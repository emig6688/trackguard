import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { registrarCargaCombustible } from "@/app/_actions/combustible";
import { AutorizacionError } from "@/lib/permisos";
import {
  crearEmpresaDePrueba,
  crearUsuarioDePrueba,
  mockearSesion,
  borrarEmpresaDePrueba,
} from "@/lib/test-fixtures";
import type { ScopedPrismaClient } from "@/lib/tenant-prisma";

function formData(campos: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

function ticket() {
  return new File(["contenido"], "ticket.jpg", { type: "image/jpeg" });
}

function sufijoCorto() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

describe("app/_actions/combustible.ts", () => {
  let empresaId: string;
  let prisma: ScopedPrismaClient;
  let chofer: { id: string; nombre: string };
  let vehiculoId: string;
  let templateId: string;

  beforeAll(async () => {
    const empresa = await crearEmpresaDePrueba("combustible");
    empresaId = empresa.empresaId;
    prisma = empresa.prisma;

    chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");

    const vehiculo = await prisma.vehiculo.create({
      data: { empresaId, patente: `TSTCMB${sufijoCorto()}`, marca: "Test", modelo: "Test", tipo: "CAMION" },
    });
    vehiculoId = vehiculo.id;

    const template = await prisma.checklistTemplate.create({
      data: { empresaId, nombre: `Template-${sufijoCorto()}` },
    });
    templateId = template.id;
  });

  afterAll(async () => {
    // ChecklistRealizado no tiene empresaId propio (no está en
    // MODELOS_CON_EMPRESA — ver lib/tenant-prisma.ts), así que
    // borrarEmpresaDePrueba no lo borra solo: limpiarlo a mano para no
    // romper el borrado de Vehiculo/ChecklistTemplate/Usuario por la FK.
    await prisma.checklistRealizado.deleteMany({ where: { choferId: chofer.id } });
    await borrarEmpresaDePrueba(empresaId);
  });

  async function desactivarReglaChecklist() {
    await prisma.reglaNotificacion.deleteMany({ where: { empresaId, tipo: "CHECKLIST_NO_REALIZADO" } });
  }

  async function activarReglaChecklist() {
    await prisma.reglaNotificacion.upsert({
      where: { empresaId_tipo: { empresaId, tipo: "CHECKLIST_NO_REALIZADO" } },
      create: { empresaId, tipo: "CHECKLIST_NO_REALIZADO", activo: true, roles: [] },
      update: { activo: true, roles: [] },
    });
  }

  describe("registrarCargaCombustible", () => {
    it("un rol fuera de ROLES_MOBILE_CHOFER no puede registrar una carga", async () => {
      await desactivarReglaChecklist();
      const admin = await crearUsuarioDePrueba(empresaId, "ADMIN");
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const fd = formData({ vehiculoId, kmOdometro: "1000", litrosCargados: "50", montoTotal: "5000" });
      fd.set("archivoTicket", ticket());
      await expect(registrarCargaCombustible(undefined, fd)).rejects.toThrow(AutorizacionError);
    });

    it("rechaza sin vehículo", async () => {
      await desactivarReglaChecklist();
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      const fd = formData({ kmOdometro: "1000", litrosCargados: "50", montoTotal: "5000" });
      fd.set("archivoTicket", ticket());
      const resultado = await registrarCargaCombustible(undefined, fd);
      expect(resultado?.error).toMatch(/vehículo/i);
    });

    it("rechaza un vehículo inválido", async () => {
      await desactivarReglaChecklist();
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      const fd = formData({ vehiculoId: "no-existe", kmOdometro: "1000", litrosCargados: "50", montoTotal: "5000" });
      fd.set("archivoTicket", ticket());
      const resultado = await registrarCargaCombustible(undefined, fd);
      expect(resultado?.error).toMatch(/vehículo inválido/i);
    });

    it("rechaza km/litros/monto inválidos", async () => {
      await desactivarReglaChecklist();
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      const fd = formData({ vehiculoId, kmOdometro: "-5", litrosCargados: "0", montoTotal: "0" });
      fd.set("archivoTicket", ticket());
      const resultado = await registrarCargaCombustible(undefined, fd);
      expect(resultado?.error).toMatch(/completá km, litros y monto/i);
    });

    it("rechaza sin foto del ticket", async () => {
      await desactivarReglaChecklist();
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      const fd = formData({ vehiculoId, kmOdometro: "1000", litrosCargados: "50", montoTotal: "5000" });
      const resultado = await registrarCargaCombustible(undefined, fd);
      expect(resultado?.error).toMatch(/ticket/i);
    });

    it("bloquea si el checklist obligatorio está activo y el chofer no lo hizo hoy", async () => {
      await activarReglaChecklist();
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      const fd = formData({ vehiculoId, kmOdometro: "1000", litrosCargados: "50", montoTotal: "5000" });
      fd.set("archivoTicket", ticket());
      const resultado = await registrarCargaCombustible(undefined, fd);
      expect(resultado?.error).toMatch(/checklist pre-salida/i);
      await desactivarReglaChecklist();
    });

    it("con checklist obligatorio activo, rechaza cargar combustible con un vehículo distinto al del checklist de hoy más reciente (IDOR)", async () => {
      const otroVehiculo = await prisma.vehiculo.create({
        data: { empresaId, patente: `TSTCMB${sufijoCorto()}`, marca: "Test", modelo: "Test", tipo: "CAMION" },
      });

      // El chofer hizo el checklist de HOY con `vehiculoId` primero, y con
      // `otroVehiculo` después (el más reciente) — el vehículo "activo" para
      // combustible/gastos pasa a ser otroVehiculo.
      await prisma.checklistRealizado.create({
        data: { templateId, vehiculoId, choferId: chofer.id, momento: "PRESALIDA" },
      });
      await prisma.checklistRealizado.create({
        data: { templateId, vehiculoId: otroVehiculo.id, choferId: chofer.id, momento: "PRESALIDA" },
      });

      await activarReglaChecklist();
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      // Intenta cargar combustible con el vehículo viejo (vehiculoId), no el
      // activo (otroVehiculo) — el servidor debe rechazarlo aunque el campo
      // vehiculoId llegue "manipulado" con un vehículo válido de la empresa.
      const fd = formData({ vehiculoId, kmOdometro: "1000", litrosCargados: "50", montoTotal: "5000" });
      fd.set("archivoTicket", ticket());
      const resultado = await registrarCargaCombustible(undefined, fd);
      expect(resultado?.error).toMatch(/checklist de hoy/i);
      expect(resultado?.error).toContain(otroVehiculo.patente);

      await desactivarReglaChecklist();
    });

    it("registra una carga de combustible y calcula km recorridos / consumo respecto de la carga anterior", async () => {
      await desactivarReglaChecklist();
      const vehiculo = await prisma.vehiculo.create({
        data: { empresaId, patente: `TSTCMB${sufijoCorto()}`, marca: "Test", modelo: "Test", tipo: "CAMION" },
      });
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });

      const primerTicket = new File(["x"], "t1.jpg", { type: "image/jpeg" });
      const fd1 = formData({ vehiculoId: vehiculo.id, kmOdometro: "1000", litrosCargados: "40", montoTotal: "4000" });
      fd1.set("archivoTicket", primerTicket);
      const primero = await registrarCargaCombustible(undefined, fd1);
      expect(primero?.error).toBeUndefined();
      expect(primero?.kmRecorridos).toBeUndefined(); // no hay carga anterior

      const fd2 = formData({
        vehiculoId: vehiculo.id,
        kmOdometro: "1200",
        litrosCargados: "40",
        montoTotal: "4200",
        precioLitro: "105",
        estacionServicio: "YPF Ruta 9",
      });
      fd2.set("archivoTicket", ticket());
      const segundo = await registrarCargaCombustible(undefined, fd2);
      expect(segundo?.error).toBeUndefined();
      expect(segundo?.kmRecorridos).toBe(200);
      expect(segundo?.consumoL100km).toBe(20);

      const cargas = await prisma.cargaCombustible.findMany({
        where: { vehiculoId: vehiculo.id },
        orderBy: { fechaHora: "asc" },
      });
      expect(cargas).toHaveLength(2);
      expect(cargas[1].kmRecorridosDesdeUltimaCarga).toBe(200);
      expect(Number(cargas[1].consumoL100km)).toBe(20);
      expect(cargas[1].estacionServicio).toBe("YPF Ruta 9");

      const vehiculoActualizado = await prisma.vehiculo.findUniqueOrThrow({ where: { id: vehiculo.id } });
      expect(vehiculoActualizado.kmActual).toBe(1200);
    });
  });
});
