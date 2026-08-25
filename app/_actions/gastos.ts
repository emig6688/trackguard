"use server";

import { redirect } from "next/navigation";
import { requireRole, ROLES_MOBILE_CHOFER } from "@/lib/permisos";
import { guardarArchivo } from "@/lib/storage";
import { verificarChecklistDelDia, checklistObligatorioActivo, vehiculoDelChecklistDeHoy } from "@/lib/checklist";

const TIPOS_GASTO = ["PEAJE", "VIATICO", "REPARACION_MENOR", "OTRO"] as const;

export type GastoState = { error?: string } | undefined;

export async function registrarGasto(_prevState: GastoState, formData: FormData): Promise<GastoState> {
  const { user: chofer, prisma } = await requireRole(ROLES_MOBILE_CHOFER);
  const empresaId = chofer.empresaId!;

  const tipo = formData.get("tipo");
  const montoRaw = formData.get("monto");
  const vehiculoId = formData.get("vehiculoId");
  const descripcion = formData.get("descripcion");

  if (typeof tipo !== "string" || !TIPOS_GASTO.includes(tipo as (typeof TIPOS_GASTO)[number])) {
    return { error: "Elegí un tipo de gasto." };
  }
  const monto = Number(montoRaw);
  if (!Number.isFinite(monto) || monto <= 0) return { error: "Ingresá un monto válido." };

  // El vehículo nunca es opcional: todo lo que carga el chofer queda
  // identificado con chofer + patente juntos.
  if (typeof vehiculoId !== "string" || !vehiculoId) return { error: "Elegí un vehículo." };
  const vehiculo = await prisma.vehiculo.findUnique({ where: { id: vehiculoId } });
  if (!vehiculo) return { error: "Vehículo inválido." };

  const chequeo = await verificarChecklistDelDia(prisma, empresaId, chofer, vehiculoId);
  if (chequeo.bloqueado) return { error: chequeo.motivo };

  // Con checklist obligatorio activo, la patente viene fija en el
  // formulario (ver gastos/page.tsx) — este chequeo es el resguardo del
  // servidor por si el campo oculto llegó manipulado.
  if (await checklistObligatorioActivo(prisma, empresaId)) {
    const vehiculoActivo = await vehiculoDelChecklistDeHoy(prisma, chofer.id);
    if (!vehiculoActivo || vehiculoActivo.id !== vehiculoId) {
      return {
        error: `Tenés que cargar el gasto con ${vehiculoActivo?.patente ?? "el vehículo"} de tu checklist de hoy.`,
      };
    }
  }

  const descripcionTrim = typeof descripcion === "string" ? descripcion.trim() : "";
  if (tipo === "OTRO" && !descripcionTrim) {
    return { error: 'Para "Otro" tenés que aclarar el gasto en observación.' };
  }

  const file = formData.get("archivoComprobante");
  const archivo =
    file instanceof File && file.size > 0 ? await guardarArchivo(prisma, empresaId, file, chofer.id) : null;

  await prisma.gasto.create({
    data: {
      empresaId,
      choferId: chofer.id,
      vehiculoId,
      tipo: tipo as (typeof TIPOS_GASTO)[number],
      monto,
      descripcion: descripcionTrim || undefined,
      archivoComprobanteId: archivo?.id,
    },
  });

  redirect("/mobile/gastos/listo");
}
