"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  requireRole,
  requireSession,
  AutorizacionError,
  ROLES_ADMIN_MANTENIMIENTO,
  ROLES_MOBILE_CHOFER,
  ROLES_REASIGNAR_MECANICO,
  usuariosDeEmpresaPorRol,
} from "@/lib/permisos";
import { puedeTransicionar } from "@/lib/ot-state-machine";
import { puedeMecanicoAccionar, ESTADOS_OT_REQUIEREN_FECHA_ESTIMADA } from "@/lib/ot";
import { optionalInt, optionalNumber } from "@/lib/zod-helpers";
import { guardarArchivo } from "@/lib/storage";
import { descontarStockYVerificarMinimo } from "@/lib/panol";
import { obtenerReglaNotificacion, enviarPorCanalesConfigurados } from "@/lib/notificaciones";
import type { ScopedPrismaClient } from "@/lib/tenant-prisma";
import type { EstadoOT, Rol } from "@/app/generated/prisma/client";

/**
 * Se basa en el número más alto ya usado (no en un count()): si se borra
 * cualquier OT del medio de la secuencia (papelera, limpieza de datos de
 * prueba, etc.), un count() por sí solo puede repetir un número que ya
 * existe en una OT que sigue viva, y choca contra el @@unique([empresaId,
 * numero]).
 */
export async function generarNumeroOT(prisma: ScopedPrismaClient, empresaId: string) {
  const anio = new Date().getFullYear();
  const prefijo = `OT-${anio}-`;
  const ultima = await prisma.ordenDeTrabajo.findFirst({
    where: { numero: { startsWith: prefijo }, empresaId },
    orderBy: { numero: "desc" },
    select: { numero: true },
  });
  const ultimoNumero = ultima ? parseInt(ultima.numero.slice(prefijo.length), 10) : 0;
  return `${prefijo}${String(ultimoNumero + 1).padStart(5, "0")}`;
}

/**
 * Centraliza toda transición de estado: valida rol (y asignación si es mecánico interno),
 * actualiza la OT y registra el historial. Usado por todas las acciones de más abajo.
 */
async function transicionarOT(
  prisma: ScopedPrismaClient,
  user: { id: string; rol: Rol },
  otId: string,
  estadoNuevo: EstadoOT,
  extraData: Record<string, unknown> = {},
  comentario?: string
) {
  const ot = await prisma.ordenDeTrabajo.findUniqueOrThrow({
    where: { id: otId },
    include: { itemsPreventivos: true },
  });

  const puede =
    puedeTransicionar(ot.estado, estadoNuevo, user.rol) &&
    (user.rol !== "MECANICO_INTERNO" || puedeMecanicoAccionar(ot, user.id));

  if (!puede) {
    throw new Error("No podés realizar esta transición sobre esta orden de trabajo.");
  }

  await prisma.$transaction([
    prisma.ordenDeTrabajo.update({
      where: { id: otId },
      data: { estado: estadoNuevo, ...extraData },
    }),
    prisma.oTHistorialEstado.create({
      data: {
        ordenDeTrabajoId: otId,
        actorId: user.id,
        estadoAnterior: ot.estado,
        estadoNuevo,
        comentario,
      },
    }),
  ]);

  // Al completar una OT preventiva, cada plan vinculado reinicia su ciclo
  // desde el km/fecha actuales — tanto el caso viejo (1 plan = 1 OT, vía
  // planMantenimientoId) como el nuevo en lote (vía itemsPreventivos, ya
  // filtrados de pendientes por completarOT antes de llegar acá).
  if (estadoNuevo === "COMPLETADA" && ot.origen === "PREVENTIVO") {
    const planIds = [
      ...(ot.planMantenimientoId ? [ot.planMantenimientoId] : []),
      ...ot.itemsPreventivos.map((i) => i.planMantenimientoId),
    ];
    if (planIds.length > 0) {
      const vehiculo = await prisma.vehiculo.findUniqueOrThrow({ where: { id: ot.vehiculoId } });
      await prisma.planMantenimiento.updateMany({
        where: { id: { in: planIds } },
        data: {
          kmUltimoService: vehiculo.kmActual,
          fechaUltimoService: new Date(),
          horasUltimoService: vehiculo.horasEquipoFrio,
        },
      });
    }
  }

  revalidatePath("/ordenes-trabajo");
  revalidatePath(`/ordenes-trabajo/${otId}`);
}

