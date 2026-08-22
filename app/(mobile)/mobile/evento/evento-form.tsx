"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { registrarEventoRuta } from "@/app/_actions/eventosRuta";

export function EventoForm({
  vehiculos,
  vehiculoActivo,
}: {
  vehiculos: { id: string; patente: string }[];
  vehiculoActivo?: { id: string; patente: string } | null;
}) {
  const [state, formAction, pending] = useActionState(registrarEventoRuta, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <h1 className="text-lg font-semibold">Cierre de ruta</h1>
      <p className="text-sm text-muted-foreground">
        Contanos qué pasó — se genera una orden de trabajo para que el encargado de mantenimiento
        lo revise.
      </p>

      <input type="hidden" name="tipo" value="DESPERFECTO" />

      <div className="space-y-2">
        <Label htmlFor="vehiculoId">Vehículo</Label>
        {vehiculoActivo ? (
          <>
            <input type="hidden" name="vehiculoId" value={vehiculoActivo.id} />
            <p className="rounded-md border bg-muted/40 p-2 text-sm font-medium">
              {vehiculoActivo.patente}{" "}
              <span className="font-normal text-muted-foreground">(el que usaste en tu checklist de hoy)</span>
            </p>
          </>
        ) : (
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
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="descripcion">Descripción</Label>
        <Textarea id="descripcion" name="descripcion" required rows={4} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="kmAlMomento">Km actual (opcional)</Label>
        <Input id="kmAlMomento" name="kmAlMomento" type="number" inputMode="numeric" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="archivo">Foto (opcional)</Label>
        <Input id="archivo" name="archivo" type="file" accept="image/*" />
      </div>

      <div className="flex items-center gap-2 rounded-md border p-3">
        <input id="tanqueLleno" name="tanqueLleno" type="checkbox" className="size-4" />
        <Label htmlFor="tanqueLleno" className="font-normal">
          Tanque lleno
        </Label>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Enviando..." : "Enviar reporte"}
      </Button>
    </form>
  );
}
