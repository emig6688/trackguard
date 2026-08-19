import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enviarWhatsapp } from "@/lib/whatsapp";
import { enviarEmail } from "@/lib/email";

/**
 * Corre una vez al día (ver vercel.json — el plan Hobby de Vercel no permite
 * crons horarios, solo diarios). Por eso NO se compara horaEnvio contra la
 * hora actual: cualquier empresa con la regla DEVOLUCION_SIN_ENVIAR activa y
 * una hora configurada (el campo sigue sirviendo como "encendido/apagado" de
 * este aviso) recibe el aviso en esta única corrida diaria si todavía hay
 * devoluciones sin enviar, protegido por idempotencia de "una vez por día"
 * más abajo. Si el proyecto pasa a un plan que soporte crons horarios, se
 * puede volver a comparar horaEnvio contra la hora UTC actual para precisión
 * de horario real.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const ahora = new Date();
  // Arranque del día actual (UTC): sirve para el chequeo de idempotencia de
  // abajo (un reintento de Vercel el mismo día no debe duplicar el envío).
  const inicioDelDia = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()));

  const reglas = await prisma.reglaNotificacion.findMany({
    where: { tipo: "DEVOLUCION_SIN_ENVIAR", activo: true },
  });

  const enviados: string[] = [];
  const errores: string[] = [];

  for (const regla of reglas) {
    try {
      if (regla.horaEnvio == null) continue;
      if (regla.roles.length === 0 || regla.canales.length === 0) continue;

      const pendientes = await prisma.devolucion.count({
        where: { empresaId: regla.empresaId, enviadoEn: null },
      });
      if (pendientes === 0) continue;

      const destinatarios = await prisma.usuario.findMany({
        where: { empresaId: regla.empresaId, rol: { in: regla.roles }, activo: true, eliminadoEn: null },
      });
      if (destinatarios.length === 0) continue;

      // Idempotencia: reclama el día antes de mandar. Si otra invocación
      // (reintento de Vercel) ya lo reclamó, count da 0 y no se duplica el
      // aviso.
      const claim = await prisma.reglaNotificacion.updateMany({
        where: { id: regla.id, OR: [{ ultimoEnvioEn: null }, { ultimoEnvioEn: { lt: inicioDelDia } }] },
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
            motivo: f.resultado.enviado ? "" : (f.resultado.detalle ?? f.resultado.motivo),
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
