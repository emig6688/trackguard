/**
 * Heurística de extracción de monto a partir del texto de una factura leído
 * por OCR. Prioriza líneas con "total/importe/monto" (formato AR: "$ 45.000,00")
 * y si no encuentra ninguna, cae al número más grande de todo el texto.
 * Es una sugerencia: el usuario siempre puede corregirla antes de confirmar.
 */
const PATRON_MONTO = /\$?\s?(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/g;
const PALABRAS_CLAVE = /total|importe|monto/i;

function aNumero(match: string): number {
  return parseFloat(match.replace(/\./g, "").replace(",", "."));
}

function numerosDeTexto(texto: string): number[] {
  const matches = [...texto.matchAll(PATRON_MONTO)];
  return matches.map((m) => aNumero(m[1])).filter((n) => Number.isFinite(n) && n > 0);
}

export function extraerMontoDeTexto(texto: string): number | null {
  const lineas = texto.split("\n").filter((l) => PALABRAS_CLAVE.test(l));
  const candidatos = lineas.flatMap((linea) => numerosDeTexto(linea));
  if (candidatos.length > 0) return Math.max(...candidatos);

  const todos = numerosDeTexto(texto);
  if (todos.length === 0) return null;
  return Math.max(...todos);
}
