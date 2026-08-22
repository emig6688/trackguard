"use server";

import { redirect } from "next/navigation";
import { requireRole, ROLES_MOBILE_CHOFER } from "@/lib/permisos";
import { guardarArchivo } from "@/lib/storage";
import { generarNumeroOT } from "@/app/_actions/ordenesTrabajo";
import { clasificarAreaReparacion, AREA_REPARACION_LABEL } from "@/lib/clasificador-averias";
import { notificarOTGeneradaChofer } from "@/lib/notificaciones";
import { buscarOTAbiertaMismoProblema } from "@/lib/ot";
import {
  verificarChecklistDelDia,
  registrarHorasEquipoFrioSiCorresponde,
  vehiculoActivoParaCierre,
} from "@/lib/checklist";

const PRIORIDAD_POR_TIPO = {
  DESPERFECTO: "ALTA",
  INCIDENTE: "URGENTE",
  OBSERVACION: "MEDIA",
} as const;

export type EventoRutaState = { error?: string } | undefined;

export async function registrarEventoRuta(
  _prevState: EventoRutaState,
  formData: FormData
): Promise<EventoRutaState> {
  const { user: chofer, prisma } = await requireRole(ROLES_MOBILE_CHOFER);
  const empresaId = chofer.empresaId!;

  const vehiculoId = formData.get("vehiculoId");
  const tipo = formData.get("tipo");
  const descripcion = formData.get("descripcion");
  if (typeof vehiculoId !== "string" || !vehiculoId) return { error: "Elegí un vehículo." };
  if (typeof tipo !== "string" || !(tipo in PRIORIDAD_POR_TIPO)) return { error: "Elegí un tipo de evento." };
  if (typeof descripcion !== "string" || !descripcion.trim()) return { error: "Describí el evento." };

  const vehiculo = await prisma.vehiculo.findUnique({ where: { id: vehiculoId }, select: { patente: true } });
  if (!vehiculo) return { error: "Vehículo inválido." };

  const chequeo = await verificarChecklistDelDia(prisma, empresaId, chofer, vehiculoId);
  if (chequeo.bloqueado) return { error: chequeo.motivo };

  const vehiculoActivo = await vehiculoActivoParaCierre(prisma, chofer.id);
  if (!vehiculoActivo) return { error: "No tenés ningún reparto abierto para cerrar." };
  if (vehiculoActivo.id !== vehiculoId) {
    return { error: `Tenés que cerrar ruta con ${vehiculoActivo.patente}, el vehículo de tu checklist de hoy.` };
  }

  const kmRaw = formData.get("kmAlMomento");
  const kmAlMomento = typeof kmRaw === "string" && kmRaw !== "" ? Number(kmRaw) : undefined;

  const file = formData.get("archivo");
  const archivo =
    file instanceof File && file.size > 0 ? await guardarArchivo(prisma, empresaId, file, chofer.id) : null;

  const evento = await prisma.eventoRuta.create({
    data: {
      empresaId,
      vehiculoId,
      choferId: chofer.id,
      tipo: tipo as "DESPERFECTO" | "INCIDENTE" | "OBSERVACION",
      descripcion: descripcion.trim(),
      kmAlMomento,
      archivoId: archivo?.id,
      tanqueLleno: formData.get("tanqueLleno") === "on",
    },
  });

  await registrarHorasEquipoFrioSiCorresponde(prisma, {
    vehiculoId,
    choferId: chofer.id,
    eventoRutaId: evento.id,
    cierreFechaHora: evento.fechaHora,
  });

  const areaReparacion = clasificarAreaReparacion(descripcion);

  // Si ya hay una OT abierta que suena al mismo problema (misma área Y
  // alguna palabra clave en común, no solo la misma área), se agrega la
  // observación ahí en vez de duplicar la OT (ver lib/ot.ts).
  const otAbierta = await buscarOTAbiertaMismoProblema(prisma, vehiculoId, areaReparacion, descripcion);

  if (otAbierta) {
    const fecha = new Date().toLocaleDateString("es-AR");
    await prisma.ordenDeTrabajo.update({
      where: { id: otAbierta.id },
      data: {
        descripcion: `${otAbierta.descripcion ?? ""}\n\n[Reiterado ${fecha} por ${chofer.nombre}] ${descripcion.trim()}`.trim(),
      },
    });
    await notificarOTGeneradaChofer(prisma, empresaId, {
      id: otAbierta.id,
      numero: otAbierta.numero,
      titulo: otAbierta.titulo,
      patente: vehiculo.patente,
      reiterada: true,
    });
  } else {
    const numero = await generarNumeroOT(prisma, empresaId);
    const titulo = `Evento de ruta: ${AREA_REPARACION_LABEL[areaReparacion]}`;

    const empresa = await prisma.empresa.findUniqueOrThrow({
      where: { id: empresaId },
      select: { autoAprobacionMecanicosActiva: true },
    });
    const estadoInicial = empresa.autoAprobacionMecanicosActiva ? "APROBADA" : "PENDIENTE_APROBACION";

    const otCreada = await prisma.ordenDeTrabajo.create({
      data: {
        empresaId,
        numero,
        vehiculoId,
        origen: "EVENTO_RUTA",
        estado: estadoInicial,
        prioridad: PRIORIDAD_POR_TIPO[tipo as keyof typeof PRIORIDAD_POR_TIPO],
        areaReparacion,
        titulo,
        descripcion: descripcion.trim(),
        eventoRutaId: evento.id,
        creadoPorId: chofer.id,
        historial: {
          create: { actorId: chofer.id, estadoAnterior: null, estadoNuevo: estadoInicial },
        },
      },
    });
    await notificarOTGeneradaChofer(prisma, empresaId, { id: otCreada.id, numero, titulo, patente: vehiculo.patente });
  }

  redirect("/mobile/evento/listo");
}

