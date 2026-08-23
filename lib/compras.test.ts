import { describe, it, expect } from "vitest";
import { Prisma } from "@/app/generated/prisma/client";
import { calcularRequiereAutorizacion } from "@/lib/compras";

describe("calcularRequiereAutorizacion", () => {
  it("no requiere autorización si no hay umbral configurado (función desactivada)", () => {
    expect(calcularRequiereAutorizacion(999999, null)).toBe(false);
  });

  it("no requiere autorización si todavía no se cargó un monto estimado", () => {
    expect(calcularRequiereAutorizacion(undefined, new Prisma.Decimal(1000))).toBe(false);
  });

  it("requiere autorización cuando el monto supera el umbral", () => {
    expect(calcularRequiereAutorizacion(1500, new Prisma.Decimal(1000))).toBe(true);
  });

  it("no requiere autorización cuando el monto es igual al umbral (solo por encima)", () => {
    expect(calcularRequiereAutorizacion(1000, new Prisma.Decimal(1000))).toBe(false);
  });

  it("no requiere autorización cuando el monto está por debajo del umbral", () => {
    expect(calcularRequiereAutorizacion(500, new Prisma.Decimal(1000))).toBe(false);
  });
});
