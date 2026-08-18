"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ArticuloFormState } from "@/app/_actions/panol";

export function ArticuloForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (prevState: ArticuloFormState, formData: FormData) => Promise<ArticuloFormState>;
  defaultValues?: {
    nombre?: string;
    descripcion?: string | null;
    unidadMedida?: string | null;
    stockActual?: number;
    stockMinimo?: number;
  };
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nombre">Nombre del artículo</Label>
        <Input id="nombre" name="nombre" defaultValue={defaultValues?.nombre} required />
        {errors.nombre && <p className="text-sm text-destructive">{errors.nombre[0]}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="descripcion">Descripción (opcional)</Label>
        <Textarea id="descripcion" name="descripcion" defaultValue={defaultValues?.descripcion ?? ""} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="unidadMedida">Unidad</Label>
          <Input
            id="unidadMedida"
            name="unidadMedida"
            placeholder="Ej: unidad, litro"
            defaultValue={defaultValues?.unidadMedida ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="stockActual">Stock actual</Label>
          <Input
            id="stockActual"
            name="stockActual"
            type="number"
            defaultValue={defaultValues?.stockActual ?? 0}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="stockMinimo">Stock mínimo</Label>
          <Input
            id="stockMinimo"
            name="stockMinimo"
            type="number"
            defaultValue={defaultValues?.stockMinimo ?? 0}
          />
        </div>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Guardando..." : submitLabel}
      </Button>
    </form>
  );
}
