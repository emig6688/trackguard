"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole, ROLES_GUARDIA } from "@/lib/permisos";

const devolucionSchema = z.object({
  fecha: z
    .string()
    .min(1, "Fecha requerida")
    .transform((v) => new Date(v)),
  choferId: z.string().trim().min(1, "Elegí un chofer"),
  cliente: z.string().trim().min(1, "Cliente requerido"),
  remito: z.string().trim().min(1, "Remito requerido"),
});

export type DevolucionFormState = { error?: string; fieldErrors?: Record<string, string[]> } | undefined;

function leerFilas(formData: FormData, idsCsv: FormDataEntryValue | null, campos: string[]) {
  const ids = ((idsCsv as string | null) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return ids
    .map((id) => {
      const fila: Record<string, string> = {};
      for (const campo of campos) {
        fila[campo] = ((formData.get(`${campo}_${id}`) as string | null) ?? "").trim();
      }
      return fila;
    })
    .filter((fila) => Object.values(fila).some((v) => v !== ""));
}

export async function crearDevolucion(
  _prevState: DevolucionFormState,
  formData: FormData
): Promise<DevolucionFormState> {
  const { user, prisma } = await requireRole(ROLES_GUARDIA);

  const parsed = devolucionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "Revisá los campos.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const productosFilas = leerFilas(formData, formData.get("productoIds"), [
    "prod_producto",
    "prod_correlativo",
    "prod_ubicacion",
    "prod_observacion",
  ]);
  for (const fila of productosFilas) {
    if (!fila.prod_producto || !fila.prod_correlativo || !fila.prod_ubicacion) {
      return {
        error: 'Completá producto, correlativo y ubicación en cada fila de "Regresa a frigorífico".',
      };
    }
  }

  const cambiosFilas = leerFilas(formData, formData.get("cambioIds"), [
    "cam_cliente",
    "cam_producto",
    "cam_correlativo",
    "cam_autoriz",
    "cam_observacion",
  ]);
  for (const fila of cambiosFilas) {
    if (!fila.cam_cliente || !fila.cam_producto || !fila.cam_correlativo || !fila.cam_autoriz) {
      return { error: 'Completá todos los campos en cada fila de "Cambios".' };
    }
  }

  const chofer = await prisma.usuario.findFirst({
    where: { id: parsed.data.choferId, empresaId: user.empresaId!, rol: "CHOFER" },
  });
  if (!chofer) return { error: "Chofer inválido." };

  const devolucion = await prisma.devolucion.create({
    data: {
      empresaId: user.empresaId!,
      fecha: parsed.data.fecha,
      choferId: parsed.data.choferId,
      cliente: parsed.data.cliente,
      remito: parsed.data.remito,
      registradoPorId: user.id,
      productos: {
        create: productosFilas.map((f) => ({
          producto: f.prod_producto,
          correlativo: f.prod_correlativo,
          ubicacionGuardado: f.prod_ubicacion,
          observacion: f.prod_observacion || undefined,
        })),
      },
      cambios: {
        create: cambiosFilas.map((f) => ({
          clienteEntregado: f.cam_cliente,
          producto: f.cam_producto,
          correlativo: f.cam_correlativo,
          autoriz: f.cam_autoriz,
          observacion: f.cam_observacion || undefined,
        })),
      },
    },
  });

  redirect(`/guardia/devoluciones/${devolucion.id}`);
}

export async function enviarDevolucion(devolucionId: string) {
  const { user, prisma } = await requireRole(ROLES_GUARDIA);

  const devolucion = await prisma.devolucion.findUniqueOrThrow({ where: { id: devolucionId } });
  if (devolucion.enviadoEn) return; // ya se envió, no hace nada en un doble click

  await prisma.devolucion.update({
    where: { id: devolucionId },
    data: { enviadoEn: new Date(), enviadoPorId: user.id },
  });

  revalidatePath(`/guardia/devoluciones/${devolucionId}`);
  revalidatePath("/guardia/devoluciones");
}
