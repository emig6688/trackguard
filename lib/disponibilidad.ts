import "server-only";
import type { ScopedPrismaClient } from "@/lib/tenant-prisma";

/**
 * Un vehículo derivado a un taller externo (OT en DERIVADA_EXTERNO, todavía
 * sin cerrar) no está en condiciones de uso aunque el encargado no haya
 * tocado el interruptor manual — se fuerza "no disponible" automáticamente.
 */
export async function vehiculosEnTallerExterno(
  prisma: ScopedPrismaClient,
  vehiculoIds?: string[]
): Promise<Set<string>> {
  const ots = await prisma.ordenDeTrabajo.findMany({
    where: {
      eliminadoEn: null,
      estado: "DERIVADA_EXTERNO",
      ...(vehiculoIds ? { vehiculoId: { in: vehiculoIds } } : {}),
    },
    select: { vehiculoId: true },
  });
  return new Set(ots.map((ot) => ot.vehiculoId));
}

export function disponibilidadEfectiva(
  vehiculo: { disponible: boolean },
  enTallerExterno: boolean
): boolean {
  return vehiculo.disponible && !enTallerExterno;
}
