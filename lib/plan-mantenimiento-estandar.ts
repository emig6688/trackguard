import "server-only";
import type { ScopedPrismaClient } from "@/lib/tenant-prisma";

/**
 * Aplica el catálogo estándar de mantenimiento preventivo (editable en el
 * mantenedor) como PlanMantenimiento de un vehículo, salteando por nombre lo
 * que ya tenga cargado — así se puede llamar tanto al crear el vehículo
 * (automático) como manualmente después de sumar ítems nuevos al catálogo.
 */
export async function aplicarPlanEstandarAVehiculo(
  prisma: ScopedPrismaClient,
  empresaId: string,
  vehiculoId: string
): Promise<number> {
  const vehiculo = await prisma.vehiculo.findUniqueOrThrow({ where: { id: vehiculoId } });
  const [catalogo, existentes] = await Promise.all([
    prisma.planMantenimientoEstandarItem.findMany({
      where: { empresaId, activo: true, eliminadoEn: null },
    }),
    prisma.planMantenimiento.findMany({ where: { vehiculoId }, select: { nombre: true } }),
  ]);
  const nombresExistentes = new Set(existentes.map((p) => p.nombre));
  const nuevos = catalogo.filter((item) => !nombresExistentes.has(item.nombre));

  if (nuevos.length > 0) {
    await prisma.planMantenimiento.createMany({
      data: nuevos.map((item) => ({
        empresaId,
        vehiculoId,
        nombre: item.nombre,
        categoria: item.categoria,
        tipoIntervalo: item.tipoIntervalo,
        intervaloKm: item.intervaloKm,
        intervaloDias: item.intervaloDias,
        intervaloHoras: item.intervaloHoras,
        kmUltimoService: vehiculo.kmActual,
        fechaUltimoService: new Date(),
        horasUltimoService: vehiculo.horasEquipoFrio,
      })),
    });
  }

  return nuevos.length;
}
