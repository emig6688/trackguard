import "server-only";
import type { ScopedPrismaClient } from "@/lib/tenant-prisma";

export type FiltroPeriodo = { desde?: Date; hasta?: Date };

export type CostoPorVehiculo = {
  vehiculoId: string;
  patente: string;
  combustible: number;
  gastos: number;
  repuestos: number;
  facturas: number;
  total: number;
};

export type CostoPorChofer = {
  choferId: string;
  nombre: string;
  combustible: number;
  gastos: number;
  total: number;
};

function rangoFecha(filtro: FiltroPeriodo): { gte?: Date; lte?: Date } | undefined {
  const where: { gte?: Date; lte?: Date } = {};
  if (filtro.desde) where.gte = filtro.desde;
  if (filtro.hasta) where.lte = filtro.hasta;
  return Object.keys(where).length > 0 ? where : undefined;
}

/**
 * Costo total por vehículo: combustible + gastos + repuestos + facturas de OT.
 * Repuestos y facturas se agregan en memoria porque su vehículo vive en la OT
 * padre, no en la fila misma — a la escala de esta flota es más simple que un
 * groupBy con join crudo.
 */
export async function calcularCostosPorVehiculo(
  prisma: ScopedPrismaClient,
  filtro: FiltroPeriodo
): Promise<CostoPorVehiculo[]> {
  const fecha = rangoFecha(filtro);

  const [vehiculos, combustible, gastos, ots] = await Promise.all([
    prisma.vehiculo.findMany({ where: { eliminadoEn: null }, orderBy: { patente: "asc" } }),
    prisma.cargaCombustible.groupBy({
      by: ["vehiculoId"],
      _sum: { montoTotal: true },
      where: { eliminadoEn: null, ...(fecha ? { fechaHora: fecha } : {}) },
    }),
    prisma.gasto.groupBy({
      by: ["vehiculoId"],
      _sum: { monto: true },
      // Un gasto rechazado no es un costo real de la empresa — no cuenta.
      where: { eliminadoEn: null, estado: { not: "RECHAZADO" }, ...(fecha ? { fecha } : {}) },
    }),
    prisma.ordenDeTrabajo.findMany({
      where: { eliminadoEn: null },
      select: {
        vehiculoId: true,
        repuestos: { where: { eliminadoEn: null }, select: { cantidad: true, costoUnitario: true, createdAt: true } },
        facturas: { where: { eliminadoEn: null }, select: { monto: true, createdAt: true } },
      },
    }),
  ]);

  const combustiblePorVehiculo = new Map(
    combustible.map((c) => [c.vehiculoId, Number(c._sum.montoTotal ?? 0)])
  );
  const gastosPorVehiculo = new Map(
    gastos.filter((g) => g.vehiculoId != null).map((g) => [g.vehiculoId as string, Number(g._sum.monto ?? 0)])
  );

  const dentroDelRango = (fechaItem: Date) =>
    (!fecha?.gte || fechaItem >= fecha.gte) && (!fecha?.lte || fechaItem <= fecha.lte);

  const repuestosPorVehiculo = new Map<string, number>();
  const facturasPorVehiculo = new Map<string, number>();
  for (const ot of ots) {
    for (const r of ot.repuestos) {
      if (!dentroDelRango(r.createdAt)) continue;
      const costo = Number(r.costoUnitario ?? 0) * r.cantidad;
      repuestosPorVehiculo.set(ot.vehiculoId, (repuestosPorVehiculo.get(ot.vehiculoId) ?? 0) + costo);
    }
    for (const f of ot.facturas) {
      if (!dentroDelRango(f.createdAt)) continue;
      facturasPorVehiculo.set(ot.vehiculoId, (facturasPorVehiculo.get(ot.vehiculoId) ?? 0) + Number(f.monto));
    }
  }

  return vehiculos.map((v) => {
    const combustibleTotal = combustiblePorVehiculo.get(v.id) ?? 0;
    const gastosTotal = gastosPorVehiculo.get(v.id) ?? 0;
    const repuestosTotal = repuestosPorVehiculo.get(v.id) ?? 0;
    const facturasTotal = facturasPorVehiculo.get(v.id) ?? 0;
    return {
      vehiculoId: v.id,
      patente: v.patente,
      combustible: combustibleTotal,
      gastos: gastosTotal,
      repuestos: repuestosTotal,
      facturas: facturasTotal,
      total: combustibleTotal + gastosTotal + repuestosTotal + facturasTotal,
    };
  });
}

/**
 * Costo total por chofer: solo combustible y gastos, porque son los únicos
 * dos registros que tienen un chofer real asociado. Repuestos y facturas
 * pertenecen a la OT/vehículo, no a un chofer específico.
 */
