"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole, ROLES_ADMIN_MANTENIMIENTO } from "@/lib/permisos";

export type SensorFrioState = { error?: string } | undefined;

const sensorSchema = z.object({
  dispositivoId: z.string().trim().min(1, "Falta el ID del dispositivo."),
});

/**
 * Alta/edición del sensor de frío de un vehículo — un solo sensor por
 * vehículo (upsert por vehiculoId). dispositivoId es el identificador que
 * Flespi manda en cada webhook (ver app/api/telemetria/frio/route.ts) para
 * saber a qué vehículo pertenece la lectura; es único en toda la base (no
 * por empresa) porque lo asigna Flespi/Rinho, no nosotros.
 */
export async function guardarSensorFrio(
  vehiculoId: string,
  _prevState: SensorFrioState,
  formData: FormData
): Promise<SensorFrioState> {
  const { user, prisma } = await requireRole(ROLES_ADMIN_MANTENIMIENTO);

  const parsed = sensorSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors.dispositivoId?.[0] ?? "Datos inválidos." };
  }

  try {
    await prisma.sensorFrio.upsert({
      where: { vehiculoId },
      create: { empresaId: user.empresaId!, vehiculoId, dispositivoId: parsed.data.dispositivoId },
      update: { dispositivoId: parsed.data.dispositivoId, activo: true },
    });
  } catch {
    return { error: "Ese ID de dispositivo ya está asignado a otro vehículo." };
  }

  await prisma.vehiculo.update({ where: { id: vehiculoId }, data: { tieneSensorFrio: true } });

  revalidatePath(`/vehiculos/${vehiculoId}`);
  revalidatePath("/calidad");
}

/**
 * Desactiva el sensor sin borrar el historial de lecturas/alertas — el
 * vehículo deja de esperarse en /calidad y el webhook de Flespi para ese
 * dispositivo pasa a rechazarse (ver "!sensor.activo" en la ingesta).
 */
export async function desactivarSensorFrio(vehiculoId: string) {
  const { prisma } = await requireRole(ROLES_ADMIN_MANTENIMIENTO);

  await prisma.sensorFrio.updateMany({ where: { vehiculoId }, data: { activo: false } });
  await prisma.vehiculo.update({ where: { id: vehiculoId }, data: { tieneSensorFrio: false } });

  revalidatePath(`/vehiculos/${vehiculoId}`);
  revalidatePath("/calidad");
}
