import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { registrarGasto } from "@/app/_actions/gastos";
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

describe("app/_actions/gastos.ts", () => {
  let empresaId: string;
  let prisma: ScopedPrismaClient;
  let chofer: { id: string; nombre: string };
  let vehiculoId: string;
  let templateId: string;

  beforeAll(async () => {
    const empresa = await crearEmpresaDePrueba("gastos");
    empresaId = empresa.empresaId;
    prisma = empresa.prisma;

    chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");

    const vehiculo = await prisma.vehiculo.create({
      data: { empresaId, patente: `TSTGTO${sufijoCorto()}`, marca: "Test", modelo: "Test", tipo: "CAMION" },
    });
    vehiculoId = vehiculo.id;

    const template = await prisma.checklistTemplate.create({
      data: { empresaId, nombre: `Template-${sufijoCorto()}` },
    });
    templateId = template.id;
  });

  afterAll(async () => {
    // ChecklistRealizado no tiene empresaId propio (no está en
    // MODELOS_CON_EMPRESA — ver lib/tenant-prisma.ts), así que
    // borrarEmpresaDePrueba no lo borra solo: limpiarlo a mano para no
    // romper el borrado de Vehiculo/ChecklistTemplate/Usuario por la FK.
    await prisma.checklistRealizado.deleteMany({ where: { choferId: chofer.id } });
    await borrarEmpresaDePrueba(empresaId);
  });

  async function desactivarReglaChecklist() {
    await prisma.reglaNotificacion.deleteMany({ where: { empresaId, tipo: "CHECKLIST_NO_REALIZADO" } });
  }

  async function activarReglaChecklist() {
    await prisma.reglaNotificacion.upsert({
      where: { empresaId_tipo: { empresaId, tipo: "CHECKLIST_NO_REALIZADO" } },
      create: { empresaId, tipo: "CHECKLIST_NO_REALIZADO", activo: true, roles: [] },
      update: { activo: true, roles: [] },
    });
  }

  describe("registrarGasto", () => {
    it("un rol fuera de ROLES_MOBILE_CHOFER no puede registrar un gasto", async () => {
      await desactivarReglaChecklist();
      const admin = await crearUsuarioDePrueba(empresaId, "ADMIN");
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const fd = formData({ tipo: "PEAJE", monto: "500", vehiculoId });
      await expect(registrarGasto(undefined, fd)).rejects.toThrow(AutorizacionError);
    });

    it("rechaza un tipo de gasto inválido", async () => {
      await desactivarReglaChecklist();
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      const fd = formData({ tipo: "INVALIDO", monto: "500", vehiculoId });
      const resultado = await registrarGasto(undefined, fd);
      expect(resultado?.error).toMatch(/tipo de gasto/i);
    });

    it("rechaza un monto inválido", async () => {
      await desactivarReglaChecklist();
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      const fd = formData({ tipo: "PEAJE", monto: "0", vehiculoId });
      const resultado = await registrarGasto(undefined, fd);
      expect(resultado?.error).toMatch(/monto válido/i);
    });

    it("rechaza sin vehículo", async () => {
      await desactivarReglaChecklist();
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      const fd = formData({ tipo: "PEAJE", monto: "500" });
      const resultado = await registrarGasto(undefined, fd);
      expect(resultado?.error).toMatch(/vehículo/i);
    });

    it("rechaza un vehículo inválido", async () => {
      await desactivarReglaChecklist();
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      const fd = formData({ tipo: "PEAJE", monto: "500", vehiculoId: "no-existe" });
      const resultado = await registrarGasto(undefined, fd);
      expect(resultado?.error).toMatch(/vehículo inválido/i);
    });

    it('exige descripción cuando el tipo es "OTRO"', async () => {
      await desactivarReglaChecklist();
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      const fd = formData({ tipo: "OTRO", monto: "500", vehiculoId });
      const resultado = await registrarGasto(undefined, fd);
      expect(resultado?.error).toMatch(/aclarar el gasto/i);
    });

    it("bloquea si el checklist obligatorio está activo y el chofer no lo hizo hoy", async () => {
      await activarReglaChecklist();
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      const fd = formData({ tipo: "PEAJE", monto: "500", vehiculoId });
      const resultado = await registrarGasto(undefined, fd);
      expect(resultado?.error).toMatch(/checklist pre-salida/i);
      await desactivarReglaChecklist();
    });

    it("con checklist obligatorio activo, rechaza cargar el gasto con un vehículo distinto al del checklist de hoy más reciente (IDOR)", async () => {
      const otroVehiculo = await prisma.vehiculo.create({
        data: { empresaId, patente: `TSTGTO${sufijoCorto()}`, marca: "Test", modelo: "Test", tipo: "CAMION" },
      });

      await prisma.checklistRealizado.create({
        data: { templateId, vehiculoId, choferId: chofer.id, momento: "PRESALIDA" },
      });
      await prisma.checklistRealizado.create({
        data: { templateId, vehiculoId: otroVehiculo.id, choferId: chofer.id, momento: "PRESALIDA" },
      });

      await activarReglaChecklist();
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      const fd = formData({ tipo: "PEAJE", monto: "500", vehiculoId });
      const resultado = await registrarGasto(undefined, fd);
      expect(resultado?.error).toMatch(/checklist de hoy/i);
      expect(resultado?.error).toContain(otroVehiculo.patente);

      await desactivarReglaChecklist();
    });

    it("registra un gasto sin comprobante y redirige a /mobile/gastos/listo", async () => {
      await desactivarReglaChecklist();
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      const fd = formData({ tipo: "VIATICO", monto: "1500", vehiculoId, descripcion: "Almuerzo" });
      await expect(registrarGasto(undefined, fd)).rejects.toThrow(RedirectDeTest);

      const gasto = await prisma.gasto.findFirstOrThrow({
        where: { choferId: chofer.id, vehiculoId, tipo: "VIATICO" },
        orderBy: { createdAt: "desc" },
      });
      expect(Number(gasto.monto)).toBe(1500);
      expect(gasto.descripcion).toBe("Almuerzo");
      expect(gasto.archivoComprobanteId).toBeNull();
      expect(gasto.estado).toBe("PENDIENTE_REVISION");
    });

    it("registra un gasto con comprobante adjunto", async () => {
      await desactivarReglaChecklist();
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      const fd = formData({ tipo: "REPARACION_MENOR", monto: "3000", vehiculoId });
      fd.set("archivoComprobante", new File(["x"], "comprobante.pdf", { type: "application/pdf" }));
      await expect(registrarGasto(undefined, fd)).rejects.toThrow(RedirectDeTest);

      const gasto = await prisma.gasto.findFirstOrThrow({
        where: { choferId: chofer.id, vehiculoId, tipo: "REPARACION_MENOR" },
        orderBy: { createdAt: "desc" },
      });
      expect(gasto.archivoComprobanteId).not.toBeNull();
    });
  });
});