export type TipoCostoMensual = "COMBUSTIBLE" | "GASTOS" | "TOTAL";
export type CostoMensual = { mes: string; monto: number };

/**
 * Serie mensual de costos (últimos N meses, default 12) para graficar en el
 * reporte de costos. Se agrega en memoria por la misma razón que
 * calcularCostosPorVehiculo: a esta escala de flota es más simple que un
 * groupBy con date_trunc crudo, y reutiliza las mismas fuentes de datos.
 */
export async function calcularCostosMensuales(
  prisma: ScopedPrismaClient,
  opciones: { tipo: TipoCostoMensual; vehiculoId?: string; meses?: number }
): Promise<CostoMensual[]> {
  const meses = opciones.meses ?? 12;
  const ahora = new Date();
  const desde = new Date(ahora.getFullYear(), ahora.getMonth() - (meses - 1), 1);
  const filtroVehiculo = opciones.vehiculoId ? { vehiculoId: opciones.vehiculoId } : {};

  const claveMes = (fecha: Date) =>
    `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;

  const acumulado = new Map<string, number>();
  for (let i = 0; i < meses; i++) {
    const d = new Date(desde.getFullYear(), desde.getMonth() + i, 1);
    acumulado.set(claveMes(d), 0);
  }

  const sumar = (fecha: Date, monto: number) => {
    const clave = claveMes(fecha);
    if (acumulado.has(clave)) acumulado.set(clave, (acumulado.get(clave) ?? 0) + monto);
  };

  if (opciones.tipo === "COMBUSTIBLE" || opciones.tipo === "TOTAL") {
    const cargas = await prisma.cargaCombustible.findMany({
      where: { eliminadoEn: null, fechaHora: { gte: desde }, ...filtroVehiculo },
      select: { fechaHora: true, montoTotal: true },
    });
    for (const c of cargas) sumar(c.fechaHora, Number(c.montoTotal));
  }

  if (opciones.tipo === "GASTOS" || opciones.tipo === "TOTAL") {
    const gastos = await prisma.gasto.findMany({
      where: { eliminadoEn: null, estado: { not: "RECHAZADO" }, fecha: { gte: desde }, ...filtroVehiculo },
      select: { fecha: true, monto: true },
    });
    for (const g of gastos) sumar(g.fecha, Number(g.monto));
  }

  if (opciones.tipo === "TOTAL") {
    const ots = await prisma.ordenDeTrabajo.findMany({
      where: { eliminadoEn: null, ...filtroVehiculo },
      select: {
        repuestos: {
          where: { eliminadoEn: null, createdAt: { gte: desde } },
          select: { cantidad: true, costoUnitario: true, createdAt: true },
        },
        facturas: {
          where: { eliminadoEn: null, createdAt: { gte: desde } },
          select: { monto: true, createdAt: true },
        },
      },
    });
    for (const ot of ots) {
      for (const r of ot.repuestos) sumar(r.createdAt, Number(r.costoUnitario ?? 0) * r.cantidad);
      for (const f of ot.facturas) sumar(f.createdAt, Number(f.monto));
    }
  }

  return [...acumulado.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, monto]) => ({ mes, monto }));
}

export async function calcularCostosPorChofer(
  prisma: ScopedPrismaClient,
  empresaId: string,
  filtro: FiltroPeriodo
): Promise<CostoPorChofer[]> {
  const fecha = rangoFecha(filtro);

  const [choferes, combustible, gastos] = await Promise.all([
    prisma.usuario.findMany({
      where: { empresaId, rol: "CHOFER", eliminadoEn: null },
      orderBy: { nombre: "asc" },
    }),
    prisma.cargaCombustible.groupBy({
      by: ["choferId"],
      _sum: { montoTotal: true },
      where: { eliminadoEn: null, ...(fecha ? { fechaHora: fecha } : {}) },
    }),
    prisma.gasto.groupBy({
      by: ["choferId"],
      _sum: { monto: true },
      where: { eliminadoEn: null, estado: { not: "RECHAZADO" }, ...(fecha ? { fecha } : {}) },
    }),
  ]);

  const combustiblePorChofer = new Map(combustible.map((c) => [c.choferId, Number(c._sum.montoTotal ?? 0)]));
  const gastosPorChofer = new Map(gastos.map((g) => [g.choferId, Number(g._sum.monto ?? 0)]));

  return choferes.map((c) => {
    const combustibleTotal = combustiblePorChofer.get(c.id) ?? 0;
    const gastosTotal = gastosPorChofer.get(c.id) ?? 0;
    return {
      choferId: c.id,
      nombre: c.nombre,
      combustible: combustibleTotal,
      gastos: gastosTotal,
      total: combustibleTotal + gastosTotal,
    };
  });
}
