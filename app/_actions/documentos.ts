"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole, ROLES_ADMIN_MANTENIMIENTO } from "@/lib/permisos";

const documentoSchema = z.object({
  entidadTipo: z.enum(["VEHICULO", "CHOFER"]),
  entidadId: z.string().min(1),
  tipoDocumentoId: z.string().min(1, "Elegí un tipo de documento"),
  numeroDocumento: z.string().trim().optional(),
  fechaEmision: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  fechaVencimiento: z
    .string()
    .min(1, "Fecha de vencimiento requerida")
    .transform((v) => new Date(v)),
  observaciones: z.string().trim().optional(),
});

export type DocumentoFormState =
  | { error?: string; fieldErrors?: Record<string, string[]>; success?: boolean }
  | undefined;

export async function crearDocumento(
  redirectPath: string,
  _prevState: DocumentoFormState,
  formData: FormData
): Promise<DocumentoFormState> {
  const { user, prisma } = await requireRole(ROLES_ADMIN_MANTENIMIENTO);

  const parsed = documentoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  await prisma.documento.create({ data: { ...parsed.data, empresaId: user.empresaId! } });

  revalidatePath(redirectPath);
  revalidatePath("/documentos");
  return { success: true };
}
