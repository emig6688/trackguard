"use server";

import { revalidatePath } from "next/cache";
import { requireRole, ROLES_ADMIN_MANTENIMIENTO } from "@/lib/permisos";

export type GuardarChecklistTemplateState = { error?: string; success?: boolean } | undefined;

/**
 * Un checklist ya usado (ChecklistRealizado/ChecklistRespuesta) referencia
 * sus propios ChecklistItem, y esa relación no tiene cascade — no se pueden
 * borrar los ítems viejos sin romper el historial. Por eso "editar" el
 * checklist no toca la fila existente: desactiva la vieja y crea una nueva
 * versión con los ítems actuales, igual que ya usa `version` en el modelo.
 * Los checklists ya hechos siguen mostrando los ítems que tenían en su
 * momento; a partir de ahora se usa la versión nueva.
 */
export async function guardarChecklistTemplate(
  _prevState: GuardarChecklistTemplateState,
  formData: FormData
): Promise<GuardarChecklistTemplateState> {
  const { user, prisma } = await requireRole(ROLES_ADMIN_MANTENIMIENTO);

  const textos = formData
    .getAll("item")
    .map((t) => String(t).trim())
    .filter(Boolean);
  if (textos.length === 0) return { error: "Agregá al menos un ítem." };

  const actual = await prisma.checklistTemplate.findFirst({ where: { activo: true } });

  await prisma.$transaction(async (tx) => {
    if (actual) {
      await tx.checklistTemplate.update({ where: { id: actual.id }, data: { activo: false } });
    }
    await tx.checklistTemplate.create({
      data: {
        empresaId: user.empresaId!,
        nombre: "Checklist pre-salida",
        activo: true,
        version: (actual?.version ?? 0) + 1,
        items: { create: textos.map((texto, orden) => ({ orden: orden + 1, texto })) },
      },
    });
  });

  revalidatePath("/notificaciones");
  return { success: true };
}
