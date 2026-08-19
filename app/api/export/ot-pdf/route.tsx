import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireSession } from "@/lib/permisos";
import { ReporteOTDocument } from "@/lib/pdf/reporte-ot";

export const maxDuration = 60;

export async function GET(request: Request) {
  const { prisma } = await requireSession();

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta el id de la OT" }, { status: 400 });

  const ot = await prisma.ordenDeTrabajo.findUnique({
    where: { id, eliminadoEn: null },
    include: {
      vehiculo: true,
      asignadoA: true,
      creadoPor: true,
      historial: { include: { actor: true }, orderBy: { createdAt: "asc" } },
      repuestos: { where: { eliminadoEn: null } },
      facturas: { where: { eliminadoEn: null }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!ot) return NextResponse.json({ error: "OT no encontrada" }, { status: 404 });

  const buffer = await renderToBuffer(
    <ReporteOTDocument
      ot={{
        numero: ot.numero,
        titulo: ot.titulo,
        descripcion: ot.descripcion,
        estado: ot.estado,
        prioridad: ot.prioridad,
        areaReparacion: ot.areaReparacion,
        vehiculoPatente: ot.vehiculo.patente,
        asignadoANombre: ot.asignadoA?.nombre ?? null,
        creadoPorNombre: ot.creadoPor?.nombre ?? null,
        fechaLimite: ot.fechaLimite,
        fechaEstimadaFinalizacion: ot.fechaEstimadaFinalizacion,
        fechaFin: ot.fechaFin,
        observacionesMecanico: ot.observacionesMecanico,
        tiempoInsumidoMinutos: ot.tiempoInsumidoMinutos,
        repuestos: ot.repuestos.map((r) => ({
          descripcion: r.descripcion,
          cantidad: r.cantidad,
          costoUnitario: r.costoUnitario?.toString() ?? null,
        })),
        facturas: ot.facturas.map((f) => ({ monto: f.monto.toString(), createdAt: f.createdAt })),
        historial: ot.historial.map((h) => ({
          estadoAnterior: h.estadoAnterior,
          estadoNuevo: h.estadoNuevo,
          actorNombre: h.actor?.nombre ?? null,
          createdAt: h.createdAt,
        })),
      }}
    />
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${ot.numero}.pdf"`,
    },
  });
}
