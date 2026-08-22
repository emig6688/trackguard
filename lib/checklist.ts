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

/**
 * vehiculoId es opcional a propósito: sin él, chequea "hizo algún checklist
 * hoy con cualquier vehículo" (usado como pista general en pantallas que
 * todavía no saben con qué camión va a trabajar el chofer). Pasándolo,
 * chequea el checklist de ESE vehículo puntual — es el chequeo que hay que
 * usar antes de dejar cargar combustible/cerrar ruta/cargar gasto de un
 * vehículo específico, para no dar por hecho que el checklist de otro
 * camión (hecho más temprano el mismo día) también cubre a este.
 */
export async function choferHizoChecklistHoy(
  prisma: ScopedPrismaClient,
  choferId: string,
  vehiculoId?: string
): Promise<boolean> {
  const checklist = await prisma.checklistRealizado.findFirst({
    where: {
      choferId,
      momento: "PRESALIDA",
      fechaHora: { gte: inicioDeHoy() },
      ...(vehiculoId ? { vehiculoId } : {}),
    },
  });
  return checklist != null;
}

/**
 * El vehículo del "reparto abierto" de hoy para este chofer: el más
 * reciente que tiene checklist pre-salida hecho hoy pero todavía no tiene
 * un cierre de ruta (EventoRuta) hoy. Es la patente correcta para cerrar
 * ruta — un chofer no debería poder elegir cualquier vehículo activo de la
 * empresa al cerrar, solo el que efectivamente usó en el pre-salida.
 *
 * Devuelve null si no hay ningún reparto abierto (no hizo ningún checklist
 * hoy, o ya cerró todos los que hizo) — en ese caso quien llama debe caer
 * a un selector libre o bloquear, según si el checklist es obligatorio.
 */
export async function vehiculoActivoParaCierre(
  prisma: ScopedPrismaClient,
  choferId: string
): Promise<{ id: string; patente: string } | null> {
  const checklistsHoy = await prisma.checklistRealizado.findMany({
    where: { choferId, momento: "PRESALIDA", fechaHora: { gte: inicioDeHoy() } },
    orderBy: { fechaHora: "desc" },
    select: { vehiculoId: true, vehiculo: { select: { id: true, patente: true } } },
  });

  for (const c of checklistsHoy) {
    const yaCerro = await prisma.eventoRuta.findFirst({
      where: { choferId, vehiculoId: c.vehiculoId, fechaHora: { gte: inicioDeHoy() } },
    });
    if (!yaCerro) return c.vehiculo;
  }
  return null;
}

/**
 * Suma a Vehiculo.horasEquipoFrio la duración entre el checklist pre-salida
 * de hoy y el cierre de ruta (con o sin novedades) que se acaba de
 * completar, para el mismo chofer+vehículo. Si falta el pre-salida de hoy,
 * o si ya se sumó un cierre hoy (evita doble conteo si el chofer cierra la
 * ruta más de una vez), la medición se descarta sin sumar nada — nunca se
 * adivina un valor.
 */
export async function registrarHorasEquipoFrioSiCorresponde(
  prisma: ScopedPrismaClient,
  params: { vehiculoId: string; choferId: string; eventoRutaId: string; cierreFechaHora: Date }
) {
  const { vehiculoId, choferId, eventoRutaId, cierreFechaHora } = params;

  const presalida = await prisma.checklistRealizado.findFirst({
    where: { choferId, vehiculoId, momento: "PRESALIDA", fechaHora: { gte: inicioDeHoy() } },
    orderBy: { fechaHora: "asc" },
  });
  if (!presalida) {
    console.log(`[horasEquipoFrio] descartada: sin checklist pre-salida hoy (chofer=${choferId}, vehiculo=${vehiculoId})`);
    return;
  }

  const otroCierreHoy = await prisma.eventoRuta.findFirst({
    where: { choferId, vehiculoId, fechaHora: { gte: inicioDeHoy() }, id: { not: eventoRutaId } },
  });
  if (otroCierreHoy) {
    console.log(`[horasEquipoFrio] descartada: ya se registró un cierre de ruta hoy (chofer=${choferId}, vehiculo=${vehiculoId})`);
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
