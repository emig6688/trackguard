import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { MODELOS_BACKUP } from "@/lib/backup-modelos";

describe("MODELOS_BACKUP", () => {
  it("cada nombre corresponde a una propiedad real del cliente de Prisma", () => {
    for (const modelo of MODELOS_BACKUP) {
      expect(prisma[modelo as keyof typeof prisma], `prisma.${modelo} no existe`).toBeDefined();
    }
  });

  it("no tiene nombres repetidos", () => {
    expect(new Set(MODELOS_BACKUP).size).toBe(MODELOS_BACKUP.length);
  });
});
