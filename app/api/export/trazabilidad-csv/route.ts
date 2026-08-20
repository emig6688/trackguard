import { NextResponse } from "next/server";
import { requireSession } from "@/lib/permisos";
import { generarCsv } from "@/lib/csv";
import { rangoExportPorDefecto } from "@/lib/export-rango";
import { calcularEstadoVencimiento, ESTADO_VENCIMIENTO_LABEL } from "@/lib/vencimientos";
import type { EstadoOT, TipoIntervaloPlan } from "@/app/generated/prisma/client";

const ESTADO_OT_LABEL: Record<EstadoOT, string> = {
  PENDIENTE_APROBACION: "Pendiente de aprobación",
  APROBADA: "Aprobada",
  EN_PROGRESO: "En progreso",
  DERIVADA_EXTERNO: "Derivada a externo",
  COMPLETADA: "Completada",
  CANCELADA: "Cancelada",
};

const INTERVALO_CORTO: Record<TipoIntervaloPlan, string> = {
  KM: "Km",
  TIEMPO: "Días",
  HORAS: "Horas",
  AMBOS: "Km/Días/Horas",
};

function formatearFecha(fecha: Date | null) {
  return fecha ? fecha.toLocaleDateString("es-AR") : "";
}

export async function GET(request: Request) {
  const { prisma } = await requireSession();

  const { searchParams } = new URL(request.url);
  const vehiculoId = searchParams.get("vehiculoId");
  if (!vehiculoId) return NextResponse.json({ error: "Falta el vehiculoId" }, { status: 400 });

  const tipo = searchParams.get("tipo") || "mantenimientos";
  const { desde, hasta } = rangoExportPorDefecto(searchParams);

  const vehiculo = await prisma.vehiculo.findUnique({ where: { id: vehiculoId } });
  if (!vehiculo) return NextResponse.json({ error: "Vehículo no encontrado" }, { status: 404 });

  if (tipo === "documentacion") {
    const documentos = await prisma.documento.findMany({
      where: { entidadTipo: "VEHICULO", entidadId: vehiculoId, activo: true, eliminadoEn: null },
      include: { tipoDocumento: true },
      orderBy: { fechaVencimiento: "asc" },
    });
    const csv = generarCsv(
      ["Tipo", "Número", "Vencimiento", "Estado"],
      documentos.map((d) => [
        d.tipoDocumento.nombre,
        d.numeroDocumento,
        formatearFecha(d.fechaVencimiento),
        ESTADO_VENCIMIENTO_LABEL[calcularEstadoVencimiento(d.fechaVencimiento, d.tipoDocumento.diasAlertaDefault)],
      ])
    );
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="trazabilidad-${vehiculo.patente}-documentacion.csv"`,
      },
    });
  }

  const esPreventivo = tipo === "preventivo";
  const ots = await prisma.ordenDeTrabajo.findMany({
    where: {
      vehiculoId,
      eliminadoEn: null,
      createdAt: { gte: desde, lte: hasta },
      origen: esPreventivo ? "PREVENTIVO" : { not: "PREVENTIVO" },
    },
    include: {
      itemsPreventivos: { select: { planMantenimiento: { select: { tipoIntervalo: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const encabezados = esPreventivo
    ? ["OT", "Alta", "Motivo", "Estado", "Finalización"]
    : ["OT", "Título", "Área", "Alta", "Estado", "Finalización"];

  const filas = ots.map((ot) => {
    const tipos = [...new Set(ot.itemsPreventivos.map((i) => i.planMantenimiento.tipoIntervalo))];
    const motivo = tipos.length > 0 ? [...new Set(tipos.map((t) => INTERVALO_CORTO[t]))].join(", ") : "";
    return esPreventivo
      ? [ot.numero, formatearFecha(ot.createdAt), motivo, ESTADO_OT_LABEL[ot.estado], formatearFecha(ot.fechaFin)]
      : [
          ot.numero,
          ot.titulo,
          ot.areaReparacion ?? "",
          formatearFecha(ot.createdAt),
          ESTADO_OT_LABEL[ot.estado],
          formatearFecha(ot.fechaFin),
        ];
  });

  const csv = generarCsv(encabezados, filas);
  const sufijo = esPreventivo ? "preventivo" : "correctivos";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="trazabilidad-${vehiculo.patente}-${sufijo}.csv"`,
    },
  });
}