const otManualSchema = z.object({
  vehiculoId: z.string().min(1, "Elegí un vehículo"),
  titulo: z.string().trim().min(1, "Título requerido"),
  descripcion: z.string().trim().optional(),
  prioridad: z.enum(["BAJA", "MEDIA", "ALTA", "URGENTE"]),
  areaReparacion: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.enum(["FRENOS", "SUSPENSION", "ESTRUCTURA", "MOTOR", "ELECTRICO", "NEUMATICOS", "EQUIPO_FRIO", "OTRO"]).optional()
  ),
  fechaLimite: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  asignadoAId: z.string().optional(),
});

export type OTFormState = { error?: string; fieldErrors?: Record<string, string[]> } | undefined;

export async function crearOTManual(
  _prevState: OTFormState,
  formData: FormData
): Promise<OTFormState> {
  const { user, prisma } = await requireRole(ROLES_ADMIN_MANTENIMIENTO);

  const parsed = otManualSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const numero = await generarNumeroOT(prisma, user.empresaId!);
  const asignadoAId = parsed.data.asignadoAId || undefined;

  const ot = await prisma.ordenDeTrabajo.create({
    data: {
      empresaId: user.empresaId!,
      numero,
      vehiculoId: parsed.data.vehiculoId,
      origen: "MANUAL",
      estado: "APROBADA",
      prioridad: parsed.data.prioridad,
      areaReparacion: parsed.data.areaReparacion,
      titulo: parsed.data.titulo,
      descripcion: parsed.data.descripcion,
      fechaLimite: parsed.data.fechaLimite,
      asignadoAId,
      creadoPorId: user.id,
      aprobadoPorId: user.id,
      historial: {
        create: { actorId: user.id, estadoAnterior: null, estadoNuevo: "APROBADA" },
      },
    },
  });

  revalidatePath("/ordenes-trabajo");
  redirect(`/ordenes-trabajo/${ot.id}`);
}

/**
 * Adelanta manualmente un plan de mantenimiento previsto (todavía no vencido)
 * a una OT ya aprobada, para cuando el encargado prefiere resolverlo ahora en
 * vez de esperar a que el cron lo marque vencido. Se agrega como un ítem más
 * a la OT preventiva en lote ya abierta para ese vehículo (si existe) — así
 * el mecánico ve todas las tareas pendientes del camión en una sola OT, en
 * vez de una nueva por cada plan. Ver el mismo criterio en el cron
 * (app/api/cron/planes-mantenimiento/route.ts).
 */
export async function crearOTDesdePlan(planId: string, redirectPath: string) {
  const { user, prisma } = await requireRole(ROLES_ADMIN_MANTENIMIENTO);

  const plan = await prisma.planMantenimiento.findUniqueOrThrow({
    where: { id: planId },
    include: { vehiculo: true },
  });

  // Cubre tanto las OT preventivas viejas (1 plan = 1 OT, vía
  // planMantenimientoId directo) como las nuevas en lote (vía OTItemPreventivo).
  const [otLegacyAbierta, itemAbierto] = await Promise.all([
    prisma.ordenDeTrabajo.findFirst({
      where: { planMantenimientoId: planId, estado: { notIn: ["COMPLETADA", "CANCELADA"] } },
    }),
    prisma.oTItemPreventivo.findFirst({
      where: { planMantenimientoId: planId, ordenDeTrabajo: { estado: { notIn: ["COMPLETADA", "CANCELADA"] } } },
    }),
  ]);
  if (otLegacyAbierta || itemAbierto) return;

  let ot = await prisma.ordenDeTrabajo.findFirst({
    where: {
      vehiculoId: plan.vehiculoId,
      origen: "PREVENTIVO",
      estado: { notIn: ["COMPLETADA", "CANCELADA"] },
      eliminadoEn: null,
      planMantenimientoId: null,
    },
  });

  if (!ot) {
    const numero = await generarNumeroOT(prisma, user.empresaId!);
    ot = await prisma.ordenDeTrabajo.create({
      data: {
        empresaId: user.empresaId!,
        numero,
        vehiculoId: plan.vehiculoId,
        origen: "PREVENTIVO",
        estado: "APROBADA",
        prioridad: "MEDIA",
        titulo: `Mantenimiento preventivo — ${plan.vehiculo.patente}`,
        descripcion: "Mantenimiento preventivo adelantado desde el cronograma.",
        creadoPorId: user.id,
        aprobadoPorId: user.id,
        historial: {
          create: { actorId: user.id, estadoAnterior: null, estadoNuevo: "APROBADA" },
        },
      },
    });
  }

  await prisma.oTItemPreventivo.create({
    data: {
      empresaId: user.empresaId!,
      ordenDeTrabajoId: ot.id,
      planMantenimientoId: plan.id,
      titulo: plan.nombre,
      categoria: plan.categoria,
    },
  });

  revalidatePath(redirectPath);
  revalidatePath("/ordenes-trabajo");
  revalidatePath(`/ordenes-trabajo/${ot.id}`);
  return ot.id;
}

