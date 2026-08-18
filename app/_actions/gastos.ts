"use server";

import { redirect } from "next/navigation";
import { requireRole, ROLES_MOBILE_CHOFER } from "@/lib/permisos";
import { guardarArchivo } from "@/lib/storage";
import { verificarChecklistDelDia } from "@/lib/checklist";

const TIPOS_GASTO = ["PEAJE", "VIATICO", "REPARACION_MENOR", "OTRO"] as const;

export async function registrarGasto(formData: FormData) {
  const { user: chofer, prisma } = await requireRole(ROLES_MOBILE_CHOFER);
  const empresaId = chofer.empresaId!;

  const chequeo = await verificarChecklistDelDia(prisma, empresaId, chofer);
  if (chequeo.bloqueado) throw new Error(chequeo.motivo);

  const tipo = formData.get("tipo");
  const montoRaw = formData.get("monto");
  const vehiculoId = formData.get("vehiculoId");
  const descripcion = formData.get("descripcion");

  if (typeof tipo !== "string" || !TIPOS_GASTO.includes(tipo as (typeof TIPOS_GASTO)[number])) {
    throw new Error("Elegí un tipo de gasto.");
  }
  const monto = Number(montoRaw);
  if (!Number.isFinite(monto) || monto <= 0) throw new Error("Ingresá un monto válido.");

  // El vehículo nunca es opcional: todo lo que carga el chofer queda
  // identificado con chofer + patente juntos.
  if (typeof vehiculoId !== "string" || !vehiculoId) throw new Error("Elegí un vehículo.");

  const descripcionTrim = typeof descripcion === "string" ? descripcion.trim() : "";
  if (tipo === "OTRO" && !descripcionTrim) {
    throw new Error("Para \"Otro\" tenés que aclarar el gasto en observación.");
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
