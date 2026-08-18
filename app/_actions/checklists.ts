"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole, ROLES_MOBILE_CHOFER } from "@/lib/permisos";
import { generarNumeroOT } from "@/app/_actions/ordenesTrabajo";
import { optionalInt } from "@/lib/zod-helpers";
import { notificarOTGeneradaChofer } from "@/lib/notificaciones";
import { buscarOTAbiertaMismoProblema } from "@/lib/ot";
import { clasificarAreaReparacion } from "@/lib/clasificador-averias";

const respuestaSchema = z.object({
  checklistItemId: z.string(),
  resultado: z.enum(["OK", "FALLA", "NO_APLICA"]),
  observacion: z.string().trim().optional(),
});

export async function registrarChecklist(formData: FormData) {
  const { user: chofer, prisma } = await requireRole(ROLES_MOBILE_CHOFER);
  const empresaId = chofer.empresaId!;

  const vehiculoId = formData.get("vehiculoId");
  const templateId = formData.get("templateId");
  if (typeof vehiculoId !== "string" || !vehiculoId) throw new Error("Elegí un vehículo.");
  if (typeof templateId !== "string" || !templateId) throw new Error("Falta el template de checklist.");

  const kmAlMomento = optionalInt().parse(formData.get("kmAlMomento"));

  const items = await prisma.checklistItem.findMany({ where: { templateId } });

  const respuestas = items.map((item) =>
    respuestaSchema.parse({
      checklistItemId: item.id,
      resultado: formData.get(`resultado_${item.id}`),
      observacion: formData.get(`observacion_${item.id}`),
    })
  );

  const hayFallas = respuestas.some((r) => r.resultado === "FALLA");

  const checklist = await prisma.checklistRealizado.create({
    data: {
      templateId,
      vehiculoId,
      choferId: chofer.id,
      kmAlMomento,
      resultadoGeneral: hayFallas ? "CON_FALLAS" : "OK",
      respuestas: { create: respuestas },
    },
  });

  if (kmAlMomento != null) {
    await prisma.vehiculo.updateMany({
      where: { id: vehiculoId, kmActual: { lt: kmAlMomento } },
      data: { kmActual: kmAlMomento },
    });
  }

  if (hayFallas) {
    const itemsPorId = new Map(items.map((i) => [i.id, i.texto]));
    const detalle = respuestas
      .filter((r) => r.resultado === "FALLA")
      .map((r) => `- ${itemsPorId.get(r.checklistItemId)}${r.observacion ? `: ${r.observacion}` : ""}`)
      .join("\n");

    const titulo = "Fallas detectadas en checklist pre-salida";
    const areaReparacion = clasificarAreaReparacion(detalle);
    const vehiculo = await prisma.vehiculo.findUniqueOrThrow({ where: { id: vehiculoId }, select: { patente: true } });

    const otAbierta = await buscarOTAbiertaMismoProblema(prisma, vehiculoId, areaReparacion, detalle);

    if (otAbierta) {
      const fecha = new Date().toLocaleDateString("es-AR");
      await prisma.ordenDeTrabajo.update({
        where: { id: otAbierta.id },
        data: {
          descripcion: `${otAbierta.descripcion ?? ""}\n\n[Reiterado ${fecha} por checklist de ${chofer.nombre}]\n${detalle}`.trim(),
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
      const otCreada = await prisma.ordenDeTrabajo.create({
        data: {
          empresaId,
          numero,
          vehiculoId,
          origen: "CHECKLIST",
          estado: "PENDIENTE_APROBACION",
          prioridad: "ALTA",
          areaReparacion,
          titulo,
          descripcion: detalle,
          checklistRealizadoId: checklist.id,
          creadoPorId: chofer.id,
          historial: {
            create: { actorId: chofer.id, estadoAnterior: null, estadoNuevo: "PENDIENTE_APROBACION" },
          },
        },
      });
      await notificarOTGeneradaChofer(prisma, empresaId, { id: otCreada.id, numero, titulo, patente: vehiculo.patente });
    }
  }

  revalidatePath("/mobile/inicio");
  redirect(`/mobile/checklist/listo?fallas=${hayFallas ? "1" : "0"}`);
}