const aprobarSchema = z.object({
  prioridad: z.enum(["BAJA", "MEDIA", "ALTA", "URGENTE"]),
  areaReparacion: z.enum(["FRENOS", "SUSPENSION", "ESTRUCTURA", "MOTOR", "ELECTRICO", "NEUMATICOS", "EQUIPO_FRIO", "OTRO"]),
  fechaLimite: z
    .string()
    .min(1, "Elegí una fecha límite")
    .transform((v) => new Date(v)),
  asignadoAId: z.string().min(1, "Asigná un mecánico"),
  ordenSecuencia: optionalInt(),
});

export type AprobarOTState = { error?: string; fieldErrors?: Record<string, string[]> } | undefined;

/**
 * No se puede aprobar una OT sin mecánico asignado ni fecha límite: sin eso
 * queda "aprobada" pero nadie sabe quién la tiene que hacer ni para cuándo.
 */
export async function aprobarOT(
  otId: string,
  _prevState: AprobarOTState,
  formData: FormData
): Promise<AprobarOTState> {
  const { user, prisma } = await requireRole(ROLES_ADMIN_MANTENIMIENTO);
  const parsed = aprobarSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  await transicionarOT(prisma, user, otId, "APROBADA", {
    prioridad: parsed.data.prioridad,
    areaReparacion: parsed.data.areaReparacion,
    fechaLimite: parsed.data.fechaLimite,
    asignadoAId: parsed.data.asignadoAId,
    ordenSecuencia: parsed.data.ordenSecuencia,
    aprobadoPorId: user.id,
  });
}

const reasignarSchema = z.object({
  asignadoAId: z.string().min(1, "Elegí un mecánico"),
});

export type ReasignarMecanicoState = { error?: string; fieldErrors?: Record<string, string[]> } | undefined;

/**
 * Cambiar el mecánico asignado a una OT ya aprobada, mientras todavía no la
 * empezó (estado APROBADA, no EN_PROGRESO) — facultad exclusiva de
 * encargado de mantenimiento, gerente o admin. Un mecánico interno nunca
 * puede reasignar, ni siquiera la OT que tiene asignada (por eso esta
 * acción no está en ROLES_ADMIN_MANTENIMIENTO, que sí incluiría de más).
 */
export async function reasignarMecanico(
  otId: string,
  _prevState: ReasignarMecanicoState,
  formData: FormData
): Promise<ReasignarMecanicoState> {
  const { user, prisma } = await requireRole(ROLES_REASIGNAR_MECANICO);
  const parsed = reasignarSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const ot = await prisma.ordenDeTrabajo.findUniqueOrThrow({ where: { id: otId } });
  if (ot.estado !== "APROBADA") {
    return { error: "Solo se puede reasignar una OT aprobada que el mecánico todavía no comenzó." };
  }

  await prisma.$transaction([
    prisma.ordenDeTrabajo.update({
      where: { id: otId },
      data: { asignadoAId: parsed.data.asignadoAId },
    }),
    prisma.oTHistorialEstado.create({
      data: {
        ordenDeTrabajoId: otId,
        actorId: user.id,
        estadoAnterior: ot.estado,
        estadoNuevo: ot.estado,
        comentario: "Reasignada a otro mecánico",
      },
    }),
  ]);

  revalidatePath("/ordenes-trabajo");
  revalidatePath(`/ordenes-trabajo/${otId}`);
}

