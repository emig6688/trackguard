"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { registrarChecklist } from "@/app/_actions/checklists";

type Item = { id: string; texto: string };

export function ChecklistForm({
  vehiculos,
  templateId,
  items,
}: {
  vehiculos: { id: string; patente: string }[];
  templateId: string;
  items: Item[];
}) {
  const [state, formAction, pending] = useActionState(registrarChecklist, undefined);

  return (
    <form action={formAction} className="space-y-6">
      <h1 className="text-lg font-semibold">Checklist pre-salida</h1>

      <input type="hidden" name="templateId" value={templateId} />
      <input type="hidden" name="momento" value="PRESALIDA" />

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
        <Label htmlFor="kmAlMomento">Km actual (opcional)</Label>
        <Input id="kmAlMomento" name="kmAlMomento" type="number" inputMode="numeric" />
      </div>

      <div className="space-y-4">
        {items.map((item) => (
          <fieldset key={item.id} className="space-y-2 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">{item.texto}</legend>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-1">
                <input type="radio" name={`resultado_${item.id}`} value="OK" defaultChecked />
                OK
              </label>
              <label className="flex items-center gap-1">
                <input type="radio" name={`resultado_${item.id}`} value="FALLA" />
                Falla
              </label>
              <label className="flex items-center gap-1">
                <input type="radio" name={`resultado_${item.id}`} value="NO_APLICA" />
                N/A
              </label>
            </div>
            <Textarea
              name={`observacion_${item.id}`}
              placeholder="Observación (opcional)"
              className="text-sm"
            />
          </fieldset>
        ))}
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Enviando..." : "Enviar checklist"}
      </Button>
    </form>
  );
}
