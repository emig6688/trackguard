export type DatosResumenMatutino = {
  nombreUsuario: string | null;
  vehiculosOperativos: number;
  vehiculosTotal: number;
  otAbiertas: number;
  otAtrasadas: number;
  otSinFechaEstimada: number;
  vencimientosProximos: number;
  vencimientosVencidos: boolean;
  comprasSinDocumentar: number;
  presupuestosPendientesAprobar: number;
  pctPreventivo: number | null;
};

export function construirResumenMatutino(d: DatosResumenMatutino): string {
  const partes: string[] = [];

  partes.push(`Buen día${d.nombreUsuario ? `, ${d.nombreUsuario}` : ""}. Así está la flota hoy.`);
  partes.push(`${d.vehiculosOperativos} de ${d.vehiculosTotal} vehículos operativos.`);

  partes.push(
    d.otAtrasadas > 0
      ? `Hay ${d.otAbiertas} órdenes de trabajo abiertas, y ${d.otAtrasadas} están atrasadas.`
      : `Hay ${d.otAbiertas} órdenes de trabajo abiertas, ninguna atrasada.`
  );

  if (d.otSinFechaEstimada > 0) {
    partes.push(`${d.otSinFechaEstimada} órdenes todavía no tienen fecha estimada de finalización.`);
  }

  partes.push(
    d.vencimientosProximos > 0
      ? `${d.vencimientosProximos} documentos ${d.vencimientosVencidos ? "vencidos o próximos a vencer" : "próximos a vencer"}.`
      : "Sin vencimientos próximos."
  );

  if (d.comprasSinDocumentar > 0) {
    partes.push(`${d.comprasSinDocumentar} compras todavía sin documentar.`);
  }

  if (d.presupuestosPendientesAprobar > 0) {
    partes.push(`${d.presupuestosPendientesAprobar} presupuestos esperando tu aprobación.`);
  }

  if (d.pctPreventivo != null) {
    partes.push(`El ${d.pctPreventivo}% del mantenimiento de este período fue preventivo.`);
  }

  return partes.join(" ");
}
