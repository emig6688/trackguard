import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enviarWhatsapp } from "@/lib/whatsapp";
import { enviarEmail } from "@/lib/email";
import { disponibilidadEfectiva } from "@/lib/disponibilidad";

// Argentina no tiene horario de verano desde 2009: UTC-3 todo el año.
const OFFSET_ARGENTINA_HORAS = 3;

/**
 * Corre cada hora (ver vercel.json). Para cada empresa con la regla
 * RESUMEN_VEHICULOS_OPERATIVOS activa cuya hora configurada (horaEnvio, en
 * huso horario Argentina) coincide con la hora UTC actual, calcula cuántos
 * vehículos están operativos y avisa a los roles/canales que eligieron en
 * /notificaciones.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const horaUTCActual = new Date().getUTCHours();

  const reglas = await prisma.reglaNotificacion.findMany({
    where: { tipo: "RESUMEN_VEHICULOS_OPERATIVOS", activo: true },
  });

  const enviados: string[] = [];

  for (const regla of reglas) {
    if (regla.horaEnvio == null) continue;
    const horaUTCConfigurada = (regla.horaEnvio + OFFSET_ARGENTINA_HORAS) % 24;
    if (horaUTCConfigurada !== horaUTCActual) continue;
    if (regla.roles.length === 0 || regla.canales.length === 0) continue;

    const [vehiculos, otsEnTaller, destinatarios] = await Promise.all([
      prisma.vehiculo.findMany({
        where: { empresaId: regla.empresaId, activo: true, eliminadoEn: null },
        select: { id: true, patente: true, disponible: true, motivoNoOperativo: true },
      }),
      prisma.ordenDeTrabajo.findMany({
        where: { empresaId: regla.empresaId, eliminadoEn: null, estado: "DERIVADA_EXTERNO" },
        select: { vehiculoId: true },
      }),
      prisma.usuario.findMany({
        where: { empresaId: regla.empresaId, rol: { in: regla.roles }, activo: true, eliminadoEn: null },
      }),
    ]);

    if (destinatarios.length === 0) continue;

    const enTaller = new Set(otsEnTaller.map((o) => o.vehiculoId));
    const noOperativos = vehiculos.filter((v) => !disponibilidadEfectiva(v, enTaller.has(v.id)));
    const operativos = vehiculos.length - noOperativos.length;

    const asunto = "Resumen diario de vehículos operativos";
    const detalleNoOperativos = noOperativos
      .map((v) =>
        enTaller.has(v.id)
          ? `${v.patente} (derivado a taller externo)`
          : `${v.patente}${v.motivoNoOperativo ? ` (${v.motivoNoOperativo})` : ""}`
      )
      .join(", ");
    const mensaje =
      `Vehículos operativos hoy: ${operativos}/${vehiculos.length}.` +
      (noOperativos.length > 0 ? ` No operativos: ${detalleNoOperativos}.` : "");

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
                tipo: "RESUMEN_VEHICULOS_OPERATIVOS" as const,
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
