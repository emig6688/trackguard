import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { registrarChecklist } from "@/app/_actions/checklists";
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

describe("app/_actions/checklists.ts", () => {
  let empresaId: string;
  let prisma: ScopedPrismaClient;
  let vehiculoId: string;
  let chofer: { id: string; nombre: string };
  let templateId: string;

  beforeAll(async () => {
    const empresa = await crearEmpresaDePrueba("checklists");
    empresaId = empresa.empresaId;
    prisma = empresa.prisma;

    chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");

    const vehiculo = await prisma.vehiculo.create({
      data: { empresaId, patente: `TSTCHK${sufijoCorto()}`, marca: "Test", modelo: "Test", tipo: "CAMION", kmActual: 100 },
    });
    vehiculoId = vehiculo.id;

    const template = await prisma.checklistTemplate.create({
      data: { empresaId, nombre: `Template-${sufijoCorto()}` },
    });
    templateId = template.id;
  });

  afterAll(async () => {
    // ChecklistRealizado no tiene empresaId propio (ver lib/tenant-prisma.ts
    // — MODELOS_CON_EMPRESA no lo incluye), así que borrarEmpresaDePrueba no
    // lo toca: hay que limpiarlo a mano (y las OT que lo referencian, antes
    // que él) para no dejar filas huérfanas ni romper el borrado de
    // Vehiculo/ChecklistTemplate/Usuario por la FK.
    await prisma.ordenDeTrabajo.deleteMany({ where: { empresaId } });
    await prisma.checklistRealizado.deleteMany({ where: { choferId: chofer.id } });
    await borrarEmpresaDePrueba(empresaId);
  });

  /**
   * Cada test que necesita ítems arma su PROPIO template (en vez de sumar
   * ítems al `templateId` compartido) — registrarChecklist exige una
   * respuesta para TODOS los ítems del template
   * (`prisma.checklistItem.findMany({ where: { templateId } })`), así que
   * reusar un template entre tests acumularía ítems sin respuesta y
   * rompería el parseo con un ZodError.
   */
  async function crearTemplateConItem(texto: string) {
    const template = await prisma.checklistTemplate.create({
      data: { empresaId, nombre: `Template-${sufijoCorto()}` },
    });
    const item = await prisma.checklistItem.create({ data: { templateId: template.id, orden: 1, texto } });
    return { templateId: template.id, itemId: item.id };
  }

  /**
   * registrarChecklist siempre redirige al terminar OK — no se puede leer
   * el valor de retorno para ese camino. Este helper llama a la acción,
   * atrapa el redirect esperado y devuelve la URL a la que hubiera ido.
   */
  async function registrarYCapturarRedirect(formDataArg: FormData) {
    try {
      const resultado = await registrarChecklist(undefined, formDataArg);
      return { resultado, url: undefined as string | undefined };
    } catch (err) {
      if (!(err instanceof RedirectDeTest)) throw err;
      return { resultado: undefined, url: err.url };
    }
  }

  describe("registrarChecklist", () => {
    it("un rol fuera de ROLES_MOBILE_CHOFER no puede registrar un checklist", async () => {
      const admin = await crearUsuarioDePrueba(empresaId, "ADMIN");
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const fd = formData({ vehiculoId, templateId });
      await expect(registrarChecklist(undefined, fd)).rejects.toThrow(AutorizacionError);
    });

    it("rechaza sin vehículo", async () => {
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      const fd = formData({ templateId });
      const resultado = await registrarChecklist(undefined, fd);
      expect(resultado?.error).toMatch(/vehículo/i);
    });

    it("rechaza sin template", async () => {
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      const fd = formData({ vehiculoId });
      const resultado = await registrarChecklist(undefined, fd);
      expect(resultado?.error).toMatch(/template/i);
    });

    it("rechaza un vehículo inválido", async () => {
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      const fd = formData({ vehiculoId: "no-existe", templateId });
      const resultado = await registrarChecklist(undefined, fd);
      expect(resultado?.error).toMatch(/vehículo inválido/i);
    });

    it("rechaza un template inválido", async () => {
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      const fd = formData({ vehiculoId, templateId: "no-existe" });
      const resultado = await registrarChecklist(undefined, fd);
      expect(resultado?.error).toMatch(/template de checklist inválido/i);
    });

    it("registra un checklist sin fallas, actualiza el km y redirige con fallas=0", async () => {
      const { templateId: tplId, itemId } = await crearTemplateConItem("Luces delanteras");

      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      const fd = formData({
        vehiculoId,
        templateId: tplId,
        momento: "PRESALIDA",
        kmAlMomento: "150",
        [`resultado_${itemId}`]: "OK",
        [`observacion_${itemId}`]: "",
      });
      const { url } = await registrarYCapturarRedirect(fd);
      expect(url).toContain("fallas=0");

      const checklist = await prisma.checklistRealizado.findFirstOrThrow({
        where: { vehiculoId, templateId: tplId, choferId: chofer.id },
        orderBy: { fechaHora: "desc" },
      });
      expect(checklist.resultadoGeneral).toBe("OK");
      expect(checklist.momento).toBe("PRESALIDA");

      const vehiculoActualizado = await prisma.vehiculo.findUniqueOrThrow({ where: { id: vehiculoId } });
      expect(vehiculoActualizado.kmActual).toBe(150);
    });

    it("no retrocede el km si kmAlMomento es menor al actual", async () => {
      const { templateId: tplId, itemId } = await crearTemplateConItem("Frenos");
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      const fd = formData({
        vehiculoId,
        templateId: tplId,
        kmAlMomento: "50",
        [`resultado_${itemId}`]: "OK",
        [`observacion_${itemId}`]: "",
      });
      await registrarYCapturarRedirect(fd);
      const vehiculoActualizado = await prisma.vehiculo.findUniqueOrThrow({ where: { id: vehiculoId } });
      expect(vehiculoActualizado.kmActual).toBe(150); // sigue en 150, no bajó a 50
    });

    it("registra un checklist con fallas: queda CON_FALLAS y genera una OT nueva", async () => {
      const { templateId: tplId, itemId } = await crearTemplateConItem(`Chequeo especial ${sufijoCorto()}`);
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      const fd = formData({
        vehiculoId,
        templateId: tplId,
        momento: "CIERRE",
        [`resultado_${itemId}`]: "FALLA",
        [`observacion_${itemId}`]: "anotacion generica sin detalle particular",
      });
      const { url } = await registrarYCapturarRedirect(fd);
      expect(url).toContain("fallas=1");

      const checklist = await prisma.checklistRealizado.findFirstOrThrow({
        where: { vehiculoId, templateId: tplId, choferId: chofer.id, momento: "CIERRE" },
      });
      expect(checklist.resultadoGeneral).toBe("CON_FALLAS");

      const ot = await prisma.ordenDeTrabajo.findFirstOrThrow({
        where: { checklistRealizadoId: checklist.id },
      });
      expect(ot.origen).toBe("CHECKLIST");
      expect(ot.vehiculoId).toBe(vehiculoId);
      expect(ot.titulo).toMatch(/fallas detectadas en checklist de cierre/i);
      expect(ot.estado).toBe("PENDIENTE_APROBACION");
    });

    it("con autoAprobacionMecanicosActiva, la OT generada por fallas nace APROBADA", async () => {
      await prisma.empresa.update({ where: { id: empresaId }, data: { autoAprobacionMecanicosActiva: true } });
      const { templateId: tplId, itemId } = await crearTemplateConItem(`Chequeo auto ${sufijoCorto()}`);
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      const fd = formData({
        vehiculoId,
        templateId: tplId,
        [`resultado_${itemId}`]: "FALLA",
        [`observacion_${itemId}`]: "detalle sin palabras clave conocidas",
      });
      await registrarYCapturarRedirect(fd);

      const checklist = await prisma.checklistRealizado.findFirstOrThrow({
        where: { vehiculoId, templateId: tplId, choferId: chofer.id, resultadoGeneral: "CON_FALLAS" },
        orderBy: { fechaHora: "desc" },
      });
      const ot = await prisma.ordenDeTrabajo.findFirstOrThrow({ where: { checklistRealizadoId: checklist.id } });
      expect(ot.estado).toBe("APROBADA");
      await prisma.empresa.update({ where: { id: empresaId }, data: { autoAprobacionMecanicosActiva: false } });
    });
  });
});
