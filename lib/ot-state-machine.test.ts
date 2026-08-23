import { describe, it, expect } from "vitest";
import { puedeTransicionar, transicionesDisponibles } from "@/lib/ot-state-machine";

describe("puedeTransicionar", () => {
  it("ADMIN puede aprobar una OT pendiente de aprobación", () => {
    expect(puedeTransicionar("PENDIENTE_APROBACION", "APROBADA", "ADMIN")).toBe(true);
  });

  it("un mecánico interno NO puede aprobar una OT (solo gestión)", () => {
    expect(puedeTransicionar("PENDIENTE_APROBACION", "APROBADA", "MECANICO_INTERNO")).toBe(false);
  });

  it("un mecánico interno SÍ puede iniciar una OT ya aprobada", () => {
    expect(puedeTransicionar("APROBADA", "EN_PROGRESO", "MECANICO_INTERNO")).toBe(true);
  });

  it("un mecánico interno NO puede derivar a taller externo", () => {
    expect(puedeTransicionar("APROBADA", "DERIVADA_EXTERNO", "MECANICO_INTERNO")).toBe(false);
  });

  it("un mecánico interno SÍ puede completar una OT en progreso", () => {
    expect(puedeTransicionar("EN_PROGRESO", "COMPLETADA", "MECANICO_INTERNO")).toBe(true);
  });

  it("no existe transición directa de PENDIENTE_APROBACION a COMPLETADA", () => {
    expect(puedeTransicionar("PENDIENTE_APROBACION", "COMPLETADA", "ADMIN")).toBe(false);
  });

  it("una OT completada no puede volver a ningún otro estado", () => {
    expect(puedeTransicionar("COMPLETADA", "EN_PROGRESO", "ADMIN")).toBe(false);
    expect(puedeTransicionar("COMPLETADA", "CANCELADA", "ADMIN")).toBe(false);
  });

  it("una OT cancelada no puede volver a ningún otro estado", () => {
    expect(puedeTransicionar("CANCELADA", "PENDIENTE_APROBACION", "ADMIN")).toBe(false);
  });

  it("ENCARGADO_MANTENIMIENTO puede cancelar en cualquier estado abierto", () => {
    expect(puedeTransicionar("PENDIENTE_APROBACION", "CANCELADA", "ENCARGADO_MANTENIMIENTO")).toBe(true);
    expect(puedeTransicionar("APROBADA", "CANCELADA", "ENCARGADO_MANTENIMIENTO")).toBe(true);
    expect(puedeTransicionar("EN_PROGRESO", "CANCELADA", "ENCARGADO_MANTENIMIENTO")).toBe(true);
    expect(puedeTransicionar("DERIVADA_EXTERNO", "CANCELADA", "ENCARGADO_MANTENIMIENTO")).toBe(true);
  });

  it("desde DERIVADA_EXTERNO se puede volver a EN_PROGRESO o completar, solo gestión", () => {
    expect(puedeTransicionar("DERIVADA_EXTERNO", "EN_PROGRESO", "ADMIN")).toBe(true);
    expect(puedeTransicionar("DERIVADA_EXTERNO", "COMPLETADA", "ADMIN")).toBe(true);
    expect(puedeTransicionar("DERIVADA_EXTERNO", "EN_PROGRESO", "MECANICO_INTERNO")).toBe(false);
  });

  it("un rol sin ninguna relación con OT (ej. CONTADOR) no puede transicionar nada", () => {
    expect(puedeTransicionar("PENDIENTE_APROBACION", "APROBADA", "CONTADOR")).toBe(false);
    expect(puedeTransicionar("APROBADA", "EN_PROGRESO", "CONTADOR")).toBe(false);
  });
});

describe("transicionesDisponibles", () => {
  it("lista las transiciones que puede hacer un ADMIN desde PENDIENTE_APROBACION", () => {
    const disponibles = transicionesDisponibles("PENDIENTE_APROBACION", "ADMIN");
    expect(disponibles.sort()).toEqual(["APROBADA", "CANCELADA"].sort());
  });

  it("lista solo EN_PROGRESO para un mecánico desde APROBADA", () => {
    expect(transicionesDisponibles("APROBADA", "MECANICO_INTERNO")).toEqual(["EN_PROGRESO"]);
  });

  it("devuelve vacío para un estado terminal", () => {
    expect(transicionesDisponibles("COMPLETADA", "ADMIN")).toEqual([]);
  });
});
