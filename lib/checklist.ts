import "server-only";
import type { ScopedPrismaClient } from "@/lib/tenant-prisma";
import { obtenerReglaNotificacion, enviarPorCanalesConfigurados } from "@/lib/notificaciones";
import { usuariosDeEmpresaPorRol } from "@/lib/permisos";

export function inicioDeHoy(): Date {
  const ahora = new Date();
  return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
}

export async function choferHizoChecklistHoy(prisma: ScopedPrismaClient, choferId: string): Promise<boolean> {
  const checklist = await prisma.checklistRealizado.findFirst({
    where: { choferId, momento: "PRESALIDA", fechaHora: { gte: inicioDeHoy() } },
  });
  return checklist != null;
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
    const dia = c.fechaHora.toISOString().slice(0, 10);
    const clave = `${dia}_${c.choferId}`;
    const entrada = porDiaChofer.get(clave) ?? {};
    if (c.momento === "PRESALIDA" && !entrada.presalida) entrada.presalida = c.fechaHora;
    if (c.momento === "CIERRE" && !entrada.cierre) entrada.cierre = c.fechaHora;
    porDiaChofer.set(clave, entrada);
  }
  for (const e of eventos) {
    const dia = e.fechaHora.toISOString().slice(0, 10);
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

/**
 * Si la empresa activó "checklist obligatorio" (regla CHECKLIST_NO_REALIZADO
 * activa en /notificaciones) y el chofer todavía no hizo el checklist
 * pre-salida de hoy, bloquea la acción y avisa a los roles configurados —
 * así el encargado se entera de que alguien intentó saltearse el checklist.
 * Si la regla no está activa, nunca bloquea (comportamiento actual).
 */
export async function verificarChecklistDelDia(
  prisma: ScopedPrismaClient,
  empresaId: string,
  chofer: { id: string; nombre: string }
): Promise<ResultadoChecklistObligatorio> {
  const regla = await obtenerReglaNotificacion(prisma, empresaId, "CHECKLIST_NO_REALIZADO");
  if (!regla.activo) return { bloqueado: false };

  const yaHizo = await choferHizoChecklistHoy(prisma, chofer.id);
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
    motivo: "Tenés que completar el checklist pre-salida de hoy antes de continuar. Volvé al inicio y hacé el checklist primero.",
  };
}