const iniciarSchema = z.object({
  fechaEstimadaFinalizacion: z
    .string()
    .min(1, "Ingresá una fecha estimada de finalización")
    .transform((v) => new Date(v)),
});

export async function iniciarOT(otId: string, formData: FormData) {
  const { user, prisma } = await requireSession();
  const parsed = iniciarSchema.parse(Object.fromEntries(formData));

  // Un preventivo generado por el cron nace sin mecánico asignado: el primero
  // que la inicia queda como responsable, sin pasar por una asignación manual.
  const ot = await prisma.ordenDeTrabajo.findUniqueOrThrow({ where: { id: otId } });
  const seAutoasigna = user.rol === "MECANICO_INTERNO" && ot.asignadoAId === null;

  await transicionarOT(prisma, user, otId, "EN_PROGRESO", {
    fechaInicio: new Date(),
    fechaEstimadaFinalizacion: parsed.fechaEstimadaFinalizacion,
    ...(seAutoasigna ? { asignadoAId: user.id } : {}),
  });
}

const actualizarFechaEstimadaSchema = z.object({
  fechaEstimadaFinalizacion: z
    .string()
    .min(1, "Ingresá una fecha estimada de finalización")
    .transform((v) => new Date(v)),
});

/**
 * Permite poner o ajustar la fecha estimada de finalización de una OT ya
 * aprobada (aprobada, en progreso, o derivada a externo — ver
 * ESTADOS_OT_REQUIEREN_FECHA_ESTIMADA) sin necesidad de pasar por "iniciar".
 * Antes de aprobarla no hay nada que fijar, y una vez completada ya quedó
 * fija para el cálculo de cumplimiento.
 */
export async function actualizarFechaEstimada(otId: string, formData: FormData) {
  const { user, prisma } = await requireSession();
  const parsed = actualizarFechaEstimadaSchema.parse(Object.fromEntries(formData));

  const ot = await prisma.ordenDeTrabajo.findUniqueOrThrow({ where: { id: otId } });
  const puedeEditar =
    ROLES_ADMIN_MANTENIMIENTO.includes(user.rol) ||
    (user.rol === "MECANICO_INTERNO" && puedeMecanicoAccionar(ot, user.id));

  if (!puedeEditar || !ESTADOS_OT_REQUIEREN_FECHA_ESTIMADA.includes(ot.estado)) {
    throw new Error("No podés actualizar la fecha estimada de esta orden de trabajo.");
  }

  await prisma.ordenDeTrabajo.update({
    where: { id: otId },
    data: { fechaEstimadaFinalizacion: parsed.fechaEstimadaFinalizacion },
  });

  revalidatePath(`/ordenes-trabajo/${otId}`);
  revalidatePath("/ordenes-trabajo");
  revalidatePath("/dashboard");
}

const completarSchema = z.object({
  observacionesMecanico: z.string().trim().optional(),
  tiempoInsumidoMinutos: optionalInt(),
});

export type CompletarOTState = { error?: string } | undefined;

function mensajeReparacionCompletada(opts: {
  choferNombre: string;
  patente: string;
  titulo: string;
  observaciones?: string;
}) {
  const detalle = opts.observaciones ? `\n\nDetalle de la reparación: ${opts.observaciones}` : "";
  return (
    `Hola ${opts.choferNombre}! El mecánico terminó la reparación que reportaste en el vehículo ${opts.patente} ` +
    `(${opts.titulo}).${detalle}\n\nPor favor entrá a la app, a "Confirmar reparaciones", y confirmanos si quedó ` +
    `resuelto. Si el problema sigue, avisanos ahí mismo para reabrir la orden de trabajo.`
  );
}

