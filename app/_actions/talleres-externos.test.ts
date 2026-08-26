import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  crearTallerExterno,
  actualizarTallerExterno,
  alternarActivoTaller,
} from "@/app/_actions/talleres-externos";
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

describe("app/_actions/talleres-externos.ts", () => {
  let empresaId: string;
  let prisma: ScopedPrismaClient;
  let admin: { id: string };

  beforeAll(async () => {
    const empresa = await crearEmpresaDePrueba("talleres");
    empresaId = empresa.empresaId;
    prisma = empresa.prisma;
    admin = await crearUsuarioDePrueba(empresaId, "ADMIN");
  });

  afterAll(async () => {
    await borrarEmpresaDePrueba(empresaId);
  });

  describe("crearTallerExterno", () => {
    it("crea un taller externo y redirige a /talleres-externos", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const nombre = `Taller-${sufijoCorto()}`;
      const fd = formData({ nombre, email: "" });
      await expect(crearTallerExterno(undefined, fd)).rejects.toThrow(RedirectDeTest);
      const taller = await prisma.tallerExterno.findFirstOrThrow({ where: { nombre } });
      expect(taller.empresaId).toBe(empresaId);
      expect(taller.activo).toBe(true);
    });

    it("rechaza sin nombre (fieldErrors)", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await crearTallerExterno(undefined, formData({ nombre: "" }));
      expect(resultado?.fieldErrors?.nombre).toBeTruthy();
    });

    it("rechaza un email inválido", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await crearTallerExterno(
        undefined,
        formData({ nombre: `Taller-${sufijoCorto()}`, email: "no-es-un-email" })
      );
      expect(resultado?.fieldErrors?.email).toBeTruthy();
    });

    it("un rol fuera de ROLES_ADMIN_MANTENIMIENTO no puede crear un taller", async () => {
      const chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      await expect(
        crearTallerExterno(undefined, formData({ nombre: `Taller-${sufijoCorto()}` }))
      ).rejects.toThrow(AutorizacionError);
    });
  });

  describe("actualizarTallerExterno", () => {
    it("edita un taller existente y redirige", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const taller = await prisma.tallerExterno.create({
        data: { empresaId, nombre: `Taller-${sufijoCorto()}` },
      });
      const nuevoNombre = `Editado-${sufijoCorto()}`;
      await expect(
        actualizarTallerExterno(taller.id, undefined, formData({ nombre: nuevoNombre, email: "" }))
      ).rejects.toThrow(RedirectDeTest);
      const actualizado = await prisma.tallerExterno.findUniqueOrThrow({ where: { id: taller.id } });
      expect(actualizado.nombre).toBe(nuevoNombre);
    });

    it("un rol fuera de ROLES_ADMIN_MANTENIMIENTO no puede editar", async () => {
      const chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
      const taller = await prisma.tallerExterno.create({
        data: { empresaId, nombre: `Taller-${sufijoCorto()}` },
      });
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      await expect(
        actualizarTallerExterno(taller.id, undefined, formData({ nombre: "x" }))
      ).rejects.toThrow(AutorizacionError);
    });
  });

  describe("alternarActivoTaller", () => {
    it("activa/desactiva un taller", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const taller = await prisma.tallerExterno.create({
        data: { empresaId, nombre: `Taller-${sufijoCorto()}` },
      });
      await alternarActivoTaller(taller.id, false);
      expect((await prisma.tallerExterno.findUniqueOrThrow({ where: { id: taller.id } })).activo).toBe(false);
      await alternarActivoTaller(taller.id, true);
      expect((await prisma.tallerExterno.findUniqueOrThrow({ where: { id: taller.id } })).activo).toBe(true);
    });

    it("un rol fuera de ROLES_ADMIN_MANTENIMIENTO no puede alternar activo", async () => {
      const chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
      const taller = await prisma.tallerExterno.create({
        data: { empresaId, nombre: `Taller-${sufijoCorto()}` },
      });
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      await expect(alternarActivoTaller(taller.id, false)).rejects.toThrow(AutorizacionError);
    });
  });
});
