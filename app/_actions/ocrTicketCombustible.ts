"use server";

import { requireRole, ROLES_MOBILE_CHOFER } from "@/lib/permisos";
import { leerTicketCombustible, type LecturaTicketResultado } from "@/lib/ocr-ticket-combustible";

export async function leerTicketCombustibleAction(formData: FormData): Promise<LecturaTicketResultado> {
  await requireRole(ROLES_MOBILE_CHOFER);

  const file = formData.get("archivoTicket");
  if (!(file instanceof File) || file.size === 0) {
    return { leido: false, motivo: "archivo_invalido" };
  }

  return leerTicketCombustible(file);
}
