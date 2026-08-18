"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole, ROLES_ADMIN_MANTENIMIENTO } from "@/lib/permisos";

const tallerSchema = z.object({
  nombre: z.string().trim().min(1, "Nombre requerido"),
  contactoNombre: z.string().trim().optional(),
  telefono: z.string().trim().optional(),
  email: z.string().trim().email("Email inválido").optional().or(z.literal("")),
  direccion: z.string().trim().optional(),
  especialidad: z.string().trim().optional(),
});

export type TallerFormState =
  | { error?: string; fieldErrors?: Record<string, string[]> }
  | undefined;

export async function crearTallerExterno(
  _prevState: TallerFormState,
  formData: FormData
): Promise<TallerFormState> {
  const { user, prisma } = await requireRole(ROLES_ADMIN_MANTENIMIENTO);

  const parsed = tallerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  await prisma.tallerExterno.create({ data: { ...parsed.data, empresaId: user.empresaId! } });

  revalidatePath("/talleres-externos");
  redirect("/talleres-externos");
}

export async function actualizarTallerExterno(
  tallerId: string,
  _prevState: TallerFormState,
  formData: FormData
): Promise<TallerFormState> {
  const { prisma } = await requireRole(ROLES_ADMIN_MANTENIMIENTO);

  const parsed = tallerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  await prisma.tallerExterno.update({ where: { id: tallerId }, data: parsed.data });

  revalidatePath("/talleres-externos");
  redirect("/talleres-externos");
}

export async function alternarActivoTaller(tallerId: string, activo: boolean) {
  const { prisma } = await requireRole(ROLES_ADMIN_MANTENIMIENTO);
  await prisma.tallerExterno.update({ where: { id: tallerId }, data: { activo } });
  revalidatePath("/talleres-externos");
}
