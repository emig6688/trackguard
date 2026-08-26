import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eliminarRegistroAction, restaurarRegistroAction } from "@/app/_actions/papelera";
import { AutorizacionError } from "@/lib/permisos";
import {
  crearEmpresaDePrueba,
  crearUsuarioDePrueba,
  mockearSesion,
  borrarEmpresaDePrueba,
} from "@/lib/test-fixtures";
import type { ScopedPrismaClient } from "@/lib/tenant-prisma";

function sufijoCorto() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

describe("app/_actions/papelera.ts", () => {
  let empresaId: string;
  let prisma: ScopedPrismaClient;
  let admin: { id: string };

  beforeAll(async () => {
    const empresa = await crearEmpresaDePrueba("papelera");
    empresaId = empresa.empresaId;
    prisma = empresa.prisma;
    admin = await crearUsuarioDePrueba(empresaId, "ADMIN");
  });

  afterAll(async () => {
    await borrarEmpresaDePrueba(empresaId);
  });

  describe("eliminarRegistroAction / restaurarRegistroAction", () => {
    it("manda un artículo de pañol a la papelera (soft delete) y lo restaura", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const articulo = await prisma.articuloPanol.create({
        data: { empresaId, nombre: `Art-${sufijoCorto()}` },
      });

      await eliminarRegistroAction("articuloPanol", articulo.id);
      const eliminado = await prisma.articuloPanol.findUniqueOrThrow({ where: { id: articulo.id } });
      expect(eliminado.eliminadoEn).not.toBeNull();
      expect(eliminado.eliminadoPorId).toBe(admin.id);

      await restaurarRegistroAction("articuloPanol", articulo.id);
      const restaurado = await prisma.articuloPanol.findUniqueOrThrow({ where: { id: articulo.id } });
      expect(restaurado.eliminadoEn).toBeNull();
      expect(restaurado.eliminadoPorId).toBeNull();
    });

    it("acepta un redirectPath opcional sin fallar", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const vehiculo = await prisma.vehiculo.create({
        data: { empresaId, patente: `TSTPAP${sufijoCorto()}`, marca: "Test", modelo: "Test", tipo: "CAMION" },
      });
      await eliminarRegistroAction("vehiculo", vehiculo.id, `/vehiculos/${vehiculo.id}`);
      const eliminado = await prisma.vehiculo.findUniqueOrThrow({ where: { id: vehiculo.id } });
      expect(eliminado.eliminadoEn).not.toBeNull();
    });

    it("solo ADMIN puede eliminar un registro", async () => {
      const gerente = await crearUsuarioDePrueba(empresaId, "GERENTE");
      const articulo = await prisma.articuloPanol.create({
        data: { empresaId, nombre: `Art-${sufijoCorto()}` },
      });
      mockearSesion({ id: gerente.id, rol: "GERENTE", empresaId });
      await expect(eliminarRegistroAction("articuloPanol", articulo.id)).rejects.toThrow(AutorizacionError);
    });

    it("solo ADMIN puede restaurar un registro", async () => {
      const gerente = await crearUsuarioDePrueba(empresaId, "GERENTE");
      const articulo = await prisma.articuloPanol.create({
        data: { empresaId, nombre: `Art-${sufijoCorto()}`, eliminadoEn: new Date() },
      });
      mockearSesion({ id: gerente.id, rol: "GERENTE", empresaId });
      await expect(restaurarRegistroAction("articuloPanol", articulo.id)).rejects.toThrow(AutorizacionError);
    });
  });
});
