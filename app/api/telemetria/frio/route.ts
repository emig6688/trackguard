import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { scopedPrisma } from "@/lib/tenant-prisma";
import { evaluarAlertaTemperatura } from "@/lib/frio";

export const maxDuration = 15;

/**
 * Contrato del webhook que hay que configurar en Flespi (reporte custom,
 * ver plan-sensor-frio-rinho.md) — estos son los nombres de campo que
 * ESPERAMOS que Flespi mande, no algo impuesto por Rinho/Flespi: al armar
 * el reporte custom con ayuda de Rinho, se mapean los parámetros reales de
 * la trama Wialon IPS a este JSON. Si en la práctica conviene otro nombre
 * de campo, se ajusta este schema, no hace falta ningún otro cambio.
 */
const bodySchema = z.object({
  dispositivoId: z.string().min(1),
  temperatura: z.number().nullable().optional(),
  equipoEncendido: z.boolean().nullable().optional(),
  latitud: z.number().nullable().optional(),
  longitud: z.number().nullable().optional(),
  kmOdometro: z.number().int().nonnegative().nullable().optional(),
  fechaHora: z.string().datetime().optional(),
});

/**
 * Ingesta de telemetría de frío (temperatura, encendido/apagado del equipo,
 * posición, km) — mismo patrón fail-closed que app/api/cron/*: un secreto
 * propio (TELEMETRIA_FRIO_SECRET, no reusar CRON_SECRET, este lo manda
 * Flespi en cada webhook) en el header Authorization.
 *
 * dispositivoId no alcanza para saber la empresa de antemano (a diferencia
 * de las Server Actions, este endpoint lo llama Flespi, no un usuario
 * logueado) — por eso arranca con el cliente de Prisma sin escopear solo
 * para resolver el SensorFrio, y recién de ahí en adelante usa el cliente
 * scopeado a esa empresa.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.TELEMETRIA_FRIO_SECRET || authHeader !== `Bearer ${process.env.TELEMETRIA_FRIO_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido", detalle: parsed.error.flatten() }, { status: 400 });
  }
  const datos = parsed.data;

  const sensor = await prisma.sensorFrio.findUnique({
    where: { dispositivoId: datos.dispositivoId },
    select: { id: true, empresaId: true, vehiculoId: true, activo: true },
  });
  if (!sensor || !sensor.activo) {
    return NextResponse.json({ error: "Dispositivo desconocido o inactivo" }, { status: 404 });
  }

  const empresaPrisma = scopedPrisma(sensor.empresaId);
  const fechaHora = datos.fechaHora ? new Date(datos.fechaHora) : new Date();

  await empresaPrisma.lecturaFrio.create({
    data: {
      empresaId: sensor.empresaId,
      sensorFrioId: sensor.id,
      vehiculoId: sensor.vehiculoId,
      fechaHora,
      temperatura: datos.temperatura ?? undefined,
      equipoEncendido: datos.equipoEncendido ?? undefined,
      latitud: datos.latitud ?? undefined,
      longitud: datos.longitud ?? undefined,
      kmOdometro: datos.kmOdometro ?? undefined,
    },
  });

  await empresaPrisma.sensorFrio.update({
    where: { id: sensor.id },
    data: { ultimaLecturaEn: fechaHora },
  });

  if (datos.kmOdometro != null) {
    await empresaPrisma.vehiculo.updateMany({
      where: { id: sensor.vehiculoId, kmActual: { lt: datos.kmOdometro } },
      data: { kmActual: datos.kmOdometro },
    });
  }

  await evaluarAlertaTemperatura(
    empresaPrisma,
    sensor.empresaId,
    { id: sensor.id, vehiculoId: sensor.vehiculoId },
    { temperatura: datos.temperatura ?? null, fechaHora }
  );

  return NextResponse.json({ ok: true });
}
