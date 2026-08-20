import { NextResponse } from "next/server";
import { requireSession } from "@/lib/permisos";

/**
 * Ruta temporal de diagnóstico de un solo uso — se borra después de usarse.
 */
export async function GET(request: Request) {
  const { prisma } = await requireSession();
  const { searchParams } = new URL(request.url);
  const vehiculoId = searchParams.get("vehiculoId");
  if (!vehiculoId) return NextResponse.json({ error: "Falta vehiculoId" }, { status: 400 });

  const planes = await prisma.planMantenimiento.findMany({
    where: { vehiculoId },
    select: {
      id: true,
      nombre: true,
      activo: true,
      eliminadoEn: true,
      fechaUltimoService: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { nombre: "asc" },
    take: 5,
  });

  const activos = await prisma.planMantenimiento.count({
    where: { vehiculoId, activo: true, eliminadoEn: null },
  });
  const eliminados = await prisma.planMantenimiento.count({
    where: { vehiculoId, eliminadoEn: { not: null } },
  });

  return NextResponse.json({ activos, eliminados, muestra: planes });
}
