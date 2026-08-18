"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole, ROLES_ADMIN_MANTENIMIENTO } from "@/lib/permisos";
import { optionalInt } from "@/lib/zod-helpers";
import { aplicarPlanEstandarAVehiculo } from "@/lib/plan-mantenimiento-estandar";

const planSchema = z.object({
  vehiculoId: z.string().min(1),
  nombre: z.string().trim().min(1, "Nombre requerido"),
  categoria: z.string().trim().optional(),
  tipoIntervalo: z.enum(["KM", "TIEMPO", "HORAS", "AMBOS"]),
  intervaloKm: optionalInt(),
  intervaloDias: optionalInt(),
  intervaloHoras: optionalInt(),
});

export type PlanFormState =
  | { error?: string; fieldErrors?: Record<string, string[]>; success?: boolean }
  | undefined;

export async function crearPlanMantenimiento(
  redirectPath: string,
  _prevState: PlanFormState,
  formData: FormData
): Promise<PlanFormState> {
  const { user, prisma } = await requireRole(ROLES_ADMIN_MANTENIMIENTO);

  const parsed = planSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const vehiculo = await prisma.vehiculo.findUniqueOrThrow({ where: { id: parsed.data.vehiculoId } });

  await prisma.planMantenimiento.create({
    data: {
      ...parsed.data,
      empresaId: user.empresaId!,
      kmUltimoService: vehiculo.kmActual,
      fechaUltimoService: new Date(),
      horasUltimoService: vehiculo.horasEquipoFrio,
    },
  });

  revalidatePath(redirectPath);
  return { success: true };
}

export async function alternarActivoPlan(planId: string, activo: boolean, redirectPath: string) {
  const { prisma } = await requireRole(ROLES_ADMIN_MANTENIMIENTO);
  await prisma.planMantenimiento.update({ where: { id: planId }, data: { activo } });
  revalidatePath(redirectPath);
}

export type AplicarPlanEstandarState = { aplicados: number } | undefined;

/**
 * Re-sincroniza el plan de un vehículo con el catálogo estándar editable
 * (mantenedor) — para vehículos ya creados, cuando se suman ítems nuevos al
 * catálogo después de su alta. Los vehículos nuevos ya lo reciben solos al
 * crearse (ver crearVehiculo en app/_actions/vehiculos.ts).
 */
export async function aplicarPlanEstandar(
  vehiculoId: string,
  redirectPath: string
): Promise<AplicarPlanEstandarState> {
  const { user, prisma } = await requireRole(ROLES_ADMIN_MANTENIMIENTO);
  const aplicados = await aplicarPlanEstandarAVehiculo(prisma, user.empresaId!, vehiculoId);
  revalidatePath(redirectPath);
  return { aplicados };
}

export type AplicarPlanEstandarFlotaState = { aplicados: number; vehiculos: number } | undefined;

/**
 * Igual que aplicarPlanEstandar pero para varios vehículos de una sola vez
 * — se usa desde el botón "Aplicar a flota" del mantenedor, para no tener
 * que entrar vehículo por vehículo cuando se suma una tarea nueva al
 * catálogo estándar.
 */
export async function aplicarPlanEstandarAFlota(
  vehiculoIds: string[]
): Promise<AplicarPlanEstandarFlotaState> {
  const { user, prisma } = await requireRole(ROLES_ADMIN_MANTENIMIENTO);
  if (vehiculoIds.length === 0) return { aplicados: 0, vehiculos: 0 };

  let aplicados = 0;
  for (const vehiculoId of vehiculoIds) {
    aplicados += await aplicarPlanEstandarAVehiculo(prisma, user.empresaId!, vehiculoId);
  }

  revalidatePath("/mantenimiento-estandar");
  revalidatePath("/vehiculos");
  return { aplicados, vehiculos: vehiculoIds.length };
}
