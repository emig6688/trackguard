import { requireEmpresa } from "@/lib/permisos";
import { ChecklistForm } from "./checklist-form";

export default async function ChecklistPage() {
  const { prisma } = await requireEmpresa();
  const [vehiculos, template] = await Promise.all([
    prisma.vehiculo.findMany({ where: { activo: true, eliminadoEn: null }, orderBy: { patente: "asc" } }),
    prisma.checklistTemplate.findFirst({
      where: { activo: true },
      include: { items: { orderBy: { orden: "asc" } } },
    }),
  ]);

  if (!template) {
    return <p className="text-sm text-muted-foreground">No hay un checklist configurado todavía.</p>;
  }

  return <ChecklistForm vehiculos={vehiculos} templateId={template.id} items={template.items} />;
}
