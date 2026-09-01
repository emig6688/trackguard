import { describe, it, expect } from "vitest";
import { otEstaAtrasada, puedeMecanicoAccionar, puedeModificarOT, fechaReferenciaAtraso } from "@/lib/ot";

describe("puedeMecanicoAccionar", () => {
  it("permite al mecánico asignado", () => {
    const ot = { asignadoAId: "mec-1", estado: "EN_PROGRESO" as const };
    expect(puedeMecanicoAccionar(ot, "mec-1")).toBe(true);
  });

  it("no permite a un mecánico distinto del asignado", () => {
    const ot = { asignadoAId: "mec-1", estado: "EN_PROGRESO" as const };
    expect(puedeMecanicoAccionar(ot, "mec-2")).toBe(false);
  });

  it("permite a cualquier mecánico tomar una OT sin asignar en APROBADA", () => {
    const ot = { asignadoAId: null, estado: "APROBADA" as const };
    expect(puedeMecanicoAccionar(ot, "mec-cualquiera")).toBe(true);
  });

  it("permite a cualquier mecánico tomar una OT sin asignar en EN_PROGRESO", () => {
    const ot = { asignadoAId: null, estado: "EN_PROGRESO" as const };
    expect(puedeMecanicoAccionar(ot, "mec-cualquiera")).toBe(true);
  });

  it("no permite tomar una OT sin asignar en otros estados (ej. recién creada)", () => {
    const ot = { asignadoAId: null, estado: "PENDIENTE_APROBACION" as const };
    expect(puedeMecanicoAccionar(ot, "mec-cualquiera")).toBe(false);
  });

  it("no permite tomar una OT sin asignar ya completada", () => {
    const ot = { asignadoAId: null, estado: "COMPLETADA" as const };
    expect(puedeMecanicoAccionar(ot, "mec-cualquiera")).toBe(false);
  });
});

describe("puedeModificarOT", () => {
  it("una OT COMPLETADA solo la puede modificar ADMIN o GERENTE", () => {
    const ot = { asignadoAId: "mec-1", estado: "COMPLETADA" as const };
    expect(puedeModificarOT(ot, { rol: "ADMIN", id: "admin-1" })).toBe(true);
    expect(puedeModificarOT(ot, { rol: "GERENTE", id: "ger-1" })).toBe(true);
    expect(puedeModificarOT(ot, { rol: "ENCARGADO_MANTENIMIENTO", id: "enc-1" })).toBe(false);
    expect(puedeModificarOT(ot, { rol: "MECANICO_INTERNO", id: "mec-1" })).toBe(false);
  });

  it("una OT CANCELADA no la puede modificar nadie, ni ADMIN ni GERENTE", () => {
    const ot = { asignadoAId: null, estado: "CANCELADA" as const };
    expect(puedeModificarOT(ot, { rol: "ADMIN", id: "admin-1" })).toBe(false);
    expect(puedeModificarOT(ot, { rol: "GERENTE", id: "ger-1" })).toBe(false);
  });

  it("en un estado activo rige el criterio de siempre: gestión o el mecánico asignado", () => {
    const ot = { asignadoAId: "mec-1", estado: "EN_PROGRESO" as const };
    expect(puedeModificarOT(ot, { rol: "ADMIN", id: "admin-1" })).toBe(true);
    expect(puedeModificarOT(ot, { rol: "ENCARGADO_MANTENIMIENTO", id: "enc-1" })).toBe(true);
    expect(puedeModificarOT(ot, { rol: "MECANICO_INTERNO", id: "mec-1" })).toBe(true);
    expect(puedeModificarOT(ot, { rol: "MECANICO_INTERNO", id: "mec-2" })).toBe(false);
    expect(puedeModificarOT(ot, { rol: "GERENTE", id: "ger-1" })).toBe(false);
  });
});

describe("otEstaAtrasada", () => {
  const ahora = new Date("2026-06-15T12:00:00Z");

  it("no está atrasada si el estado ya está cerrado, aunque las fechas hayan pasado", () => {
    const ot = {
      estado: "COMPLETADA" as const,
      fechaEstimadaFinalizacion: new Date("2026-01-01"),
      fechaLimite: new Date("2026-01-01"),
    };
    expect(otEstaAtrasada(ot, ahora)).toBe(false);
  });

  it("usa fechaEstimadaFinalizacion cuando está fijada", () => {
    const pasada = { estado: "EN_PROGRESO" as const, fechaEstimadaFinalizacion: new Date("2026-06-01"), fechaLimite: null };
    const futura = { estado: "EN_PROGRESO" as const, fechaEstimadaFinalizacion: new Date("2026-07-01"), fechaLimite: null };
    expect(otEstaAtrasada(pasada, ahora)).toBe(true);
    expect(otEstaAtrasada(futura, ahora)).toBe(false);
  });

  it("cae a fechaLimite si todavía no se fijó fecha estimada", () => {
    const pasada = { estado: "APROBADA" as const, fechaEstimadaFinalizacion: null, fechaLimite: new Date("2026-06-01") };
    const futura = { estado: "APROBADA" as const, fechaEstimadaFinalizacion: null, fechaLimite: new Date("2026-07-01") };
    expect(otEstaAtrasada(pasada, ahora)).toBe(true);
    expect(otEstaAtrasada(futura, ahora)).toBe(false);
  });

  it("no está atrasada si no hay ninguna fecha cargada", () => {
    const ot = { estado: "PENDIENTE_APROBACION" as const, fechaEstimadaFinalizacion: null, fechaLimite: null };
    expect(otEstaAtrasada(ot, ahora)).toBe(false);
  });
});

describe("fechaReferenciaAtraso", () => {
  it("prioriza fechaEstimadaFinalizacion sobre fechaLimite", () => {
    const estimada = new Date("2026-06-01");
    const limite = new Date("2026-05-01");
    expect(fechaReferenciaAtraso({ fechaEstimadaFinalizacion: estimada, fechaLimite: limite })).toBe(estimada);
  });

  it("usa fechaLimite si no hay fecha estimada", () => {
    const limite = new Date("2026-05-01");
    expect(fechaReferenciaAtraso({ fechaEstimadaFinalizacion: null, fechaLimite: limite })).toBe(limite);
  });

  it("devuelve null si no hay ninguna de las dos", () => {
    expect(fechaReferenciaAtraso({ fechaEstimadaFinalizacion: null, fechaLimite: null })).toBeNull();
  });
});
