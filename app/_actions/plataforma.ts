"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperadmin } from "@/lib/permisos";

const crearEmpresaSchema = z.object({
  nombreEmpresa: z.string().trim().min(1, "Nombre de la empresa requerido"),
  nombreAdmin: z.string().trim().min(1, "Nombre del administrador requerido"),
  email: z.string().trim().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

export type CrearEmpresaState =
  | { error?: string; fieldErrors?: Record<string, string[]> }
  | undefined;

/**
 * Da de alta una empresa nueva junto con su primer usuario ADMIN, en una sola
 * transacción — si falla la creación del usuario (ej. email duplicado), no
 * queda una empresa huérfana sin nadie que pueda entrar a administrarla.
 */
export async function crearEmpresa(
  _prevState: CrearEmpresaState,
  formData: FormData
): Promise<CrearEmpresaState> {
  const { prisma } = await requireSuperadmin();

  const parsed = crearEmpresaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const existente = await prisma.usuario.findUnique({ where: { email: parsed.data.email } });
  if (existente) {
    return { error: "Ya existe un usuario con ese email." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  await prisma.empresa.create({
    data: {
      nombre: parsed.data.nombreEmpresa,
      usuarios: {
        create: {
          nombre: parsed.data.nombreAdmin,
          email: parsed.data.email,
          passwordHash,
          rol: "ADMIN",
        },
      },
    },
  });

  revalidatePath("/plataforma");
  redirect("/plataforma");
}

export async function alternarActivoEmpresa(empresaId: string, activo: boolean) {
  const { prisma } = await requireSuperadmin();
  await prisma.empresa.update({ where: { id: empresaId }, data: { activo } });
  revalidatePath("/plataforma");
}

const actualizarEmpresaSchema = z.object({
  nombre: z.string().trim().min(1, "Nombre de la empresa requerido"),
  emailContacto: z.string().trim().email("Email inválido").optional().or(z.literal("")),
  telefono: z.string().trim().optional(),
  direccion: z.string().trim().optional(),
  contactoNombre: z.string().trim().optional(),
});

export type ActualizarEmpresaState =
  | { error?: string; fieldErrors?: Record<string, string[]> }
  | undefined;

export async function actualizarEmpresa(
  empresaId: string,
  _prevState: ActualizarEmpresaState,
  formData: FormData
): Promise<ActualizarEmpresaState> {
  const { prisma } = await requireSuperadmin();

  const parsed = actualizarEmpresaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  await prisma.empresa.update({
    where: { id: empresaId },
    data: {
      nombre: parsed.data.nombre,
      emailContacto: parsed.data.emailContacto || null,
      telefono: parsed.data.telefono || null,
      direccion: parsed.data.direccion || null,
      contactoNombre: parsed.data.contactoNombre || null,
    },
  });

  revalidatePath("/plataforma");
  revalidatePath(`/plataforma/${empresaId}`);
  return undefined;
}

const actualizarAdminEmpresaSchema = z.object({
  nombre: z.string().trim().min(1, "Nombre requerido"),
  email: z.string().trim().email("Email inválido"),
  telefono: z.string().trim().optional(),
  password: z.string().min(6, "Mínimo 6 caracteres").optional().or(z.literal("")),
});

export type ActualizarAdminEmpresaState =
  | { error?: string; fieldErrors?: Record<string, string[]> }
  | undefined;

/**
 * El superadmin puede setear/resetear el usuario y la contraseña de ingreso
 * del ADMIN de un cliente (ej. si perdió el acceso). Se verifica que el
 * usuario efectivamente sea ADMIN de esa empresa antes de tocarlo, para que
 * este endpoint no sirva para editar cualquier usuario por id.
 */
export async function actualizarAdminEmpresa(
  usuarioId: string,
  empresaId: string,
  _prevState: ActualizarAdminEmpresaState,
  formData: FormData
): Promise<ActualizarAdminEmpresaState> {
  const { prisma } = await requireSuperadmin();

  const parsed = actualizarAdminEmpresaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const admin = await prisma.usuario.findFirst({
    where: { id: usuarioId, empresaId, rol: "ADMIN" },
  });
  if (!admin) {
    return { error: "No se encontró ese administrador para esta empresa." };
  }

  const emailExistente = await prisma.usuario.findFirst({
    where: { email: parsed.data.email, id: { not: usuarioId } },
  });
  if (emailExistente) {
    return { error: "Ya existe un usuario con ese email." };
  }

  await prisma.usuario.update({
    where: { id: usuarioId },
    data: {
      nombre: parsed.data.nombre,
      email: parsed.data.email,
      telefono: parsed.data.telefono || null,
      ...(parsed.data.password ? { passwordHash: await bcrypt.hash(parsed.data.password, 10) } : {}),
    },
  });

  revalidatePath(`/plataforma/${empresaId}`);
  return undefined;
}
