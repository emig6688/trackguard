import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  actualizarReglaNotificacion,
  actualizarMontoAutorizacionCompra,
  actualizarMontoAutorizacionCompraMecanico,
  actualizarAutoAprobacionMecanicos,
} from "@/app/_actions/reglasNotificacion";
import { AutorizacionError } from "@/lib/permisos";
import {
  crearEmpresaDePrueba,
  crearUsuarioDePrueba,
  mockearSesion,
  borrarEmpresaDePrueba,
} from "@/lib/test-fixtures";
import type { ScopedPrismaClient } from "@/lib/tenant-prisma";

describe("app/_actions/reglasNotificacion.ts", () => {
  let empresaId: string;
  let prisma: ScopedPrismaClient;
  let admin: { id: string };

  beforeAll(async () => {
    const empresa = await crearEmpresaDePrueba("reglasNotif");
    empresaId = empresa.empresaId;
    prisma = empresa.prisma;
    admin = await crearUsuarioDePrueba(empresaId, "ADMIN");
  });

  afterAll(async () => {
    await borrarEmpresaDePrueba(empresaId);
  });

  describe("actualizarReglaNotificacion", () => {
    it("crea la regla si no existía (upsert), limpiando diasAviso", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      await actualizarReglaNotificacion(
        "NUEVA_ORDEN_COMPRA",
        ["GERENTE", "ADMIN"],
        ["EMAIL", "EN_APP"],
        [7, 15, 7, -1, 0],
        true
      );
      const regla = await prisma.reglaNotificacion.findUniqueOrThrow({
        where: { empresaId_tipo: { empresaId, tipo: "NUEVA_ORDEN_COMPRA" } },
      });
      expect(regla.roles.sort()).toEqual(["ADMIN", "GERENTE"].sort());
      expect(regla.canales.sort()).toEqual(["EMAIL", "EN_APP"].sort());
      // Dedupe, filtra <=0 y no enteros, ordena descendente.
      expect(regla.diasAviso).toEqual([15, 7]);
      expect(regla.activo).toBe(true);
    });

    it("actualiza la regla si ya existía", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      await actualizarReglaNotificacion("COMPRA_REALIZADA", ["GERENTE"], ["EMAIL"], [], true);
      await actualizarReglaNotificacion("COMPRA_REALIZADA", ["ADMIN"], ["EN_APP"], [], false);

      const regla = await prisma.reglaNotificacion.findUniqueOrThrow({
        where: { empresaId_tipo: { empresaId, tipo: "COMPRA_REALIZADA" } },
      });
      expect(regla.roles).toEqual(["ADMIN"]);
      expect(regla.canales).toEqual(["EN_APP"]);
      expect(regla.activo).toBe(false);
    });

    it("un rol fuera de ROLES_ADMIN_MANTENIMIENTO no puede actualizar reglas", async () => {
      const chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      await expect(
        actualizarReglaNotificacion("NUEVA_ORDEN_COMPRA", [], ["EMAIL"], [], true)
      ).rejects.toThrow(AutorizacionError);
    });
  });

  describe("actualizarMontoAutorizacionCompra", () => {
    it("guarda el monto cuando es positivo, y lo desactiva (null) con negativo o null", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      await actualizarMontoAutorizacionCompra(1500);
      expect(
        Number((await prisma.empresa.findUniqueOrThrow({ where: { id: empresaId } })).montoAutorizacionCompra)
      ).toBe(1500);

      await actualizarMontoAutorizacionCompra(-5);
      expect(
        (await prisma.empresa.findUniqueOrThrow({ where: { id: empresaId } })).montoAutorizacionCompra
      ).toBeNull();

      await actualizarMontoAutorizacionCompra(2000);
      await actualizarMontoAutorizacionCompra(null);
      expect(
        (await prisma.empresa.findUniqueOrThrow({ where: { id: empresaId } })).montoAutorizacionCompra
      ).toBeNull();
    });

    it("un rol fuera de ROLES_ADMIN_MANTENIMIENTO no puede modificar el monto", async () => {
      const chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      await expect(actualizarMontoAutorizacionCompra(1000)).rejects.toThrow(AutorizacionError);
    });
  });

  describe("actualizarMontoAutorizacionCompraMecanico", () => {
    it("guarda el monto de la compuerta de mecánico, independiente de la de gerencia", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      await actualizarMontoAutorizacionCompraMecanico(800);
      const empresa = await prisma.empresa.findUniqueOrThrow({ where: { id: empresaId } });
      expect(Number(empresa.montoAutorizacionCompraMecanico)).toBe(800);
    });

    it("un rol fuera de ROLES_ADMIN_MANTENIMIENTO no puede modificar el monto de mecánico", async () => {
      const chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      await expect(actualizarMontoAutorizacionCompraMecanico(500)).rejects.toThrow(AutorizacionError);
    });
  });

  describe("actualizarAutoAprobacionMecanicos", () => {
    it("activa/desactiva la auto-aprobación de OT generadas por chofer", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      await actualizarAutoAprobacionMecanicos(true);
      expect(
        (await prisma.empresa.findUniqueOrThrow({ where: { id: empresaId } })).autoAprobacionMecanicosActiva
      ).toBe(true);

      await actualizarAutoAprobacionMecanicos(false);
      expect(
        (await prisma.empresa.findUniqueOrThrow({ where: { id: empresaId } })).autoAprobacionMecanicosActiva
      ).toBe(false);
    });

    it("un rol fuera de ROLES_ADMIN_MANTENIMIENTO no puede alternar la auto-aprobación", async () => {
      const chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      await expect(actualizarAutoAprobacionMecanicos(true)).rejects.toThrow(AutorizacionError);
    });
  });
});
