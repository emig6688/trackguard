"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/permisos";
import { normalizarDni } from "@/lib/zod-helpers";

const ROLES_USUARIO = [
  "ADMIN",
  "ENCARGADO_MANTENIMIENTO",
  "ENCARGADO_COMPRAS",
  "MECANICO_INTERNO",
  "GERENTE",
  "CONTADOR",
  "GUARDIA",
] as const;

const dniSchema = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? normalizarDni(v) : undefined));

const crearUsuarioSchema = z.object({
  nombre: z.string().trim().min(1, "Nombre requerido"),
  email: z.string().trim().email("Email inválido"),
  dni: dniSchema,
  password: z.string().min(6, "Mínimo 6 caracteres"),
  telefono: z.string().trim().optional(),
  rol: z.enum(ROLES_USUARIO),
});

const actualizarUsuarioSchema = z.object({
  nombre: z.string().trim().min(1, "Nombre requerido"),
  email: z.string().trim().email("Email inválido"),
  dni: dniSchema,
  password: z.string().min(6, "Mínimo 6 caracteres").optional().or(z.literal("")),
  telefono: z.string().trim().optional(),
  rol: z.enum(ROLES_USUARIO),
});

export type UsuarioFormState =
  | { error?: string; fieldErrors?: Record<string, string[]> }
  | undefined;

export async function crearUsuario(
  _prevState: UsuarioFormState,
  formData: FormData
): Promise<UsuarioFormState> {
  const { user, prisma } = await requireRole(["ADMIN"]);

  const parsed = crearUsuarioSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  // email/dni son únicos en toda la tabla (no por empresa): el login busca
  // por esos campos sin saber todavía a qué empresa pertenece el usuario.
  const existente = await prisma.usuario.findUnique({ where: { email: parsed.data.email } });
  if (existente) {
    return { error: "Ya existe un usuario con ese email." };
  }
  if (parsed.data.dni) {
    const dniExistente = await prisma.usuario.findUnique({ where: { dni: parsed.data.dni } });
    if (dniExistente) {
      return { error: "Ya existe un usuario con ese DNI." };
    }
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  await prisma.usuario.create({
    data: {
      empresaId: user.empresaId!,
      email: parsed.data.email,
      dni: parsed.data.dni,
      passwordHash,
      nombre: parsed.data.nombre,
      telefono: parsed.data.telefono,
      rol: parsed.data.rol,
    },
  });

  revalidatePath("/usuarios");
  redirect("/usuarios");
}

export async function actualizarUsuario(
  usuarioId: string,
  _prevState: UsuarioFormState,
  formData: FormData
): Promise<UsuarioFormState> {
  const { user, prisma } = await requireRole(["ADMIN"]);

  const parsed = actualizarUsuarioSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { nombre, email, dni, telefono, rol, password } = parsed.data;

  const emailExistente = await prisma.usuario.findFirst({
    where: { email, id: { not: usuarioId } },
  });
  if (emailExistente) {
    return { error: "Ya existe un usuario con ese email." };
  }
  if (dni) {
    const dniExistente = await prisma.usuario.findFirst({
      where: { dni, id: { not: usuarioId } },
    });
    if (dniExistente) {
      return { error: "Ya existe un usuario con ese DNI." };
    }
  }

  await prisma.usuario.update({
    where: { id: usuarioId, empresaId: user.empresaId! },
    data: {
      nombre,
      email,
      dni: dni ?? null,
      telefono,
      rol,
      ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
    },
  });

  revalidatePath("/usuarios");
  revalidatePath(`/usuarios/${usuarioId}`);
  redirect(`/usuarios/${usuarioId}`);
}

const bajaSchema = z.object({
  observacion: z.string().trim().min(1, "Indicá el motivo de la baja"),
});

export async function darDeBajaUsuario(usuarioId: string, formData: FormData) {
  const { user, prisma } = await requireRole(["ADMIN"]);
  const parsed = bajaSchema.parse(Object.fromEntries(formData));

  await prisma.usuario.update({
    where: { id: usuarioId, empresaId: user.empresaId! },
    data: { activo: false, observacionBaja: parsed.observacion, fechaBaja: new Date() },
  });
  revalidatePath("/usuarios");
  revalidatePath(`/usuarios/${usuarioId}`);
}

export async function reactivarUsuario(usuarioId: string) {
  const { user, prisma } = await requireRole(["ADMIN"]);
  await prisma.usuario.update({
    where: { id: usuarioId, empresaId: user.empresaId! },
    data: { activo: true, observacionBaja: null, fechaBaja: null },
  });
  revalidatePath("/usuarios");
  revalidatePath(`/usuarios/${usuarioId}`);
}
