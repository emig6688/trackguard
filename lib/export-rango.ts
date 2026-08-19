import "server-only";

/**
 * Rango de fechas para exports masivos (CSV/PDF/XLSX): sin desde/hasta
 * explícitos en la URL, se acota al último año en vez de exportar el
 * historial completo sin límite.
 */
export function rangoExportPorDefecto(searchParams: URLSearchParams, aniosPorDefecto = 1) {
  const desdeRaw = searchParams.get("desde");
  const hastaRaw = searchParams.get("hasta");
  const hasta = hastaRaw ? new Date(hastaRaw) : new Date();
  const desde = desdeRaw
    ? new Date(desdeRaw)
    : new Date(hasta.getFullYear() - aniosPorDefecto, hasta.getMonth(), hasta.getDate());
  return { desde, hasta };
}
