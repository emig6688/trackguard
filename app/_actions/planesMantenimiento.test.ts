import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  crearPlanMantenimiento,
  alternarActivoPlan,
  aplicarPlanEstandar,
  aplicarPlanEstandarAFlota,
} from "@/app/_actions/planesMantenimiento";
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

function sufijoCorto() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

describe("app/_actions/planesMantenimiento.ts", () => {
  let empresaId: string;
  let prisma: ScopedPrismaClient;
  let admin: { id: string };

  beforeAll(async () => {
    const empresa = await crearEmpresaDePrueba("planesMant");
    empresaId = empresa.empresaId;
    prisma = empresa.prisma;
    admin = await crearUsuarioDePrueba(empresaId, "ADMIN");
  });

  afterAll(async () => {
    await borrarEmpresaDePrueba(empresaId);
  });

  async function crearVehiculo(overrides: { kmActual?: number; horasEquipoFrio?: number } = {}) {
    return prisma.vehiculo.create({
      data: {
        empresaId,
        patente: `TSTPLN${sufijoCorto()}`,
        marca: "Test",
        modelo: "Test",
        tipo: "CAMION",
        kmActual: overrides.kmActual ?? 10000,
        horasEquipoFrio: overrides.horasEquipoFrio ?? 500,
      },
    });
  }

  describe("crearPlanMantenimiento", () => {
    it("crea un plan tomando el km/horas actual del vehículo como último service", async () => {
      const vehiculo = await crearVehiculo({ kmActual: 12345, horasEquipoFrio: 678 });
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const nombre = `Plan-${sufijoCorto()}`;
      const resultado = await crearPlanMantenimiento(
        "/vehiculos",
        undefined,
        formData({ vehiculoId: vehiculo.id, nombre, tipoIntervalo: "KM", intervaloKm: "5000" })
      );
      expect(resultado?.success).toBe(true);
      const plan = await prisma.planMantenimiento.findFirstOrThrow({ where: { nombre } });
      expect(plan.vehiculoId).toBe(vehiculo.id);
      expect(plan.intervaloKm).toBe(5000);
      expect(plan.kmUltimoService).toBe(12345);
      expect(plan.horasUltimoService).toBe(678);
      expect(plan.fechaUltimoService).not.toBeNull();
    });

    it("rechaza sin nombre", async () => {
      const vehiculo = await crearVehiculo();
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await crearPlanMantenimiento(
        "/vehiculos",
        undefined,
        formData({ vehiculoId: vehiculo.id, nombre: "", tipoIntervalo: "KM" })
      );
      expect(resultado?.fieldErrors?.nombre).toBeTruthy();
    });

    it("un rol fuera de ROLES_ADMIN_MANTENIMIENTO no puede crear un plan", async () => {
      const chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
      const vehiculo = await crearVehiculo();
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      await expect(
        crearPlanMantenimiento(
          "/vehiculos",
          undefined,
          formData({ vehiculoId: vehiculo.id, nombre: "X", tipoIntervalo: "KM" })
        )
      ).rejects.toThrow(AutorizacionError);
    });
  });

  describe("alternarActivoPlan", () => {
    it("activa/desactiva un plan existente", async () => {
      const vehiculo = await crearVehiculo();
      const plan = await prisma.planMantenimiento.create({
        data: { empresaId, vehiculoId: vehiculo.id, nombre: `Plan-${sufijoCorto()}`, tipoIntervalo: "KM", activo: true },
      });
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      await alternarActivoPlan(plan.id, false, "/vehiculos");
      expect((await prisma.planMantenimiento.findUniqueOrThrow({ where: { id: plan.id } })).activo).toBe(false);
    });

    it("un rol fuera de ROLES_ADMIN_MANTENIMIENTO no puede alternar", async () => {
      const chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
      const vehiculo = await crearVehiculo();
      const plan = await prisma.planMantenimiento.create({
        data: { empresaId, vehiculoId: vehiculo.id, nombre: `Plan-${sufijoCorto()}`, tipoIntervalo: "KM" },
      });
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      await expect(alternarActivoPlan(plan.id, false, "/vehiculos")).rejects.toThrow(AutorizacionError);
    });
  });

  describe("aplicarPlanEstandar", () => {
    it("aplica los ítems del catálogo estándar que el vehículo todavía no tiene", async () => {
      const vehiculo = await crearVehiculo();
      const nombreItem = `Item-${sufijoCorto()}`;
      await prisma.planMantenimientoEstandarItem.create({
        data: { empresaId, categoria: "Motor", nombre: nombreItem, tipoIntervalo: "KM", intervaloKm: 10000, activo: true },
      });
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await aplicarPlanEstandar(vehiculo.id, "/vehiculos");
      expect(resultado?.aplicados).toBeGreaterThanOrEqual(1);
      const plan = await prisma.planMantenimiento.findFirstOrThrow({ where: { vehiculoId: vehiculo.id, nombre: nombreItem } });
      expect(plan.intervaloKm).toBe(10000);

      // Volver a aplicar no debería duplicar (ya existe por nombre).
      const segundo = await aplicarPlanEstandar(vehiculo.id, "/vehiculos");
      expect(segundo?.aplicados).toBe(0);
    });

    it("un rol fuera de ROLES_ADMIN_MANTENIMIENTO no puede aplicar el plan estándar", async () => {
      const chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
      const vehiculo = await crearVehiculo();
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      await expect(aplicarPlanEstandar(vehiculo.id, "/vehiculos")).rejects.toThrow(AutorizacionError);
    });
  });

  describe("aplicarPlanEstandarAFlota", () => {
    it("no hace nada si la lista de vehículos está vacía", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await aplicarPlanEstandarAFlota([]);
      expect(resultado).toEqual({ aplicados: 0, vehiculos: 0 });
    });

    it("aplica el catálogo a varios vehículos de una sola vez", async () => {
      const nombreItem = `Item-${sufijoCorto()}`;
      await prisma.planMantenimientoEstandarItem.create({
        data: { empresaId, categoria: "Motor", nombre: nombreItem, tipoIntervalo: "KM", intervaloKm: 8000, activo: true },
      });
      const vehiculo1 = await crearVehiculo();
      const vehiculo2 = await crearVehiculo();
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await aplicarPlanEstandarAFlota([vehiculo1.id, vehiculo2.id]);
      expect(resultado?.vehiculos).toBe(2);
      expect(resultado?.aplicados).toBeGreaterThanOrEqual(2);
    });

    it("un rol fuera de ROLES_ADMIN_MANTENIMIENTO no puede aplicar a la flota", async () => {
      const chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
      const vehiculo = await crearVehiculo();
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      await expect(aplicarPlanEstandarAFlota([vehiculo.id])).rejects.toThrow(AutorizacionError);
    });
  });
});
