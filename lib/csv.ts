function celdaCsv(valor: string | number | null | undefined): string {
  const str = valor == null ? "" : String(valor);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function generarCsv(
  encabezados: string[],
  filas: (string | number | null | undefined)[][]
): string {
  const lineas = [encabezados.map(celdaCsv).join(","), ...filas.map((f) => f.map(celdaCsv).join(","))];
  return lineas.join("\n");
}
