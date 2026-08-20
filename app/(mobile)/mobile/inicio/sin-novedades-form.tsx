"use client";

import { useActionState } from "react";
import { CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cerrarRutaSinNovedades } from "@/app/_actions/eventosRuta";

export function SinNovedadesForm({ vehiculos }: { vehiculos: { id: string; patente: string }[] }) {
  const [state, formAction, pending] = useActionState(cerrarRutaSinNovedades, undefined);

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-lg border border-success/40 bg-success/5 p-4"
    >
      <div className="flex items-center gap-2">
        <CircleCheck className="size-5 shrink-0 text-success" strokeWidth={2} />
        <p className="font-medium">Cerrar ruta sin novedades</p>
      </div>
      <select
        name="vehiculoId"
        required
        className="w-full rounded-md border border-input bg-transparent p-2 text-sm"
      >
        <option value="">Elegí un vehículo</option>
        {vehiculos.map((v) => (
          <option key={v.id} value={v.id}>
            {v.patente}
          </option>
        ))}
      </select>
      <input
        name="kmAlMomento"
        type="number"
        inputMode="numeric"
        placeholder="Km actual (opcional)"
        className="w-full rounded-md border border-input bg-transparent p-2 text-sm"
      />
      <label className="flex items-center gap-2 text-sm">
        <input name="tanqueLleno" type="checkbox" className="size-4" />
        Tanque lleno
      </label>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" variant="secondary" className="w-full" disabled={pending}>
        {pending ? "Enviando..." : "Confirmar sin novedades"}
      </Button>
    </form>
  );
}
