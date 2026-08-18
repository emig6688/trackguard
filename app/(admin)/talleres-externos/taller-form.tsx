"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TallerFormState } from "@/app/_actions/talleres-externos";

export function TallerForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (prevState: TallerFormState, formData: FormData) => Promise<TallerFormState>;
  defaultValues?: {
    nombre?: string;
    contactoNombre?: string | null;
    telefono?: string | null;
    email?: string | null;
    direccion?: string | null;
    especialidad?: string | null;
  };
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nombre">Nombre del taller</Label>
        <Input id="nombre" name="nombre" defaultValue={defaultValues?.nombre} required />
        {errors.nombre && <p className="text-sm text-destructive">{errors.nombre[0]}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="contactoNombre">Contacto</Label>
          <Input
            id="contactoNombre"
            name="contactoNombre"
            defaultValue={defaultValues?.contactoNombre ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="telefono">Teléfono</Label>
          <Input id="telefono" name="telefono" defaultValue={defaultValues?.telefono ?? ""} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" defaultValue={defaultValues?.email ?? ""} />
        {errors.email && <p className="text-sm text-destructive">{errors.email[0]}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="direccion">Dirección</Label>
        <Input id="direccion" name="direccion" defaultValue={defaultValues?.direccion ?? ""} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="especialidad">Especialidad</Label>
        <Input
          id="especialidad"
          name="especialidad"
          defaultValue={defaultValues?.especialidad ?? ""}
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Guardando..." : submitLabel}
      </Button>
    </form>
  );
}
