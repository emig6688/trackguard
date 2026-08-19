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

  const ahora = new Date();
  const horaUTCActual = ahora.getUTCHours();
  // Arranque de la franja horaria actual: sirve para el chequeo de
  // idempotencia de abajo (un reintento de Vercel dentro de la misma hora no
  // debe duplicar el envío).
  const inicioHora = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate(), horaUTCActual));

  const reglas = await prisma.reglaNotificacion.findMany({
    where: { tipo: "DEVOLUCION_SIN_ENVIAR", activo: true },
  });

  const enviados: string[] = [];
  const errores: string[] = [];

  for (const regla of reglas) {
    try {
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

      // Idempotencia: reclama la franja horaria antes de mandar. Si otra
      // invocación (reintento de Vercel) ya la reclamó, count da 0 y no se
      // duplica el aviso.
      const claim = await prisma.reglaNotificacion.updateMany({
        where: { id: regla.id, OR: [{ ultimoEnvioEn: null }, { ultimoEnvioEn: { lt: inicioHora } }] },
        data: { ultimoEnvioEn: ahora },
      });
      if (claim.count === 0) continue;

      const asunto = "Devoluciones sin enviar";
      const mensaje =
        pendientes === 1
          ? "Hay 1 devolución del guardia todavía sin enviar."
          : `Hay ${pendientes} devoluciones del guardia todavía sin enviar.`;

      const envios = destinatarios.flatMap((u) => [
        ...(regla.canales.includes("WHATSAPP")
          ? [enviarWhatsapp(u.telefono, mensaje).then((resultado) => ({ canal: "WHATSAPP" as const, destinatario: u.telefono, resultado }))]
          : []),
        ...(regla.canales.includes("EMAIL")
          ? [enviarEmail(u.email, asunto, mensaje).then((resultado) => ({ canal: "EMAIL" as const, destinatario: u.email, resultado }))]
          : []),
      ]);
      const [resultadosEnvio] = await Promise.all([
        Promise.all(envios),
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
      const fallos = resultadosEnvio.filter((r) => !r.resultado.enviado);
      if (fallos.length > 0) {
        await prisma.notificacionFallo.createMany({
          data: fallos.map((f) => ({
            empresaId: regla.empresaId,
            tipo: "DEVOLUCION_SIN_ENVIAR" as const,
            canal: f.canal,
            destinatario: f.destinatario?.trim() || "(sin dato)",
            motivo: f.resultado.enviado ? "" : f.resultado.motivo,
          })),
        });
      }

      enviados.push(regla.empresaId);
    } catch (error) {
      console.error(`[cron/devoluciones-pendientes] empresa=${regla.empresaId}`, error);
      errores.push(regla.empresaId);
    }
  }

  return NextResponse.json({ enviados, errores });
}
