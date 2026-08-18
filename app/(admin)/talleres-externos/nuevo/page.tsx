import { crearTallerExterno } from "@/app/_actions/talleres-externos";
import { TallerForm } from "../taller-form";

export default function NuevoTallerPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Nuevo taller externo</h1>
      <TallerForm action={crearTallerExterno} submitLabel="Crear taller" />
    </div>
  );
}
