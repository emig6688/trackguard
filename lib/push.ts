import "server-only";
import webpush from "web-push";
import type { ScopedPrismaClient } from "@/lib/tenant-prisma";

const vapidConfigurado = Boolean(
  process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT
);

if (vapidConfigurado) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
}

/**
 * Manda un push real (llega aunque la app esté cerrada) a cada dispositivo
 * suscripto del usuario — 1:1 con "En la app", no un canal configurable
 * aparte (ver enviarPorCanalesConfigurados en lib/notificaciones.ts). Sin
 * VAPID configurado (dev sin setear las variables), no hace nada. Best-effort
 * como enviarEmail/enviarWhatsapp: nunca tira, y borra sola una suscripción
 * vencida/revocada (404/410) para no reintentar contra algo muerto.
 */
export async function enviarPush(
  prisma: ScopedPrismaClient,
  usuarioId: string,
  payload: { title: string; body: string; url?: string }
) {
  if (!vapidConfigurado) return;

  const subs = await prisma.pushSubscription.findMany({ where: { usuarioId } });
  if (subs.length === 0) return;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        );
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.error(`[Push] Error notificando a usuario=${usuarioId}:`, error);
        }
      }
    })
  );
}