export async function completarOT(
  otId: string,
  _prevState: CompletarOTState,
  formData: FormData
): Promise<CompletarOTState> {
  const parsed = completarSchema.parse(Object.fromEntries(formData));

  const file = formData.get("fotoReparacion");
  const tieneFoto = file instanceof File && file.size > 0;

  if (!parsed.observacionesMecanico && !tieneFoto) {
    return { error: "Cargá una observación o una foto de la reparación para poder completar la OT." };
  }

  const { user, prisma } = await requireSession();
  const fotoReparacionId = tieneFoto
    ? (await guardarArchivo(prisma, user.empresaId!, file as File, user.id)).id
    : undefined;

  // Si la OT viene de una novedad cargada por un chofer (evento de ruta o
  // falla de checklist), queda pendiente de que ese mismo chofer confirme
  // que la reparación resolvió el problema.
  const ot = await prisma.ordenDeTrabajo.findUniqueOrThrow({
    where: { id: otId },
    include: {
      eventoRuta: { include: { chofer: true } },
      checklistRealizado: { include: { chofer: true } },
      vehiculo: true,
      itemsPreventivos: true,
    },
  });
  const chofer = ot.eventoRuta?.chofer ?? ot.checklistRealizado?.chofer;

  // Si es una OT preventiva en lote y quedan ítems sin resolver, se mueven a
  // una OT nueva para retomarlos más adelante — así el mecánico puede cerrar
  // ya lo que sí resolvió (ej. 20 de 25 ítems) sin perder de vista los
  // pendientes ni tener que esperar a terminarlos todos.
  const pendientes = ot.itemsPreventivos.filter((i) => i.resultado === "PENDIENTE");
  if (pendientes.length > 0) {
    const numeroPendiente = await generarNumeroOT(prisma, user.empresaId!);
    const otPendiente = await prisma.ordenDeTrabajo.create({
      data: {
        empresaId: user.empresaId!,
        numero: numeroPendiente,
        vehiculoId: ot.vehiculoId,
        origen: "PREVENTIVO",
        estado: "APROBADA",
        prioridad: ot.prioridad,
        titulo: `Mantenimiento preventivo — ${ot.vehiculo.patente}`,
        descripcion: `Ítems pendientes de ${ot.numero}.`,
        historial: {
          create: { actorId: user.id, estadoAnterior: null, estadoNuevo: "APROBADA" },
        },
      },
    });
    await prisma.oTItemPreventivo.updateMany({
      where: { id: { in: pendientes.map((p) => p.id) } },
      data: { ordenDeTrabajoId: otPendiente.id },
    });
    revalidatePath(`/ordenes-trabajo/${otPendiente.id}`);
  }

  await transicionarOT(prisma, user, otId, "COMPLETADA", {
    fechaFin: new Date(),
    observacionesMecanico: parsed.observacionesMecanico,
    tiempoInsumidoMinutos: parsed.tiempoInsumidoMinutos,
    fotoReparacionId,
    ...(chofer ? { confirmacionReparacion: "PENDIENTE" as const } : {}),
  });

  if (chofer) {
    const mensaje = mensajeReparacionCompletada({
      choferNombre: chofer.nombre,
      patente: ot.vehiculo.patente,
      titulo: ot.titulo,
      observaciones: parsed.observacionesMecanico,
    });
    const asunto = `OT completada: ${ot.titulo}`;

    // Al chofer siempre se le avisa por email + en la app (necesita
    // confirmar la reparación, no depende de que la notificación esté
    // activa ni de sus canales configurados). Los roles extra configurados
    // reciben además por los canales que elijan.
    await enviarPorCanalesConfigurados(
      prisma,
      user.empresaId!,
      [chofer],
      ["EMAIL", "EN_APP"],
      "OT_COMPLETADA_CONFIRMACION",
      asunto,
      mensaje,
      "/mobile"
    );

    const regla = await obtenerReglaNotificacion(prisma, user.empresaId!, "OT_COMPLETADA_CONFIRMACION");
    if (regla.roles.length > 0 && regla.canales.length > 0) {
      const destinatariosExtra = await usuariosDeEmpresaPorRol(prisma, user.empresaId!, regla.roles);
      await enviarPorCanalesConfigurados(
        prisma,
        user.empresaId!,
        destinatariosExtra,
        regla.canales,
        "OT_COMPLETADA_CONFIRMACION",
        asunto,
        mensaje,
        `/ordenes-trabajo/${ot.id}`
      );
    }
  }
}

const confirmarReparacionSchema = z.object({
  resultado: z.enum(["OK", "PROBLEMA"]),
  comentario: z.string().trim().optional(),
});

/**
 * El chofer que cargó la novedad confirma si la reparación resolvió el
 * problema. Si no, la OT se reabre (vuelve a EN_PROGRESO) para que el
 * mecánico y el encargado la retomen, con el comentario del chofer en el
 * historial.
 */
