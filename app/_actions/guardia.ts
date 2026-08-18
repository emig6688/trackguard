"use server";

import { revalidatePath } from "next/cache";
import { requireRole, ROLES_GUARDIA } from "@/lib/permisos";
import { inicioDeHoy } from "@/lib/checklist";
import type { EtapaObservacionGuardia } from "@/app/generated/prisma/client";
import type { ScopedPrismaClient } from "@/lib/tenant-prisma";

export async function guardarObservacionGuardia(
  vehiculoId: string,
  etapa: EtapaObservacionGuardia,
  formData: FormData
) {
  const { user, prisma } = await requireRole(ROLES_GUARDIA);
  const empresaId = user.empresaId!;
  const observacion = (formData.get("observacion") as string | null)?.trim() ?? "";
  const fecha = inicioDeHoy();

  if (!observacion) {
    await prisma.observacionGuardia.deleteMany({ where: { vehiculoId, fecha, etapa } });
  } else {
    await prisma.observacionGuardia.upsert({
      where: { empresaId_vehiculoId_fecha_etapa: { empresaId, vehiculoId, fecha, etapa } },
      create: { empresaId, vehiculoId, fecha, etapa, observacion, guardiaId: user.id },
      update: { observacion, guardiaId: user.id },
    });
  }

  revalidatePath("/guardia");
}

/**
 * El guardia marca que un vehículo no salió a reparto hoy (no va a tener
 * checklist ni cierre de ruta porque no operó, no por incumplimiento). Como
 * no hay una asignación fija chofer-vehículo, el guardia elige a mano a qué
 * chofer corresponde ese día — lib/estadisticas-guardia.ts excluye ese día
 * de las estadísticas de ESE chofer.
 */
/**
 * Un camión que no salió a reparto no lo manejó ningún chofer ese día, así
 * que no tiene sentido pedirle al guardia que elija uno a mano — se toma el
 * chofer del checklist/evento de ruta más reciente de ese vehículo (quien
 * más recientemente lo usó), que es a quien le correspondería excluir el día
 * en sus estadísticas de cumplimiento. Si el vehículo nunca se usó, queda
 * sin chofer (no hay a quién excluirle nada).
 */
async function choferHabitual(prisma: ScopedPrismaClient, vehiculoId: string) {
  const [ultimoChecklist, ultimoEvento] = await Promise.all([
    prisma.checklistRealizado.findFirst({
      where: { vehiculoId },
      orderBy: { fechaHora: "desc" },
      select: { choferId: true, fechaHora: true },
    }),
    prisma.eventoRuta.findFirst({
      where: { vehiculoId },
      orderBy: { fechaHora: "desc" },
      select: { choferId: true, fechaHora: true },
    }),
  ]);
  const candidatos = [ultimoChecklist, ultimoEvento].filter((c): c is NonNullable<typeof c> => c != null);
  if (candidatos.length === 0) return null;
  candidatos.sort((a, b) => b.fechaHora.getTime() - a.fechaHora.getTime());
  return candidatos[0].choferId;
}

export async function marcarDiaNoOperado(vehiculoId: string, formData: FormData) {
  const { user, prisma } = await requireRole(ROLES_GUARDIA);
  const empresaId = user.empresaId!;
  const motivo = (formData.get("motivo") as string | null)?.trim() || undefined;
  const fecha = inicioDeHoy();
  const choferId = await choferHabitual(prisma, vehiculoId);

  await prisma.diaNoOperado.upsert({
    where: { empresaId_vehiculoId_fecha: { empresaId, vehiculoId, fecha } },
    create: { empresaId, vehiculoId, fecha, choferId, motivo, marcadoPorId: user.id },
    update: { choferId, motivo, marcadoPorId: user.id },
  });

  revalidatePath("/guardia");
}

export async function desmarcarDiaNoOperado(vehiculoId: string) {
  const { prisma } = await requireRole(ROLES_GUARDIA);
  const fecha = inicioDeHoy();
  await prisma.diaNoOperado.deleteMany({ where: { vehiculoId, fecha } });
  revalidatePath("/guardia");
}
