import "server-only";
import type { ScopedPrismaClient } from "@/lib/tenant-prisma";

export type EstadoDia = {
  fecha: string; // YYYY-MM-DD
  checklistSalida: boolean;
  cierreRuta: boolean;
  // null = el chofer no cerró ruta ese día, así que no hay dato de tanque.
  tanqueLleno: boolean | null;
  // true = el guardia marcó que el vehículo no salió a reparto ese día — no
  // cuenta ni como cumplido ni como incumplido, se excluye de los agregados.
  excluido: boolean;
};

export type CumplimientoAgregado = {
  clave: string; // "01".."12" (mes) o "2026" (año)
  checklistSalida: number;
  cierreRuta: number;
  tanqueLleno: number;
};

function claveDia(fecha: Date) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}

/**
 * Los campos `@db.Date` (como DiaNoOperado.fecha) vuelven de Prisma como
 * medianoche UTC, no medianoche local — con getters locales, en un huso
 * horario negativo (Argentina, UTC-3) el día calculado queda un día atrás.
 * Para esos campos hay que leer los componentes en UTC, no local.
 */
function claveDiaUTC(fecha: Date) {
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, "0")}-${String(fecha.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Un día cuenta como "con checklist"/"con cierre" si el chofer tiene al
 * menos un registro ese día — no distingue vehículo, porque lo que se mide
 * acá es la gestión del chofer, no del vehículo (eso ya lo cubre el panel
 * principal de portería). Los días que el guardia marcó como "no salió a
 * reparto" para ese chofer quedan con excluido=true, sin importar si hay
 * o no registros ese día.
 */
async function estadoPorDia(
  prisma: ScopedPrismaClient,
  choferId: string,
  desde: Date,
  hasta: Date
): Promise<Map<string, EstadoDia>> {
  const [checklists, eventos, diasNoOperados] = await Promise.all([
    prisma.checklistRealizado.findMany({
      where: { choferId, fechaHora: { gte: desde, lte: hasta } },
      select: { fechaHora: true },
    }),
    prisma.eventoRuta.findMany({
      where: { choferId, fechaHora: { gte: desde, lte: hasta } },
      select: { fechaHora: true, tanqueLleno: true },
    }),
    prisma.diaNoOperado.findMany({
      where: { choferId, fecha: { gte: desde, lte: hasta } },
      select: { fecha: true },
    }),
  ]);

  const mapa = new Map<string, EstadoDia>();
  const obtener = (fecha: Date) => {
    const clave = claveDia(fecha);
    let estado = mapa.get(clave);
    if (!estado) {
      estado = { fecha: clave, checklistSalida: false, cierreRuta: false, tanqueLleno: null, excluido: false };
      mapa.set(clave, estado);
    }
    return estado;
  };

  for (const c of checklists) obtener(c.fechaHora).checklistSalida = true;
  for (const e of eventos) {
    const estado = obtener(e.fechaHora);
    estado.cierreRuta = true;
    if (e.tanqueLleno === true) estado.tanqueLleno = true;
    else if (e.tanqueLleno === false && estado.tanqueLleno !== true) estado.tanqueLleno = false;
  }
  for (const d of diasNoOperados) {
    const clave = claveDiaUTC(d.fecha);
    let estado = mapa.get(clave);
    if (!estado) {
      estado = { fecha: clave, checklistSalida: false, cierreRuta: false, tanqueLleno: null, excluido: false };
      mapa.set(clave, estado);
    }
    estado.excluido = true;
  }

  return mapa;
}

/** Un renglón por cada día del mes, cumpla o no — así se ven también los días sin actividad. */
export async function calcularCumplimientoPorDia(
  prisma: ScopedPrismaClient,
  choferId: string,
  anio: number,
  mes: number // 1-12
): Promise<EstadoDia[]> {
  const desde = new Date(anio, mes - 1, 1);
  const hasta = new Date(anio, mes, 0, 23, 59, 59, 999);
  const estados = await estadoPorDia(prisma, choferId, desde, hasta);

  const diasEnMes = hasta.getDate();
  const resultado: EstadoDia[] = [];
  for (let dia = 1; dia <= diasEnMes; dia++) {
    const clave = claveDia(new Date(anio, mes - 1, dia));
    resultado.push(
      estados.get(clave) ?? { fecha: clave, checklistSalida: false, cierreRuta: false, tanqueLleno: null, excluido: false }
    );
  }
  return resultado;
}

/** Un grupo por cada mes del año (acumulado), con la cantidad de días que cumplió cada métrica. */
export async function calcularCumplimientoPorMes(
  prisma: ScopedPrismaClient,
  choferId: string,
  anio: number
): Promise<CumplimientoAgregado[]> {
  const desde = new Date(anio, 0, 1);
  const hasta = new Date(anio, 11, 31, 23, 59, 59, 999);
  const estados = await estadoPorDia(prisma, choferId, desde, hasta);

  const acumulado: CumplimientoAgregado[] = Array.from({ length: 12 }, (_, i) => ({
    clave: String(i + 1).padStart(2, "0"),
    checklistSalida: 0,
    cierreRuta: 0,
    tanqueLleno: 0,
  }));

  for (const estado of estados.values()) {
    if (estado.excluido) continue;
    const mes = Number(estado.fecha.slice(5, 7)) - 1;
    if (estado.checklistSalida) acumulado[mes].checklistSalida++;
    if (estado.cierreRuta) acumulado[mes].cierreRuta++;
    if (estado.tanqueLleno === true) acumulado[mes].tanqueLleno++;
  }

  return acumulado;
}

/** Rango de años (inclusive) con al menos un registro del chofer, para saber qué años graficar. */
async function rangoAniosConDatos(prisma: ScopedPrismaClient, choferId: string): Promise<[number, number] | null> {
  const [checklistMin, checklistMax, eventoMin, eventoMax] = await Promise.all([
    prisma.checklistRealizado.findFirst({ where: { choferId }, orderBy: { fechaHora: "asc" }, select: { fechaHora: true } }),
    prisma.checklistRealizado.findFirst({ where: { choferId }, orderBy: { fechaHora: "desc" }, select: { fechaHora: true } }),
    prisma.eventoRuta.findFirst({ where: { choferId }, orderBy: { fechaHora: "asc" }, select: { fechaHora: true } }),
    prisma.eventoRuta.findFirst({ where: { choferId }, orderBy: { fechaHora: "desc" }, select: { fechaHora: true } }),
  ]);

  const fechas = [checklistMin, checklistMax, eventoMin, eventoMax]
    .filter((r): r is { fechaHora: Date } => r != null)
    .map((r) => r.fechaHora.getFullYear());
  if (fechas.length === 0) return null;
  return [Math.min(...fechas), Math.max(...fechas)];
}

/** Un grupo por cada año con datos, con la cantidad de días que cumplió cada métrica. */
export async function calcularCumplimientoPorAnio(
  prisma: ScopedPrismaClient,
  choferId: string
): Promise<CumplimientoAgregado[]> {
  const rango = await rangoAniosConDatos(prisma, choferId);
  if (!rango) return [];
  const [anioMin, anioMax] = rango;

  const resultado: CumplimientoAgregado[] = [];
  for (let anio = anioMin; anio <= anioMax; anio++) {
    const desde = new Date(anio, 0, 1);
    const hasta = new Date(anio, 11, 31, 23, 59, 59, 999);
    const estados = await estadoPorDia(prisma, choferId, desde, hasta);

    const agregado: CumplimientoAgregado = { clave: String(anio), checklistSalida: 0, cierreRuta: 0, tanqueLleno: 0 };
    for (const estado of estados.values()) {
      if (estado.excluido) continue;
      if (estado.checklistSalida) agregado.checklistSalida++;
      if (estado.cierreRuta) agregado.cierreRuta++;
      if (estado.tanqueLleno === true) agregado.tanqueLleno++;
    }
    resultado.push(agregado);
  }
  return resultado;
}
