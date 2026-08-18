import { crearChofer } from "@/app/_actions/choferes";
import { ChoferForm } from "../chofer-form";

export default function NuevoChoferPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Nuevo chofer</h1>
      <ChoferForm action={crearChofer} modo="crear" submitLabel="Crear chofer" />
    </div>
  );
}
