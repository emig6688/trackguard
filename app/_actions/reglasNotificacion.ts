"use server";

import { revalidatePath } from "next/cache";
import { requireRole, ROLES_ADMIN_MANTENIMIENTO } from "@/lib/permisos";
import type { CanalNotificacion, Rol, TipoNotificacion } from "@/app/generated/prisma/client";

const RUTA = "/notificaciones";

export async function actualizarReglaNotificacion(
  tipo: TipoNotificacion,
  roles: Rol[],
  canales: CanalNotificacion[],
  diasAviso: number[],
  activo: boolean
) {
  const { user, prisma } = await requireRole(ROLES_ADMIN_MANTENIMIENTO);

  const diasAvisoLimpios = [...new Set(diasAviso.filter((d) => Number.isInteger(d) && d > 0))].sort(
    (a, b) => b - a
  );

  await prisma.reglaNotificacion.upsert({
    where: { empresaId_tipo: { empresaId: user.empresaId!, tipo } },
    update: { roles, canales, diasAviso: diasAvisoLimpios, activo },
    create: {
      empresaId: user.empresaId!,
      tipo,
      roles,
      canales,
      diasAviso: diasAvisoLimpios,
      activo,
    },
  });

  revalidatePath(RUTA);
}

/**
 * Monto (ARS) por debajo del cual una OC no requiere autorización de
 * gerencia — null desactiva la función por completo (ninguna OC requiere
 * autorización sin importar el monto).
 */
export async function actualizarMontoAutorizacionCompra(monto: number | null) {
  const { user, prisma } = await requireRole(ROLES_ADMIN_MANTENIMIENTO);

  await prisma.empresa.update({
    where: { id: user.empresaId! },
    data: { montoAutorizacionCompra: monto != null && monto >= 0 ? monto : null },
  });

  revalidatePath(RUTA);
}

/**
 * Igual que actualizarMontoAutorizacionCompra, pero para la compuerta aparte
 * que solo aplica a compras generadas por un mecánico interno (la autoriza
 * encargado de mantenimiento, no gerencia).
 */
export async function actualizarMontoAutorizacionCompraMecanico(monto: number | null) {
  const { user, prisma } = await requireRole(ROLES_ADMIN_MANTENIMIENTO);

  await prisma.empresa.update({
    where: { id: user.empresaId! },
    data: { montoAutorizacionCompraMecanico: monto != null && monto >= 0 ? monto : null },
  });

  revalidatePath(RUTA);
}

/**
 * Si está activo, una OT generada por el reporte de un chofer nace directo
 * APROBADA y sin mecánico asignado (igual que ya nace una preventiva
 * generada por cron) — cualquier mecánico interno la ve y la puede tomar,
 * sin esperar que el encargado de mantenimiento la apruebe y asigne.
 */
export async function actualizarAutoAprobacionMecanicos(activo: boolean) {
  const { user, prisma } = await requireRole(ROLES_ADMIN_MANTENIMIENTO);

  await prisma.empresa.update({
    where: { id: user.empresaId! },
    data: { autoAprobacionMecanicosActiva: activo },
  });

  revalidatePath(RUTA);
}
