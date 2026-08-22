import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { scopedPrisma } from "@/lib/tenant-prisma";
import type { ScopedPrismaClient } from "@/lib/tenant-prisma";
import type { Session } from "next-auth";
import type { Rol } from "@/app/generated/prisma/client";

export const ROLES_ADMIN_MANTENIMIENTO: Rol[] = ["ADMIN", "ENCARGADO_MANTENIMIENTO"];
export const ROLES_SOLO_LECTURA: Rol[] = ["GERENTE", "CONTADOR"];
export const ROLES_MOBILE_CHOFER: Rol[] = ["CHOFER"];
// ADMIN y GERENTE entran también a las pantallas de guardia (ver y actuar
// igual que el guardia, sin necesitar loguearse con ese usuario).
export const ROLES_GUARDIA: Rol[] = ["GUARDIA", "ADMIN", "GERENTE"];
// Quien ejecuta/aprueba la compra (marca realizada, carga factura, cancela, asigna a una OT).
export const ROLES_COMPRAS: Rol[] = ["ADMIN", "ENCARGADO_COMPRAS"];
// Quien puede pedir una compra manual: además de compras, mantenimiento sabe
// qué repuesto necesita, y el mecánico interno la pide desde la OT que tiene
// asignada (queda sujeta a la autorización de encargado de mantenimiento —
// ver ROLES_AUTORIZAR_COMPRA_MECANICO).
export const ROLES_CREAR_COMPRA: Rol[] = [
  "ADMIN",
  "ENCARGADO_MANTENIMIENTO",
  "ENCARGADO_COMPRAS",
  "MECANICO_INTERNO",
];
// Quien aprueba/rechaza una compra sujeta a autorización de gerencia y ve /autorizaciones.
export const ROLES_AUTORIZAR_COMPRA: Rol[] = ["GERENTE", "ADMIN"];
// Quien aprueba/rechaza una compra de un mecánico sujeta a autorización de
// mantenimiento (compuerta aparte de la de gerencia de arriba).
export const ROLES_AUTORIZAR_COMPRA_MECANICO: Rol[] = ["ENCARGADO_MANTENIMIENTO", "ADMIN"];
// Quien puede reasignar a otro mecánico una OT aprobada que todavía no
// arrancó — un mecánico interno nunca puede reasignarse ni reasignar a
// otro, ni siquiera la OT que tiene asignada.
export const ROLES_REASIGNAR_MECANICO: Rol[] = ["ADMIN", "ENCARGADO_MANTENIMIENTO", "GERENTE"];

export class AutorizacionError extends Error {
  constructor(message = "No tenés permisos para realizar esta acción.") {
    super(message);
    this.name = "AutorizacionError";
  }
}

type SessionUser = Session["user"];

/**
 * Todo lo que corre dentro de una empresa (Server Actions y Server
 * Components de `(admin)`/`(mobile)`) pasa por acá para obtener tanto el
 * usuario autenticado como un cliente de Prisma ya filtrado por su
 * `empresaId` — así ninguna consulta hecha con ese `prisma` puede leer ni
 * escribir datos de otra empresa (ver lib/tenant-prisma.ts). SUPERADMIN no
 * tiene empresa, así que nunca pasa esta barrera; usa requireSuperadmin().
 */
function contextoEmpresa(user: SessionUser) {
  if (!user.empresaId) {
    throw new AutorizacionError();
  }
  return { user, prisma: scopedPrisma(user.empresaId) };
}

/**
 * Barrera real de autorización para Server Actions. El proxy solo bloquea
 * navegación de páginas; cada mutación debe validar el rol acá.
 */
export async function requireRole(rolesPermitidos: Rol[]) {
  const session = await auth();
  if (!session?.user || !rolesPermitidos.includes(session.user.rol)) {
    throw new AutorizacionError();
  }
  return contextoEmpresa(session.user);
}

export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    throw new AutorizacionError("Debés iniciar sesión.");
  }
  return contextoEmpresa(session.user);
}

/**
 * Equivalente a requireSession/requireRole pero para Server Components
 * (páginas), que redirigen en vez de tirar una excepción sin manejar.
 */
export async function requireEmpresa(rolesPermitidos?: Rol[]) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (rolesPermitidos && !rolesPermitidos.includes(session.user.rol)) redirect("/dashboard");
  if (!session.user.empresaId) redirect("/plataforma");
  return { user: session.user, prisma: scopedPrisma(session.user.empresaId) };
}

/**
 * Solo para las rutas de /plataforma: SUPERADMIN gestiona empresas, no datos
 * de una empresa en particular, así que usa el cliente de Prisma crudo (sin
 * scoping) directamente.
 */
export async function requireSuperadmin() {
  const session = await auth();
  if (!session?.user || session.user.rol !== "SUPERADMIN") {
    throw new AutorizacionError();
  }
  return { user: session.user, prisma };
}

/**
 * Usuario NO está en MODELOS_CON_EMPRESA (ver tenant-prisma.ts — su email/dni
 * tienen que seguir siendo únicos en toda la tabla), así que el cliente
 * scoped no lo filtra solo. Cualquier `prisma.usuario.findMany` que busque
 * destinatarios por rol tiene que pasar por acá — de lo contrario devuelve
 * usuarios de TODAS las empresas, no solo la del que dispara la acción.
 */
export async function usuariosDeEmpresaPorRol(prisma: ScopedPrismaClient, empresaId: string, roles: Rol[]) {
  if (roles.length === 0) return [];
  return prisma.usuario.findMany({
    where: { empresaId, rol: { in: roles }, activo: true, eliminadoEn: null },
  });
}
