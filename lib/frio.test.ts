import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { evaluarAlertaTemperatura } from "@/lib/frio";
import { crearEmpresaDePrueba, crearUsuarioDePrueba, borrarEmpresaDePrueba } from "@/lib/test-fixtures";
import type { ScopedPrismaClient } from "@/lib/tenant-prisma";

function sufijoCorto() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

describe("lib/frio.ts", () => {
  let empresaId: string;
  let prisma: ScopedPrismaClient;

  beforeAll(async () => {
    const empresa = await crearEmpresaDePrueba("frio");
    empresaId = empresa.empresaId;
    prisma = empresa.prisma;
  });

  afterAll(async () => {
    await borrarEmpresaDePrueba(empresaId);
  });

  async function crearVehiculoConSensor() {
    const vehiculo = await prisma.vehiculo.create({
      data: {
        empresaId,
        patente: `TSTFRI${sufijoCorto()}`,
        marca: "Test",
        modelo: "Test",
        tieneSensorFrio: true,
      },
    });
    const sensor = await prisma.sensorFrio.create({
      data: { empresaId, vehiculoId: vehiculo.id, dispositivoId: `dev-${sufijoCorto()}` },
    });
    return { vehiculo, sensor };
  }

  describe("evaluarAlertaTemperatura", () => {
    it("sin rango configurado en la empresa, no hace nada", async () => {
      const { sensor } = await crearVehiculoConSensor();
      await evaluarAlertaTemperatura(prisma, empresaId, sensor, { temperatura: -25, fechaHora: new Date() });

      const alertas = await prisma.alertaFrio.findMany({ where: { vehiculoId: sensor.vehiculoId } });
      expect(alertas).toHaveLength(0);
    });

    it("sin temperatura en la lectura, no hace nada aunque haya rango configurado", async () => {
      await prisma.empresa.update({
        where: { id: empresaId },
        data: { temperaturaMinimaFrio: -20, temperaturaMaximaFrio: -10 },
      });
      const { sensor } = await crearVehiculoConSensor();
      await evaluarAlertaTemperatura(prisma, empresaId, sensor, { temperatura: null, fechaHora: new Date() });

      const alertas = await prisma.alertaFrio.findMany({ where: { vehiculoId: sensor.vehiculoId } });
      expect(alertas).toHaveLength(0);
    });

    it("temperatura por debajo del mínimo abre una alerta nueva", async () => {
      await prisma.empresa.update({
        where: { id: empresaId },
        data: { temperaturaMinimaFrio: -20, temperaturaMaximaFrio: -10 },
      });
      const { sensor } = await crearVehiculoConSensor();
      await evaluarAlertaTemperatura(prisma, empresaId, sensor, { temperatura: -25, fechaHora: new Date() });

      const alertas = await prisma.alertaFrio.findMany({ where: { vehiculoId: sensor.vehiculoId } });
      expect(alertas).toHaveLength(1);
      expect(alertas[0].tipo).toBe("TEMPERATURA_FUERA_DE_RANGO");
      expect(alertas[0].resuelta).toBe(false);
    });

    it("temperatura por encima del máximo también abre una alerta", async () => {
      await prisma.empresa.update({
        where: { id: empresaId },
        data: { temperaturaMinimaFrio: -20, temperaturaMaximaFrio: -10 },
      });
      const { sensor } = await crearVehiculoConSensor();
      await evaluarAlertaTemperatura(prisma, empresaId, sensor, { temperatura: -2, fechaHora: new Date() });

      const alertas = await prisma.alertaFrio.findMany({ where: { vehiculoId: sensor.vehiculoId } });
      expect(alertas).toHaveLength(1);
    });

    it("mientras se sigue fuera de rango, no duplica la alerta", async () => {
      await prisma.empresa.update({
        where: { id: empresaId },
        data: { temperaturaMinimaFrio: -20, temperaturaMaximaFrio: -10 },
      });
      const { sensor } = await crearVehiculoConSensor();
      await evaluarAlertaTemperatura(prisma, empresaId, sensor, { temperatura: -25, fechaHora: new Date() });
      await evaluarAlertaTemperatura(prisma, empresaId, sensor, { temperatura: -26, fechaHora: new Date() });
      await evaluarAlertaTemperatura(prisma, empresaId, sensor, { temperatura: -24, fechaHora: new Date() });

      const alertas = await prisma.alertaFrio.findMany({ where: { vehiculoId: sensor.vehiculoId } });
      expect(alertas).toHaveLength(1);
    });

    it("al volver a estar en rango, resuelve la alerta abierta sin crear una nueva", async () => {
      await prisma.empresa.update({
        where: { id: empresaId },
        data: { temperaturaMinimaFrio: -20, temperaturaMaximaFrio: -10 },
      });
      const { sensor } = await crearVehiculoConSensor();
      await evaluarAlertaTemperatura(prisma, empresaId, sensor, { temperatura: -25, fechaHora: new Date() });
      await evaluarAlertaTemperatura(prisma, empresaId, sensor, { temperatura: -15, fechaHora: new Date() });

      const alertas = await prisma.alertaFrio.findMany({ where: { vehiculoId: sensor.vehiculoId } });
      expect(alertas).toHaveLength(1);
      expect(alertas[0].resuelta).toBe(true);
      expect(alertas[0].resueltaEn).not.toBeNull();
    });

    it("una nueva excursión después de resuelta abre una alerta distinta", async () => {
      await prisma.empresa.update({
        where: { id: empresaId },
        data: { temperaturaMinimaFrio: -20, temperaturaMaximaFrio: -10 },
      });
      const { sensor } = await crearVehiculoConSensor();
      await evaluarAlertaTemperatura(prisma, empresaId, sensor, { temperatura: -25, fechaHora: new Date() });
      await evaluarAlertaTemperatura(prisma, empresaId, sensor, { temperatura: -15, fechaHora: new Date() });
      await evaluarAlertaTemperatura(prisma, empresaId, sensor, { temperatura: -25, fechaHora: new Date() });

      const alertas = await prisma.alertaFrio.findMany({ where: { vehiculoId: sensor.vehiculoId } });
      expect(alertas).toHaveLength(2);
      expect(alertas.filter((a) => !a.resuelta)).toHaveLength(1);
    });

    it("con regla activa y rol configurado, notifica en la app al abrir la alerta", async () => {
      await prisma.empresa.update({
        where: { id: empresaId },
        data: { temperaturaMinimaFrio: -20, temperaturaMaximaFrio: -10 },
      });
      const gerente = await crearUsuarioDePrueba(empresaId, "GERENTE");
      await prisma.reglaNotificacion.create({
        data: {
          empresaId,
          tipo: "TEMPERATURA_FUERA_DE_RANGO",
          roles: ["GERENTE"],
          canales: ["EN_APP"],
          activo: true,
        },
      });
      const { sensor } = await crearVehiculoConSensor();

      await evaluarAlertaTemperatura(prisma, empresaId, sensor, { temperatura: -25, fechaHora: new Date() });
      await evaluarAlertaTemperatura(prisma, empresaId, sensor, { temperatura: -26, fechaHora: new Date() });

      const notificaciones = await prisma.notificacion.findMany({
        where: { usuarioId: gerente.id, tipo: "TEMPERATURA_FUERA_DE_RANGO" },
      });
      expect(notificaciones).toHaveLength(1); // una sola, no una por lectura
    });
  });
});
