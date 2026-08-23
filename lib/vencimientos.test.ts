import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { diasHastaVencimiento, calcularEstadoVencimiento } from "@/lib/vencimientos";

describe("diasHastaVencimiento", () => {
  it("da 0 el mismo día", () => {
    const hoy = new Date("2026-06-15T08:00:00Z");
    expect(diasHastaVencimiento(new Date("2026-06-15T20:00:00Z"), hoy)).toBe(0);
  });

  it("cuenta días hacia adelante", () => {
    const hoy = new Date("2026-06-15T12:00:00Z");
    expect(diasHastaVencimiento(new Date("2026-06-22T12:00:00Z"), hoy)).toBe(7);
  });

  it("da negativo para una fecha ya vencida", () => {
    const hoy = new Date("2026-06-15T12:00:00Z");
    expect(diasHastaVencimiento(new Date("2026-06-10T12:00:00Z"), hoy)).toBe(-5);
  });

  it("ignora la hora del día, solo compara fechas de calendario", () => {
    const hoy = new Date("2026-06-15T12:00:00Z");
    expect(diasHastaVencimiento(new Date("2026-06-16T12:00:00Z"), hoy)).toBe(1);
  });
});

// calcularEstadoVencimiento no recibe "ahora" como parámetro (siempre usa
// new Date() real), así que estos tests fijan el reloj del sistema para que
// las fechas relativas sean deterministas sin importar cuándo se corra la
// suite.
describe("calcularEstadoVencimiento", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("VENCIDO cuando ya pasó la fecha", () => {
    expect(calcularEstadoVencimiento(new Date("2026-06-01"), [30, 15, 7])).toBe("VENCIDO");
  });

  it("VIGENTE cuando falta más que el máximo de los días de alerta", () => {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + 60);
    expect(calcularEstadoVencimiento(fecha, [30, 15, 7])).toBe("VIGENTE");
  });

  it("PROXIMO cuando falta menos que el máximo de los días de alerta", () => {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + 10);
    expect(calcularEstadoVencimiento(fecha, [30, 15, 7])).toBe("PROXIMO");
  });

  it("usa 30 como default de alerta si no se pasan diasAlerta", () => {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + 20);
    expect(calcularEstadoVencimiento(fecha)).toBe("PROXIMO");
  });

  it("respeta un umbral de alerta configurado más chico", () => {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + 10);
    // Con umbral máximo de 7, una fecha a 10 días todavía es VIGENTE.
    expect(calcularEstadoVencimiento(fecha, [7])).toBe("VIGENTE");
  });
});
