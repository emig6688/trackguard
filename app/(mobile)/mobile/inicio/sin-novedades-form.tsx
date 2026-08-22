"use client";

import { useActionState } from "react";
import { CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cerrarRutaSinNovedades } from "@/app/_actions/eventosRuta";

export function SinNovedadesForm({
  vehiculos,
  vehiculoActivo,
  bloqueado,
  motivo,
}: {
  vehiculos: { id: string; patente: string }[];
  vehiculoActivo?: { id: string; patente: string } | null;
  bloqueado?: boolean;
  motivo?: string;
}) {
  const [state, formAction, pending] = useActionState(cerrarRutaSinNovedades, undefined);

  if (bloqueado) {
    return (
      <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/5 p-4 text-muted-foreground">
        <div className="flex items-center gap-2">
          <CircleCheck className="size-5 shrink-0 opacity-50" strokeWidth={2} />
          <p className="font-medium opacity-50">Cerrar ruta sin novedades</p>
        </div>
        <p className="text-sm">{motivo}</p>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-lg border border-success/40 bg-success/5 p-4"
    >
      <div className="flex items-center gap-2">
        <CircleCheck className="size-5 shrink-0 text-success" strokeWidth={2} />
        <p className="font-medium">Cerrar ruta sin novedades</p>
      </div>
      {vehiculoActivo ? (
        <>
          <input type="hidden" name="vehiculoId" value={vehiculoActivo.id} />
          <p className="rounded-md border bg-background p-2 text-sm font-medium">
            {vehiculoActivo.patente}{" "}
            <span className="font-normal text-muted-foreground">(el que usaste en tu checklist de hoy)</span>
          </p>
        </>
      ) : (
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
      )}
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
