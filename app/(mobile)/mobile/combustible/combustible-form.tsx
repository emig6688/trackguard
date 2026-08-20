"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registrarCargaCombustible } from "@/app/_actions/combustible";

export function CombustibleForm({ vehiculos }: { vehiculos: { id: string; patente: string }[] }) {
  const [state, formAction, pending] = useActionState(registrarCargaCombustible, undefined);

  if (state?.success) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-lg font-semibold">Carga registrada</h1>
        {state.kmRecorridos != null && state.consumoL100km != null ? (
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Km recorridos desde la última carga</p>
            <p className="text-2xl font-semibold">{state.kmRecorridos} km</p>
            <p className="mt-2 text-sm text-muted-foreground">Consumo</p>
            <p className="text-2xl font-semibold">{state.consumoL100km} L/100km</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Es la primera carga registrada para este vehículo, todavía no hay consumo para calcular.
          </p>
        )}
        <a href="/mobile/inicio" className="block underline">
          Volver al inicio
        </a>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <h1 className="text-lg font-semibold">Cargar combustible</h1>

      <div className="space-y-2">
        <Label htmlFor="vehiculoId">Vehículo</Label>
        <select
          id="vehiculoId"
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
      </div>

      <div className="space-y-2">
        <Label htmlFor="archivoTicket">Foto del ticket</Label>
        <Input id="archivoTicket" name="archivoTicket" type="file" accept="image/*" capture="environment" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="kmOdometro">Km actual del odómetro</Label>
        <Input id="kmOdometro" name="kmOdometro" type="number" inputMode="numeric" required />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="litrosCargados">Litros</Label>
          <Input id="litrosCargados" name="litrosCargados" type="number" step="0.01" inputMode="decimal" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="montoTotal">Monto total</Label>
          <Input id="montoTotal" name="montoTotal" type="number" step="0.01" inputMode="decimal" required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="estacionServicio">Estación de servicio (opcional)</Label>
        <Input id="estacionServicio" name="estacionServicio" />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Guardando..." : "Guardar carga"}
      </Button>
    </form>
  );
}
