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
  // Mes en curso: 1 del mes actual hasta hoy (no hasta el final del mes,
  // todavía no pasó) — si hoy es 26/8, va del 1/8 al 26/8.
  const primerDiaDelMes = () => new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
  // Último mes completo: el mes calendario anterior, entero — si hoy es
  // 26/8, va del 1/7 al 31/7 (agosto todavía no terminó, así que el "mes
  // completo" más reciente es julio, no agosto).
  const primerDiaDelMesAnterior = () => new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 1, 1));
  const ultimoDiaDelMesAnterior = () => new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 0));

  return [
    { label: "Última semana", desde: formatearISO(restarDias(7)), hasta: hastaStr },
    { label: "Último mes", desde: formatearISO(restarMeses(1)), hasta: hastaStr },
    { label: "Mes en curso", desde: formatearISO(primerDiaDelMes()), hasta: hastaStr },
    {
      label: "Último mes completo",
      desde: formatearISO(primerDiaDelMesAnterior()),
      hasta: formatearISO(ultimoDiaDelMesAnterior()),
    },
    { label: "Último año", desde: formatearISO(restarAnios(1)), hasta: hastaStr },
  ];
}
