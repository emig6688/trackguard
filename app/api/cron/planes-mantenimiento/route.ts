import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type PlanVencimiento = {
  tipoIntervalo: string;
  intervaloKm: number | null;
  intervaloDias: number | null;
  intervaloHoras: number | null;
  kmUltimoService: number | null;
  fechaUltimoService: Date | null;
  horasUltimoService: number | null;
};

function planVencido(plan: PlanVencimiento, kmActual: number, horasEquipoFrio: number | null) {
  const porKm =
    plan.intervaloKm != null &&
    plan.kmUltimoService != null &&
    kmActual - plan.kmUltimoService >= plan.intervaloKm;

  const porTiempo =
    plan.intervaloDias != null &&
    plan.fechaUltimoService != null &&
    Date.now() - plan.fechaUltimoService.getTime() >= plan.intervaloDias * 24 * 60 * 60 * 1000;

  const porHoras =
    plan.intervaloHoras != null &&
    plan.horasUltimoService != null &&
    horasEquipoFrio != null &&
    horasEquipoFrio - plan.horasUltimoService >= plan.intervaloHoras;

  if (plan.tipoIntervalo === "KM") return porKm;
  if (plan.tipoIntervalo === "TIEMPO") return porTiempo;
  if (plan.tipoIntervalo === "HORAS") return porHoras;
  return porKm || porTiempo || porHoras;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const planes = await prisma.planMantenimiento.findMany({
    where: { activo: true, eliminadoEn: null, vehiculo: { activo: true, eliminadoEn: null } },
    include: { vehiculo: true },
  });

  const vencidos = planes.filter((plan) =>
    planVencido(plan, plan.vehiculo.kmActual, plan.vehiculo.horasEquipoFrio)
  );

  const porVehiculo = new Map<string, typeof vencidos>();
  for (const plan of vencidos) {
    const lista = porVehiculo.get(plan.vehiculoId) ?? [];
    lista.push(plan);
    porVehiculo.set(plan.vehiculoId, lista);
  }

  const otsCreadas: string[] = [];
  const otsActualizadas: string[] = [];
  const errores: string[] = [];

  for (const [vehiculoId, planesVehiculo] of porVehiculo) {
    try {
      const planIds = planesVehiculo.map((p) => p.id);

      // Cubre tanto las OT preventivas viejas (1 plan = 1 OT, vía
      // planMantenimientoId directo) como las nuevas en lote (vía
      // OTItemPreventivo) — evita duplicar si el cron corre de nuevo antes de
      // que se cierre la OT anterior.
      const [otsLegacyAbiertas, itemsAbiertos] = await Promise.all([
        prisma.ordenDeTrabajo.findMany({
          where: { planMantenimientoId: { in: planIds }, estado: { notIn: ["COMPLETADA", "CANCELADA"] }, eliminadoEn: null },
          select: { planMantenimientoId: true },
        }),
        prisma.oTItemPreventivo.findMany({
          where: { planMantenimientoId: { in: planIds }, ordenDeTrabajo: { estado: { notIn: ["COMPLETADA", "CANCELADA"] } } },
          select: { planMantenimientoId: true },
        }),
      ]);
      const yaCubiertos = new Set([
        ...otsLegacyAbiertas.map((o) => o.planMantenimientoId),
        ...itemsAbiertos.map((i) => i.planMantenimientoId),
      ]);
      const planesNuevos = planesVehiculo.filter((p) => !yaCubiertos.has(p.id));
      if (planesNuevos.length === 0) continue;

      const empresaId = planesVehiculo[0].empresaId;

      // Job de sistema: recorre planes de TODAS las empresas a propósito, así
      // que no pasa por el cliente scoped — la numeración y el empresaId se
      // arman a mano por cada empresa dueña del plan.
      let ot = await prisma.ordenDeTrabajo.findFirst({
        where: {
          vehiculoId,
          origen: "PREVENTIVO",
          estado: { notIn: ["COMPLETADA", "CANCELADA"] },
          eliminadoEn: null,
          planMantenimientoId: null,
        },
      });

      if (!ot) {
        const anio = new Date().getFullYear();
        const prefijo = `OT-${anio}-`;
        // Basado en el número más alto ya usado, no en un count(): si se borró
        // cualquier OT del medio de la secuencia, un count() puede repetir un
        // número que ya existe en una OT viva y choca contra el
        // @@unique([empresaId, numero]).
        const ultima = await prisma.ordenDeTrabajo.findFirst({
          where: { numero: { startsWith: prefijo }, empresaId },
          orderBy: { numero: "desc" },
          select: { numero: true },
        });
        const ultimoNumero = ultima ? parseInt(ultima.numero.slice(prefijo.length), 10) : 0;
        const numero = `${prefijo}${String(ultimoNumero + 1).padStart(5, "0")}`;

        // Preventivo nace directamente APROBADA: no tiene sentido que el
        // encargado de mantenimiento tenga que aprobar algo que ya generó el
        // propio sistema de planes — el mecánico la ve y la puede tomar sin
        // ese paso intermedio. Todos los planes vencidos del mismo vehículo
        // entran a UNA sola OT (como ítems), en vez de una OT por plan.
        ot = await prisma.ordenDeTrabajo.create({
          data: {
            empresaId,
            numero,
            vehiculoId,
            origen: "PREVENTIVO",
            estado: "APROBADA",
            prioridad: "MEDIA",
            titulo: `Mantenimiento preventivo — ${planesVehiculo[0].vehiculo.patente}`,
            descripcion: "Mantenimiento preventivo generado automáticamente.",
            historial: {
              create: { estadoAnterior: null, estadoNuevo: "APROBADA" },
            },
          },
        });
        otsCreadas.push(ot.numero);
      } else {
        otsActualizadas.push(ot.numero);
      }

      await prisma.oTItemPreventivo.createMany({
        data: planesNuevos.map((p) => ({
          empresaId,
          ordenDeTrabajoId: ot!.id,
          planMantenimientoId: p.id,
          titulo: p.nombre,
          categoria: p.categoria,
        })),
      });
    } catch (error) {
      console.error(`[cron/planes-mantenimiento] vehiculo=${vehiculoId}`, error);
      errores.push(vehiculoId);
    }
  }

  return NextResponse.json({ otsCreadas, otsActualizadas, errores });
}
