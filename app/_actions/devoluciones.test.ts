import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { crearDevolucion } from "@/app/_actions/devoluciones";
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

describe("app/_actions/devoluciones.ts", () => {
  let empresaId: string;
  let prisma: ScopedPrismaClient;
  let guardia: { id: string };
  let chofer: { id: string };

  beforeAll(async () => {
    const empresa = await crearEmpresaDePrueba("devoluciones");
    empresaId = empresa.empresaId;
    prisma = empresa.prisma;

    guardia = await crearUsuarioDePrueba(empresaId, "GUARDIA");
    chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
  });

  afterAll(async () => {
    await borrarEmpresaDePrueba(empresaId);
  });

  function datosBase(overrides: Record<string, string> = {}) {
    return {
      fecha: "2026-01-15",
      choferId: chofer.id,
      cliente: "Cliente SRL",
      remito: `REM-${sufijoCorto()}`,
      ...overrides,
    };
  }

  describe("crearDevolucion", () => {
    it("un rol fuera de ROLES_GUARDIA no puede crear una devolución", async () => {
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      await expect(crearDevolucion(undefined, formData(datosBase()))).rejects.toThrow(AutorizacionError);
    });

    it("devuelve fieldErrors si faltan campos requeridos", async () => {
      mockearSesion({ id: guardia.id, rol: "GUARDIA", empresaId });
      const resultado = await crearDevolucion(undefined, formData({ fecha: "", choferId: "", cliente: "", remito: "" }));
      expect(resultado?.error).toMatch(/revisá los campos/i);
      expect(resultado?.fieldErrors).toBeDefined();
    });

    it("rechaza un choferId que no corresponde a un CHOFER de la empresa", async () => {
      mockearSesion({ id: guardia.id, rol: "GUARDIA", empresaId });
      const resultado = await crearDevolucion(undefined, formData(datosBase({ choferId: "no-existe" })));
      expect(resultado?.error).toMatch(/chofer inválido/i);
    });

    it("rechaza un choferId que pertenece a un usuario que no es CHOFER", async () => {
      mockearSesion({ id: guardia.id, rol: "GUARDIA", empresaId });
      const resultado = await crearDevolucion(undefined, formData(datosBase({ choferId: guardia.id })));
      expect(resultado?.error).toMatch(/chofer inválido/i);
    });

    it("crea una devolución mínima (sin filas) y redirige a /guardia/devoluciones/:id", async () => {
      mockearSesion({ id: guardia.id, rol: "GUARDIA", empresaId });
      const remito = `REM-${sufijoCorto()}`;
      await expect(crearDevolucion(undefined, formData(datosBase({ remito })))).rejects.toThrow(RedirectDeTest);
      const devolucion = await prisma.devolucion.findFirstOrThrow({ where: { remito } });
      expect(devolucion.cliente).toBe("Cliente SRL");
      expect(devolucion.registradoPorId).toBe(guardia.id);
    });

    it("rechaza una fila de 'regresa a frigorífico' incompleta", async () => {
      mockearSesion({ id: guardia.id, rol: "GUARDIA", empresaId });
      const fd = formData(datosBase());
      fd.set("productoIds", "1");
      fd.set("prod_producto_1", "Carne vacuna");
      // falta prod_correlativo_1 y prod_ubicacion_1
      const resultado = await crearDevolucion(undefined, fd);
      expect(resultado?.error).toMatch(/regresa a frigorífico/i);
    });

    it("rechaza una fila de 'cambios' incompleta", async () => {
      mockearSesion({ id: guardia.id, rol: "GUARDIA", empresaId });
      const fd = formData(datosBase());
      fd.set("cambioIds", "1");
      fd.set("cam_cliente_1", "Otro cliente");
      // faltan los demás campos de la fila de cambio
      const resultado = await crearDevolucion(undefined, fd);
      expect(resultado?.error).toMatch(/cambios/i);
    });

    it("crea una devolución con una fila de producto y una de cambio", async () => {
      mockearSesion({ id: guardia.id, rol: "GUARDIA", empresaId });
      const remito = `REM-${sufijoCorto()}`;
      const fd = formData(datosBase({ remito }));
      fd.set("productoIds", "1");
      fd.set("prod_producto_1", "Carne vacuna");
      fd.set("prod_correlativo_1", "COR-1");
      fd.set("prod_ubicacion_1", "Camara 3");
      fd.set("cambioIds", "1");
      fd.set("cam_cliente_1", "Otro cliente");
      fd.set("cam_producto_1", "Pollo");
      fd.set("cam_correlativo_1", "COR-2");
      fd.set("cam_autoriz_1", "Juan Perez");

      await expect(crearDevolucion(undefined, fd)).rejects.toThrow(RedirectDeTest);

      const devolucion = await prisma.devolucion.findFirstOrThrow({
        where: { remito },
        include: { productos: true, cambios: true },
      });
      expect(devolucion.productos).toHaveLength(1);
      expect(devolucion.productos[0].producto).toBe("Carne vacuna");
      expect(devolucion.cambios).toHaveLength(1);
      expect(devolucion.cambios[0].autoriz).toBe("Juan Perez");
    });
  });
});
