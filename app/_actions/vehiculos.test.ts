import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  crearVehiculo,
  actualizarVehiculo,
  darDeBajaVehiculo,
  reactivarVehiculo,
  actualizarDisponibilidadVehiculo,
} from "@/app/_actions/vehiculos";
import { AutorizacionError } from "@/lib/permisos";
import {
  crearEmpresaDePrueba,
  crearUsuarioDePrueba,
  mockearSesion,
  borrarEmpresaDePrueba,
} from "@/lib/test-fixtures";
import { RedirectDeTest } from "../../vitest.setup";
import type { ScopedPrismaClient } from "@/lib/tenant-prisma";

function formData(campos: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

function sufijoCorto() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

describe("app/_actions/vehiculos.ts", () => {
  let empresaId: string;
  let prisma: ScopedPrismaClient;
  let admin: { id: string };
  let mecanico: { id: string };
  let chofer: { id: string };

  beforeAll(async () => {
    const empresa = await crearEmpresaDePrueba("vehiculos");
    empresaId = empresa.empresaId;
    prisma = empresa.prisma;

    admin = await crearUsuarioDePrueba(empresaId, "ADMIN");
    mecanico = await crearUsuarioDePrueba(empresaId, "MECANICO_INTERNO");
    chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
  });

  afterAll(async () => {
    await borrarEmpresaDePrueba(empresaId);
  });

  function datosVehiculo(overrides: Record<string, string> = {}) {
    return {
      patente: `TSTVEH${sufijoCorto()}`,
      marca: "Scania",
      modelo: "R450",
      tipo: "CAMION",
      ...overrides,
    };
  }

  async function crearVehiculoDePrueba() {
    mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
    const patente = `TSTVEH${sufijoCorto()}`;
    try {
      await crearVehiculo(undefined, formData(datosVehiculo({ patente })));
    } catch (err) {
      if (!(err instanceof RedirectDeTest)) throw err;
    }
    return prisma.vehiculo.findUniqueOrThrow({ where: { patente } });
  }

  describe("crearVehiculo", () => {
    it("crea un vehículo y redirige a /vehiculos", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const patente = `TSTVEH${sufijoCorto()}`;
      await expect(crearVehiculo(undefined, formData(datosVehiculo({ patente })))).rejects.toThrow(RedirectDeTest);
      const vehiculo = await prisma.vehiculo.findUniqueOrThrow({ where: { patente } });
      expect(vehiculo.marca).toBe("Scania");
      expect(vehiculo.tipo).toBe("CAMION");
    });

    it("devuelve fieldErrors si falta un campo requerido", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const fd = formData({ patente: `TSTVEH${sufijoCorto()}`, tipo: "CAMION" }); // sin marca/modelo
      const resultado = await crearVehiculo(undefined, fd);
      expect(resultado?.fieldErrors).toBeDefined();
      expect(Object.keys(resultado!.fieldErrors!)).toEqual(expect.arrayContaining(["marca", "modelo"]));
    });

    it("rechaza una patente duplicada", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const patente = `TSTVEH${sufijoCorto()}`;
      await expect(crearVehiculo(undefined, formData(datosVehiculo({ patente })))).rejects.toThrow(RedirectDeTest);
      const resultado = await crearVehiculo(undefined, formData(datosVehiculo({ patente })));
      expect(resultado?.error).toMatch(/ya existe un vehículo/i);
    });

    it("un rol fuera de ROLES_ADMIN_MANTENIMIENTO no puede crear un vehículo", async () => {
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      await expect(crearVehiculo(undefined, formData(datosVehiculo()))).rejects.toThrow(AutorizacionError);
    });
  });

  describe("actualizarVehiculo", () => {
    it("edita un vehículo y redirige a /vehiculos/:id", async () => {
      const vehiculo = await crearVehiculoDePrueba();
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const fd = formData(datosVehiculo({ patente: vehiculo.patente, modelo: "R500" }));
      await expect(actualizarVehiculo(vehiculo.id, undefined, fd)).rejects.toThrow(RedirectDeTest);
      const actualizado = await prisma.vehiculo.findUniqueOrThrow({ where: { id: vehiculo.id } });
      expect(actualizado.modelo).toBe("R500");
    });

    it("devuelve fieldErrors si el formulario es inválido", async () => {
      const vehiculo = await crearVehiculoDePrueba();
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await actualizarVehiculo(vehiculo.id, undefined, formData({ patente: "" }));
      expect(resultado?.fieldErrors).toBeDefined();
    });

    it("un rol fuera de ROLES_ADMIN_MANTENIMIENTO no puede editar", async () => {
      const vehiculo = await crearVehiculoDePrueba();
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      await expect(
        actualizarVehiculo(vehiculo.id, undefined, formData(datosVehiculo({ patente: vehiculo.patente })))
      ).rejects.toThrow(AutorizacionError);
    });
  });

  describe("darDeBajaVehiculo / reactivarVehiculo", () => {
    it("da de baja un vehículo con observación y lo reactiva", async () => {
      const vehiculo = await crearVehiculoDePrueba();
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      await darDeBajaVehiculo(vehiculo.id, formData({ observacion: "Motor fundido" }));

      let actualizado = await prisma.vehiculo.findUniqueOrThrow({ where: { id: vehiculo.id } });
      expect(actualizado.activo).toBe(false);
      expect(actualizado.observacionBaja).toBe("Motor fundido");
      expect(actualizado.fechaBaja).not.toBeNull();

      await reactivarVehiculo(vehiculo.id);
      actualizado = await prisma.vehiculo.findUniqueOrThrow({ where: { id: vehiculo.id } });
      expect(actualizado.activo).toBe(true);
      expect(actualizado.observacionBaja).toBeNull();
      expect(actualizado.fechaBaja).toBeNull();
    });

    it("rechaza dar de baja sin observación", async () => {
      const vehiculo = await crearVehiculoDePrueba();
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      await expect(darDeBajaVehiculo(vehiculo.id, formData({ observacion: "" }))).rejects.toThrow();
    });

    it("un rol fuera de ROLES_ADMIN_MANTENIMIENTO no puede dar de baja", async () => {
      const vehiculo = await crearVehiculoDePrueba();
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      await expect(darDeBajaVehiculo(vehiculo.id, formData({ observacion: "x" }))).rejects.toThrow(AutorizacionError);
    });
  });

  describe("actualizarDisponibilidadVehiculo", () => {
    it("marca no disponible con motivo", async () => {
      const vehiculo = await crearVehiculoDePrueba();
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      await actualizarDisponibilidadVehiculo(vehiculo.id, false, "Pinchazo");
      const actualizado = await prisma.vehiculo.findUniqueOrThrow({ where: { id: vehiculo.id } });
      expect(actualizado.disponible).toBe(false);
      expect(actualizado.motivoNoOperativo).toBe("Pinchazo");
      expect(actualizado.disponibleActualizadoPorId).toBe(admin.id);
    });

    it("rechaza marcar no disponible sin motivo", async () => {
      const vehiculo = await crearVehiculoDePrueba();
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      await expect(actualizarDisponibilidadVehiculo(vehiculo.id, false, "  ")).rejects.toThrow(
        /indicá qué problema/i
      );
    });

    it("marca disponible cuando no hay ninguna OT derivada a taller externo", async () => {
      const vehiculo = await crearVehiculoDePrueba();
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      await actualizarDisponibilidadVehiculo(vehiculo.id, false, "Falla");
      await actualizarDisponibilidadVehiculo(vehiculo.id, true);
      const actualizado = await prisma.vehiculo.findUniqueOrThrow({ where: { id: vehiculo.id } });
      expect(actualizado.disponible).toBe(true);
      expect(actualizado.motivoNoOperativo).toBeNull();
    });

    it("rechaza marcar disponible si el vehículo está derivado a un taller externo", async () => {
      const vehiculo = await crearVehiculoDePrueba();
      await prisma.ordenDeTrabajo.create({
        data: {
          empresaId,
          numero: `OT-DISP-${sufijoCorto()}`,
          titulo: "Reparación externa",
          origen: "MANUAL",
          vehiculoId: vehiculo.id,
          estado: "DERIVADA_EXTERNO",
        },
      });
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      await expect(actualizarDisponibilidadVehiculo(vehiculo.id, true)).rejects.toThrow(/derivado a un taller/i);
    });

    it("MECANICO_INTERNO puede actualizar la disponibilidad", async () => {
      const vehiculo = await crearVehiculoDePrueba();
      mockearSesion({ id: mecanico.id, rol: "MECANICO_INTERNO", empresaId });
      await actualizarDisponibilidadVehiculo(vehiculo.id, false, "Motor");
      const actualizado = await prisma.vehiculo.findUniqueOrThrow({ where: { id: vehiculo.id } });
      expect(actualizado.disponibleActualizadoPorId).toBe(mecanico.id);
    });

    it("un rol fuera de lo permitido no puede actualizar la disponibilidad", async () => {
      const vehiculo = await crearVehiculoDePrueba();
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      await expect(actualizarDisponibilidadVehiculo(vehiculo.id, false, "x")).rejects.toThrow(AutorizacionError);
    });
  });
});