export async function confirmarReparacion(otId: string, formData: FormData) {
  const { user, prisma } = await requireRole(ROLES_MOBILE_CHOFER);
  const parsed = confirmarReparacionSchema.parse(Object.fromEntries(formData));

  const ot = await prisma.ordenDeTrabajo.findUniqueOrThrow({
    where: { id: otId },
    include: { eventoRuta: true, checklistRealizado: true },
  });
  const choferReportanteId = ot.eventoRuta?.choferId ?? ot.checklistRealizado?.choferId;

  const puedeConfirmar =
    choferReportanteId === user.id &&
    ot.estado === "COMPLETADA" &&
    ot.confirmacionReparacion === "PENDIENTE";

  if (!puedeConfirmar) {
    throw new Error("Esta orden de trabajo no está esperando tu confirmación.");
  }

  if (parsed.resultado === "OK") {
    await prisma.ordenDeTrabajo.update({
      where: { id: otId },
      data: { confirmacionReparacion: "CONFIRMADA" },
    });
  } else {
    await prisma.$transaction([
      prisma.ordenDeTrabajo.update({
        where: { id: otId },
        data: {
          estado: "EN_PROGRESO",
          fechaFin: null,
          confirmacionReparacion: "RECHAZADA",
          confirmacionReparacionComentario: parsed.comentario,
        },
      }),
      prisma.oTHistorialEstado.create({
        data: {
          ordenDeTrabajoId: otId,
          actorId: user.id,
          estadoAnterior: "COMPLETADA",
          estadoNuevo: "EN_PROGRESO",
          comentario: parsed.comentario
            ? `El chofer indicó que el problema persiste: ${parsed.comentario}`
            : "El chofer indicó que el problema persiste.",
        },
      }),
    ]);
  }

  revalidatePath("/mobile/reparaciones");
  revalidatePath(`/ordenes-trabajo/${otId}`);
  revalidatePath("/ordenes-trabajo");
}

export async function cancelarOT(otId: string, comentario?: string) {
  const { user, prisma } = await requireSession();
  await transicionarOT(prisma, user, otId, "CANCELADA", {}, comentario);
}

export async function completarDesdeExterno(otId: string) {
  const { user, prisma } = await requireSession();
  await transicionarOT(prisma, user, otId, "COMPLETADA");
}

export async function volverAInternoDesdeExterno(otId: string) {
  const { user, prisma } = await requireSession();
  await transicionarOT(prisma, user, otId, "EN_PROGRESO");
}

const derivarSchema = z.object({
  tallerExternoId: z.string().min(1, "Elegí un taller"),
  presupuestoMonto: optionalNumber(),
  fechaEstimadaEntrega: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
});

export async function derivarAExterno(otId: string, formData: FormData) {
  const { user, prisma } = await requireRole(ROLES_ADMIN_MANTENIMIENTO);
  const parsed = derivarSchema.parse(Object.fromEntries(formData));

  await prisma.$transaction(async (tx) => {
    const ot = await tx.ordenDeTrabajo.findUniqueOrThrow({ where: { id: otId } });

    if (!puedeTransicionar(ot.estado, "DERIVADA_EXTERNO", user.rol)) {
      throw new Error("No se puede derivar esta orden de trabajo en su estado actual.");
    }

    await tx.ordenDeTrabajo.update({ where: { id: otId }, data: { estado: "DERIVADA_EXTERNO" } });
    await tx.oTHistorialEstado.create({
      data: {
        ordenDeTrabajoId: otId,
        actorId: user.id,
        estadoAnterior: ot.estado,
        estadoNuevo: "DERIVADA_EXTERNO",
      },
    });
    await tx.oTDerivacionExterna.upsert({
      where: { ordenDeTrabajoId: otId },
      create: {
        ordenDeTrabajoId: otId,
        tallerExternoId: parsed.tallerExternoId,
        presupuestoMonto: parsed.presupuestoMonto,
        fechaEstimadaEntrega: parsed.fechaEstimadaEntrega,
      },
      update: {
        tallerExternoId: parsed.tallerExternoId,
        presupuestoMonto: parsed.presupuestoMonto,
        fechaEstimadaEntrega: parsed.fechaEstimadaEntrega,
        estadoExterno: "ENVIADO",
      },
    });
  });

  revalidatePath("/ordenes-trabajo");
  revalidatePath(`/ordenes-trabajo/${otId}`);
}

