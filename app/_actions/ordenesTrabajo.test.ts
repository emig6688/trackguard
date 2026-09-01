import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  generarNumeroOT,
  crearOTManual,
  crearOTDesdePlan,
  aprobarOT,
  reasignarMecanico,
  iniciarOT,
  actualizarFechaEstimada,
  completarOT,
  confirmarReparacion,
  cancelarOT,
  completarDesdeExterno,
  volverAInternoDesdeExterno,
  derivarAExterno,
  actualizarDerivacionExterna,
  agregarRepuesto,
  eliminarRepuestoUsado,
  completarItemsPreventivos,
} from "@/app/_actions/ordenesTrabajo";
import { AutorizacionError } from "@/lib/permisos";
import {
  crearEmpresaDePrueba,
  crearUsuarioDePrueba,
  mockearSesion,
  borrarEmpresaDePrueba,
} from "@/lib/test-fixtures";
import { RedirectDeTest } from "../../vitest.setup";
import type { ScopedPrismaClient } from "@/lib/tenant-prisma";
import type { EstadoOT, OrigenOT } from "@/app/generated/prisma/client";

function formData(campos: Record<string, string | File>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

function sufijoCorto() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

describe("app/_actions/ordenesTrabajo.ts", () => {
  let empresaId: string;
  let prisma: ScopedPrismaClient;
  let vehiculoId: string;
  let tallerExternoId: string;
  let admin: { id: string };
  let encargadoMantenimiento: { id: string };
  let mecanico1: { id: string };
  let mecanico2: { id: string };
  let chofer: { id: string };

  beforeAll(async () => {
    const empresa = await crearEmpresaDePrueba("ordenesTrabajo");
    empresaId = empresa.empresaId;
    prisma = empresa.prisma;

    admin = await crearUsuarioDePrueba(empresaId, "ADMIN");
    encargadoMantenimiento = await crearUsuarioDePrueba(empresaId, "ENCARGADO_MANTENIMIENTO");
    mecanico1 = await crearUsuarioDePrueba(empresaId, "MECANICO_INTERNO");
    mecanico2 = await crearUsuarioDePrueba(empresaId, "MECANICO_INTERNO");
    chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");

    const vehiculo = await prisma.vehiculo.create({
      data: { empresaId, patente: `TSTOT${sufijoCorto()}`, marca: "Test", modelo: "Test", tipo: "CAMION" },
    });
    vehiculoId = vehiculo.id;

    const taller = await prisma.tallerExterno.create({
      data: { empresaId, nombre: `Taller-${sufijoCorto()}` },
    });
    tallerExternoId = taller.id;
  });

  afterAll(async () => {
    await borrarEmpresaDePrueba(empresaId);
  });

  async function crearVehiculo() {
    return prisma.vehiculo.create({
      data: { empresaId, patente: `TSTOT${sufijoCorto()}`, marca: "Test", modelo: "Test", tipo: "CAMION" },
    });
  }

  async function crearOT(
    overrides: {
      estado?: EstadoOT;
      origen?: OrigenOT;
      asignadoAId?: string | null;
      vehiculoId?: string;
      eventoRutaId?: string;
      checklistRealizadoId?: string;
      planMantenimientoId?: string | null;
    } = {}
  ) {
    return prisma.ordenDeTrabajo.create({
      data: {
        empresaId,
        numero: `OT-TEST-${sufijoCorto()}`,
        vehiculoId: overrides.vehiculoId ?? vehiculoId,
        origen: overrides.origen ?? "MANUAL",
        titulo: "OT de prueba",
        estado: overrides.estado ?? "PENDIENTE_APROBACION",
        asignadoAId: overrides.asignadoAId ?? undefined,
        eventoRutaId: overrides.eventoRutaId,
        checklistRealizadoId: overrides.checklistRealizadoId,
        planMantenimientoId: overrides.planMantenimientoId ?? undefined,
      },
    });
  }

  async function crearPlan(vId: string = vehiculoId) {
    return prisma.planMantenimiento.create({
      data: {
        empresaId,
        vehiculoId: vId,
        nombre: `Plan-${sufijoCorto()}`,
        tipoIntervalo: "KM",
        intervaloKm: 10000,
      },
    });
  }

  async function crearArticulo(stockActual: number, stockMinimo = 1) {
    return prisma.articuloPanol.create({
      data: { empresaId, nombre: `Art-${sufijoCorto()}`, stockActual, stockMinimo },
    });
  }

  describe("generarNumeroOT", () => {
    it("genera el primer número del año y luego incrementa contra el más alto ya usado", async () => {
      const v = await crearVehiculo();
      const numero1 = await generarNumeroOT(prisma, empresaId);
      await prisma.ordenDeTrabajo.create({
        data: { empresaId, numero: numero1, vehiculoId: v.id, origen: "MANUAL", titulo: "x" },
      });
      const numero2 = await generarNumeroOT(prisma, empresaId);
      expect(numero2).not.toBe(numero1);
      const anio = new Date().getFullYear();
      expect(numero1.startsWith(`OT-${anio}-`)).toBe(true);
      const n1 = parseInt(numero1.split("-").pop()!, 10);
      const n2 = parseInt(numero2.split("-").pop()!, 10);
      expect(n2).toBe(n1 + 1);
    });
  });

  describe("crearOTManual", () => {
    async function crearOTManualDirecta(fd: FormData) {
      try {
        await crearOTManual(undefined, fd);
      } catch (err) {
        if (!(err instanceof RedirectDeTest)) throw err;
      }
    }

    it("crea una OT manual (rol de gestión) y redirige a su detalle", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const titulo = `Manual-${sufijoCorto()}`;
      const fd = formData({ vehiculoId, titulo, prioridad: "ALTA", areaReparacion: "MOTOR" });
      await crearOTManualDirecta(fd);
      const ot = await prisma.ordenDeTrabajo.findFirstOrThrow({ where: { titulo } });
      expect(ot.estado).toBe("APROBADA");
      expect(ot.origen).toBe("MANUAL");
      expect(ot.prioridad).toBe("ALTA");
      expect(ot.aprobadoPorId).toBe(admin.id);
      expect(ot.creadoPorId).toBe(admin.id);
    });

    it("rechaza datos incompletos con fieldErrors (sin vehículo/título/prioridad)", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await crearOTManual(undefined, formData({}));
      expect(resultado?.fieldErrors).toBeDefined();
      expect(resultado?.fieldErrors?.vehiculoId).toBeDefined();
      expect(resultado?.fieldErrors?.titulo).toBeDefined();
      expect(resultado?.fieldErrors?.prioridad).toBeDefined();
    });

    it("un rol fuera de ROLES_ADMIN_MANTENIMIENTO no puede crear una OT manual", async () => {
      mockearSesion({ id: mecanico1.id, rol: "MECANICO_INTERNO", empresaId });
      const fd = formData({ vehiculoId, titulo: "x", prioridad: "BAJA" });
      await expect(crearOTManual(undefined, fd)).rejects.toThrow(AutorizacionError);
    });
  });

  describe("crearOTDesdePlan", () => {
    it("un rol fuera de ROLES_ADMIN_MANTENIMIENTO no puede adelantar un plan", async () => {
      mockearSesion({ id: mecanico1.id, rol: "MECANICO_INTERNO", empresaId });
      const plan = await crearPlan();
      await expect(crearOTDesdePlan(plan.id, "/mantenimiento")).rejects.toThrow(AutorizacionError);
    });

    it("crea una OT preventiva nueva con un ítem para el plan adelantado", async () => {
      const v = await crearVehiculo();
      const plan = await crearPlan(v.id);
      mockearSesion({ id: encargadoMantenimiento.id, rol: "ENCARGADO_MANTENIMIENTO", empresaId });
      const otId = await crearOTDesdePlan(plan.id, "/mantenimiento");
      expect(otId).toBeDefined();
      const ot = await prisma.ordenDeTrabajo.findUniqueOrThrow({
        where: { id: otId! },
        include: { itemsPreventivos: true },
      });
      expect(ot.origen).toBe("PREVENTIVO");
      expect(ot.estado).toBe("APROBADA");
      expect(ot.itemsPreventivos).toHaveLength(1);
      expect(ot.itemsPreventivos[0].planMantenimientoId).toBe(plan.id);
    });

    it("no duplica el ítem si el plan ya tiene una OT/ítem abierto", async () => {
      const v = await crearVehiculo();
      const plan = await crearPlan(v.id);
      mockearSesion({ id: encargadoMantenimiento.id, rol: "ENCARGADO_MANTENIMIENTO", empresaId });
      const otId1 = await crearOTDesdePlan(plan.id, "/mantenimiento");
      const otId2 = await crearOTDesdePlan(plan.id, "/mantenimiento");
      expect(otId2).toBeUndefined();
      const items = await prisma.oTItemPreventivo.findMany({ where: { planMantenimientoId: plan.id } });
      expect(items).toHaveLength(1);
      expect(items[0].ordenDeTrabajoId).toBe(otId1);
    });

    it("reutiliza la OT preventiva en lote ya abierta para el mismo vehículo con otro plan", async () => {
      const v = await crearVehiculo();
      const planA = await crearPlan(v.id);
      const planB = await crearPlan(v.id);
      mockearSesion({ id: encargadoMantenimiento.id, rol: "ENCARGADO_MANTENIMIENTO", empresaId });
      const otIdA = await crearOTDesdePlan(planA.id, "/mantenimiento");
      const otIdB = await crearOTDesdePlan(planB.id, "/mantenimiento");
      expect(otIdB).toBe(otIdA);
      const ot = await prisma.ordenDeTrabajo.findUniqueOrThrow({
        where: { id: otIdA! },
        include: { itemsPreventivos: true },
      });
      expect(ot.itemsPreventivos).toHaveLength(2);
    });
  });

  describe("aprobarOT", () => {
    it("aprueba una OT pendiente de aprobación con los datos requeridos", async () => {
      const ot = await crearOT({ estado: "PENDIENTE_APROBACION" });
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await aprobarOT(
        ot.id,
        undefined,
        formData({
          prioridad: "URGENTE",
          areaReparacion: "FRENOS",
          fechaLimite: "2026-12-31",
          asignadoAId: mecanico1.id,
        })
      );
      expect(resultado?.error).toBeUndefined();
      const actualizada = await prisma.ordenDeTrabajo.findUniqueOrThrow({ where: { id: ot.id } });
      expect(actualizada.estado).toBe("APROBADA");
      expect(actualizada.prioridad).toBe("URGENTE");
      expect(actualizada.asignadoAId).toBe(mecanico1.id);
      expect(actualizada.aprobadoPorId).toBe(admin.id);
    });

    it("rechaza sin fecha límite ni mecánico asignado (fieldErrors)", async () => {
      const ot = await crearOT({ estado: "PENDIENTE_APROBACION" });
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      // fechaLimite="" (no ausente): así llega siempre desde el form real,
      // que la manda vacía en vez de omitir la clave — con la clave
      // directamente ausente, Zod corta el parseo en ese campo requerido
      // antes de llegar al superRefine que valida mecánico/taller.
      const resultado = await aprobarOT(
        ot.id,
        undefined,
        formData({ prioridad: "BAJA", areaReparacion: "MOTOR", fechaLimite: "" })
      );
      expect(resultado?.fieldErrors?.fechaLimite).toBeDefined();
      expect(resultado?.fieldErrors?.asignadoAId).toBeDefined();
    });

    it("un rol fuera de ROLES_ADMIN_MANTENIMIENTO no puede aprobar", async () => {
      const ot = await crearOT({ estado: "PENDIENTE_APROBACION" });
      mockearSesion({ id: mecanico1.id, rol: "MECANICO_INTERNO", empresaId });
      await expect(
        aprobarOT(
          ot.id,
          undefined,
          formData({ prioridad: "BAJA", areaReparacion: "MOTOR", fechaLimite: "2026-12-31", asignadoAId: mecanico1.id })
        )
      ).rejects.toThrow(AutorizacionError);
    });

    it("no permite aprobar una OT que ya no está pendiente de aprobación", async () => {
      const ot = await crearOT({ estado: "APROBADA" });
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      await expect(
        aprobarOT(
          ot.id,
          undefined,
          formData({ prioridad: "BAJA", areaReparacion: "MOTOR", fechaLimite: "2026-12-31", asignadoAId: mecanico1.id })
        )
      ).rejects.toThrow(/no podés realizar esta transición/i);
    });

    it("aprueba y deriva a taller externo en el mismo paso, sin asignar mecánico", async () => {
      const ot = await crearOT({ estado: "PENDIENTE_APROBACION" });
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await aprobarOT(
        ot.id,
        undefined,
        formData({
          prioridad: "MEDIA",
          areaReparacion: "MOTOR",
          fechaLimite: "2026-12-31",
          tallerExternoId,
          presupuestoMonto: "50000",
        })
      );
      expect(resultado?.error).toBeUndefined();
      const actualizada = await prisma.ordenDeTrabajo.findUniqueOrThrow({ where: { id: ot.id } });
      expect(actualizada.estado).toBe("DERIVADA_EXTERNO");
      expect(actualizada.asignadoAId).toBeNull();
      expect(actualizada.aprobadoPorId).toBe(admin.id);
      const derivacion = await prisma.oTDerivacionExterna.findUnique({ where: { ordenDeTrabajoId: ot.id } });
      expect(derivacion?.tallerExternoId).toBe(tallerExternoId);
      expect(derivacion?.presupuestoMonto?.toString()).toBe("50000");
    });

    it("rechaza si no se elige ni mecánico ni taller externo", async () => {
      const ot = await crearOT({ estado: "PENDIENTE_APROBACION" });
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await aprobarOT(
        ot.id,
        undefined,
        formData({ prioridad: "BAJA", areaReparacion: "MOTOR", fechaLimite: "2026-12-31" })
      );
      expect(resultado?.fieldErrors?.asignadoAId).toBeDefined();
    });

    it("rechaza si se eligen mecánico y taller externo a la vez", async () => {
      const ot = await crearOT({ estado: "PENDIENTE_APROBACION" });
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await aprobarOT(
        ot.id,
        undefined,
        formData({
          prioridad: "BAJA",
          areaReparacion: "MOTOR",
          fechaLimite: "2026-12-31",
          asignadoAId: mecanico1.id,
          tallerExternoId,
        })
      );
      expect(resultado?.fieldErrors?.tallerExternoId).toBeDefined();
    });
  });

  describe("reasignarMecanico", () => {
    it("reasigna una OT aprobada a otro mecánico", async () => {
      const ot = await crearOT({ estado: "APROBADA", asignadoAId: mecanico1.id });
      mockearSesion({ id: encargadoMantenimiento.id, rol: "ENCARGADO_MANTENIMIENTO", empresaId });
      const resultado = await reasignarMecanico(ot.id, undefined, formData({ asignadoAId: mecanico2.id }));
      expect(resultado?.error).toBeUndefined();
      const actualizada = await prisma.ordenDeTrabajo.findUniqueOrThrow({ where: { id: ot.id } });
      expect(actualizada.asignadoAId).toBe(mecanico2.id);
      const historial = await prisma.oTHistorialEstado.findFirst({
        where: { ordenDeTrabajoId: ot.id, comentario: { contains: "Reasignada" } },
      });
      expect(historial).not.toBeNull();
    });

    it("rechaza sin mecánico elegido (fieldErrors)", async () => {
      const ot = await crearOT({ estado: "APROBADA", asignadoAId: mecanico1.id });
      mockearSesion({ id: encargadoMantenimiento.id, rol: "ENCARGADO_MANTENIMIENTO", empresaId });
      const resultado = await reasignarMecanico(ot.id, undefined, formData({}));
      expect(resultado?.fieldErrors?.asignadoAId).toBeDefined();
    });

    it("no permite reasignar una OT que no está APROBADA", async () => {
      const ot = await crearOT({ estado: "EN_PROGRESO", asignadoAId: mecanico1.id });
      mockearSesion({ id: encargadoMantenimiento.id, rol: "ENCARGADO_MANTENIMIENTO", empresaId });
      const resultado = await reasignarMecanico(ot.id, undefined, formData({ asignadoAId: mecanico2.id }));
      expect(resultado?.error).toMatch(/solo se puede reasignar/i);
    });

    it("un mecánico interno no puede reasignar (ni siquiera su propia OT)", async () => {
      const ot = await crearOT({ estado: "APROBADA", asignadoAId: mecanico1.id });
      mockearSesion({ id: mecanico1.id, rol: "MECANICO_INTERNO", empresaId });
      await expect(reasignarMecanico(ot.id, undefined, formData({ asignadoAId: mecanico2.id }))).rejects.toThrow(
        AutorizacionError
      );
    });
  });

  describe("iniciarOT", () => {
    it("el mecánico asignado inicia la OT (pasa a EN_PROGRESO)", async () => {
      const ot = await crearOT({ estado: "APROBADA", asignadoAId: mecanico1.id });
      mockearSesion({ id: mecanico1.id, rol: "MECANICO_INTERNO", empresaId });
      await iniciarOT(ot.id, formData({ fechaEstimadaFinalizacion: "2026-12-31" }));
      const actualizada = await prisma.ordenDeTrabajo.findUniqueOrThrow({ where: { id: ot.id } });
      expect(actualizada.estado).toBe("EN_PROGRESO");
      expect(actualizada.fechaInicio).not.toBeNull();
      expect(actualizada.fechaEstimadaFinalizacion).not.toBeNull();
    });

    it("un mecánico sin asignar se autoasigna al iniciar una OT sin dueño", async () => {
      const ot = await crearOT({ estado: "APROBADA", asignadoAId: null });
      mockearSesion({ id: mecanico2.id, rol: "MECANICO_INTERNO", empresaId });
      await iniciarOT(ot.id, formData({ fechaEstimadaFinalizacion: "2026-12-31" }));
      const actualizada = await prisma.ordenDeTrabajo.findUniqueOrThrow({ where: { id: ot.id } });
      expect(actualizada.estado).toBe("EN_PROGRESO");
      expect(actualizada.asignadoAId).toBe(mecanico2.id);
    });

    it("un mecánico distinto del asignado no puede iniciarla", async () => {
      const ot = await crearOT({ estado: "APROBADA", asignadoAId: mecanico1.id });
      mockearSesion({ id: mecanico2.id, rol: "MECANICO_INTERNO", empresaId });
      await expect(iniciarOT(ot.id, formData({ fechaEstimadaFinalizacion: "2026-12-31" }))).rejects.toThrow();
    });

    it("un rol sin relación con la OT (ej. CHOFER) no puede iniciarla", async () => {
      const ot = await crearOT({ estado: "APROBADA", asignadoAId: null });
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      await expect(iniciarOT(ot.id, formData({ fechaEstimadaFinalizacion: "2026-12-31" }))).rejects.toThrow();
    });

    it("exige fecha estimada de finalización", async () => {
      const ot = await crearOT({ estado: "APROBADA", asignadoAId: mecanico1.id });
      mockearSesion({ id: mecanico1.id, rol: "MECANICO_INTERNO", empresaId });
      await expect(iniciarOT(ot.id, formData({}))).rejects.toThrow();
    });
  });

  describe("actualizarFechaEstimada", () => {
    it("un rol de gestión puede actualizar la fecha estimada de una OT aprobada", async () => {
      const ot = await crearOT({ estado: "APROBADA" });
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await actualizarFechaEstimada(
        ot.id,
        undefined,
        formData({ fechaEstimadaFinalizacion: "2026-11-30" })
      );
      expect(resultado?.error).toBeUndefined();
      const actualizada = await prisma.ordenDeTrabajo.findUniqueOrThrow({ where: { id: ot.id } });
      expect(actualizada.fechaEstimadaFinalizacion?.toISOString().slice(0, 10)).toBe("2026-11-30");
    });

    it("rechaza en un estado que no la requiere (ej. PENDIENTE_APROBACION)", async () => {
      const ot = await crearOT({ estado: "PENDIENTE_APROBACION" });
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await actualizarFechaEstimada(
        ot.id,
        undefined,
        formData({ fechaEstimadaFinalizacion: "2026-11-30" })
      );
      expect(resultado?.error).toMatch(/no podés actualizar/i);
    });

    it("un mecánico no asignado a la OT no puede actualizarla", async () => {
      const ot = await crearOT({ estado: "EN_PROGRESO", asignadoAId: mecanico1.id });
      mockearSesion({ id: mecanico2.id, rol: "MECANICO_INTERNO", empresaId });
      const resultado = await actualizarFechaEstimada(
        ot.id,
        undefined,
        formData({ fechaEstimadaFinalizacion: "2026-11-30" })
      );
      expect(resultado?.error).toMatch(/no podés actualizar/i);
    });

    it("exige la fecha estimada", async () => {
      const ot = await crearOT({ estado: "APROBADA" });
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await actualizarFechaEstimada(
        ot.id,
        undefined,
        formData({ fechaEstimadaFinalizacion: "" })
      );
      expect(resultado?.error).toMatch(/ingresá una fecha/i);
    });
  });

  describe("completarOT", () => {
    it("exige observaciones o foto para poder completar", async () => {
      const ot = await crearOT({ estado: "EN_PROGRESO", asignadoAId: mecanico1.id });
      mockearSesion({ id: mecanico1.id, rol: "MECANICO_INTERNO", empresaId });
      const resultado = await completarOT(ot.id, undefined, formData({}));
      expect(resultado?.error).toMatch(/observación o una foto/i);
    });

    it("el mecánico asignado completa la OT con observaciones", async () => {
      const ot = await crearOT({ estado: "EN_PROGRESO", asignadoAId: mecanico1.id });
      mockearSesion({ id: mecanico1.id, rol: "MECANICO_INTERNO", empresaId });
      const resultado = await completarOT(
        ot.id,
        undefined,
        formData({ observacionesMecanico: "Se reparó la pinza de freno", tiempoInsumidoMinutos: "90" })
      );
      expect(resultado?.error).toBeUndefined();
      const actualizada = await prisma.ordenDeTrabajo.findUniqueOrThrow({ where: { id: ot.id } });
      expect(actualizada.estado).toBe("COMPLETADA");
      expect(actualizada.fechaFin).not.toBeNull();
      expect(actualizada.observacionesMecanico).toBe("Se reparó la pinza de freno");
      expect(actualizada.tiempoInsumidoMinutos).toBe(90);
    });

    it("acepta una foto de reparación en lugar de observaciones", async () => {
      const ot = await crearOT({ estado: "EN_PROGRESO", asignadoAId: mecanico1.id });
      mockearSesion({ id: mecanico1.id, rol: "MECANICO_INTERNO", empresaId });
      const fd = formData({});
      fd.set("fotoReparacion", new File(["x"], "foto.jpg", { type: "image/jpeg" }));
      const resultado = await completarOT(ot.id, undefined, fd);
      expect(resultado?.error).toBeUndefined();
      const actualizada = await prisma.ordenDeTrabajo.findUniqueOrThrow({ where: { id: ot.id } });
      expect(actualizada.estado).toBe("COMPLETADA");
      expect(actualizada.fotoReparacionId).not.toBeNull();
    });

    it("si viene de un evento de ruta, deja la reparación pendiente de confirmación del chofer", async () => {
      const evento = await prisma.eventoRuta.create({
        data: { empresaId, vehiculoId, choferId: chofer.id, tipo: "DESPERFECTO", descripcion: "Ruido en freno" },
      });
      const ot = await crearOT({ estado: "EN_PROGRESO", asignadoAId: mecanico1.id, origen: "EVENTO_RUTA", eventoRutaId: evento.id });
      mockearSesion({ id: mecanico1.id, rol: "MECANICO_INTERNO", empresaId });
      const resultado = await completarOT(ot.id, undefined, formData({ observacionesMecanico: "Listo" }));
      expect(resultado?.error).toBeUndefined();
      const actualizada = await prisma.ordenDeTrabajo.findUniqueOrThrow({ where: { id: ot.id } });
      expect(actualizada.confirmacionReparacion).toBe("PENDIENTE");
    });

    it("mueve los ítems preventivos pendientes a una OT nueva y actualiza el plan al completar", async () => {
      const v = await crearVehiculo();
      await prisma.vehiculo.update({ where: { id: v.id }, data: { kmActual: 54321 } });
      const plan = await crearPlan(v.id);
      const ot = await crearOT({ estado: "EN_PROGRESO", asignadoAId: mecanico1.id, origen: "PREVENTIVO", vehiculoId: v.id });
      const itemOk = await prisma.oTItemPreventivo.create({
        data: { empresaId, ordenDeTrabajoId: ot.id, planMantenimientoId: plan.id, titulo: "Filtro", resultado: "OK" },
      });
      const itemPendiente = await prisma.oTItemPreventivo.create({
        data: { empresaId, ordenDeTrabajoId: ot.id, planMantenimientoId: plan.id, titulo: "Aceite", resultado: "PENDIENTE" },
      });

      mockearSesion({ id: mecanico1.id, rol: "MECANICO_INTERNO", empresaId });
      const resultado = await completarOT(ot.id, undefined, formData({ observacionesMecanico: "Parcial" }));
      expect(resultado?.error).toBeUndefined();

      const otActualizada = await prisma.ordenDeTrabajo.findUniqueOrThrow({ where: { id: ot.id } });
      expect(otActualizada.estado).toBe("COMPLETADA");

      const itemPendienteActualizado = await prisma.oTItemPreventivo.findUniqueOrThrow({
        where: { id: itemPendiente.id },
      });
      expect(itemPendienteActualizado.ordenDeTrabajoId).not.toBe(ot.id);
      const otNueva = await prisma.ordenDeTrabajo.findUniqueOrThrow({
        where: { id: itemPendienteActualizado.ordenDeTrabajoId },
      });
      expect(otNueva.estado).toBe("APROBADA");
      expect(otNueva.origen).toBe("PREVENTIVO");

      const itemOkActualizado = await prisma.oTItemPreventivo.findUniqueOrThrow({ where: { id: itemOk.id } });
      expect(itemOkActualizado.ordenDeTrabajoId).toBe(ot.id);

      const planActualizado = await prisma.planMantenimiento.findUniqueOrThrow({ where: { id: plan.id } });
      expect(planActualizado.kmUltimoService).toBe(54321);
    });

    it("no permite completar una OT que no está EN_PROGRESO", async () => {
      const ot = await crearOT({ estado: "APROBADA", asignadoAId: mecanico1.id });
      mockearSesion({ id: mecanico1.id, rol: "MECANICO_INTERNO", empresaId });
      await expect(
        completarOT(ot.id, undefined, formData({ observacionesMecanico: "x" }))
      ).rejects.toThrow();
    });

    it("un mecánico distinto del asignado no puede completarla", async () => {
      const ot = await crearOT({ estado: "EN_PROGRESO", asignadoAId: mecanico1.id });
      mockearSesion({ id: mecanico2.id, rol: "MECANICO_INTERNO", empresaId });
      await expect(
        completarOT(ot.id, undefined, formData({ observacionesMecanico: "x" }))
      ).rejects.toThrow();
    });
  });

  describe("confirmarReparacion", () => {
    async function crearOTCompletadaPendienteConfirmacion() {
      const evento = await prisma.eventoRuta.create({
        data: { empresaId, vehiculoId, choferId: chofer.id, tipo: "DESPERFECTO", descripcion: "Falla eléctrica" },
      });
      return crearOT({
        estado: "COMPLETADA",
        origen: "EVENTO_RUTA",
        eventoRutaId: evento.id,
        asignadoAId: mecanico1.id,
      }).then((ot) =>
        prisma.ordenDeTrabajo.update({ where: { id: ot.id }, data: { confirmacionReparacion: "PENDIENTE" } })
      );
    }

    it("el chofer que reportó confirma OK", async () => {
      const ot = await crearOTCompletadaPendienteConfirmacion();
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      await confirmarReparacion(ot.id, formData({ resultado: "OK" }));
      const actualizada = await prisma.ordenDeTrabajo.findUniqueOrThrow({ where: { id: ot.id } });
      expect(actualizada.confirmacionReparacion).toBe("CONFIRMADA");
    });

    it("el chofer indica que el problema persiste y la OT reabre a EN_PROGRESO", async () => {
      const ot = await crearOTCompletadaPendienteConfirmacion();
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      await confirmarReparacion(ot.id, formData({ resultado: "PROBLEMA", comentario: "Sigue fallando" }));
      const actualizada = await prisma.ordenDeTrabajo.findUniqueOrThrow({ where: { id: ot.id } });
      expect(actualizada.estado).toBe("EN_PROGRESO");
      expect(actualizada.confirmacionReparacion).toBe("RECHAZADA");
      expect(actualizada.fechaFin).toBeNull();
    });

    it("un chofer que no reportó la novedad no puede confirmar", async () => {
      const ot = await crearOTCompletadaPendienteConfirmacion();
      const otroChofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
      mockearSesion({ id: otroChofer.id, rol: "CHOFER", empresaId });
      await expect(confirmarReparacion(ot.id, formData({ resultado: "OK" }))).rejects.toThrow(
        /no está esperando tu confirmación/i
      );
    });

    it("un rol fuera de ROLES_MOBILE_CHOFER no puede confirmar", async () => {
      const ot = await crearOTCompletadaPendienteConfirmacion();
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      await expect(confirmarReparacion(ot.id, formData({ resultado: "OK" }))).rejects.toThrow(AutorizacionError);
    });
  });

  describe("cancelarOT", () => {
    it("un rol de gestión cancela una OT pendiente de aprobación", async () => {
      const ot = await crearOT({ estado: "PENDIENTE_APROBACION" });
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await cancelarOT(ot.id, undefined, formData({}));
      expect(resultado?.error).toBeUndefined();
      const actualizada = await prisma.ordenDeTrabajo.findUniqueOrThrow({ where: { id: ot.id } });
      expect(actualizada.estado).toBe("CANCELADA");
    });

    it("devuelve error (no tira excepción) si el rol no puede cancelar", async () => {
      const ot = await crearOT({ estado: "PENDIENTE_APROBACION" });
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      const resultado = await cancelarOT(ot.id, undefined, formData({}));
      expect(resultado?.error).toBeDefined();
      const actualizada = await prisma.ordenDeTrabajo.findUniqueOrThrow({ where: { id: ot.id } });
      expect(actualizada.estado).toBe("PENDIENTE_APROBACION");
    });

    it("no permite cancelar una OT ya completada", async () => {
      const ot = await crearOT({ estado: "COMPLETADA" });
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await cancelarOT(ot.id, undefined, formData({}));
      expect(resultado?.error).toBeDefined();
    });
  });

  describe("completarDesdeExterno / volverAInternoDesdeExterno", () => {
    it("completa una OT derivada a taller externo", async () => {
      const ot = await crearOT({ estado: "DERIVADA_EXTERNO" });
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await completarDesdeExterno(ot.id, undefined, formData({}));
      expect(resultado?.error).toBeUndefined();
      expect((await prisma.ordenDeTrabajo.findUniqueOrThrow({ where: { id: ot.id } })).estado).toBe("COMPLETADA");
    });

    it("un rol sin permiso no puede completarla desde externo", async () => {
      const ot = await crearOT({ estado: "DERIVADA_EXTERNO" });
      mockearSesion({ id: mecanico1.id, rol: "MECANICO_INTERNO", empresaId });
      const resultado = await completarDesdeExterno(ot.id, undefined, formData({}));
      expect(resultado?.error).toBeDefined();
    });

    it("vuelve una OT derivada a taller interno (EN_PROGRESO)", async () => {
      const ot = await crearOT({ estado: "DERIVADA_EXTERNO" });
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await volverAInternoDesdeExterno(ot.id, undefined, formData({}));
      expect(resultado?.error).toBeUndefined();
      expect((await prisma.ordenDeTrabajo.findUniqueOrThrow({ where: { id: ot.id } })).estado).toBe("EN_PROGRESO");
    });

    it("no permite volver a interno una OT ya completada (transición inválida)", async () => {
      const ot = await crearOT({ estado: "COMPLETADA" });
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await volverAInternoDesdeExterno(ot.id, undefined, formData({}));
      expect(resultado?.error).toBeDefined();
    });
  });

  describe("derivarAExterno", () => {
    it("deriva una OT aprobada a un taller externo", async () => {
      const ot = await crearOT({ estado: "APROBADA" });
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await derivarAExterno(
        ot.id,
        undefined,
        formData({ tallerExternoId, presupuestoMonto: "15000", fechaEstimadaEntrega: "2026-12-01" })
      );
      expect(resultado?.error).toBeUndefined();
      const actualizada = await prisma.ordenDeTrabajo.findUniqueOrThrow({ where: { id: ot.id } });
      expect(actualizada.estado).toBe("DERIVADA_EXTERNO");
      const derivacion = await prisma.oTDerivacionExterna.findUniqueOrThrow({ where: { ordenDeTrabajoId: ot.id } });
      expect(derivacion.tallerExternoId).toBe(tallerExternoId);
      expect(Number(derivacion.presupuestoMonto)).toBe(15000);
    });

    it("exige elegir un taller", async () => {
      const ot = await crearOT({ estado: "APROBADA" });
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await derivarAExterno(ot.id, undefined, formData({ tallerExternoId: "" }));
      expect(resultado?.error).toMatch(/elegí un taller/i);
    });

    it("un rol fuera de ROLES_ADMIN_MANTENIMIENTO no puede derivar", async () => {
      const ot = await crearOT({ estado: "APROBADA" });
      mockearSesion({ id: mecanico1.id, rol: "MECANICO_INTERNO", empresaId });
      await expect(derivarAExterno(ot.id, undefined, formData({ tallerExternoId }))).rejects.toThrow(
        AutorizacionError
      );
    });

    it("no permite derivar una OT en un estado inválido (ej. pendiente de aprobación)", async () => {
      const ot = await crearOT({ estado: "PENDIENTE_APROBACION" });
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await derivarAExterno(ot.id, undefined, formData({ tallerExternoId }));
      expect(resultado?.error).toMatch(/no se puede derivar/i);
    });
  });

  describe("actualizarDerivacionExterna", () => {
    async function crearDerivacion() {
      const ot = await crearOT({ estado: "APROBADA" });
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      await derivarAExterno(ot.id, undefined, formData({ tallerExternoId }));
      const derivacion = await prisma.oTDerivacionExterna.findUniqueOrThrow({ where: { ordenDeTrabajoId: ot.id } });
      return { ot, derivacion };
    }

    it("actualiza el seguimiento de la derivación", async () => {
      const { ot, derivacion } = await crearDerivacion();
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await actualizarDerivacionExterna(
        derivacion.id,
        ot.id,
        undefined,
        formData({ estadoExterno: "EN_REPARACION", presupuestoMonto: "20000", resultado: "" })
      );
      expect(resultado?.error).toBeUndefined();
      const actualizada = await prisma.oTDerivacionExterna.findUniqueOrThrow({ where: { id: derivacion.id } });
      expect(actualizada.estadoExterno).toBe("EN_REPARACION");
      expect(Number(actualizada.presupuestoMonto)).toBe(20000);
    });

    it("rechaza si la derivación no pertenece a la OT indicada", async () => {
      const { derivacion } = await crearDerivacion();
      const otraOT = await crearOT({ estado: "APROBADA" });
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await actualizarDerivacionExterna(
        derivacion.id,
        otraOT.id,
        undefined,
        formData({ estadoExterno: "EN_REPARACION" })
      );
      expect(resultado?.error).toMatch(/no pertenece a la orden de trabajo/i);
    });

    it("un rol fuera de ROLES_ADMIN_MANTENIMIENTO no puede actualizar el seguimiento", async () => {
      const { ot, derivacion } = await crearDerivacion();
      mockearSesion({ id: mecanico1.id, rol: "MECANICO_INTERNO", empresaId });
      await expect(
        actualizarDerivacionExterna(derivacion.id, ot.id, undefined, formData({ estadoExterno: "EN_REPARACION" }))
      ).rejects.toThrow(AutorizacionError);
    });
  });

  describe("agregarRepuesto", () => {
    it("agrega un repuesto manual (sin pañol) a una OT en progreso", async () => {
      const ot = await crearOT({ estado: "EN_PROGRESO", asignadoAId: mecanico1.id });
      mockearSesion({ id: mecanico1.id, rol: "MECANICO_INTERNO", empresaId });
      const resultado = await agregarRepuesto(
        ot.id,
        undefined,
        formData({ descripcion: "Correa alternador", cantidad: "2", costoUnitario: "500" })
      );
      expect(resultado?.error).toBeUndefined();
      const repuesto = await prisma.oTRepuesto.findFirstOrThrow({ where: { ordenDeTrabajoId: ot.id } });
      expect(repuesto.descripcion).toBe("Correa alternador");
      expect(repuesto.cantidad).toBe(2);
    });

    it("descuenta stock del pañol al agregar un repuesto vinculado a un artículo", async () => {
      const articulo = await crearArticulo(10, 2);
      const ot = await crearOT({ estado: "EN_PROGRESO", asignadoAId: mecanico1.id });
      mockearSesion({ id: mecanico1.id, rol: "MECANICO_INTERNO", empresaId });
      const resultado = await agregarRepuesto(
        ot.id,
        undefined,
        formData({ descripcion: articulo.nombre, cantidad: "4", articuloPanolId: articulo.id })
      );
      expect(resultado?.mensaje).toMatch(/se usó/i);
      const articuloActualizado = await prisma.articuloPanol.findUniqueOrThrow({ where: { id: articulo.id } });
      expect(articuloActualizado.stockActual).toBe(6);
    });

    it("rechaza si no hay stock suficiente", async () => {
      const articulo = await crearArticulo(1, 0);
      const ot = await crearOT({ estado: "EN_PROGRESO", asignadoAId: mecanico1.id });
      mockearSesion({ id: mecanico1.id, rol: "MECANICO_INTERNO", empresaId });
      const resultado = await agregarRepuesto(
        ot.id,
        undefined,
        formData({ descripcion: articulo.nombre, cantidad: "5", articuloPanolId: articulo.id })
      );
      expect(resultado?.error).toMatch(/no hay stock suficiente/i);
      const articuloActualizado = await prisma.articuloPanol.findUniqueOrThrow({ where: { id: articulo.id } });
      expect(articuloActualizado.stockActual).toBe(1);
    });

    it("exige una descripción", async () => {
      const ot = await crearOT({ estado: "EN_PROGRESO", asignadoAId: mecanico1.id });
      mockearSesion({ id: mecanico1.id, rol: "MECANICO_INTERNO", empresaId });
      const resultado = await agregarRepuesto(ot.id, undefined, formData({ descripcion: "" }));
      expect(resultado?.error).toMatch(/descripción/i);
    });

    it("no permite agregar repuestos a una OT COMPLETADA", async () => {
      const ot = await crearOT({ estado: "COMPLETADA", asignadoAId: mecanico1.id });
      mockearSesion({ id: mecanico1.id, rol: "MECANICO_INTERNO", empresaId });
      await expect(
        agregarRepuesto(ot.id, undefined, formData({ descripcion: "Filtro" }))
      ).rejects.toThrow(AutorizacionError);
    });

    it("un mecánico no asignado a la OT no puede agregar repuestos", async () => {
      const ot = await crearOT({ estado: "EN_PROGRESO", asignadoAId: mecanico1.id });
      mockearSesion({ id: mecanico2.id, rol: "MECANICO_INTERNO", empresaId });
      await expect(
        agregarRepuesto(ot.id, undefined, formData({ descripcion: "Filtro" }))
      ).rejects.toThrow(AutorizacionError);
    });

    it("un rol sin relación con la OT (ej. CHOFER) no puede agregar repuestos", async () => {
      const ot = await crearOT({ estado: "EN_PROGRESO", asignadoAId: mecanico1.id });
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      await expect(
        agregarRepuesto(ot.id, undefined, formData({ descripcion: "Filtro" }))
      ).rejects.toThrow(AutorizacionError);
    });
  });

  describe("eliminarRepuestoUsado", () => {
    async function crearRepuesto(otId: string, articuloPanolId?: string, cantidad = 1) {
      return prisma.oTRepuesto.create({
        data: {
          empresaId,
          ordenDeTrabajoId: otId,
          descripcion: `Rep-${sufijoCorto()}`,
          cantidad,
          articuloPanolId,
        },
      });
    }

    it("elimina (soft-delete) un repuesto cargado por error", async () => {
      const ot = await crearOT({ estado: "EN_PROGRESO", asignadoAId: mecanico1.id });
      const repuesto = await crearRepuesto(ot.id);
      mockearSesion({ id: mecanico1.id, rol: "MECANICO_INTERNO", empresaId });
      await eliminarRepuestoUsado(ot.id, repuesto.id);
      const actualizado = await prisma.oTRepuesto.findUniqueOrThrow({ where: { id: repuesto.id } });
      expect(actualizado.eliminadoEn).not.toBeNull();
      expect(actualizado.eliminadoPorId).toBe(mecanico1.id);
    });

    it("repone el stock del pañol al eliminar un repuesto que salió de ahí", async () => {
      const articulo = await crearArticulo(5, 1);
      const ot = await crearOT({ estado: "EN_PROGRESO", asignadoAId: mecanico1.id });
      const repuesto = await crearRepuesto(ot.id, articulo.id, 3);
      mockearSesion({ id: mecanico1.id, rol: "MECANICO_INTERNO", empresaId });
      await eliminarRepuestoUsado(ot.id, repuesto.id);
      const articuloActualizado = await prisma.articuloPanol.findUniqueOrThrow({ where: { id: articulo.id } });
      expect(articuloActualizado.stockActual).toBe(8);
    });

    it("rechaza si el repuesto no pertenece a la OT indicada", async () => {
      const ot1 = await crearOT({ estado: "EN_PROGRESO", asignadoAId: mecanico1.id });
      const ot2 = await crearOT({ estado: "EN_PROGRESO", asignadoAId: mecanico1.id });
      const repuesto = await crearRepuesto(ot1.id);
      mockearSesion({ id: mecanico1.id, rol: "MECANICO_INTERNO", empresaId });
      await expect(eliminarRepuestoUsado(ot2.id, repuesto.id)).rejects.toThrow(AutorizacionError);
    });

    it("no permite eliminar repuestos de una OT CANCELADA", async () => {
      const ot = await crearOT({ estado: "CANCELADA", asignadoAId: mecanico1.id });
      const repuesto = await crearRepuesto(ot.id);
      mockearSesion({ id: mecanico1.id, rol: "MECANICO_INTERNO", empresaId });
      await expect(eliminarRepuestoUsado(ot.id, repuesto.id)).rejects.toThrow(AutorizacionError);
    });
  });

  describe("completarItemsPreventivos", () => {
    async function crearOTConItems() {
      const plan = await crearPlan();
      const ot = await crearOT({ estado: "EN_PROGRESO", asignadoAId: mecanico1.id, origen: "PREVENTIVO" });
      const item1 = await prisma.oTItemPreventivo.create({
        data: { empresaId, ordenDeTrabajoId: ot.id, planMantenimientoId: plan.id, titulo: "Filtro aire" },
      });
      const item2 = await prisma.oTItemPreventivo.create({
        data: { empresaId, ordenDeTrabajoId: ot.id, planMantenimientoId: plan.id, titulo: "Aceite motor" },
      });
      return { ot, item1, item2 };
    }

    it("guarda el resultado de todos los ítems de una OT preventiva en lote", async () => {
      const { ot, item1, item2 } = await crearOTConItems();
      mockearSesion({ id: mecanico1.id, rol: "MECANICO_INTERNO", empresaId });
      const resultado = await completarItemsPreventivos(
        ot.id,
        undefined,
        formData({
          [`resultado_${item1.id}`]: "OK",
          [`observacion_${item1.id}`]: "Cambiado sin novedad",
          [`resultado_${item2.id}`]: "PENDIENTE",
        })
      );
      expect(resultado?.error).toBeUndefined();
      const item1Actualizado = await prisma.oTItemPreventivo.findUniqueOrThrow({ where: { id: item1.id } });
      expect(item1Actualizado.resultado).toBe("OK");
      expect(item1Actualizado.observacion).toBe("Cambiado sin novedad");
      expect(item1Actualizado.completadoEn).not.toBeNull();
      const item2Actualizado = await prisma.oTItemPreventivo.findUniqueOrThrow({ where: { id: item2.id } });
      expect(item2Actualizado.resultado).toBe("PENDIENTE");
      expect(item2Actualizado.completadoEn).toBeNull();
    });

    it("rechaza (sin guardar nada) si falta observación/foto en un ítem marcado OK/REPARADO", async () => {
      const { ot, item1, item2 } = await crearOTConItems();
      mockearSesion({ id: mecanico1.id, rol: "MECANICO_INTERNO", empresaId });
      const resultado = await completarItemsPreventivos(
        ot.id,
        undefined,
        formData({
          [`resultado_${item1.id}`]: "OK",
          [`resultado_${item2.id}`]: "PENDIENTE",
        })
      );
      expect(resultado?.error).toMatch(/faltan observaciones/i);
      expect(resultado?.itemsInvalidos).toEqual([item1.id]);
      const item1SinCambios = await prisma.oTItemPreventivo.findUniqueOrThrow({ where: { id: item1.id } });
      expect(item1SinCambios.resultado).toBe("PENDIENTE");
    });

    it("no permite modificar ítems de una OT COMPLETADA", async () => {
      const { ot, item1, item2 } = await crearOTConItems();
      await prisma.ordenDeTrabajo.update({ where: { id: ot.id }, data: { estado: "COMPLETADA" } });
      mockearSesion({ id: mecanico1.id, rol: "MECANICO_INTERNO", empresaId });
      await expect(
        completarItemsPreventivos(
          ot.id,
          undefined,
          formData({ [`resultado_${item1.id}`]: "PENDIENTE", [`resultado_${item2.id}`]: "PENDIENTE" })
        )
      ).rejects.toThrow(AutorizacionError);
    });

    it("un rol sin relación con la OT (ej. CHOFER) no puede modificar los ítems", async () => {
      const { ot, item1, item2 } = await crearOTConItems();
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      await expect(
        completarItemsPreventivos(
          ot.id,
          undefined,
          formData({ [`resultado_${item1.id}`]: "PENDIENTE", [`resultado_${item2.id}`]: "PENDIENTE" })
        )
      ).rejects.toThrow(AutorizacionError);
    });
  });
});
