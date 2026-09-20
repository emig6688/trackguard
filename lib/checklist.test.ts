import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  choferHizoChecklistHoy,
  vehiculoActivoParaCierre,
  vehiculoDelChecklistDeHoy,
  registrarHorasEquipoFrioSiCorresponde,
} from "@/lib/checklist";
import { crearEmpresaDePrueba, crearUsuarioDePrueba, borrarEmpresaDePrueba } from "@/lib/test-fixtures";
import type { ScopedPrismaClient } from "@/lib/tenant-prisma";

const HORA_MS = 60 * 60 * 1000;

function sufijoCorto() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

describe("lib/checklist.ts", () => {
  let empresaId: string;
  let prisma: ScopedPrismaClient;
  let templateId: string;

  beforeAll(async () => {
    const empresa = await crearEmpresaDePrueba("checklist-lib");
    empresaId = empresa.empresaId;
    prisma = empresa.prisma;

    const template = await prisma.checklistTemplate.create({
      data: { empresaId, nombre: `Template-${sufijoCorto()}` },
    });
    templateId = template.id;
  });

  afterAll(async () => {
    await prisma.checklistRealizado.deleteMany({ where: { vehiculo: { empresaId } } });
    await borrarEmpresaDePrueba(empresaId);
  });

  async function crearVehiculo() {
    return prisma.vehiculo.create({
      data: { empresaId, patente: `TSTCHK${sufijoCorto()}`, marca: "Test", modelo: "Test" },
    });
  }

  async function crearChofer() {
    return crearUsuarioDePrueba(empresaId, "CHOFER");
  }

  async function crearPresalida(choferId: string, vehiculoId: string, horasAtras: number) {
    return prisma.checklistRealizado.create({
      data: {
        templateId,
        vehiculoId,
        choferId,
        momento: "PRESALIDA",
        fechaHora: new Date(Date.now() - horasAtras * HORA_MS),
      },
    });
  }

  async function crearCierre(choferId: string, vehiculoId: string, horasAtras: number) {
    return prisma.eventoRuta.create({
      data: {
        empresaId,
        vehiculoId,
        choferId,
        tipo: "OBSERVACION",
        descripcion: "Cierre de prueba",
        fechaHora: new Date(Date.now() - horasAtras * HORA_MS),
      },
    });
  }

  describe("choferHizoChecklistHoy / vehiculoActivoParaCierre", () => {
    it("sin ningún pre-salida, no hay reparto abierto", async () => {
      const chofer = await crearChofer();
      expect(await choferHizoChecklistHoy(prisma, chofer.id)).toBe(false);
      expect(await vehiculoActivoParaCierre(prisma, chofer.id)).toBeNull();
    });

    it("pre-salida reciente sin cierre: hay reparto abierto", async () => {
      const chofer = await crearChofer();
      const vehiculo = await crearVehiculo();
      await crearPresalida(chofer.id, vehiculo.id, 2);

      expect(await choferHizoChecklistHoy(prisma, chofer.id)).toBe(true);
      expect(await choferHizoChecklistHoy(prisma, chofer.id, vehiculo.id)).toBe(true);
      expect((await vehiculoActivoParaCierre(prisma, chofer.id))?.id).toBe(vehiculo.id);
    });

    it("REGRESIÓN: pre-salida hecho ayer (cruzando medianoche) sin cerrar todavía sigue contando — bug PERALTA/OT-2026-00044", async () => {
      const chofer = await crearUsuarioDePrueba(empresaId, "CHOFER", { nombre: "PERALTA, Jonatan Ezequiel" });
      const vehiculo = await crearVehiculo();
      // Pre-salida hace 16hs: aunque haya cambiado el día calendario en
      // Argentina en el medio, el chofer sigue en el mismo reparto sin cerrar.
      await crearPresalida(chofer.id, vehiculo.id, 16);

      expect(await choferHizoChecklistHoy(prisma, chofer.id)).toBe(true);
      expect(await choferHizoChecklistHoy(prisma, chofer.id, vehiculo.id)).toBe(true);
      expect((await vehiculoActivoParaCierre(prisma, chofer.id))?.id).toBe(vehiculo.id);
      expect((await vehiculoDelChecklistDeHoy(prisma, chofer.id))?.id).toBe(vehiculo.id);
    });

    it("una vez cerrado, deja de contar como reparto abierto (aunque haya sido hoy)", async () => {
      const chofer = await crearChofer();
      const vehiculo = await crearVehiculo();
      const presalida = await crearPresalida(chofer.id, vehiculo.id, 3);
      await crearCierre(chofer.id, vehiculo.id, 1);

      expect(await choferHizoChecklistHoy(prisma, chofer.id, vehiculo.id)).toBe(false);
      expect(await vehiculoActivoParaCierre(prisma, chofer.id)).toBeNull();
      // vehiculoDelChecklistDeHoy sí debe seguir señalando el vehículo — se
      // usa incluso después de cerrar (p.ej. cargar combustible post-cierre).
      expect((await vehiculoDelChecklistDeHoy(prisma, chofer.id))?.id).toBe(vehiculo.id);
      void presalida;
    });

    it("con dos vehículos, uno cerrado y otro todavía abierto, encuentra el abierto sin importar el orden", async () => {
      const chofer = await crearChofer();
      const vehiculoCerrado = await crearVehiculo();
      const vehiculoAbierto = await crearVehiculo();

      await crearPresalida(chofer.id, vehiculoCerrado.id, 20); // más viejo
      await crearCierre(chofer.id, vehiculoCerrado.id, 18);
      await crearPresalida(chofer.id, vehiculoAbierto.id, 5); // más nuevo, sin cerrar

      expect((await vehiculoActivoParaCierre(prisma, chofer.id))?.id).toBe(vehiculoAbierto.id);
      expect(await choferHizoChecklistHoy(prisma, chofer.id)).toBe(true);
      expect(await choferHizoChecklistHoy(prisma, chofer.id, vehiculoCerrado.id)).toBe(false);
      expect(await choferHizoChecklistHoy(prisma, chofer.id, vehiculoAbierto.id)).toBe(true);
    });

    it("un pre-salida nuevo para un segundo reparto el mismo día exige checklist si el anterior ya se cerró", async () => {
      const chofer = await crearChofer();
      const vehiculo = await crearVehiculo();
      await crearPresalida(chofer.id, vehiculo.id, 6);
      await crearCierre(chofer.id, vehiculo.id, 4);

      // Cerró el primer reparto del día — para uno nuevo con el mismo
      // vehículo, tiene que volver a hacer el checklist.
      expect(await choferHizoChecklistHoy(prisma, chofer.id, vehiculo.id)).toBe(false);
    });
  });

  describe("registrarHorasEquipoFrioSiCorresponde", () => {
    it("REGRESIÓN: suma las horas de un reparto que cruza medianoche (antes se descartaba en silencio)", async () => {
      const chofer = await crearChofer();
      const vehiculo = await crearVehiculo();
      await crearPresalida(chofer.id, vehiculo.id, 16); // "ayer" en huso Argentina

      const evento = await crearCierre(chofer.id, vehiculo.id, 0);
      await registrarHorasEquipoFrioSiCorresponde(prisma, {
        vehiculoId: vehiculo.id,
        choferId: chofer.id,
        eventoRutaId: evento.id,
        cierreFechaHora: evento.fechaHora,
      });

      const vehiculoActualizado = await prisma.vehiculo.findUniqueOrThrow({ where: { id: vehiculo.id } });
      expect(vehiculoActualizado.horasEquipoFrio).toBe(16);
    });

    it("no descuenta ni duplica si ya hay un cierre anterior para el mismo pre-salida", async () => {
      const chofer = await crearChofer();
      const vehiculo = await crearVehiculo();
      await crearPresalida(chofer.id, vehiculo.id, 10);
      await crearCierre(chofer.id, vehiculo.id, 6); // cierre anterior ya contado

      const eventoNuevo = await crearCierre(chofer.id, vehiculo.id, 0);
      await registrarHorasEquipoFrioSiCorresponde(prisma, {
        vehiculoId: vehiculo.id,
        choferId: chofer.id,
        eventoRutaId: eventoNuevo.id,
        cierreFechaHora: eventoNuevo.fechaHora,
      });

      const vehiculoActualizado = await prisma.vehiculo.findUniqueOrThrow({ where: { id: vehiculo.id } });
      expect(vehiculoActualizado.horasEquipoFrio).toBeNull();
    });

    it("sin pre-salida previo, no suma nada", async () => {
      const chofer = await crearChofer();
      const vehiculo = await crearVehiculo();
      const evento = await crearCierre(chofer.id, vehiculo.id, 0);
      await registrarHorasEquipoFrioSiCorresponde(prisma, {
        vehiculoId: vehiculo.id,
        choferId: chofer.id,
        eventoRutaId: evento.id,
        cierreFechaHora: evento.fechaHora,
      });

      const vehiculoActualizado = await prisma.vehiculo.findUniqueOrThrow({ where: { id: vehiculo.id } });
      expect(vehiculoActualizado.horasEquipoFrio).toBeNull();
    });
  });
});
