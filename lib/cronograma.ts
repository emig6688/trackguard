import "server-only";
import type { ScopedPrismaClient } from "@/lib/tenant-prisma";
import type { EstadoOT, OrigenOT, Rol } from "@/app/generated/prisma/client";
import { condicionVisibleParaMecanico } from "@/lib/ot";

export type VistaCronograma = "DIA" | "SEMANA" | "MES";

const DIAS_POR_VISTA: Record<VistaCronograma, number> = { DIA: 0, SEMANA: 6, MES: 29 };

export function rangoCronograma(vista: VistaCronograma, hoy = new Date()) {
  const desde = new Date(hoy);
  desde.setHours(0, 0, 0, 0);
  const hasta = new Date(desde);
  hasta.setDate(hasta.getDate() + DIAS_POR_VISTA[vista]);
  hasta.setHours(23, 59, 59, 999);
  return { desde, hasta };
}

const ESTADOS_ABIERTOS: EstadoOT[] = [
  "PENDIENTE_APROBACION",
  "APROBADA",
  "EN_PROGRESO",
  "DERIVADA_EXTERNO",
];

export type EventoOTExistente = {
  tipo: "OT_EXISTENTE";
  fecha: Date;
  vehiculoPatente: string;
  titulo: string;
  categoria: string | null;
  otId: string;
  estado: EstadoOT;
  origen: OrigenOT;
  itemsTotal: number;
  itemsResueltos: number;
};

export type EventoPrevisto = {
  tipo: "PREVISTO";
  fecha: Date | null;
  vehiculoPatente: string;
  titulo: string;
  categoria: string | null;
  planId: string;
  vehiculoId: string;
  detalle: string;
  avance: number | null;
};

export type EventoCronograma = EventoOTExistente | EventoPrevisto;

/**
 * Trae las OT abiertas cuya fecha relevante (fechaLimite, o createdAt si no
 * tiene) cae dentro o antes del fin de la ventana — así las vencidas quedan
 * siempre visibles sin importar el filtro elegido.
 */
async function otsExistentes(
  prisma: ScopedPrismaClient,
  hasta: Date,
  rol: Rol,
  userId: string
): Promise<EventoOTExistente[]> {
  const esMecanico = rol === "MECANICO_INTERNO";
  const ots = await prisma.ordenDeTrabajo.findMany({
    where: {
      estado: { in: ESTADOS_ABIERTOS },
      eliminadoEn: null,
      ...(esMecanico ? condicionVisibleParaMecanico(userId) : {}),
    },
    include: {
      vehiculo: true,
      planMantenimiento: { select: { categoria: true } },
      itemsPreventivos: { select: { resultado: true } },
    },
  });

  return ots
    .map((ot) => ({
      tipo: "OT_EXISTENTE" as const,
      fecha: ot.fechaLimite ?? ot.createdAt,
      vehiculoPatente: ot.vehiculo.patente,
      titulo: ot.titulo,
      categoria: ot.planMantenimiento?.categoria ?? null,
      otId: ot.id,
      estado: ot.estado,
      origen: ot.origen,
      itemsTotal: ot.itemsPreventivos.length,
      itemsResueltos: ot.itemsPreventivos.filter((i) => i.resultado !== "PENDIENTE").length,
    }))
    .filter((e) => e.fecha <= hasta);
}

/**
 * Planes activos que YA vencieron (por km, días u horas) pero todavía no
 * tienen una OT abierta asociada — típicamente porque el cron diario todavía
 * no corrió. No se muestran los que se acercan pero no vencieron: esos van a
 * aparecer solos (o vía cron) cuando corresponda, y listarlos de antemano
 * generaba confusión ("¿por qué no se generó todavía?"). Si el plan tiene un
 * componente de calendario (días) se proyecta una fecha concreta; si es
 * puramente por km/horas se muestra el % de avance ya sobre el 100%.
 */
async function planesPrevistos(prisma: ScopedPrismaClient, hasta: Date): Promise<EventoPrevisto[]> {
  const ahora = new Date();
  const planes = await prisma.planMantenimiento.findMany({
    where: {
      activo: true,
      eliminadoEn: null,
      vehiculo: { activo: true, eliminadoEn: null },
      // Cubre tanto el vínculo viejo (1 plan = 1 OT, vía planMantenimientoId)
      // como el nuevo en lote (vía OTItemPreventivo) — sin el segundo, un
      // plan ya cubierto por la OT en lote seguía apareciendo acá como si
      // todavía necesitara "Generar OT".
      ordenesDeTrabajo: { none: { estado: { in: ESTADOS_ABIERTOS } } },
      itemsPreventivo: { none: { ordenDeTrabajo: { estado: { in: ESTADOS_ABIERTOS } } } },
    },
    include: { vehiculo: true },
  });

  const eventos: EventoPrevisto[] = [];

  for (const plan of planes) {
    const base = {
      tipo: "PREVISTO" as const,
      vehiculoPatente: plan.vehiculo.patente,
      titulo: plan.nombre,
      categoria: plan.categoria,
      planId: plan.id,
      vehiculoId: plan.vehiculoId,
    };

    if (plan.intervaloDias != null) {
      const inicio = plan.fechaUltimoService ?? plan.createdAt;
      const proxima = new Date(inicio);
      proxima.setDate(proxima.getDate() + plan.intervaloDias);
      if (proxima <= ahora && proxima <= hasta) {
        eventos.push({
          ...base,
          fecha: proxima,
          detalle: `Cada ${plan.intervaloDias} días`,
          avance: null,
        });
      }
      continue;
    }

    if (plan.intervaloKm != null && plan.kmUltimoService != null) {
      const avance = (plan.vehiculo.kmActual - plan.kmUltimoService) / plan.intervaloKm;
      if (avance >= 1) {
        eventos.push({
          ...base,
          fecha: null,
          detalle: `Cada ${plan.intervaloKm.toLocaleString("es-AR")} km · ${Math.round(avance * 100)}% (${plan.vehiculo.kmActual - plan.kmUltimoService}/${plan.intervaloKm} km)`,
          avance,
        });
      }
      continue;
    }

    if (plan.intervaloHoras != null && plan.horasUltimoService != null && plan.vehiculo.horasEquipoFrio != null) {
      const avance = (plan.vehiculo.horasEquipoFrio - plan.horasUltimoService) / plan.intervaloHoras;
      if (avance >= 1) {
        eventos.push({
          ...base,
          fecha: null,
          detalle: `Cada ${plan.intervaloHoras.toLocaleString("es-AR")} horas · ${Math.round(avance * 100)}% (${plan.vehiculo.horasEquipoFrio - plan.horasUltimoService}/${plan.intervaloHoras} hs)`,
          avance,
        });
      }
    }
  }

  return eventos;
}

export async function obtenerCronograma(
  prisma: ScopedPrismaClient,
  vista: VistaCronograma,
  rol: Rol,
  userId: string
) {
  const { hasta } = rangoCronograma(vista);
  const esMecanico = rol === "MECANICO_INTERNO";

  const [existentes, previstos] = await Promise.all([
    otsExistentes(prisma, hasta, rol, userId),
    esMecanico ? Promise.resolve([]) : planesPrevistos(prisma, hasta),
  ]);

  const conFecha = [...existentes, ...previstos.filter((p) => p.fecha != null)].sort(
    (a, b) => (a.fecha as Date).getTime() - (b.fecha as Date).getTime()
  );
  const sinFecha = previstos
    .filter((p) => p.fecha == null)
    .sort((a, b) => (b.avance ?? 0) - (a.avance ?? 0));

  return { conFecha, sinFecha };
}
