import "server-only";
import type { ScopedPrismaClient } from "@/lib/tenant-prisma";

const ORIGENES_CORRECTIVOS = ["CHECKLIST", "EVENTO_RUTA", "MANUAL"] as const;

export type CandidatoReemplazo = {
  vehiculoId: string;
  patente: string;
  antiguedadAnios: number | null;
  kmActual: number;
  costoTotal12m: number;
  costoPorKm: number;
  correctivas12m: number;
  areasRepetidas: { area: string; cantidad: number }[];
  score: number;
};

/**
 * Score 0-100 de candidato a reemplazo, combinando (sobre los últimos 12
 * meses) costo por km 50%, cantidad de OT correctivas 30% y antigüedad 20%.
 * Cada factor se normaliza contra el máximo presente en la flota actual, así
 * que el score es puramente relativo/de ranking, no una unidad absoluta.
 */
export async function calcularCandidatosReemplazo(
  prisma: ScopedPrismaClient
): Promise<CandidatoReemplazo[]> {
  const ahora = new Date();
  const desde = new Date(ahora.getFullYear() - 1, ahora.getMonth(), ahora.getDate());

  const [vehiculos, ots] = await Promise.all([
    prisma.vehiculo.findMany({
      where: { activo: true, eliminadoEn: null },
      select: { id: true, patente: true, anio: true, kmActual: true },
    }),
    prisma.ordenDeTrabajo.findMany({
      where: { eliminadoEn: null, estado: { not: "CANCELADA" }, createdAt: { gte: desde } },
      select: {
        vehiculoId: true,
        origen: true,
        areaReparacion: true,
        repuestos: { where: { eliminadoEn: null }, select: { cantidad: true, costoUnitario: true } },
        facturas: { where: { eliminadoEn: null }, select: { monto: true } },
      },
    }),
  ]);

  const costoPorVehiculo = new Map<string, number>();
  const correctivasPorVehiculo = new Map<string, number>();
  const areasPorVehiculo = new Map<string, Map<string, number>>();

  for (const ot of ots) {
    let costoOt = 0;
    for (const r of ot.repuestos) costoOt += Number(r.costoUnitario ?? 0) * r.cantidad;
    for (const f of ot.facturas) costoOt += Number(f.monto);
    costoPorVehiculo.set(ot.vehiculoId, (costoPorVehiculo.get(ot.vehiculoId) ?? 0) + costoOt);

    if ((ORIGENES_CORRECTIVOS as readonly string[]).includes(ot.origen)) {
      correctivasPorVehiculo.set(ot.vehiculoId, (correctivasPorVehiculo.get(ot.vehiculoId) ?? 0) + 1);
      if (ot.areaReparacion) {
        const areas = areasPorVehiculo.get(ot.vehiculoId) ?? new Map<string, number>();
        areas.set(ot.areaReparacion, (areas.get(ot.areaReparacion) ?? 0) + 1);
        areasPorVehiculo.set(ot.vehiculoId, areas);
      }
    }
  }

  const datos = vehiculos.map((v) => {
    const costoTotal12m = costoPorVehiculo.get(v.id) ?? 0;
    const costoPorKm = v.kmActual > 0 ? costoTotal12m / v.kmActual : 0;
    const correctivas12m = correctivasPorVehiculo.get(v.id) ?? 0;
    const areasRepetidas = [...(areasPorVehiculo.get(v.id) ?? new Map())]
      .filter(([, cantidad]) => cantidad >= 2)
      .map(([area, cantidad]) => ({ area, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad);

    return {
      vehiculoId: v.id,
      patente: v.patente,
      antiguedadAnios: v.anio != null ? ahora.getFullYear() - v.anio : null,
      kmActual: v.kmActual,
      costoTotal12m,
      costoPorKm,
      correctivas12m,
      areasRepetidas,
    };
  });

  const maxCostoPorKm = Math.max(0, ...datos.map((d) => d.costoPorKm));
  const maxCorrectivas = Math.max(0, ...datos.map((d) => d.correctivas12m));
  const maxAntiguedad = Math.max(0, ...datos.map((d) => d.antiguedadAnios ?? 0));

  return datos
    .map((d) => {
      const costoNorm = maxCostoPorKm > 0 ? d.costoPorKm / maxCostoPorKm : 0;
      const correctivasNorm = maxCorrectivas > 0 ? d.correctivas12m / maxCorrectivas : 0;
      const antiguedadNorm = maxAntiguedad > 0 ? (d.antiguedadAnios ?? 0) / maxAntiguedad : 0;
      const score = Math.round(100 * (0.5 * costoNorm + 0.3 * correctivasNorm + 0.2 * antiguedadNorm));
      return { ...d, score };
    })
    .sort((a, b) => b.score - a.score);
}

export type TendenciaMantenimiento = { mes: string; preventivo: number; correctivo: number };

function claveMes(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Serie mensual de cantidad de OT preventivas vs. correctivas (checklist +
 * evento de ruta + manual), para visualizar si el mix de mantenimiento se
 * mueve hacia lo planificado o hacia lo reactivo a lo largo del tiempo.
 */
export async function calcularTendenciaPreventivoCorrectivo(
  prisma: ScopedPrismaClient,
  meses = 12
): Promise<TendenciaMantenimiento[]> {
  const ahora = new Date();
  const desde = new Date(ahora.getFullYear(), ahora.getMonth() - (meses - 1), 1);

  const acumulado = new Map<string, { preventivo: number; correctivo: number }>();
  for (let i = 0; i < meses; i++) {
    const d = new Date(desde.getFullYear(), desde.getMonth() + i, 1);
    acumulado.set(claveMes(d), { preventivo: 0, correctivo: 0 });
  }

  const ots = await prisma.ordenDeTrabajo.findMany({
    where: { eliminadoEn: null, estado: { not: "CANCELADA" }, createdAt: { gte: desde } },
    select: { origen: true, createdAt: true },
  });

  for (const ot of ots) {
    const clave = claveMes(ot.createdAt);
    const bucket = acumulado.get(clave);
    if (!bucket) continue;
    if (ot.origen === "PREVENTIVO") bucket.preventivo++;
    else bucket.correctivo++;
  }

  return [...acumulado.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, valores]) => ({ mes, ...valores }));
}

export type CorrectivaPorChofer = {
  choferId: string;
  choferNombre: string;
  total: number;
  porVehiculo: { vehiculoId: string; patente: string; cantidad: number }[];
};

export type CorrelacionChoferVehiculo = {
  choferNombre: string;
  patente: string;
  cantidad: number;
  totalVehiculo: number;
  porcentaje: number;
};

/**
 * Ranking de choferes por cantidad de OT correctivas que generaron,
 * desglosado por vehículo. Solo considera origen CHECKLIST/EVENTO_RUTA —
 * son los únicos que quedan atados a un chofer concreto (las MANUAL las
 * carga un administrativo y no reflejan quién manejaba el vehículo).
 *
 * "Correlación": un chofer que concentra una porción desproporcionada de las
 * correctivas de un vehículo puntual, en vez de estar repartidas parejo entre
 * quienes lo manejan — umbral bajo a propósito (flota chica, pocos datos):
 * al menos 2 correctivas del par chofer-vehículo, y que ese chofer sea dueño
 * de al menos el 60% de las correctivas totales de ese vehículo.
 */
export async function calcularCorrectivasPorChofer(prisma: ScopedPrismaClient): Promise<{
  ranking: CorrectivaPorChofer[];
  correlaciones: CorrelacionChoferVehiculo[];
}> {
  const ots = await prisma.ordenDeTrabajo.findMany({
    where: { eliminadoEn: null, estado: { not: "CANCELADA" }, origen: { in: ["CHECKLIST", "EVENTO_RUTA"] } },
    select: {
      vehiculoId: true,
      vehiculo: { select: { patente: true } },
      checklistRealizado: { select: { choferId: true, chofer: { select: { nombre: true } } } },
      eventoRuta: { select: { choferId: true, chofer: { select: { nombre: true } } } },
    },
  });

  type Acumulado = {
    choferNombre: string;
    total: number;
    porVehiculo: Map<string, { patente: string; cantidad: number }>;
  };
  const porChofer = new Map<string, Acumulado>();
  const totalPorVehiculo = new Map<string, number>();

  for (const ot of ots) {
    const origen = ot.checklistRealizado ?? ot.eventoRuta;
    if (!origen) continue;

    totalPorVehiculo.set(ot.vehiculoId, (totalPorVehiculo.get(ot.vehiculoId) ?? 0) + 1);

    const acum = porChofer.get(origen.choferId) ?? {
      choferNombre: origen.chofer.nombre,
      total: 0,
      porVehiculo: new Map<string, { patente: string; cantidad: number }>(),
    };
    acum.total++;
    const vehiculo = acum.porVehiculo.get(ot.vehiculoId) ?? { patente: ot.vehiculo.patente, cantidad: 0 };
    vehiculo.cantidad++;
    acum.porVehiculo.set(ot.vehiculoId, vehiculo);
    porChofer.set(origen.choferId, acum);
  }

  const ranking = [...porChofer.entries()]
    .map(([choferId, acum]) => ({
      choferId,
      choferNombre: acum.choferNombre,
      total: acum.total,
      porVehiculo: [...acum.porVehiculo.entries()]
        .map(([vehiculoId, v]) => ({ vehiculoId, patente: v.patente, cantidad: v.cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad),
    }))
    .sort((a, b) => b.total - a.total);

  const correlaciones: CorrelacionChoferVehiculo[] = [];
  for (const chofer of ranking) {
    for (const v of chofer.porVehiculo) {
      const totalVehiculo = totalPorVehiculo.get(v.vehiculoId) ?? 0;
      const porcentaje = totalVehiculo > 0 ? Math.round((v.cantidad / totalVehiculo) * 100) : 0;
      if (v.cantidad >= 2 && porcentaje >= 60) {
        correlaciones.push({ choferNombre: chofer.choferNombre, patente: v.patente, cantidad: v.cantidad, totalVehiculo, porcentaje });
      }
    }
  }
  correlaciones.sort((a, b) => b.porcentaje - a.porcentaje);

  return { ranking, correlaciones };
}

export type DisponibilidadMensual = { mes: string; disponibilidadPromedio: number };

/**
 * % promedio mensual de disponibilidad efectiva de la flota, a partir de los
 * snapshots diarios (DisponibilidadSnapshot). Solo hay datos desde que se
 * creó el snapshot diario — meses anteriores a eso no aparecen en el
 * resultado en vez de mostrarse en 0 (evita sugerir una caída falsa).
 */
export async function calcularDisponibilidadHistorica(
  prisma: ScopedPrismaClient,
  meses = 12
): Promise<DisponibilidadMensual[]> {
  const ahora = new Date();
  const desde = new Date(ahora.getFullYear(), ahora.getMonth() - (meses - 1), 1);

  const snapshots = await prisma.disponibilidadSnapshot.findMany({
    where: { fecha: { gte: desde } },
    select: { fecha: true, disponible: true },
  });

  const acumulado = new Map<string, { disponibles: number; total: number }>();
  for (const s of snapshots) {
    const clave = claveMes(s.fecha);
    const bucket = acumulado.get(clave) ?? { disponibles: 0, total: 0 };
    bucket.total++;
    if (s.disponible) bucket.disponibles++;
    acumulado.set(clave, bucket);
  }

  return [...acumulado.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, { disponibles, total }]) => ({
      mes,
      disponibilidadPromedio: total > 0 ? Math.round((disponibles / total) * 1000) / 10 : 0,
    }));
}
