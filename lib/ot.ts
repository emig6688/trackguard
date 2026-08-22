import type { AreaReparacionOT, EstadoOT, Prisma } from "@/app/generated/prisma/client";
import type { ScopedPrismaClient } from "@/lib/tenant-prisma";
import { palabrasClaveCoincidentes } from "@/lib/clasificador-averias";

// Estados en los que una OT sigue "abierta" (no cerrada), usados tanto para
// filtrar el listado como para calcular atrasos en el dashboard.
export const ESTADOS_OT_ABIERTOS: EstadoOT[] = [
  "PENDIENTE_APROBACION",
  "APROBADA",
  "EN_PROGRESO",
  "DERIVADA_EXTERNO",
];

/**
 * Una OT está atrasada si el mecánico ya fijó una fecha estimada de
 * finalización y esa fecha pasó, o bien -si todavía no la fijó porque ni
 * arrancó el trabajo- si ya pasó la fecha límite que se le puso al aprobarla.
 * Sin este segundo caso, una OT aprobada y nunca iniciada nunca aparecía
 * atrasada en el dashboard aunque el cronograma (que sí mira fechaLimite) la
 * mostrara vencida.
 */
export function condicionOTAtrasada(ahora: Date = new Date()): Prisma.OrdenDeTrabajoWhereInput {
  return {
    eliminadoEn: null,
    estado: { in: ESTADOS_OT_ABIERTOS },
    OR: [
      { fechaEstimadaFinalizacion: { lt: ahora } },
      { fechaEstimadaFinalizacion: null, fechaLimite: { lt: ahora } },
    ],
  };
}

// Estados en los que ya tiene sentido exigir una fecha estimada: pendiente de
// aprobación todavía no se le asignó mecánico, así que no aplica.
export const ESTADOS_OT_REQUIEREN_FECHA_ESTIMADA: EstadoOT[] = [
  "APROBADA",
  "EN_PROGRESO",
  "DERIVADA_EXTERNO",
];

export function condicionOTSinFechaEstimada(): Prisma.OrdenDeTrabajoWhereInput {
  return {
    eliminadoEn: null,
    estado: { in: ESTADOS_OT_REQUIEREN_FECHA_ESTIMADA },
    fechaEstimadaFinalizacion: null,
  };
}

export function otEstaAtrasada(
  ot: { estado: EstadoOT; fechaEstimadaFinalizacion: Date | null; fechaLimite: Date | null },
  ahora: Date = new Date()
): boolean {
  if (!ESTADOS_OT_ABIERTOS.includes(ot.estado)) return false;
  if (ot.fechaEstimadaFinalizacion) return ot.fechaEstimadaFinalizacion.getTime() < ahora.getTime();
  if (ot.fechaLimite) return ot.fechaLimite.getTime() < ahora.getTime();
  return false;
}

/** Fecha relevante para calcular hace cuántos días está atrasada una OT. */
export function fechaReferenciaAtraso(ot: {
  fechaEstimadaFinalizacion: Date | null;
  fechaLimite: Date | null;
}): Date | null {
  return ot.fechaEstimadaFinalizacion ?? ot.fechaLimite;
}

/**
 * El preventivo se genera directo APROBADA y sin asignar (ver cron de
 * planes-mantenimiento) para que no dependa de que el encargado la apruebe:
 * cualquier mecánico la puede ver y "tomarla" (se autoasigna al iniciarla).
 * Una OT reportada por un chofer nace igual (APROBADA, sin asignar) cuando la
 * empresa activó "auto-aprobación de mecánicos" en Mantenedor/Parámetros
 * (ver app/_actions/eventosRuta.ts) — por eso esto ya no filtra por origen,
 * solo por "aprobada y sin dueño todavía". Sin esa activación, una OT
 * reportada por chofer nace PENDIENTE_APROBACION y no entra acá hasta que el
 * encargado la apruebe y asigne explícitamente.
 */
export function condicionVisibleParaMecanico(userId: string): Prisma.OrdenDeTrabajoWhereInput {
  return {
    OR: [
      { asignadoAId: userId },
      { asignadoAId: null, estado: { in: ["APROBADA", "EN_PROGRESO"] } },
    ],
  };
}

export function puedeMecanicoAccionar(
  ot: { asignadoAId: string | null; estado: EstadoOT },
  userId: string
): boolean {
  return (
    ot.asignadoAId === userId ||
    (ot.asignadoAId === null && (ot.estado === "APROBADA" || ot.estado === "EN_PROGRESO"))
  );
}

/**
 * Si el chofer reporta un problema del mismo vehículo mientras ya hay una OT
 * abierta que suena al mismo problema, no tiene sentido crear otra. "Suena al
 * mismo problema" no es solo compartir área (ESTRUCTURA cubre desde una
 * puerta del térmico rota hasta un paragolpes suelto — dos problemas
 * distintos que no deberían fusionarse): se exige además que compartan
 * alguna palabra clave puntual de esa área (ver palabrasClaveCoincidentes).
 * El área OTRO no tiene palabras clave para comparar, así que ahí nunca se
 * fusiona — mejor una OT de más que perder un reporte distinto por fusionarlo
 * con otro que no tiene nada que ver.
 */
export async function buscarOTAbiertaMismoProblema(
  prisma: ScopedPrismaClient,
  vehiculoId: string,
  areaReparacion: AreaReparacionOT,
  descripcionNueva: string
) {
  if (areaReparacion === "OTRO") return null;

  const palabrasNuevas = palabrasClaveCoincidentes(descripcionNueva, areaReparacion);
  if (palabrasNuevas.length === 0) return null;

  const candidatas = await prisma.ordenDeTrabajo.findMany({
    where: {
      vehiculoId,
      areaReparacion,
      estado: { in: ESTADOS_OT_ABIERTOS },
      eliminadoEn: null,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    candidatas.find((ot) =>
      palabrasClaveCoincidentes(ot.descripcion ?? "", areaReparacion).some((p) => palabrasNuevas.includes(p))
    ) ?? null
  );
}
