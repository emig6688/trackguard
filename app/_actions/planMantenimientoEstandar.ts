"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole, ROLES_ADMIN_MANTENIMIENTO } from "@/lib/permisos";
import { optionalInt } from "@/lib/zod-helpers";

const RUTA = "/mantenimiento-estandar";

const itemSchema = z.object({
  categoria: z.string().trim().min(1, "Categoría requerida"),
  nombre: z.string().trim().min(1, "Nombre requerido"),
  tipoIntervalo: z.enum(["KM", "TIEMPO", "HORAS", "AMBOS"]),
  intervaloKm: optionalInt(),
  intervaloDias: optionalInt(),
  intervaloHoras: optionalInt(),
});

export type ItemCatalogoFormState =
  | { error?: string; fieldErrors?: Record<string, string[]>; success?: boolean }
  | undefined;

export async function crearItemCatalogoEstandar(
  _prevState: ItemCatalogoFormState,
  formData: FormData
): Promise<ItemCatalogoFormState> {
  const { user, prisma } = await requireRole(ROLES_ADMIN_MANTENIMIENTO);

  const parsed = itemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  await prisma.planMantenimientoEstandarItem.create({
    data: { ...parsed.data, empresaId: user.empresaId! },
  });

  revalidatePath(RUTA);
  return { success: true };
}

export async function actualizarItemCatalogoEstandar(
  itemId: string,
  _prevState: ItemCatalogoFormState,
  formData: FormData
): Promise<ItemCatalogoFormState> {
  const { prisma } = await requireRole(ROLES_ADMIN_MANTENIMIENTO);

  const parsed = itemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  await prisma.planMantenimientoEstandarItem.update({
    where: { id: itemId },
    data: parsed.data,
  });

  revalidatePath(RUTA);
  return { success: true };
}

export async function alternarActivoItemCatalogoEstandar(itemId: string, activo: boolean) {
  const { prisma } = await requireRole(ROLES_ADMIN_MANTENIMIENTO);
  await prisma.planMantenimientoEstandarItem.update({ where: { id: itemId }, data: { activo } });
  revalidatePath(RUTA);
}