/**
 * Cierre de ruta rápido cuando no hay nada para reportar. A diferencia de
 * registrarEventoRuta, no genera una OT — queda solo como constancia de que
 * el chofer confirmó activamente que no tuvo novedades (no es lo mismo que
 * el silencio). El vehículo sigue siendo obligatorio: chofer y patente
 * siempre van juntos en todo lo que carga el chofer.
 */
export async function cerrarRutaSinNovedades(
  _prevState: EventoRutaState,
  formData: FormData
): Promise<EventoRutaState> {
  const { user: chofer, prisma } = await requireRole(ROLES_MOBILE_CHOFER);
  const empresaId = chofer.empresaId!;

  const vehiculoId = formData.get("vehiculoId");
  if (typeof vehiculoId !== "string" || !vehiculoId) return { error: "Elegí un vehículo." };
  const vehiculo = await prisma.vehiculo.findUnique({ where: { id: vehiculoId } });
  if (!vehiculo) return { error: "Vehículo inválido." };

  const chequeo = await verificarChecklistDelDia(prisma, empresaId, chofer, vehiculoId);
  if (chequeo.bloqueado) return { error: chequeo.motivo };

  const vehiculoActivo = await vehiculoActivoParaCierre(prisma, chofer.id);
  if (!vehiculoActivo) return { error: "No tenés ningún reparto abierto para cerrar." };
  if (vehiculoActivo.id !== vehiculoId) {
    return { error: `Tenés que cerrar ruta con ${vehiculoActivo.patente}, el vehículo de tu checklist de hoy.` };
  }

  const kmRaw = formData.get("kmAlMomento");
  const kmAlMomento = typeof kmRaw === "string" && kmRaw !== "" ? Number(kmRaw) : undefined;

  const evento = await prisma.eventoRuta.create({
    data: {
      empresaId,
      vehiculoId,
      choferId: chofer.id,
      tipo: "OBSERVACION",
      descripcion: "Cierre de ruta sin novedades.",
      kmAlMomento,
      tanqueLleno: formData.get("tanqueLleno") === "on",
    },
  });

  if (kmAlMomento != null) {
    await prisma.vehiculo.updateMany({
      where: { id: vehiculoId, kmActual: { lt: kmAlMomento } },
      data: { kmActual: kmAlMomento },
    });
  }

  await registrarHorasEquipoFrioSiCorresponde(prisma, {
    vehiculoId,
    choferId: chofer.id,
    eventoRutaId: evento.id,
    cierreFechaHora: evento.fechaHora,
  });

  redirect("/mobile/evento/listo?sinNovedades=1");
}
