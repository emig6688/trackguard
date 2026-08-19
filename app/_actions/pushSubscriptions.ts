"use server";

import { requireSession } from "@/lib/permisos";
import { enviarPush } from "@/lib/push";

export async function obtenerVapidPublicKey(): Promise<string | null> {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

/**
 * Guarda (o actualiza, si este mismo endpoint ya estaba suscripto) la
 * suscripción de push del dispositivo/navegador actual. Un usuario puede
 * tener varias — una por dispositivo — porque `endpoint` es único por
 * suscripción del navegador, no por usuario.
 */
export async function guardarPushSubscription(subscription: PushSubscriptionInput, userAgent?: string) {
  const { user, prisma } = await requireSession();

  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: {
      empresaId: user.empresaId!,
      usuarioId: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent,
    },
    update: {
      usuarioId: user.id,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent,
    },
  });
}

export async function eliminarPushSubscription(endpoint: string) {
  const { user, prisma } = await requireSession();
  await prisma.pushSubscription.deleteMany({ where: { endpoint, usuarioId: user.id } });
}

/**
 * Manda un push de prueba al propio usuario logueado, contra sus
 * suscripciones activas — para que cualquiera pueda confirmar por su cuenta
 * que le llega, sin depender de que ocurra un aviso real del sistema.
 */
export async function enviarPushDePrueba() {
  const { user, prisma } = await requireSession();
  await enviarPush(prisma, user.id, {
    title: "TruckGuard",
    body: "Notificación de prueba — si ves esto, el push funciona.",
    url: "/dashboard",
  });
}
