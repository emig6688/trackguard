import { NextResponse } from "next/server";
import { requireSession } from "@/lib/permisos";
import { generarCsv } from "@/lib/csv";

export async function GET() {
  const { prisma } = await requireSession();

  const ordenes = await prisma.ordenDeTrabajo.findMany({
    where: { eliminadoEn: null },
    include: { vehiculo: true, asignadoA: true },
    orderBy: { createdAt: "desc" },
  });

  const csv = generarCsv(
    ["Número", "Vehículo", "Origen", "Título", "Prioridad", "Estado", "Asignado a", "Creada"],
    ordenes.map((ot) => [
      ot.numero,
      ot.vehiculo.patente,
      ot.origen,
      ot.titulo,
      ot.prioridad,
      ot.estado,
      ot.asignadoA?.nombre,
      ot.createdAt.toISOString(),
    ])
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="ordenes-de-trabajo.csv"',
    },
  });
}
