import "server-only";
import type { ScopedPrismaClient } from "@/lib/tenant-prisma";
import { obtenerReglaNotificacion, enviarPorCanalesConfigurados } from "@/lib/notificaciones";
import { usuariosDeEmpresaPorRol } from "@/lib/permisos";

/**
 * Ítems con los que arranca el checklist pre-salida de toda empresa nueva
 * (se puede editar después desde /notificaciones → "Checklist pre-salida").
 * Sin esto, una empresa recién dada de alta no tiene ningún checklist
 * cargado y sus choferes quedan bloqueados el primer día.
 */
export const ITEMS_CHECKLIST_ESTANDAR = [
  "Luces delanteras",
  "Luces traseras y de freno",
  "Frenos",
  "Freno de mano",
  "Estado de neumáticos",
  "Presión de neumáticos",
  "Nivel de aceite",
  "Nivel de agua/refrigerante",
  "Documentación a bordo",
];

// Argentina no usa horario de verano desde 2009 — UTC-3 fijo todo el año.
const HORAS_DESFASE_ARGENTINA = 3;

/**
 * "Hoy" en huso horario de Argentina, no del servidor. En Vercel las
 * funciones corren en UTC: sin este ajuste, un chofer que hace el
 * checklist de pre-salida en la mañana y cierra la ruta entre las 21:00 y
 * las 23:59 (hora Argentina) cae del lado de "mañana" para el servidor
 * (ya es el día siguiente en UTC) y el emparejamiento pre-salida/cierre se
 * pierde en silencio — nunca suma horas y puede bloquear el cierre de ruta
 * si el checklist obligatorio está activo.
 */
export function inicioDeHoy(): Date {
  const msArgentina = Date.now() - HORAS_DESFASE_ARGENTINA * 60 * 60 * 1000;
  const argentina = new Date(msArgentina);
  const medianocheUTC = Date.UTC(argentina.getUTCFullYear(), argentina.getUTCMonth(), argentina.getUTCDate());
  return new Date(medianocheUTC + HORAS_DESFASE_ARGENTINA * 60 * 60 * 1000);
}

/** Clave "YYYY-MM-DD" del día calendario en Argentina para una fecha dada. */
function diaArgentina(fecha: Date): string {
  const argentina = new Date(fecha.getTime() - HORAS_DESFASE_ARGENTINA * 60 * 60 * 1000);
  return argentina.toISOString().slice(0, 10);
}

// Antes, "¿ya hizo el checklist?" se resolvía comparando contra el inicio
// del día calendario en Argentina (inicioDeHoy()). Eso se rompe con
// cualquier reparto que arranca antes de medianoche y sigue después: al
// cambiar el día calendario, el chofer perdía su pre-salida en plena ruta y
// quedaba bloqueado (cerrar ruta, cargar combustible, cargar gasto) aunque
// sí había hecho el checklist unas horas antes — pasó exactamente esto con
// PERALTA, Jonatan Ezequiel (checklist del 18/9 11:38, bloqueado de
// madrugada ya en el día siguiente). La pregunta correcta no es "¿fue hoy?"
// sino "¿el reparto que abrió ese checklist ya se cerró?" — así que ahora
// un pre-salida sigue vigente hasta que hay un cierre posterior (EventoRuta,
// o un checklist de cierre — quedan de antes de que existiera EventoRuta),
// sin importar cuántos días calendario pasen en el medio.
//
// VENTANA_REPARTO_ABIERTO_DIAS acota igual las consultas que buscan "el
// último pre-salida" — no por una regla de negocio (un reparto puede durar
// lo que dure), sino para no escanear el historial completo de checklists
// de un chofer con antigüedad cada vez que se pide la pantalla de inicio
// mobile. 30 días es muchísimo más que cualquier reparto real; si algún día
// hace falta un reparto más largo, hay que subir este número, no sacarlo.
const VENTANA_REPARTO_ABIERTO_DIAS = 30;

function inicioVentanaRepartoAbierto(): Date {
  return new Date(Date.now() - VENTANA_REPARTO_ABIERTO_DIAS * 24 * 60 * 60 * 1000);
}

