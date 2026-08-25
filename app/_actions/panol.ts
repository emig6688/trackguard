"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole, ROLES_ADMIN_MANTENIMIENTO } from "@/lib/permisos";
import { articuloSchema } from "@/lib/schemas-entidades";

export type ArticuloFormState =
  | { error?: string; fieldErrors?: Record<string, string[]> }
  | undefined;

export async function crearArticuloPanol(
  _prevState: ArticuloFormState,
  formData: FormData
): Promise<ArticuloFormState> {
  const { user, prisma } = await requireRole(ROLES_ADMIN_MANTENIMIENTO);

  const parsed = articuloSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  await prisma.articuloPanol.create({ data: { ...parsed.data, empresaId: user.empresaId! } });

  revalidatePath("/panol");
  redirect("/panol");
}

export async function actualizarArticuloPanol(
  articuloId: string,
  _prevState: ArticuloFormState,
  formData: FormData
): Promise<ArticuloFormState> {
  const { prisma } = await requireRole(ROLES_ADMIN_MANTENIMIENTO);

  const parsed = articuloSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  await prisma.articuloPanol.update({ where: { id: articuloId }, data: parsed.data });

  revalidatePath("/panol");
  redirect("/panol");
}

export async function alternarActivoArticulo(articuloId: string, activo: boolean) {
  const { prisma } = await requireRole(ROLES_ADMIN_MANTENIMIENTO);
  await prisma.articuloPanol.update({ where: { id: articuloId }, data: { activo } });
  revalidatePath("/panol");
  revalidatePath(`/panol/${articuloId}`);
}
