import { crearVehiculo } from "@/app/_actions/vehiculos";
import { VehiculoForm } from "./vehiculo-form";

export default function NuevoVehiculoPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Nuevo vehículo</h1>
      <VehiculoForm action={crearVehiculo} submitLabel="Crear vehículo" />
    </div>
  );
}