async function hayCierrePosterior(
  prisma: ScopedPrismaClient,
  choferId: string,
  vehiculoId: string,
  desde: Date
): Promise<boolean> {
  const [eventoRuta, checklistCierre] = await Promise.all([
    prisma.eventoRuta.findFirst({ where: { choferId, vehiculoId, fechaHora: { gt: desde } } }),
    prisma.checklistRealizado.findFirst({
      where: { choferId, vehiculoId, momento: "CIERRE", fechaHora: { gt: desde } },
    }),
  ]);
  return eventoRuta != null || checklistCierre != null;
}

/**
 * vehiculoId es opcional a propósito: sin él, chequea "tiene algún reparto
 * abierto con cualquier vehículo" (usado como pista general en pantallas que
 * todavía no saben con qué camión va a trabajar el chofer). Pasándolo,
 * chequea el reparto de ESE vehículo puntual — es el chequeo que hay que
 * usar antes de dejar cargar combustible/cerrar ruta/cargar gasto de un
 * vehículo específico, para no dar por hecho que el checklist de otro
 * camión también cubre a este.
 */
export async function choferHizoChecklistHoy(
  prisma: ScopedPrismaClient,
  choferId: string,
  vehiculoId?: string
): Promise<boolean> {
  const presalidas = await prisma.checklistRealizado.findMany({
    where: {
      choferId,
      momento: "PRESALIDA",
      fechaHora: { gte: inicioVentanaRepartoAbierto() },
      ...(vehiculoId ? { vehiculoId } : {}),
    },
    orderBy: { fechaHora: "desc" },
    select: { vehiculoId: true, fechaHora: true },
  });

  for (const p of presalidas) {
    if (!(await hayCierrePosterior(prisma, choferId, p.vehiculoId, p.fechaHora))) return true;
  }
  return false;
}

/**
 * El vehículo del "reparto abierto" para este chofer: el pre-salida más
 * reciente que todavía no tiene un cierre posterior (EventoRuta o checklist
 * de cierre). Es la patente correcta para cerrar ruta — un chofer no
 * debería poder elegir cualquier vehículo activo de la empresa al cerrar,
 * solo el que efectivamente usó en el pre-salida.
 *
 * Devuelve null si no hay ningún reparto abierto (no hizo ningún checklist,
 * o ya cerró todos los que hizo) — en ese caso quien llama debe caer
 * a un selector libre o bloquear, según si el checklist es obligatorio.
 */
export async function vehiculoActivoParaCierre(
  prisma: ScopedPrismaClient,
  choferId: string
): Promise<{ id: string; patente: string } | null> {
  const presalidas = await prisma.checklistRealizado.findMany({
    where: { choferId, momento: "PRESALIDA", fechaHora: { gte: inicioVentanaRepartoAbierto() } },
    orderBy: { fechaHora: "desc" },
    select: { vehiculoId: true, fechaHora: true, vehiculo: { select: { id: true, patente: true } } },
  });

  for (const p of presalidas) {
    if (!(await hayCierrePosterior(prisma, choferId, p.vehiculoId, p.fechaHora))) return p.vehiculo;
  }
  return null;
}

/**
 * El vehículo del checklist pre-salida más reciente de este chofer, sin
 * importar si ya cerró ruta con él o no — a diferencia de
 * vehiculoActivoParaCierre (pensado solo para cerrar ruta), este se usa
 * para fijar la patente al cargar combustible o un gasto: un chofer puede
 * necesitar cargar combustible antes de cerrar la ruta, o incluso después
 * de haberla cerrado.
 */
export async function vehiculoDelChecklistDeHoy(
  prisma: ScopedPrismaClient,
  choferId: string
): Promise<{ id: string; patente: string } | null> {
  const checklist = await prisma.checklistRealizado.findFirst({
    where: { choferId, momento: "PRESALIDA", fechaHora: { gte: inicioVentanaRepartoAbierto() } },
    orderBy: { fechaHora: "desc" },
    select: { vehiculo: { select: { id: true, patente: true } } },
  });
  return checklist?.vehiculo ?? null;
}

/**
 * true si la empresa tiene activada la regla de checklist obligatorio,
 * independientemente de si el chofer ya lo hizo hoy o no — a diferencia de
 * checklistObligatorioPendiente (que responde "¿hay que bloquearlo ahora
 * mismo?"), esto responde "¿esta empresa usa esta regla?", para decidir si
 * corresponde fijar la patente del vehículo o dejar un selector libre.
 */
