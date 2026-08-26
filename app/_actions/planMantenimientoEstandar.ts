"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole, ROLES_ADMIN_MANTENIMIENTO } from "@/lib/permisos";
import { optionalInt } from "@/lib/zod-helpers";
import { CATALOGO_MANTENIMIENTO_ESTANDAR } from "@/lib/catalogo-mantenimiento";

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

/**
 * Carga el catálogo estándar genérico (lib/catalogo-mantenimiento.ts) en el
 * catálogo de la empresa — pensado para una empresa que quedó sin catálogo
 * (altas anteriores a que esto se sembrara solo en crearEmpresa, ver
 * app/_actions/plataforma.ts) o que simplemente quiere partir de la base
 * genérica en vez de cargar todo a mano. Salta por nombre lo que ya esté
 * cargado (activo o no), así que es seguro correrlo más de una vez.
 */
export async function cargarCatalogoEstandar(): Promise<{ agregados: number }> {
  const { user, prisma } = await requireRole(ROLES_ADMIN_MANTENIMIENTO);

  const existentes = await prisma.planMantenimientoEstandarItem.findMany({
    select: { nombre: true },
  });
  const nombresExistentes = new Set(existentes.map((i) => i.nombre));
  const nuevos = CATALOGO_MANTENIMIENTO_ESTANDAR.filter((item) => !nombresExistentes.has(item.nombre));

  if (nuevos.length > 0) {
    await prisma.planMantenimientoEstandarItem.createMany({
      data: nuevos.map((item) => ({
        empresaId: user.empresaId!,
        categoria: item.categoria,
        nombre: item.nombre,
        tipoIntervalo: item.tipoIntervalo,
        intervaloKm: item.intervaloKm,
        intervaloDias: item.intervaloDias,
        intervaloHoras: item.intervaloHoras,
      })),
    });
  }

  revalidatePath(RUTA);
  return { agregados: nuevos.length };
}
