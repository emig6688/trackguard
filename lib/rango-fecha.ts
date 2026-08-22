import "server-only";
import { inicioDeHoy } from "@/lib/checklist";

function formatearISO(fecha: Date): string {
  const y = fecha.getUTCFullYear();
  const m = String(fecha.getUTCMonth() + 1).padStart(2, "0");
  const d = String(fecha.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type AtajoPeriodo = { label: string; desde: string; hasta: string };

/**
 * Atajos "última semana / último mes / último año" para los filtros de
 * período de la app — devuelve fechas en formato YYYY-MM-DD (el que usan los
 * <input type="date">), calculadas sobre el día de hoy en Argentina, no en
 * el huso del servidor.
 */
export function atajosPeriodo(): AtajoPeriodo[] {
  const hoy = inicioDeHoy();
  const hastaStr = formatearISO(hoy);
  const restarDias = (dias: number) => new Date(hoy.getTime() - dias * 24 * 60 * 60 * 1000);
  const restarMeses = (meses: number) =>
    new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - meses, hoy.getUTCDate()));
  const restarAnios = (anios: number) =>
    new Date(Date.UTC(hoy.getUTCFullYear() - anios, hoy.getUTCMonth(), hoy.getUTCDate()));

  return [
    { label: "Última semana", desde: formatearISO(restarDias(7)), hasta: hastaStr },
    { label: "Último mes", desde: formatearISO(restarMeses(1)), hasta: hastaStr },
    { label: "Último año", desde: formatearISO(restarAnios(1)), hasta: hastaStr },
  ];
}
