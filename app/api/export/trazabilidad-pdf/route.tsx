import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireSession } from "@/lib/permisos";
import { horasEquipoFrioEnPeriodo } from "@/lib/checklist";
import { calcularEstadoVencimiento } from "@/lib/vencimientos";
import { ReporteTrazabilidadDocument } from "@/lib/pdf/reporte-trazabilidad";

// Render de PDF con varias secciones puede acercarse al límite por defecto.
export const maxDuration = 60;

// Sin rango explícito, se acota al último año — evitar exports sin límite
// sobre vehículos con años de historial.
function rangoPorDefecto(searchParams: URLSearchParams) {
  const desdeRaw = searchParams.get("desde");
  const hastaRaw = searchParams.get("hasta");
  const hasta = hastaRaw ? new Date(hastaRaw) : new Date();
  const desde = desdeRaw ? new Date(desdeRaw) : new Date(hasta.getFullYear() - 1, hasta.getMonth(), hasta.getDate());
  return { desde, hasta };
}

export async function GET(request: Request) {
  const { prisma } = await requireSession();

  const { searchParams } = new URL(request.url);
  const vehiculoId = searchParams.get("vehiculoId");
  if (!vehiculoId) return NextResponse.json({ error: "Falta el vehiculoId" }, { status: 400 });

  const { desde, hasta } = rangoPorDefecto(searchParams);

  const vehiculo = await prisma.vehiculo.findUnique({ where: { id: vehiculoId } });
  if (!vehiculo) return NextResponse.json({ error: "Vehículo no encontrado" }, { status: 404 });

  const [otsPeriodo, planesPreventivos, checklistsPeriodo, documentosVigentes, horasEquipoFrioPeriodo, eventosRutaPeriodo] =
    await Promise.all([
      prisma.ordenDeTrabajo.findMany({
        where: {
          vehiculoId,
          eliminadoEn: null,
          createdAt: { gte: desde, lte: hasta },
        },
        include: {
          repuestos: { where: { eliminadoEn: null } },
          facturas: { where: { eliminadoEn: null } },
          itemsPreventivos: { select: { planMantenimiento: { select: { tipoIntervalo: true } } } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.planMantenimiento.findMany({
        where: { vehiculoId, activo: true, eliminadoEn: null },
        orderBy: { nombre: "asc" },
      }),
      prisma.checklistRealizado.findMany({
        where: { vehiculoId, fechaHora: { gte: desde, lte: hasta } },
        select: { momento: true, resultadoGeneral: true },
      }),
      prisma.documento.findMany({
        where: { entidadTipo: "VEHICULO", entidadId: vehiculoId, activo: true, eliminadoEn: null },
        include: { tipoDocumento: true },
        orderBy: { fechaVencimiento: "asc" },
      }),
      horasEquipoFrioEnPeriodo(prisma, vehiculoId, desde, hasta),
      prisma.eventoRuta.count({ where: { vehiculoId, fechaHora: { gte: desde, lte: hasta } } }),
    ]);

  const buffer = await renderToBuffer(
    <ReporteTrazabilidadDocument
      data={{
        vehiculo: {
          patente: vehiculo.patente,
          marca: vehiculo.marca,
          modelo: vehiculo.modelo,
          kmActual: vehiculo.kmActual,
          horasEquipoFrio: vehiculo.horasEquipoFrio,
        },
        periodo: { desde, hasta },
        mantenimientos: otsPeriodo.map((ot) => ({
          numero: ot.numero,
          titulo: ot.titulo,
          areaReparacion: ot.areaReparacion,
          origen: ot.origen,
          estado: ot.estado,
          fechaAlta: ot.createdAt,
          fechaFin: ot.fechaFin,
          tiposIntervalo: [...new Set(ot.itemsPreventivos.map((i) => i.planMantenimiento.tipoIntervalo))],
          totalRepuestos: ot.repuestos.reduce(
            (acc, r) => acc + (r.costoUnitario ? Number(r.costoUnitario) * r.cantidad : 0),
            0
          ),
          totalFacturas: ot.facturas.reduce((acc, f) => acc + Number(f.monto), 0),
        })),
        planesPreventivos: planesPreventivos.map((p) => ({
          nombre: p.nombre,
          categoria: p.categoria,
          tipoIntervalo: p.tipoIntervalo,
          intervaloKm: p.intervaloKm,
          intervaloDias: p.intervaloDias,
          intervaloHoras: p.intervaloHoras,
          kmUltimoService: p.kmUltimoService,
          fechaUltimoService: p.fechaUltimoService,
          horasUltimoService: p.horasUltimoService,
        })),
        checklists: {
          okCount: checklistsPeriodo.filter((c) => c.resultadoGeneral === "OK").length,
          conFallasCount: checklistsPeriodo.filter((c) => c.resultadoGeneral === "CON_FALLAS").length,
          presalidaCount: checklistsPeriodo.filter((c) => c.momento === "PRESALIDA").length,
        },
        documentosVigentes: documentosVigentes.map((d) => ({
          tipoNombre: d.tipoDocumento.nombre,
          numeroDocumento: d.numeroDocumento,
          fechaVencimiento: d.fechaVencimiento,
          estado: calcularEstadoVencimiento(d.fechaVencimiento, d.tipoDocumento.diasAlertaDefault),
        })),
        horasEquipoFrioPeriodo,
        eventosRutaPeriodo,
      }}
    />
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="trazabilidad-${vehiculo.patente}.pdf"`,
    },
  });
}
