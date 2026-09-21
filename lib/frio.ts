import "server-only";
import type { ScopedPrismaClient } from "@/lib/tenant-prisma";
import { obtenerReglaNotificacion, enviarPorCanalesConfigurados } from "@/lib/notificaciones";
import { usuariosDeEmpresaPorRol } from "@/lib/permisos";

/**
 * Evalúa una lectura de temperatura contra el rango configurado en la
 * empresa (Empresa.temperaturaMinimaFrio/temperaturaMaximaFrio, ver
 * /notificaciones → Calidad y frío) y abre o cierra una AlertaFrio según
 * corresponda:
 *
 * - Si la temperatura queda fuera de rango y no hay ya una alerta sin
 *   resolver para este vehículo, abre una nueva y notifica — una sola vez
 *   por excursión, no en cada lectura mientras se mantiene fuera de rango.
 * - Si la temperatura vuelve a estar dentro de rango y había una alerta sin
 *   resolver, la marca resuelta (sin volver a notificar).
 * - Sin ninguno de los dos límites configurados, o sin temperatura en la
 *   lectura, no hace nada — Fase 0 del piloto puede no tener el umbral
 *   definido todavía.
 */
export async function evaluarAlertaTemperatura(
  prisma: ScopedPrismaClient,
  empresaId: string,
  sensor: { id: string; vehiculoId: string },
  lectura: { temperatura: number | null; fechaHora: Date }
): Promise<void> {
  if (lectura.temperatura == null) return;

  const empresa = await prisma.empresa.findUniqueOrThrow({
    where: { id: empresaId },
    select: { temperaturaMinimaFrio: true, temperaturaMaximaFrio: true },
  });
  const minimo = empresa.temperaturaMinimaFrio?.toNumber() ?? null;
  const maximo = empresa.temperaturaMaximaFrio?.toNumber() ?? null;
  if (minimo == null && maximo == null) return;

  const fueraDeRango =
    (minimo != null && lectura.temperatura < minimo) || (maximo != null && lectura.temperatura > maximo);

  const alertaAbierta = await prisma.alertaFrio.findFirst({
    where: { vehiculoId: sensor.vehiculoId, tipo: "TEMPERATURA_FUERA_DE_RANGO", resuelta: false },
  });

  if (!fueraDeRango) {
    if (alertaAbierta) {
      await prisma.alertaFrio.update({
        where: { id: alertaAbierta.id },
        data: { resuelta: true, resueltaEn: lectura.fechaHora },
      });
    }
    return;
  }

  if (alertaAbierta) return; // ya notificado, sigue fuera de rango

  const detalle = `${lectura.temperatura}°C (rango configurado: ${minimo ?? "sin mínimo"} a ${maximo ?? "sin máximo"})`;
  await prisma.alertaFrio.create({
    data: {
      empresaId,
      sensorFrioId: sensor.id,
      vehiculoId: sensor.vehiculoId,
      tipo: "TEMPERATURA_FUERA_DE_RANGO",
      detalle,
    },
  });

  const regla = await obtenerReglaNotificacion(prisma, empresaId, "TEMPERATURA_FUERA_DE_RANGO");
  if (!regla.activo || regla.roles.length === 0 || regla.canales.length === 0) return;

  const vehiculo = await prisma.vehiculo.findUniqueOrThrow({
    where: { id: sensor.vehiculoId },
    select: { patente: true },
  });
  const destinatarios = await usuariosDeEmpresaPorRol(prisma, empresaId, regla.roles);
  await enviarPorCanalesConfigurados(
    prisma,
    empresaId,
    destinatarios,
    regla.canales,
    "TEMPERATURA_FUERA_DE_RANGO",
    `Temperatura fuera de rango: ${vehiculo.patente}`,
    `${vehiculo.patente} reportó ${detalle}.`,
    "/calidad"
  );
}
