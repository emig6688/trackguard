import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enviarWhatsapp } from "@/lib/whatsapp";
import { enviarEmail } from "@/lib/email";

// Argentina no tiene horario de verano desde 2009: UTC-3 todo el año.
const OFFSET_ARGENTINA_HORAS = 3;

/**
 * Corre cada hora (ver vercel.json). Para cada empresa con la regla
 * DEVOLUCION_SIN_ENVIAR activa cuya hora configurada (horaEnvio, en huso
 * horario Argentina) coincide con la hora UTC actual, si todavía hay
 * devoluciones cargadas por el guardia sin enviar, avisa a los roles/canales
 * configurados en /notificaciones — se repite todos los días a esa hora
 * hasta que se resuelva (mismo criterio que el resto de los avisos
 * recurrentes).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const horaUTCActual = new Date().getUTCHours();

  const reglas = await prisma.reglaNotificacion.findMany({
    where: { tipo: "DEVOLUCION_SIN_ENVIAR", activo: true },
  });

  const enviados: string[] = [];

  for (const regla of reglas) {
    if (regla.horaEnvio == null) continue;
    const horaUTCConfigurada = (regla.horaEnvio + OFFSET_ARGENTINA_HORAS) % 24;
    if (horaUTCConfigurada !== horaUTCActual) continue;
    if (regla.roles.length === 0 || regla.canales.length === 0) continue;

    const pendientes = await prisma.devolucion.count({
      where: { empresaId: regla.empresaId, enviadoEn: null },
    });
    if (pendientes === 0) continue;

    const destinatarios = await prisma.usuario.findMany({
      where: { empresaId: regla.empresaId, rol: { in: regla.roles }, activo: true, eliminadoEn: null },
    });
    if (destinatarios.length === 0) continue;

    const asunto = "Devoluciones sin enviar";
    const mensaje =
      pendientes === 1
        ? "Hay 1 devolución del guardia todavía sin enviar."
        : `Hay ${pendientes} devoluciones del guardia todavía sin enviar.`;

    await Promise.all([
      ...destinatarios.flatMap((u) => [
        ...(regla.canales.includes("WHATSAPP") ? [enviarWhatsapp(u.telefono, mensaje)] : []),
        ...(regla.canales.includes("EMAIL") ? [enviarEmail(u.email, asunto, mensaje)] : []),
      ]),
      ...(regla.canales.includes("EN_APP")
        ? [
            prisma.notificacion.createMany({
              data: destinatarios.map((u) => ({
                empresaId: regla.empresaId,
                usuarioId: u.id,
                tipo: "DEVOLUCION_SIN_ENVIAR" as const,
                titulo: asunto,
                mensaje,
                href: "/dashboard",
              })),
            }),
          ]
        : []),
    ]);

    enviados.push(regla.empresaId);
  }

  return NextResponse.json({ enviados });
}
