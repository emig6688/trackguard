"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { completarOT, type CompletarOTState } from "@/app/_actions/ordenesTrabajo";

export function CompletarOTForm({ otId }: { otId: string }) {
  const action = completarOT.bind(null, otId);
  const [state, formAction, pending] = useActionState<CompletarOTState, FormData>(action, undefined);

  return (
    <form action={formAction} className="space-y-4 rounded-lg border p-4">
      <h3 className="font-medium">Completar orden de trabajo</h3>
      <div className="space-y-2">
        <Label htmlFor="observacionesMecanico">Observaciones</Label>
        <Textarea id="observacionesMecanico" name="observacionesMecanico" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="fotoReparacion">Foto de la reparación</Label>
        <Input id="fotoReparacion" name="fotoReparacion" type="file" accept="image/*" capture="environment" />
      </div>
      <p className="text-xs text-muted-foreground">
        Cargá al menos una observación o una foto para poder completar la OT.
      </p>
      <div className="space-y-2 max-w-xs">
        <Label htmlFor="tiempoInsumidoMinutos">Tiempo insumido (minutos)</Label>
        <Input id="tiempoInsumidoMinutos" name="tiempoInsumidoMinutos" type="number" />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Completando..." : "Completar"}
      </Button>
    </form>
  );
}
