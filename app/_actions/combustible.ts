"use server";

import { requireRole, ROLES_MOBILE_CHOFER } from "@/lib/permisos";
import { guardarArchivo } from "@/lib/storage";
import { verificarChecklistDelDia } from "@/lib/checklist";

export type CombustibleState =
  | {
      error?: string;
      success?: boolean;
      kmRecorridos?: number;
      consumoL100km?: number;
    }
  | undefined;

export async function registrarCargaCombustible(
  _prevState: CombustibleState,
  formData: FormData
): Promise<CombustibleState> {
  const { user: chofer, prisma } = await requireRole(ROLES_MOBILE_CHOFER);
  const empresaId = chofer.empresaId!;

  const chequeo = await verificarChecklistDelDia(prisma, empresaId, chofer);
  if (chequeo.bloqueado) return { error: chequeo.motivo };

  const vehiculoId = formData.get("vehiculoId");
  if (typeof vehiculoId !== "string" || !vehiculoId) return { error: "Elegí un vehículo." };

  const kmOdometro = Number(formData.get("kmOdometro"));
  const litrosCargados = Number(formData.get("litrosCargados"));
  const montoTotal = Number(formData.get("montoTotal"));
  if (!Number.isFinite(kmOdometro) || !Number.isFinite(litrosCargados) || !Number.isFinite(montoTotal)) {
    return { error: "Completá km, litros y monto correctamente." };
  }

  const precioLitroRaw = formData.get("precioLitro");
  const precioLitro =
    typeof precioLitroRaw === "string" && precioLitroRaw !== "" ? Number(precioLitroRaw) : undefined;
  const estacionServicioRaw = formData.get("estacionServicio");
  const estacionServicio = typeof estacionServicioRaw === "string" ? estacionServicioRaw.trim() || undefined : undefined;

  const file = formData.get("archivoTicket");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Subí una foto del ticket de combustible." };
  }

  const archivo = await guardarArchivo(prisma, empresaId, file, chofer.id);

  const anterior = await prisma.cargaCombustible.findFirst({
    where: { vehiculoId, eliminadoEn: null },
    orderBy: { fechaHora: "desc" },
  });

  let kmRecorridos: number | undefined;
  let consumoL100km: number | undefined;
  if (anterior && kmOdometro > anterior.kmOdometro) {
    kmRecorridos = kmOdometro - anterior.kmOdometro;
    consumoL100km = Math.round(((litrosCargados / kmRecorridos) * 100 + Number.EPSILON) * 100) / 100;
  }

  await prisma.cargaCombustible.create({
    data: {
      empresaId,
      vehiculoId,
      choferId: chofer.id,
      kmOdometro,
      litrosCargados,
      montoTotal,
      precioLitro,
      estacionServicio,
      archivoTicketId: archivo.id,
      kmRecorridosDesdeUltimaCarga: kmRecorridos,
      consumoL100km,
    },
  });

  await prisma.vehiculo.updateMany({
    where: { id: vehiculoId, kmActual: { lt: kmOdometro } },
    data: { kmActual: kmOdometro },
  });

  return { success: true, kmRecorridos, consumoL100km };
}
