import { requireEmpresa } from "@/lib/permisos";
import { checklistObligatorioPendiente } from "@/lib/checklist";
import { ChecklistPendienteAviso } from "../checklist-pendiente-aviso";
import { CombustibleForm } from "./combustible-form";

export default async function CombustiblePage() {
  const { user, prisma } = await requireEmpresa();

  if (user.rol === "CHOFER" && (await checklistObligatorioPendiente(prisma, user.empresaId!, user.id))) {
    return <ChecklistPendienteAviso />;
  }

  const vehiculos = await prisma.vehiculo.findMany({
    where: { activo: true, eliminadoEn: null },
    orderBy: { patente: "asc" },
  });

  return <CombustibleForm vehiculos={vehiculos} />;
}
