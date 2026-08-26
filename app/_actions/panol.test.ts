import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  crearArticuloPanol,
  actualizarArticuloPanol,
  alternarActivoArticulo,
} from "@/app/_actions/panol";
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

describe("app/_actions/panol.ts", () => {
  let empresaId: string;
  let prisma: ScopedPrismaClient;
  let admin: { id: string };

  beforeAll(async () => {
    const empresa = await crearEmpresaDePrueba("panol");
    empresaId = empresa.empresaId;
    prisma = empresa.prisma;
    admin = await crearUsuarioDePrueba(empresaId, "ADMIN");
  });

  afterAll(async () => {
    await borrarEmpresaDePrueba(empresaId);
  });

  describe("crearArticuloPanol", () => {
    it("crea un artículo con stock por default 0 y redirige a /panol", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const nombre = `Art-${sufijoCorto()}`;
      await expect(crearArticuloPanol(undefined, formData({ nombre }))).rejects.toThrow(RedirectDeTest);
      const articulo = await prisma.articuloPanol.findFirstOrThrow({ where: { nombre } });
      expect(articulo.stockActual).toBe(0);
      expect(articulo.stockMinimo).toBe(0);
      expect(articulo.empresaId).toBe(empresaId);
    });

    it("crea un artículo con stock inicial explícito", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const nombre = `Art-${sufijoCorto()}`;
      await expect(
        crearArticuloPanol(undefined, formData({ nombre, stockActual: "10", stockMinimo: "2" }))
      ).rejects.toThrow(RedirectDeTest);
      const articulo = await prisma.articuloPanol.findFirstOrThrow({ where: { nombre } });
      expect(articulo.stockActual).toBe(10);
      expect(articulo.stockMinimo).toBe(2);
    });

    it("rechaza sin nombre (fieldErrors)", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await crearArticuloPanol(undefined, formData({ nombre: "" }));
      expect(resultado?.fieldErrors?.nombre).toBeTruthy();
    });

    it("un rol fuera de ROLES_ADMIN_MANTENIMIENTO no puede crear un artículo", async () => {
      const chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      await expect(
        crearArticuloPanol(undefined, formData({ nombre: `Art-${sufijoCorto()}` }))
      ).rejects.toThrow(AutorizacionError);
    });
  });

  describe("actualizarArticuloPanol", () => {
    it("edita un artículo existente y redirige", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const articulo = await prisma.articuloPanol.create({
        data: { empresaId, nombre: `Art-${sufijoCorto()}` },
      });
      const nuevoNombre = `Editado-${sufijoCorto()}`;
      await expect(
        actualizarArticuloPanol(articulo.id, undefined, formData({ nombre: nuevoNombre, stockActual: "5" }))
      ).rejects.toThrow(RedirectDeTest);
      const actualizado = await prisma.articuloPanol.findUniqueOrThrow({ where: { id: articulo.id } });
      expect(actualizado.nombre).toBe(nuevoNombre);
      expect(actualizado.stockActual).toBe(5);
    });

    it("un rol fuera de ROLES_ADMIN_MANTENIMIENTO no puede editar", async () => {
      const chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
      const articulo = await prisma.articuloPanol.create({
        data: { empresaId, nombre: `Art-${sufijoCorto()}` },
      });
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      await expect(
        actualizarArticuloPanol(articulo.id, undefined, formData({ nombre: "x" }))
      ).rejects.toThrow(AutorizacionError);
    });
  });

  describe("alternarActivoArticulo", () => {
    it("activa/desactiva un artículo", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const articulo = await prisma.articuloPanol.create({
        data: { empresaId, nombre: `Art-${sufijoCorto()}` },
      });
      await alternarActivoArticulo(articulo.id, false);
      expect((await prisma.articuloPanol.findUniqueOrThrow({ where: { id: articulo.id } })).activo).toBe(false);
      await alternarActivoArticulo(articulo.id, true);
      expect((await prisma.articuloPanol.findUniqueOrThrow({ where: { id: articulo.id } })).activo).toBe(true);
    });

    it("un rol fuera de ROLES_ADMIN_MANTENIMIENTO no puede alternar activo", async () => {
      const chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
      const articulo = await prisma.articuloPanol.create({
        data: { empresaId, nombre: `Art-${sufijoCorto()}` },
      });
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      await expect(alternarActivoArticulo(articulo.id, false)).rejects.toThrow(AutorizacionError);
    });
  });
});
