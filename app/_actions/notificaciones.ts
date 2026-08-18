"use server";

import { requireSession } from "@/lib/permisos";

const LIMITE_RECIENTES = 30;

export type NotificacionResumen = {
  id: string;
  titulo: string;
  mensaje: string;
  href: string | null;
  leida: boolean;
  createdAt: string;
};

/**
 * Notificaciones no mostradas todavía como popup (mostradaEn null) — se
 * llama al montar el campanita y periódicamente. Marca `mostradaEn` en el
 * mismo llamado para que cada una se muestre como popup una sola vez; queda
 * "no leída" hasta que el usuario la abra o toque "marcar todas como leídas".
 */
export async function obtenerNotificacionesPendientesDePopup(): Promise<NotificacionResumen[]> {
  const { user, prisma } = await requireSession();

  const pendientes = await prisma.notificacion.findMany({
    where: { usuarioId: user.id, mostradaEn: null },
    orderBy: { createdAt: "asc" },
    take: LIMITE_RECIENTES,
  });

  if (pendientes.length > 0) {
    await prisma.notificacion.updateMany({
      where: { id: { in: pendientes.map((n) => n.id) } },
      data: { mostradaEn: new Date() },
    });
  }

  return pendientes.map((n) => ({
    id: n.id,
    titulo: n.titulo,
    mensaje: n.mensaje,
    href: n.href,
    leida: n.leida,
    createdAt: n.createdAt.toISOString(),
  }));
}

/**
 * Últimas notificaciones (leídas o no) para el listado del campanita, más el
 * total de no leídas para el badge.
 */
export async function obtenerNotificaciones(): Promise<{
  notificaciones: NotificacionResumen[];
  noLeidas: number;
}> {
  const { user, prisma } = await requireSession();

  const [notificaciones, noLeidas] = await Promise.all([
    prisma.notificacion.findMany({
      where: { usuarioId: user.id },
      orderBy: { createdAt: "desc" },
      take: LIMITE_RECIENTES,
    }),
    prisma.notificacion.count({ where: { usuarioId: user.id, leida: false } }),
  ]);

  return {
    notificaciones: notificaciones.map((n) => ({
      id: n.id,
      titulo: n.titulo,
      mensaje: n.mensaje,
      href: n.href,
      leida: n.leida,
      createdAt: n.createdAt.toISOString(),
    })),
    noLeidas,
  };
}

export async function marcarNotificacionLeida(id: string) {
  const { user, prisma } = await requireSession();
  await prisma.notificacion.updateMany({
    where: { id, usuarioId: user.id },
    data: { leida: true },
  });
}

export async function marcarTodasNotificacionesLeidas() {
  const { user, prisma } = await requireSession();
  await prisma.notificacion.updateMany({
    where: { usuarioId: user.id, leida: false },
    data: { leida: true },
  });
}
