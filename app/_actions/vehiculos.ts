"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole, ROLES_ADMIN_MANTENIMIENTO } from "@/lib/permisos";
import { optionalInt } from "@/lib/zod-helpers";
import { aplicarPlanEstandarAVehiculo } from "@/lib/plan-mantenimiento-estandar";

const vehiculoSchema = z.object({
  patente: z.string().trim().min(3, "Patente requerida").max(20),
  marca: z.string().trim().min(1, "Marca requerida"),
  modelo: z.string().trim().min(1, "Modelo requerido"),
  anio: optionalInt({ min: 1980, max: 2100 }),
  tipo: z.enum(["CAMION", "ACOPLADO", "UTILITARIO", "OTRO"]),
  numeroInterno: z.string().trim().optional(),
  kmActual: z.coerce.number().int().min(0).default(0),
  horasEquipoFrio: optionalInt({ min: 0 }),
  tipoCarroceria: z.string().trim().optional(),
  equipoFrioTipo: z.string().trim().optional(),
});

export type VehiculoFormState =
  | { error?: string; fieldErrors?: Record<string, string[]> }
  | undefined;

export async function crearVehiculo(
  _prevState: VehiculoFormState,
  formData: FormData
): Promise<VehiculoFormState> {
  const { user, prisma } = await requireRole(ROLES_ADMIN_MANTENIMIENTO);

  const parsed = vehiculoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  let vehiculoId: string;
  try {
    const vehiculo = await prisma.vehiculo.create({
      data: { ...parsed.data, empresaId: user.empresaId! },
    });
    vehiculoId = vehiculo.id;
  } catch {
    return { error: "Ya existe un vehículo con esa patente." };
  }

  // El plan de mantenimiento preventivo estándar (mantenedor) se aplica solo,
  // sin que el encargado tenga que apretar "Aplicar plan estándar" a mano.
  await aplicarPlanEstandarAVehiculo(prisma, user.empresaId!, vehiculoId);

  revalidatePath("/vehiculos");
  redirect("/vehiculos");
}

export async function actualizarVehiculo(
  vehiculoId: string,
  _prevState: VehiculoFormState,
  formData: FormData
): Promise<VehiculoFormState> {
  const { prisma } = await requireRole(ROLES_ADMIN_MANTENIMIENTO);

  const parsed = vehiculoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await prisma.vehiculo.update({ where: { id: vehiculoId }, data: parsed.data });
  } catch {
    return { error: "Ya existe un vehículo con esa patente." };
  }

  revalidatePath("/vehiculos");
  revalidatePath(`/vehiculos/${vehiculoId}`);
  redirect(`/vehiculos/${vehiculoId}`);
}

const bajaSchema = z.object({
  observacion: z.string().trim().min(1, "Indicá el motivo de la baja"),
});

export async function darDeBajaVehiculo(vehiculoId: string, formData: FormData) {
  const { prisma } = await requireRole(ROLES_ADMIN_MANTENIMIENTO);
  const parsed = bajaSchema.parse(Object.fromEntries(formData));

  await prisma.vehiculo.update({
    where: { id: vehiculoId },
    data: { activo: false, observacionBaja: parsed.observacion, fechaBaja: new Date() },
  });
  revalidatePath("/vehiculos");
  revalidatePath(`/vehiculos/${vehiculoId}`);
}

export async function reactivarVehiculo(vehiculoId: string) {
  const { prisma } = await requireRole(ROLES_ADMIN_MANTENIMIENTO);
  await prisma.vehiculo.update({
    where: { id: vehiculoId },
    data: { activo: true, observacionBaja: null, fechaBaja: null },
  });
  revalidatePath("/vehiculos");
  revalidatePath(`/vehiculos/${vehiculoId}`);
}

/**
 * El encargado de mantenimiento marca a diario si el vehículo está en
 * condiciones de uso. El mecánico también puede hacerlo — suele ser quien
 * primero se da cuenta, en medio de una reparación, de que el vehículo no
 * está en condiciones de uso. Si está derivado a un taller externo (OT en
 * DERIVADA_EXTERNO sin cerrar), el estado efectivo ya se fuerza a "no
 * disponible" en lib/disponibilidad.ts — acá solo se rechaza intentar
 * marcarlo disponible mientras eso siga así, para no dejar un dato manual
 * inconsistente con la realidad.
 */
export async function actualizarDisponibilidadVehiculo(
  vehiculoId: string,
  disponible: boolean,
  motivo?: string
) {
  const { user, prisma } = await requireRole([...ROLES_ADMIN_MANTENIMIENTO, "MECANICO_INTERNO"]);

  if (disponible) {
    const enTaller = await prisma.ordenDeTrabajo.findFirst({
      where: { vehiculoId, eliminadoEn: null, estado: "DERIVADA_EXTERNO" },
    });
    if (enTaller) {
      throw new Error("El vehículo está derivado a un taller externo: no se puede marcar disponible.");
    }
  } else if (!motivo?.trim()) {
    throw new Error("Indicá qué problema tiene la unidad.");
  }

  await prisma.vehiculo.update({
    where: { id: vehiculoId },
    data: {
      disponible,
      disponibleActualizadoEn: new Date(),
      disponibleActualizadoPorId: user.id,
      motivoNoOperativo: disponible ? null : motivo!.trim(),
    },
  });
  revalidatePath("/vehiculos");
  revalidatePath(`/vehiculos/${vehiculoId}`);
  revalidatePath("/dashboard");
}
