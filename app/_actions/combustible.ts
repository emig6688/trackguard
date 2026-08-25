"use server";

import { requireRole, ROLES_MOBILE_CHOFER } from "@/lib/permisos";
import { guardarArchivo } from "@/lib/storage";
import { verificarChecklistDelDia, checklistObligatorioActivo, vehiculoDelChecklistDeHoy } from "@/lib/checklist";

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

  const vehiculoId = formData.get("vehiculoId");
  if (typeof vehiculoId !== "string" || !vehiculoId) return { error: "Elegí un vehículo." };
  const vehiculo = await prisma.vehiculo.findUnique({ where: { id: vehiculoId } });
  if (!vehiculo) return { error: "Vehículo inválido." };

  const chequeo = await verificarChecklistDelDia(prisma, empresaId, chofer, vehiculoId);
  if (chequeo.bloqueado) return { error: chequeo.motivo };

  // Con checklist obligatorio activo, la patente viene fija en el
  // formulario (ver combustible/page.tsx) — este chequeo es el resguardo
  // del servidor por si el campo oculto llegó manipulado.
  if (await checklistObligatorioActivo(prisma, empresaId)) {
    const vehiculoActivo = await vehiculoDelChecklistDeHoy(prisma, chofer.id);
    if (!vehiculoActivo || vehiculoActivo.id !== vehiculoId) {
      return {
        error: `Tenés que cargar combustible con ${vehiculoActivo?.patente ?? "el vehículo"} de tu checklist de hoy.`,
      };
    }
  }

  const kmOdometro = Number(formData.get("kmOdometro"));
  const litrosCargados = Number(formData.get("litrosCargados"));
  const montoTotal = Number(formData.get("montoTotal"));
  if (
    !Number.isFinite(kmOdometro) ||
    !Number.isFinite(litrosCargados) ||
    !Number.isFinite(montoTotal) ||
    kmOdometro < 0 ||
    litrosCargados <= 0 ||
    montoTotal <= 0
  ) {
    return { error: "Completá km, litros y monto correctamente." };
  }

  const precioLitroRaw = formData.get("precioLitro");
  const precioLitro =
    typeof precioLitroRaw === "string" && precioLitroRaw !== "" ? Number(precioLitroRaw) : undefined;
  if (precioLitro != null && (!Number.isFinite(precioLitro) || precioLitro <= 0)) {
    return { error: "El precio por litro tiene que ser un número mayor a cero." };
  }
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