const actualizarDerivacionSchema = z.object({
  estadoExterno: z.enum(["ENVIADO", "PRESUPUESTADO", "EN_REPARACION", "COMPLETADO"]),
  presupuestoMonto: optionalNumber(),
  fechaEstimadaEntrega: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  resultado: z.string().trim().optional(),
});

export async function actualizarDerivacionExterna(
  derivacionId: string,
  otId: string,
  formData: FormData
) {
  const { prisma } = await requireRole(ROLES_ADMIN_MANTENIMIENTO);
  const parsed = actualizarDerivacionSchema.parse(Object.fromEntries(formData));

  await prisma.oTDerivacionExterna.update({
    where: { id: derivacionId },
    data: parsed,
  });

  revalidatePath(`/ordenes-trabajo/${otId}`);
}

const repuestoSchema = z.object({
  descripcion: z.string().trim().min(1, "Descripción requerida"),
  cantidad: optionalInt({ min: 1 }).transform((v) => v ?? 1),
  costoUnitario: optionalNumber(),
  articuloPanolId: z.string().trim().optional(),
  otItemPreventivoId: z.string().trim().optional(),
});

export type AgregarRepuestoState = { error?: string; mensaje?: string } | undefined;

export async function agregarRepuesto(
  otId: string,
  _prevState: AgregarRepuestoState,
  formData: FormData
): Promise<AgregarRepuestoState> {
  const { user, prisma } = await requireSession();

  const ot = await prisma.ordenDeTrabajo.findUniqueOrThrow({ where: { id: otId } });
  const puedeGestionar = user.rol === "ADMIN" || user.rol === "ENCARGADO_MANTENIMIENTO";
  const puedeAccionar = puedeGestionar || (user.rol === "MECANICO_INTERNO" && puedeMecanicoAccionar(ot, user.id));
  if (!puedeAccionar || ot.estado === "COMPLETADA" || ot.estado === "CANCELADA") {
    throw new AutorizacionError("No podés modificar los repuestos de esta orden de trabajo.");
  }

  const parsed = repuestoSchema.parse(Object.fromEntries(formData));
  const articuloPanolId = parsed.articuloPanolId || undefined;
  const otItemPreventivoId = parsed.otItemPreventivoId || undefined;

  // Si el repuesto sale del pañol, se descuenta el stock ANTES de crear el
  // registro: si no hay stock suficiente, descontarStockYVerificarMinimo
  // tira error y no queda un OTRepuesto huérfano sin stock descontado.
  let mensaje: string | undefined;
  if (articuloPanolId) {
    await descontarStockYVerificarMinimo(prisma, user.empresaId!, articuloPanolId, parsed.cantidad);
    mensaje = `Se usó ${parsed.cantidad} de ${parsed.descripcion} del pañol.`;
  }

  await prisma.oTRepuesto.create({
    data: {
      empresaId: user.empresaId!,
      ordenDeTrabajoId: otId,
      descripcion: parsed.descripcion,
      cantidad: parsed.cantidad,
      costoUnitario: parsed.costoUnitario,
      articuloPanolId,
      otItemPreventivoId,
    },
  });

  revalidatePath(`/ordenes-trabajo/${otId}`);
  revalidatePath("/panol");
  revalidatePath("/compras");
  return mensaje ? { mensaje } : undefined;
}

/**
 * Sacar un repuesto cargado por error — mismo nivel de permiso que
 * agregarRepuesto (quien lo pudo cargar, lo puede sacar). Es un soft-delete
 * (igual que el resto de los registros de papelera, para que un ADMIN lo
 * pueda ver/restaurar después) pero sin pasar por el gate de ADMIN de
 * app/_actions/papelera.ts, que es demasiado restrictivo para esta
 * corrección del día a día. Si el repuesto salió del pañol, se repone el
 * stock que se había descontado al cargarlo.
 */
