"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole, ROLES_ADMIN_MANTENIMIENTO } from "@/lib/permisos";
import { crearChoferSchema } from "@/lib/schemas-entidades";

const actualizarChoferSchema = crearChoferSchema.omit({ password: true }).extend({
  password: z.string().min(6, "Mínimo 6 caracteres").optional().or(z.literal("")),
});

export type ChoferFormState =
  | { error?: string; fieldErrors?: Record<string, string[]> }
  | undefined;

export async function crearChofer(
  _prevState: ChoferFormState,
  formData: FormData
): Promise<ChoferFormState> {
  const { user, prisma } = await requireRole(ROLES_ADMIN_MANTENIMIENTO);

  const parsed = crearChoferSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { email, dni, password, nombre, telefono, ...perfil } = parsed.data;

  // email/dni son únicos en toda la tabla (no por empresa): el login busca
  // por esos campos sin saber todavía a qué empresa pertenece el usuario.
  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) {
    return { error: "Ya existe un usuario con ese email." };
  }
  if (dni) {
    const dniExistente = await prisma.usuario.findUnique({ where: { dni } });
    if (dniExistente) {
      return { error: "Ya existe un usuario con ese DNI." };
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const usuario = await prisma.usuario.create({
    data: {
      empresaId: user.empresaId!,
      email,
      dni,
      passwordHash,
      nombre,
      telefono,
      rol: "CHOFER",
      perfilChofer: { create: perfil },
    },
  });

  revalidatePath("/choferes");
  redirect(`/choferes/${usuario.id}`);
}

export async function actualizarChofer(
  choferId: string,
  _prevState: ChoferFormState,
  formData: FormData
): Promise<ChoferFormState> {
  const { user, prisma } = await requireRole(ROLES_ADMIN_MANTENIMIENTO);

  const parsed = actualizarChoferSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { nombre, telefono, dni, email, password, ...perfil } = parsed.data;

  // email/dni son únicos en toda la tabla (no por empresa): ver crearChofer.
  const emailExistente = await prisma.usuario.findFirst({
    where: { email, id: { not: choferId } },
  });
  if (emailExistente) {
    return { error: "Ya existe un usuario con ese email." };
  }
  if (dni) {
    const dniExistente = await prisma.usuario.findFirst({
      where: { dni, id: { not: choferId } },
    });
    if (dniExistente) {
      return { error: "Ya existe un usuario con ese DNI." };
    }
  }

  await prisma.usuario.update({
    where: { id: choferId, empresaId: user.empresaId! },
    data: {
      nombre,
      email,
      telefono,
      dni: dni ?? null,
      ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
      perfilChofer: {
        upsert: { create: perfil, update: perfil },
      },
    },
  });

  revalidatePath("/choferes");
  revalidatePath(`/choferes/${choferId}`);
  redirect(`/choferes/${choferId}`);
}

const bajaSchema = z.object({
  observacion: z.string().trim().min(1, "Indicá el motivo de la baja"),
});

export async function darDeBajaChofer(choferId: string, formData: FormData) {
  const { user, prisma } = await requireRole(ROLES_ADMIN_MANTENIMIENTO);
  const parsed = bajaSchema.parse(Object.fromEntries(formData));

  await prisma.usuario.update({
    where: { id: choferId, empresaId: user.empresaId! },
    data: { activo: false, observacionBaja: parsed.observacion, fechaBaja: new Date() },
  });
  revalidatePath("/choferes");
  revalidatePath(`/choferes/${choferId}`);
}

export async function reactivarChofer(choferId: string) {
  const { user, prisma } = await requireRole(ROLES_ADMIN_MANTENIMIENTO);
  await prisma.usuario.update({
    where: { id: choferId, empresaId: user.empresaId! },
    data: { activo: true, observacionBaja: null, fechaBaja: null },
  });
  revalidatePath("/choferes");
  revalidatePath(`/choferes/${choferId}`);
}
