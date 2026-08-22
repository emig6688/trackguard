import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireSession } from "@/lib/permisos";
import { ReporteOrdenesTrabajoDocument, type FilaOT } from "@/lib/pdf/reporte-ordenes-trabajo";

export const maxDuration = 60;

export async function GET() {
  const { prisma } = await requireSession();

  const ordenes = await prisma.ordenDeTrabajo.findMany({
    where: { eliminadoEn: null },
    include: { vehiculo: true, asignadoA: true },
    orderBy: { createdAt: "desc" },
  });

  const filas: FilaOT[] = ordenes.map((ot) => ({
    numero: ot.numero,
    vehiculo: ot.vehiculo.patente,
    origen: ot.origen,
    titulo: ot.titulo,
    prioridad: ot.prioridad,
    estado: ot.estado,
    asignadoA: ot.asignadoA?.nombre ?? "",
    creada: ot.createdAt.toLocaleDateString("es-AR"),
  }));

  const buffer = await renderToBuffer(<ReporteOrdenesTrabajoDocument filas={filas} />);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="ordenes-de-trabajo.pdf"',
    },
  });
}