export async function checklistObligatorioActivo(
  prisma: ScopedPrismaClient,
  empresaId: string
): Promise<boolean> {
  const regla = await obtenerReglaNotificacion(prisma, empresaId, "CHECKLIST_NO_REALIZADO");
  return regla.activo;
}

/**
 * Suma a Vehiculo.horasEquipoFrio la duración entre el pre-salida que abrió
 * el reparto y el cierre de ruta (con o sin novedades) que se acaba de
 * completar, para el mismo chofer+vehículo. Antes buscaba el pre-salida
 * "de hoy" — se rompía en repartos que cruzan medianoche (el pre-salida
 * queda "de ayer" y esto descartaba la medición en silencio, perdiendo las
 * horas de frío de esa jornada). Ahora toma el pre-salida vigente más
 * reciente (ver hayCierrePosterior), sin importar el día calendario. Si no
 * hay pre-salida vigente, o si ya hubo otro cierre entre medio (evita doble
 * conteo si el chofer cierra la ruta más de una vez), la medición se
 * descarta sin sumar nada — nunca se adivina un valor.
 */
export async function registrarHorasEquipoFrioSiCorresponde(
  prisma: ScopedPrismaClient,
  params: { vehiculoId: string; choferId: string; eventoRutaId: string; cierreFechaHora: Date }
) {
  const { vehiculoId, choferId, eventoRutaId, cierreFechaHora } = params;

  const presalida = await prisma.checklistRealizado.findFirst({
    where: { choferId, vehiculoId, momento: "PRESALIDA", fechaHora: { lte: cierreFechaHora } },
    orderBy: { fechaHora: "desc" },
  });
  if (!presalida) {
    console.log(`[horasEquipoFrio] descartada: sin checklist pre-salida vigente (chofer=${choferId}, vehiculo=${vehiculoId})`);
    return;
  }

  const otroCierreEnElMedio = await prisma.eventoRuta.findFirst({
    where: {
      choferId,
      vehiculoId,
      fechaHora: { gt: presalida.fechaHora, lte: cierreFechaHora },
      id: { not: eventoRutaId },
    },
  });
  if (otroCierreEnElMedio) {
    console.log(`[horasEquipoFrio] descartada: ya se registró un cierre de ruta para ese pre-salida (chofer=${choferId}, vehiculo=${vehiculoId})`);
    return;
  }

  const horas = (cierreFechaHora.getTime() - presalida.fechaHora.getTime()) / (1000 * 60 * 60);
  if (horas <= 0) {
    console.log(`[horasEquipoFrio] descartada: el cierre es anterior o igual al pre-salida (chofer=${choferId}, vehiculo=${vehiculoId})`);
    return;
  }

  const vehiculo = await prisma.vehiculo.findUniqueOrThrow({
    where: { id: vehiculoId },
    select: { horasEquipoFrio: true },
  });
  await prisma.vehiculo.update({
    where: { id: vehiculoId },
    data: { horasEquipoFrio: (vehiculo.horasEquipoFrio ?? 0) + Math.round(horas) },
  });
}

/**
 * Recalcula, para el reporte de trazabilidad, las horas de equipo de frío
 * acumuladas en un período — Vehiculo.horasEquipoFrio es un total corrido
 * sin desglose por fecha, así que para un período arbitrario hay que
 * volver a armar los pares pre-salida/cierre (por día+chofer) a partir de
 * los checklists y los cierres de ruta de esa ventana. El cierre de cada
 * jornada puede venir de un checklist de cierre (períodos viejos, antes de
 * que se sacara esa pantalla) o de un EventoRuta (períodos nuevos) — se usa
 * lo que exista. Mismo criterio de descarte que
 * registrarHorasEquipoFrioSiCorresponde: sin pre-salida y cierre del día,
 * esa jornada no suma.
 */