export async function eliminarRepuestoUsado(otId: string, repuestoId: string) {
  const { user, prisma } = await requireSession();

  const repuesto = await prisma.oTRepuesto.findUniqueOrThrow({ where: { id: repuestoId } });
  if (repuesto.ordenDeTrabajoId !== otId) throw new AutorizacionError();

  const ot = await prisma.ordenDeTrabajo.findUniqueOrThrow({ where: { id: otId } });
  const puedeGestionar = user.rol === "ADMIN" || user.rol === "ENCARGADO_MANTENIMIENTO";
  const puedeAccionar = puedeGestionar || (user.rol === "MECANICO_INTERNO" && puedeMecanicoAccionar(ot, user.id));
  if (!puedeAccionar || ot.estado === "COMPLETADA" || ot.estado === "CANCELADA") {
    throw new AutorizacionError("No podés modificar los repuestos de esta orden de trabajo.");
  }

  await prisma.oTRepuesto.update({
    where: { id: repuestoId },
    data: { eliminadoEn: new Date(), eliminadoPorId: user.id },
  });

  if (repuesto.articuloPanolId) {
    await prisma.articuloPanol.update({
      where: { id: repuesto.articuloPanolId },
      data: { stockActual: { increment: repuesto.cantidad } },
    });
  }

  revalidatePath(`/ordenes-trabajo/${otId}`);
  revalidatePath("/panol");
}

const resultadoItemSchema = z.enum(["PENDIENTE", "OK", "REPARADO"]);

export type CompletarItemsPreventivosState =
  | { error?: string; itemsInvalidos?: string[] }
  | undefined;

/**
 * Guarda de una sola vez el estado de todos los ítems de una OT preventiva
 * en lote (un solo botón "Guardar" al pie de la lista, no uno por ítem —
 * mismo patrón que registrarChecklist: un campo `resultado_${item.id}` /
 * `observacion_${item.id}` / `foto_${item.id}` por ítem dentro de un único
 * form). Si algún ítem quedó en OK o Reparado sin observación ni foto (nueva
 * o ya cargada antes), no se guarda nada y se devuelven los ids de los
 * ítems inválidos para resaltarlos en rojo en la UI.
 */
export async function completarItemsPreventivos(
  otId: string,
  _prevState: CompletarItemsPreventivosState,
  formData: FormData
): Promise<CompletarItemsPreventivosState> {
  const { user, prisma } = await requireSession();

  const ot = await prisma.ordenDeTrabajo.findUniqueOrThrow({ where: { id: otId } });
  const puedeGestionar = user.rol === "ADMIN" || user.rol === "ENCARGADO_MANTENIMIENTO";
  const puedeAccionar = puedeGestionar || (user.rol === "MECANICO_INTERNO" && puedeMecanicoAccionar(ot, user.id));
  if (!puedeAccionar || ot.estado === "COMPLETADA" || ot.estado === "CANCELADA") {
    throw new AutorizacionError("No podés modificar los ítems de esta orden de trabajo.");
  }

  const items = await prisma.oTItemPreventivo.findMany({ where: { ordenDeTrabajoId: otId } });

  const entradas = items.map((item) => {
    const foto = formData.get(`foto_${item.id}`);
    return {
      item,
      resultado: resultadoItemSchema.parse(formData.get(`resultado_${item.id}`)),
      observacion: (formData.get(`observacion_${item.id}`) as string | null)?.trim() || undefined,
      tieneFotoNueva: foto instanceof File && foto.size > 0,
      foto,
    };
  });

  const invalidos = entradas.filter(
    ({ item, resultado, observacion, tieneFotoNueva }) =>
      resultado !== "PENDIENTE" && !observacion && !tieneFotoNueva && !item.archivoId
  );

  if (invalidos.length > 0) {
    return {
      error: "Faltan observaciones o fotos en los ítems marcados en rojo. Completalos para poder guardar.",
      itemsInvalidos: invalidos.map(({ item }) => item.id),
    };
  }

  for (const { item, resultado, observacion, tieneFotoNueva, foto } of entradas) {
    const archivoId = tieneFotoNueva
      ? (await guardarArchivo(prisma, user.empresaId!, foto as File, user.id)).id
      : undefined;

    await prisma.oTItemPreventivo.update({
      where: { id: item.id },
      data: {
        resultado,
        observacion: observacion ?? null,
        ...(archivoId ? { archivoId } : {}),
        completadoEn: resultado === "PENDIENTE" ? null : new Date(),
      },
    });
  }

  revalidatePath(`/ordenes-trabajo/${otId}`);
  revalidatePath("/ordenes-trabajo");
}
