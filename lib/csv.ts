// Los valores que empiezan con estos caracteres son interpretados como
// fórmulas por Excel/Sheets al abrir el CSV (CSV formula injection) — se les
// antepone un apóstrofo para neutralizarlos antes de aplicar el escapado.
const PREFIJOS_FORMULA = /^[=+\-@\t\r]/;

function celdaCsv(valor: string | number | null | undefined): string {
  let str = valor == null ? "" : String(valor);
  if (PREFIJOS_FORMULA.test(str)) str = `'${str}`;
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function generarCsv(
  encabezados: string[],
  filas: (string | number | null | undefined)[][]
): string {
  const lineas = [encabezados.map(celdaCsv).join(","), ...filas.map((f) => f.map(celdaCsv).join(","))];
  return lineas.join("\n");
}
