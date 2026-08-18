"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { iniciarOT } from "@/app/_actions/ordenesTrabajo";

export function IniciarOTForm({ otId }: { otId: string }) {
  return (
    <form
      action={iniciarOT.bind(null, otId)}
      className="flex flex-wrap items-end gap-2 rounded-lg border p-3"
    >
      <div className="space-y-2">
        <Label htmlFor="fechaEstimadaFinalizacion">Fecha estimada de finalización</Label>
        <Input id="fechaEstimadaFinalizacion" name="fechaEstimadaFinalizacion" type="date" required />
      </div>
      <Button type="submit">Iniciar trabajo</Button>
    </form>
  );
}
