import { requireEmpresa } from "@/lib/permisos";
import { checklistObligatorioActivo, vehiculoDelChecklistDeHoy } from "@/lib/checklist";
import { ChecklistPendienteAviso } from "../checklist-pendiente-aviso";
import { CombustibleForm } from "./combustible-form";

export default async function CombustiblePage() {
  const { user, prisma } = await requireEmpresa();

  const esChofer = user.rol === "CHOFER";
  const obligatorio = esChofer && (await checklistObligatorioActivo(prisma, user.empresaId!));
  const vehiculoActivo = obligatorio ? await vehiculoDelChecklistDeHoy(prisma, user.id) : null;

  if (obligatorio && !vehiculoActivo) {
    return <ChecklistPendienteAviso />;
  }

  const vehiculos = vehiculoActivo
    ? []
    : await prisma.vehiculo.findMany({
        where: { activo: true, eliminadoEn: null },
        orderBy: { patente: "asc" },
      });

  return <CombustibleForm vehiculos={vehiculos} vehiculoActivo={vehiculoActivo} />;
}
