import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  crearItemCatalogoEstandar,
  actualizarItemCatalogoEstandar,
  alternarActivoItemCatalogoEstandar,
} from "@/app/_actions/planMantenimientoEstandar";
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

describe("app/_actions/planMantenimientoEstandar.ts", () => {
  let empresaId: string;
  let prisma: ScopedPrismaClient;
  let admin: { id: string };

  beforeAll(async () => {
    const empresa = await crearEmpresaDePrueba("planEstandar");
    empresaId = empresa.empresaId;
    prisma = empresa.prisma;
    admin = await crearUsuarioDePrueba(empresaId, "ADMIN");
  });

  afterAll(async () => {
    await borrarEmpresaDePrueba(empresaId);
  });

  describe("crearItemCatalogoEstandar", () => {
    it("crea un ítem de catálogo", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const nombre = `Item-${sufijoCorto()}`;
      const resultado = await crearItemCatalogoEstandar(
        undefined,
        formData({ categoria: "Motor", nombre, tipoIntervalo: "KM", intervaloKm: "10000" })
      );
      expect(resultado?.success).toBe(true);
      const item = await prisma.planMantenimientoEstandarItem.findFirstOrThrow({ where: { nombre } });
      expect(item.categoria).toBe("Motor");
      expect(item.intervaloKm).toBe(10000);
    });

    it("rechaza sin categoría", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await crearItemCatalogoEstandar(
        undefined,
        formData({ categoria: "", nombre: `Item-${sufijoCorto()}`, tipoIntervalo: "KM" })
      );
      expect(resultado?.fieldErrors?.categoria).toBeTruthy();
    });

    it("un rol fuera de ROLES_ADMIN_MANTENIMIENTO no puede crear", async () => {
      const chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      await expect(
        crearItemCatalogoEstandar(
          undefined,
          formData({ categoria: "Motor", nombre: `Item-${sufijoCorto()}`, tipoIntervalo: "KM" })
        )
      ).rejects.toThrow(AutorizacionError);
    });
  });

  describe("actualizarItemCatalogoEstandar", () => {
    it("edita un ítem existente", async () => {
      const item = await prisma.planMantenimientoEstandarItem.create({
        data: { empresaId, categoria: "Motor", nombre: `Item-${sufijoCorto()}`, tipoIntervalo: "KM", intervaloKm: 5000 },
      });
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const nuevoNombre = `Item-${sufijoCorto()}`;
      const resultado = await actualizarItemCatalogoEstandar(
        item.id,
        undefined,
        formData({ categoria: "Frenos", nombre: nuevoNombre, tipoIntervalo: "TIEMPO", intervaloDias: "180" })
      );
      expect(resultado?.success).toBe(true);
      const actualizado = await prisma.planMantenimientoEstandarItem.findUniqueOrThrow({ where: { id: item.id } });
      expect(actualizado.categoria).toBe("Frenos");
      expect(actualizado.nombre).toBe(nuevoNombre);
      expect(actualizado.intervaloDias).toBe(180);
    });

    it("rechaza sin nombre", async () => {
      const item = await prisma.planMantenimientoEstandarItem.create({
        data: { empresaId, categoria: "Motor", nombre: `Item-${sufijoCorto()}`, tipoIntervalo: "KM" },
      });
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await actualizarItemCatalogoEstandar(
        item.id,
        undefined,
        formData({ categoria: "Motor", nombre: "", tipoIntervalo: "KM" })
      );
      expect(resultado?.fieldErrors?.nombre).toBeTruthy();
    });

    it("un rol fuera de ROLES_ADMIN_MANTENIMIENTO no puede editar", async () => {
      const chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
      const item = await prisma.planMantenimientoEstandarItem.create({
        data: { empresaId, categoria: "Motor", nombre: `Item-${sufijoCorto()}`, tipoIntervalo: "KM" },
      });
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      await expect(
        actualizarItemCatalogoEstandar(
          item.id,
          undefined,
          formData({ categoria: "Motor", nombre: "X", tipoIntervalo: "KM" })
        )
      ).rejects.toThrow(AutorizacionError);
    });
  });

  describe("alternarActivoItemCatalogoEstandar", () => {
    it("activa/desactiva un ítem", async () => {
      const item = await prisma.planMantenimientoEstandarItem.create({
        data: { empresaId, categoria: "Motor", nombre: `Item-${sufijoCorto()}`, tipoIntervalo: "KM", activo: true },
      });
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      await alternarActivoItemCatalogoEstandar(item.id, false);
      expect(
        (await prisma.planMantenimientoEstandarItem.findUniqueOrThrow({ where: { id: item.id } })).activo
      ).toBe(false);
    });

    it("un rol fuera de ROLES_ADMIN_MANTENIMIENTO no puede alternar", async () => {
      const chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
      const item = await prisma.planMantenimientoEstandarItem.create({
        data: { empresaId, categoria: "Motor", nombre: `Item-${sufijoCorto()}`, tipoIntervalo: "KM" },
      });
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      await expect(alternarActivoItemCatalogoEstandar(item.id, false)).rejects.toThrow(AutorizacionError);
    });
  });
});
