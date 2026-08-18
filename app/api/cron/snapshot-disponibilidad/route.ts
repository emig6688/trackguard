import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { disponibilidadEfectiva } from "@/lib/disponibilidad";

/**
 * Corre una vez al día (ver vercel.json). Guarda, para cada vehículo activo,
 * un snapshot de disponibilidad efectiva (interruptor manual && no derivado a
 * taller externo) — arranca a registrarse desde que se creó este cron, sin
 * historial retroactivo, para poder calcular después un % de disponibilidad
 * mensual real de la flota (ver DisponibilidadSnapshot en el schema).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const [vehiculos, otsEnTaller] = await Promise.all([
    prisma.vehiculo.findMany({
      where: { activo: true, eliminadoEn: null },
      select: { id: true, empresaId: true, disponible: true },
    }),
    prisma.ordenDeTrabajo.findMany({
      where: { eliminadoEn: null, estado: "DERIVADA_EXTERNO" },
      select: { vehiculoId: true },
    }),
  ]);

  const enTaller = new Set(otsEnTaller.map((ot) => ot.vehiculoId));
  const hoy = new Date();
  const fecha = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()));

  let registrados = 0;
  for (const vehiculo of vehiculos) {
    await prisma.disponibilidadSnapshot.upsert({
      where: { vehiculoId_fecha: { vehiculoId: vehiculo.id, fecha } },
      create: {
        empresaId: vehiculo.empresaId,
        vehiculoId: vehiculo.id,
        fecha,
        disponible: disponibilidadEfectiva(vehiculo, enTaller.has(vehiculo.id)),
      },
      update: {
        disponible: disponibilidadEfectiva(vehiculo, enTaller.has(vehiculo.id)),
      },
    });
    registrados++;
  }

  return NextResponse.json({ registrados });
}
