import { describe, it, expect } from "vitest";
import { optionalInt, optionalNumber, normalizarDni } from "@/lib/zod-helpers";

describe("optionalNumber", () => {
  const schema = optionalNumber();

  it("acepta un número positivo", () => {
    expect(schema.parse("150.5")).toBe(150.5);
  });

  it("acepta cero", () => {
    expect(schema.parse("0")).toBe(0);
  });

  // Regresión directa de un hallazgo de la auditoría: montoEstimado,
  // montoTotal, costoUnitario y presupuestoMonto usan todos este helper —
  // sin este rechazo, se podía cargar un monto negativo por error de tipeo.
  it("rechaza un número negativo", () => {
    expect(() => schema.parse("-100")).toThrow();
  });

  it("un string vacío se vuelve undefined, no 0", () => {
    expect(schema.parse("")).toBeUndefined();
  });

  it("null/undefined se vuelven undefined", () => {
    expect(schema.parse(null)).toBeUndefined();
    expect(schema.parse(undefined)).toBeUndefined();
  });
});

describe("optionalInt", () => {
  it("acepta un entero dentro del rango", () => {
    expect(optionalInt({ min: 1 }).parse("5")).toBe(5);
  });

  it("rechaza por debajo del mínimo", () => {
    expect(() => optionalInt({ min: 1 }).parse("0")).toThrow();
  });

  it("rechaza por encima del máximo", () => {
    expect(() => optionalInt({ max: 10 }).parse("11")).toThrow();
  });

  it("rechaza un decimal (tiene que ser entero)", () => {
    expect(() => optionalInt().parse("1.5")).toThrow();
  });

  it("un string vacío se vuelve undefined", () => {
    expect(optionalInt().parse("")).toBeUndefined();
  });
});

describe("normalizarDni", () => {
  it("saca puntos, espacios y guiones", () => {
    expect(normalizarDni("30.123.456")).toBe("30123456");
    expect(normalizarDni("30-123-456")).toBe("30123456");
    expect(normalizarDni("30 123 456")).toBe("30123456");
  });

  it("no toca un DNI ya limpio", () => {
    expect(normalizarDni("30123456")).toBe("30123456");
  });
});
