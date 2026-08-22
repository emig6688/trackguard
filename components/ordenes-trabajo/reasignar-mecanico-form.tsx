"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { reasignarMecanico } from "@/app/_actions/ordenesTrabajo";

export function ReasignarMecanicoForm({
  otId,
  asignadoActualId,
  mecanicos,
}: {
  otId: string;
  asignadoActualId: string | null;
  mecanicos: { id: string; nombre: string }[];
}) {
  const [state, formAction, pending] = useActionState(reasignarMecanico.bind(null, otId), undefined);
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setAbierto(true)}>
        Reasignar mecánico
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
      <div className="space-y-2">
        <Label htmlFor="reasignar-asignadoAId">Nuevo mecánico</Label>
        <Select name="asignadoAId" defaultValue={asignadoActualId ?? undefined}>
          <SelectTrigger id="reasignar-asignadoAId" className="w-48">
            <SelectValue placeholder="Elegí un mecánico">
              {(value: string) => mecanicos.find((m) => m.id === value)?.nombre ?? "Elegí un mecánico"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {mecanicos.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state?.fieldErrors?.asignadoAId && (
          <p className="text-sm text-destructive">{state.fieldErrors.asignadoAId[0]}</p>
        )}
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Reasignando..." : "Confirmar"}
      </Button>
      <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>
        Cancelar
      </Button>
    </form>
  );
}
