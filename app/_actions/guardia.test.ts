import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  guardarObservacionGuardia,
  marcarDiaNoOperado,
  desmarcarDiaNoOperado,
} from "@/app/_actions/guardia";
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

describe("app/_actions/guardia.ts", () => {
  let empresaId: string;
  let prisma: ScopedPrismaClient;
  let guardia: { id: string };

  beforeAll(async () => {
    const empresa = await crearEmpresaDePrueba("guardia");
    empresaId = empresa.empresaId;
    prisma = empresa.prisma;
    guardia = await crearUsuarioDePrueba(empresaId, "GUARDIA");
  });

  afterAll(async () => {
    // ChecklistRealizado no tiene empresaId propio ni onDelete: Cascade desde
    // Vehiculo/ChecklistTemplate/Usuario (a diferencia de las tablas "nieto"
    // documentadas en test-fixtures.ts) — hay que limpiarlo a mano antes de
    // borrar la empresa, o el borrado de Vehiculo/ChecklistTemplate/Usuario
    // queda bloqueado por esa FK.
    await prisma.checklistRealizado.deleteMany({ where: { vehiculo: { empresaId } } });
    await borrarEmpresaDePrueba(empresaId);
  });

  async function crearVehiculo() {
    return prisma.vehiculo.create({
      data: { empresaId, patente: `TSTGRD${sufijoCorto()}`, marca: "Test", modelo: "Test", tipo: "CAMION" },
    });
  }

  describe("guardarObservacionGuardia", () => {
    it("crea/actualiza la observación, y la borra si se manda vacía", async () => {
      const vehiculo = await crearVehiculo();
      mockearSesion({ id: guardia.id, rol: "GUARDIA", empresaId });

      await guardarObservacionGuardia(vehiculo.id, "SALIDA", formData({ observacion: "Golpe en el paragolpes" }));
      const creada = await prisma.observacionGuardia.findFirstOrThrow({ where: { vehiculoId: vehiculo.id, etapa: "SALIDA" } });
      expect(creada.observacion).toBe("Golpe en el paragolpes");
      expect(creada.guardiaId).toBe(guardia.id);

      await guardarObservacionGuardia(vehiculo.id, "SALIDA", formData({ observacion: "" }));
      const borrada = await prisma.observacionGuardia.findFirst({ where: { vehiculoId: vehiculo.id, etapa: "SALIDA" } });
      expect(borrada).toBeNull();
    });

    it("un rol fuera de ROLES_GUARDIA no puede guardar la observación", async () => {
      const mecanico = await crearUsuarioDePrueba(empresaId, "MECANICO_INTERNO");
      const vehiculo = await crearVehiculo();
      mockearSesion({ id: mecanico.id, rol: "MECANICO_INTERNO", empresaId });
      await expect(
        guardarObservacionGuardia(vehiculo.id, "SALIDA", formData({ observacion: "x" }))
      ).rejects.toThrow(AutorizacionError);
    });
  });

  describe("marcarDiaNoOperado", () => {
    it("sin historial de uso, el vehículo queda sin chofer asignado", async () => {
      const vehiculo = await crearVehiculo();
      mockearSesion({ id: guardia.id, rol: "GUARDIA", empresaId });
      await marcarDiaNoOperado(vehiculo.id, formData({ motivo: "En taller" }));

      const dia = await prisma.diaNoOperado.findFirstOrThrow({ where: { vehiculoId: vehiculo.id } });
      expect(dia.choferId).toBeNull();
      expect(dia.motivo).toBe("En taller");
      expect(dia.marcadoPorId).toBe(guardia.id);
    });

    it("elige el chofer del checklist/evento de ruta más reciente de ese vehículo", async () => {
      const vehiculo = await crearVehiculo();
      const choferViejo = await crearUsuarioDePrueba(empresaId, "CHOFER");
      const choferReciente = await crearUsuarioDePrueba(empresaId, "CHOFER");

      const template = await prisma.checklistTemplate.create({
        data: { empresaId, nombre: `Template-${sufijoCorto()}` },
      });
      await prisma.checklistRealizado.create({
        data: {
          templateId: template.id,
          vehiculoId: vehiculo.id,
          choferId: choferViejo.id,
          fechaHora: new Date("2020-01-01T00:00:00Z"),
        },
      });
      await prisma.eventoRuta.create({
        data: {
          empresaId,
          vehiculoId: vehiculo.id,
          choferId: choferReciente.id,
          tipo: "OBSERVACION",
          descripcion: "Test",
          fechaHora: new Date("2026-01-01T00:00:00Z"),
        },
      });

      mockearSesion({ id: guardia.id, rol: "GUARDIA", empresaId });
      await marcarDiaNoOperado(vehiculo.id, formData({}));

      const dia = await prisma.diaNoOperado.findFirstOrThrow({ where: { vehiculoId: vehiculo.id } });
      expect(dia.choferId).toBe(choferReciente.id);
    });

    it("un rol fuera de ROLES_GUARDIA no puede marcar un día no operado", async () => {
      const mecanico = await crearUsuarioDePrueba(empresaId, "MECANICO_INTERNO");
      const vehiculo = await crearVehiculo();
      mockearSesion({ id: mecanico.id, rol: "MECANICO_INTERNO", empresaId });
      await expect(marcarDiaNoOperado(vehiculo.id, formData({}))).rejects.toThrow(AutorizacionError);
    });
  });

  describe("desmarcarDiaNoOperado", () => {
    it("borra el registro de día no operado del vehículo", async () => {
      const vehiculo = await crearVehiculo();
      mockearSesion({ id: guardia.id, rol: "GUARDIA", empresaId });
      await marcarDiaNoOperado(vehiculo.id, formData({ motivo: "Feriado" }));
      await desmarcarDiaNoOperado(vehiculo.id);

      const dia = await prisma.diaNoOperado.findFirst({ where: { vehiculoId: vehiculo.id } });
      expect(dia).toBeNull();
    });

    it("un rol fuera de ROLES_GUARDIA no puede desmarcar", async () => {
      const mecanico = await crearUsuarioDePrueba(empresaId, "MECANICO_INTERNO");
      const vehiculo = await crearVehiculo();
      mockearSesion({ id: mecanico.id, rol: "MECANICO_INTERNO", empresaId });
      await expect(desmarcarDiaNoOperado(vehiculo.id)).rejects.toThrow(AutorizacionError);
    });
  });
});
