import { z } from "zod";

/**
 * FormData siempre entrega strings. Un input numérico vacío llega como "",
 * y z.coerce.number() convierte "" a 0 (Number("") === 0) en vez de fallar,
 * así que un campo opcional vacío terminaría guardándose como 0 en vez de
 * quedar sin definir. Este preprocess intercepta el "" antes de la coerción.
 */
const vacioComoUndefined = (val: unknown) => (val === "" || val == null ? undefined : val);

export function optionalInt(opts?: { min?: number; max?: number }) {
  let schema = z.coerce.number().int();
  if (opts?.min != null) schema = schema.min(opts.min);
  if (opts?.max != null) schema = schema.max(opts.max);
  return z.preprocess(vacioComoUndefined, schema.optional());
}

/**
 * Usado siempre para montos de plata (estimado, total, costo unitario,
 * presupuesto) — nunca tiene sentido un monto negativo, así que se valida
 * acá una sola vez en vez de en cada action que lo usa.
 */
export function optionalNumber() {
  return z.preprocess(vacioComoUndefined, z.coerce.number().nonnegative().optional());
}

export function normalizarDni(dni: string) {
  return dni.replace(/[.\s-]/g, "");
}
