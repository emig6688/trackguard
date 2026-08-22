import { requireEmpresa } from "@/lib/permisos";
import { checklistObligatorioPendiente, vehiculoActivoParaCierre } from "@/lib/checklist";
import { ChecklistPendienteAviso } from "../checklist-pendiente-aviso";
import { EventoForm } from "./evento-form";

export default async function EventoPage() {
  const { user, prisma } = await requireEmpresa();

  if (user.rol === "CHOFER" && (await checklistObligatorioPendiente(prisma, user.empresaId!, user.id))) {
    return <ChecklistPendienteAviso />;
  }

  const vehiculoActivo = user.rol === "CHOFER" ? await vehiculoActivoParaCierre(prisma, user.id) : null;

  if (user.rol === "CHOFER" && !vehiculoActivo) {
    return (
      <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/5 p-4 text-sm text-warning-foreground">
        <p className="font-medium">No tenés ningún reparto abierto para cerrar.</p>
        <p>Hacé el checklist pre-salida del vehículo con el que vas a salir antes de cerrar ruta.</p>
      </div>
    );
  }

  const vehiculos = vehiculoActivo
    ? []
    : await prisma.vehiculo.findMany({
        where: { activo: true, eliminadoEn: null },
        orderBy: { patente: "asc" },
      });

  return <EventoForm vehiculos={vehiculos} vehiculoActivo={vehiculoActivo} />;
}