export async function horasEquipoFrioEnPeriodo(
  prisma: ScopedPrismaClient,
  vehiculoId: string,
  desde: Date,
  hasta: Date
): Promise<number> {
  const [checklists, eventos] = await Promise.all([
    prisma.checklistRealizado.findMany({
      where: { vehiculoId, fechaHora: { gte: desde, lte: hasta } },
      orderBy: { fechaHora: "asc" },
      select: { momento: true, fechaHora: true, choferId: true },
    }),
    prisma.eventoRuta.findMany({
      where: { vehiculoId, fechaHora: { gte: desde, lte: hasta } },
      orderBy: { fechaHora: "asc" },
      select: { fechaHora: true, choferId: true },
    }),
  ]);

  const porDiaChofer = new Map<string, { presalida?: Date; cierre?: Date }>();
  for (const c of checklists) {
    const dia = diaArgentina(c.fechaHora);
    const clave = `${dia}_${c.choferId}`;
    const entrada = porDiaChofer.get(clave) ?? {};
    if (c.momento === "PRESALIDA" && !entrada.presalida) entrada.presalida = c.fechaHora;
    if (c.momento === "CIERRE" && !entrada.cierre) entrada.cierre = c.fechaHora;
    porDiaChofer.set(clave, entrada);
  }
  for (const e of eventos) {
    const dia = diaArgentina(e.fechaHora);
    const clave = `${dia}_${e.choferId}`;
    const entrada = porDiaChofer.get(clave) ?? {};
    if (!entrada.cierre) entrada.cierre = e.fechaHora;
    porDiaChofer.set(clave, entrada);
  }

  let totalHoras = 0;
  for (const { presalida, cierre } of porDiaChofer.values()) {
    if (presalida && cierre && cierre > presalida) {
      totalHoras += (cierre.getTime() - presalida.getTime()) / (1000 * 60 * 60);
    }
  }
  return Math.round(totalHoras);
}

export type ResultadoChecklistObligatorio = { bloqueado: false } | { bloqueado: true; motivo: string };

export const MOTIVO_CHECKLIST_PENDIENTE =
  "Tenés que completar el checklist pre-salida de hoy antes de continuar.";

/**
 * true si la empresa activó "checklist obligatorio" (regla
 * CHECKLIST_NO_REALIZADO activa en /notificaciones) y el chofer todavía no
 * hizo el checklist pre-salida de hoy. Sin efectos secundarios — para
 * gatear la UI (mostrar las demás opciones deshabilitadas, impedir cargar
 * un formulario) antes de que el chofer llegue a intentar la acción.
 */
export async function checklistObligatorioPendiente(
  prisma: ScopedPrismaClient,
  empresaId: string,
  choferId: string,
  vehiculoId?: string
): Promise<boolean> {
  const regla = await obtenerReglaNotificacion(prisma, empresaId, "CHECKLIST_NO_REALIZADO");
  if (!regla.activo) return false;
  return !(await choferHizoChecklistHoy(prisma, choferId, vehiculoId));
}

/**
 * Mismo chequeo que checklistObligatorioPendiente, pero además avisa a los
 * roles configurados cuando bloquea — pensado como último resguardo dentro
 * de la propia acción del servidor (por si el chofer la dispara sin pasar
 * por la UI ya gateada, o la regla cambió mientras tenía la página
 * abierta), no como el mecanismo principal para evitar el intento.
 */
export async function verificarChecklistDelDia(
  prisma: ScopedPrismaClient,
  empresaId: string,
  chofer: { id: string; nombre: string },
  vehiculoId?: string
): Promise<ResultadoChecklistObligatorio> {
  const regla = await obtenerReglaNotificacion(prisma, empresaId, "CHECKLIST_NO_REALIZADO");
  if (!regla.activo) return { bloqueado: false };

  const yaHizo = await choferHizoChecklistHoy(prisma, chofer.id, vehiculoId);
  if (yaHizo) return { bloqueado: false };

  if (regla.roles.length > 0 && regla.canales.length > 0) {
    const destinatarios = await usuariosDeEmpresaPorRol(prisma, empresaId, regla.roles);
    await enviarPorCanalesConfigurados(
      prisma,
      empresaId,
      destinatarios,
      regla.canales,
      "CHECKLIST_NO_REALIZADO",
      `Checklist pendiente: ${chofer.nombre}`,
      `${chofer.nombre} intentó usar la app sin haber completado el checklist pre-salida de hoy.`,
      "/choferes"
    );
  }

  return {
    bloqueado: true,
    motivo: `${MOTIVO_CHECKLIST_PENDIENTE} Volvé al inicio y hacé el checklist primero.`,
  };
}
