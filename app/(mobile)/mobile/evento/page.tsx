import { requireEmpresa } from "@/lib/permisos";
import { checklistObligatorioPendiente } from "@/lib/checklist";
import { ChecklistPendienteAviso } from "../checklist-pendiente-aviso";
import { EventoForm } from "./evento-form";

export default async function EventoPage() {
  const { user, prisma } = await requireEmpresa();

  if (user.rol === "CHOFER" && (await checklistObligatorioPendiente(prisma, user.empresaId!, user.id))) {
    return <ChecklistPendienteAviso />;
  }

  const vehiculos = await prisma.vehiculo.findMany({
    where: { activo: true, eliminadoEn: null },
    orderBy: { patente: "asc" },
  });

  return <EventoForm vehiculos={vehiculos} />;
}
