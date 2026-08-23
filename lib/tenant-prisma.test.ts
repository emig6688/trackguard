import { describe, it, expect } from "vitest";
import { aplicarScopeDeEmpresa, MODELOS_CON_EMPRESA } from "@/lib/tenant-prisma";

const EMPRESA_A = "empresa-a";

describe("aplicarScopeDeEmpresa", () => {
  it("deja pasar sin tocar un modelo que no tiene empresaId (ej. Usuario)", () => {
    const args = { where: { email: "x@x.com" } };
    const resultado = aplicarScopeDeEmpresa("Usuario", "findFirst", args, EMPRESA_A);
    expect(resultado).toEqual({ where: { email: "x@x.com" } });
  });

  it("deja pasar sin tocar cuando no hay modelo (operaciones raw, transacciones)", () => {
    const args = { where: { id: "1" } };
    const resultado = aplicarScopeDeEmpresa(undefined, "findMany", args, EMPRESA_A);
    expect(resultado).toBe(args);
  });

  describe.each(["findUnique", "findUniqueOrThrow", "update", "delete"] as const)(
    "%s",
    (operation) => {
      it("agrega empresaId como filtro hermano de la clave única", () => {
        const args = { where: { id: "ot-1" } };
        const resultado = aplicarScopeDeEmpresa("OrdenDeTrabajo", operation, args, EMPRESA_A);
        expect(resultado.where).toEqual({ id: "ot-1", empresaId: EMPRESA_A });
      });

      it("no permite que un where malicioso pise el empresaId inyectado", () => {
        // Si alguien pasara empresaId de otra empresa a mano (por accidente o
        // con mala intención), el spread de abajo tiene que ganar siempre.
        const args = { where: { id: "ot-1", empresaId: "empresa-ajena" } };
        const resultado = aplicarScopeDeEmpresa("OrdenDeTrabajo", operation, args, EMPRESA_A);
        expect(resultado.where.empresaId).toBe(EMPRESA_A);
      });
    }
  );

  describe.each([
    "findFirst",
    "findFirstOrThrow",
    "findMany",
    "updateMany",
    "deleteMany",
    "count",
    "aggregate",
    "groupBy",
  ] as const)("%s", (operation) => {
    it("agrega empresaId al where existente", () => {
      const args = { where: { estado: "PENDIENTE_APROBACION" } };
      const resultado = aplicarScopeDeEmpresa("OrdenDeTrabajo", operation, args, EMPRESA_A);
      expect(resultado.where).toEqual({ estado: "PENDIENTE_APROBACION", empresaId: EMPRESA_A });
    });

    it("funciona incluso sin where previo", () => {
      const args = {};
      const resultado = aplicarScopeDeEmpresa("OrdenDeTrabajo", operation, args, EMPRESA_A);
      expect(resultado.where).toEqual({ empresaId: EMPRESA_A });
    });
  });

  it("create fuerza empresaId en data", () => {
    const args = { data: { numero: "OT-1", titulo: "Test" } };
    const resultado = aplicarScopeDeEmpresa("OrdenDeTrabajo", "create", args, EMPRESA_A);
    expect(resultado.data).toEqual({ numero: "OT-1", titulo: "Test", empresaId: EMPRESA_A });
  });

  it("createMany fuerza empresaId en cada fila de un array", () => {
    const args = { data: [{ numero: "OT-1" }, { numero: "OT-2" }] };
    const resultado = aplicarScopeDeEmpresa("OrdenDeTrabajo", "createMany", args, EMPRESA_A);
    expect(resultado.data).toEqual([
      { numero: "OT-1", empresaId: EMPRESA_A },
      { numero: "OT-2", empresaId: EMPRESA_A },
    ]);
  });

  it("createMany también funciona si data no es un array", () => {
    const args = { data: { numero: "OT-1" } };
    const resultado = aplicarScopeDeEmpresa("OrdenDeTrabajo", "createManyAndReturn", args, EMPRESA_A);
    expect(resultado.data).toEqual({ numero: "OT-1", empresaId: EMPRESA_A });
  });

  it("upsert agrega empresaId en where, create y update a la vez", () => {
    const args = {
      where: { id: "ot-1" },
      create: { numero: "OT-1" },
      update: { estado: "APROBADA" },
    };
    const resultado = aplicarScopeDeEmpresa("OrdenDeTrabajo", "upsert", args, EMPRESA_A);
    expect(resultado.where).toEqual({ id: "ot-1", empresaId: EMPRESA_A });
    expect(resultado.create).toEqual({ numero: "OT-1", empresaId: EMPRESA_A });
    expect(resultado.update).toEqual({ estado: "APROBADA", empresaId: EMPRESA_A });
  });

  it("una operación desconocida no toca los args", () => {
    const args = { where: { id: "1" } };
    const resultado = aplicarScopeDeEmpresa("OrdenDeTrabajo", "$queryRaw", args, EMPRESA_A);
    expect(resultado).toBe(args);
  });
});

describe("MODELOS_CON_EMPRESA", () => {
  // Regresión directa del hallazgo de la auditoría: este modelo se filtraba
  // por tenant a mano en cada archivo que lo tocaba, hasta que se encontró un
  // callsite que no lo hacía (fuga entre empresas). Si algún día alguien lo
  // saca de este set sin querer, este test lo detecta antes que un cliente.
  it("incluye PlanMantenimientoEstandarItem", () => {
    expect(MODELOS_CON_EMPRESA.has("PlanMantenimientoEstandarItem")).toBe(true);
  });

  it("NO incluye Usuario (su email/dni tienen que ser únicos en toda la tabla)", () => {
    expect(MODELOS_CON_EMPRESA.has("Usuario")).toBe(false);
  });

  it("NO incluye OTDerivacionExterna (no tiene empresaId propio, se valida a mano)", () => {
    expect(MODELOS_CON_EMPRESA.has("OTDerivacionExterna")).toBe(false);
  });

  it("NO incluye PresupuestoCompra (no tiene empresaId propio, se valida a mano)", () => {
    expect(MODELOS_CON_EMPRESA.has("PresupuestoCompra")).toBe(false);
  });
});
