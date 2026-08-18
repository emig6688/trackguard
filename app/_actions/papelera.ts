"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/permisos";
import {
  eliminarRegistro,
  restaurarRegistro,
  RUTA_LISTADO,
  type TipoPapelera,
} from "@/lib/papelera";

export async function eliminarRegistroAction(
  tipo: TipoPapelera,
  id: string,
  redirectPath?: string
) {
  const { user, prisma } = await requireRole(["ADMIN"]);
  await eliminarRegistro(prisma, user.empresaId!, tipo, id, user.id);

  revalidatePath("/papelera");
  revalidatePath(RUTA_LISTADO[tipo]);
  if (redirectPath) revalidatePath(redirectPath);
}

export async function restaurarRegistroAction(tipo: TipoPapelera, id: string) {
  const { user, prisma } = await requireRole(["ADMIN"]);
  await restaurarRegistro(prisma, user.empresaId!, tipo, id);

  revalidatePath("/papelera");
  revalidatePath(RUTA_LISTADO[tipo]);
}
