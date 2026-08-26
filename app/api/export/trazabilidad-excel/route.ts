import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireEmpresa } from "@/lib/permisos";
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

export async function GET(request: Request) {
  const { prisma } = await requireEmpresa();

  const { searchParams } = new URL(request.url);
  const vehiculoId = searchParams.get("vehiculoId");
  if (!vehiculoId) return NextResponse.json({ error: "Falta el vehiculoId" }, { status: 400 });

  const { desde, hasta } = rangoExportPorDefecto(searchParams);

  const vehiculo = await prisma.vehiculo.findUnique({ where: { id: vehiculoId } });
  if (!vehiculo) return NextResponse.json({ error: "Vehículo no encontrado" }, { status: 404 });

  const [correctivos, preventivo, documentos] = await Promise.all([
    prisma.ordenDeTrabajo.findMany({
      where: {
        vehiculoId,
        eliminadoEn: null,
        createdAt: { gte: desde, lte: hasta },
        origen: { not: "PREVENTIVO" },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.ordenDeTrabajo.findMany({
      where: {
        vehiculoId,
        eliminadoEn: null,
        createdAt: { gte: desde, lte: hasta },
        origen: "PREVENTIVO",
      },
      include: {
        itemsPreventivos: { select: { planMantenimiento: { select: { tipoIntervalo: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.documento.findMany({
      where: { entidadTipo: "VEHICULO", entidadId: vehiculoId, activo: true, eliminadoEn: null },
      include: { tipoDocumento: true },
      orderBy: { fechaVencimiento: "asc" },
    }),
  ]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TruckGuard";
  workbook.created = new Date();

  const hojaCorrectivos = workbook.addWorksheet("Correctivos");
  hojaCorrectivos.columns = [
    { header: "OT", key: "numero", width: 16 },
    { header: "Título", key: "titulo", width: 28 },
    { header: "Área", key: "area", width: 16 },
    { header: "Alta", key: "alta", width: 14 },
    { header: "Estado", key: "estado", width: 20 },
    { header: "Finalización", key: "fin", width: 14 },
  ];
  hojaCorrectivos.getRow(1).font = { bold: true };
  for (const ot of correctivos) {
    hojaCorrectivos.addRow({
      numero: ot.numero,
      titulo: ot.titulo,
      area: ot.areaReparacion ?? "",
      alta: ot.createdAt,
      estado: ESTADO_OT_LABEL[ot.estado],
      fin: ot.fechaFin,
    });
  }
  hojaCorrectivos.getColumn("alta").numFmt = "dd/mm/yyyy";
  hojaCorrectivos.getColumn("fin").numFmt = "dd/mm/yyyy";

  const hojaPreventivo = workbook.addWorksheet("Preventivo");
  hojaPreventivo.columns = [
    { header: "OT", key: "numero", width: 16 },
    { header: "Alta", key: "alta", width: 14 },
    { header: "Motivo", key: "motivo", width: 20 },
    { header: "Estado", key: "estado", width: 20 },
    { header: "Finalización", key: "fin", width: 14 },
  ];
  hojaPreventivo.getRow(1).font = { bold: true };
  for (const ot of preventivo) {
    const tipos = [...new Set(ot.itemsPreventivos.map((i) => i.planMantenimiento.tipoIntervalo))];
    const motivo = tipos.length > 0 ? [...new Set(tipos.map((t) => INTERVALO_CORTO[t]))].join(", ") : "";
    hojaPreventivo.addRow({
      numero: ot.numero,
      alta: ot.createdAt,
      motivo,
      estado: ESTADO_OT_LABEL[ot.estado],
      fin: ot.fechaFin,
    });
  }
  hojaPreventivo.getColumn("alta").numFmt = "dd/mm/yyyy";
  hojaPreventivo.getColumn("fin").numFmt = "dd/mm/yyyy";

  const hojaDocumentacion = workbook.addWorksheet("Documentación");
  hojaDocumentacion.columns = [
    { header: "Tipo", key: "tipo", width: 24 },
    { header: "Número", key: "numero", width: 18 },
    { header: "Vencimiento", key: "vencimiento", width: 16 },
    { header: "Estado", key: "estado", width: 18 },
  ];
  hojaDocumentacion.getRow(1).font = { bold: true };
  for (const d of documentos) {
    hojaDocumentacion.addRow({
      tipo: d.tipoDocumento.nombre,
      numero: d.numeroDocumento,
      vencimiento: d.fechaVencimiento,
      estado: ESTADO_VENCIMIENTO_LABEL[calcularEstadoVencimiento(d.fechaVencimiento, d.tipoDocumento.diasAlertaDefault)],
    });
  }
  hojaDocumentacion.getColumn("vencimiento").numFmt = "dd/mm/yyyy";

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="trazabilidad-${vehiculo.patente}.xlsx"`,
    },
  });
}
