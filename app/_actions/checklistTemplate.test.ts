import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { guardarChecklistTemplate } from "@/app/_actions/checklistTemplate";
import { AutorizacionError } from "@/lib/permisos";
import {
  crearEmpresaDePrueba,
  crearUsuarioDePrueba,
  mockearSesion,
  borrarEmpresaDePrueba,
} from "@/lib/test-fixtures";
import type { ScopedPrismaClient } from "@/lib/tenant-prisma";

function formData(items: string[]) {
  const fd = new FormData();
  for (const item of items) fd.append("item", item);
  return fd;
}

describe("app/_actions/checklistTemplate.ts", () => {
  let empresaId: string;
  let prisma: ScopedPrismaClient;
  let admin: { id: string };

  beforeAll(async () => {
    const empresa = await crearEmpresaDePrueba("checklisttpl");
    empresaId = empresa.empresaId;
    prisma = empresa.prisma;
    admin = await crearUsuarioDePrueba(empresaId, "ADMIN");
  });

  afterAll(async () => {
    await borrarEmpresaDePrueba(empresaId);
  });

  it("crea la primera versión del template cuando no hay ninguna activa", async () => {
    mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
    const resultado = await guardarChecklistTemplate(undefined, formData(["Luces", "Frenos"]));
    expect(resultado?.success).toBe(true);

    const activo = await prisma.checklistTemplate.findFirstOrThrow({
      where: { activo: true },
      include: { items: { orderBy: { orden: "asc" } } },
    });
    expect(activo.version).toBe(1);
    expect(activo.items.map((i) => i.texto)).toEqual(["Luces", "Frenos"]);
  });

  it("guardar una nueva versión desactiva la anterior e incrementa version", async () => {
    mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
    await guardarChecklistTemplate(undefined, formData(["Luces"]));
    const anterior = await prisma.checklistTemplate.findFirstOrThrow({ where: { activo: true } });

    const resultado = await guardarChecklistTemplate(undefined, formData(["Luces", "Neumáticos", "Aceite"]));
    expect(resultado?.success).toBe(true);

    const previaActualizada = await prisma.checklistTemplate.findUniqueOrThrow({ where: { id: anterior.id } });
    expect(previaActualizada.activo).toBe(false);

    const nueva = await prisma.checklistTemplate.findFirstOrThrow({
      where: { activo: true },
      include: { items: true },
    });
    expect(nueva.version).toBe(anterior.version + 1);
    expect(nueva.items).toHaveLength(3);
  });

  it("rechaza si no se manda ningún ítem no vacío", async () => {
    mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
    const resultado = await guardarChecklistTemplate(undefined, formData(["   ", ""]));
    expect(resultado?.error).toMatch(/ítem/i);
  });

  it("un rol fuera de ROLES_ADMIN_MANTENIMIENTO no puede guardar el template", async () => {
    const chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
    mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
    await expect(guardarChecklistTemplate(undefined, formData(["Luces"]))).rejects.toThrow(AutorizacionError);
  });
});
