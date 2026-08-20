"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ChoferFormState } from "@/app/_actions/choferes";

export function ChoferForm({
  action,
  modo,
  defaultValues,
  submitLabel,
}: {
  action: (prevState: ChoferFormState, formData: FormData) => Promise<ChoferFormState>;
  modo: "crear" | "editar";
  defaultValues?: {
    nombre?: string;
    email?: string;
    dni?: string | null;
    telefono?: string | null;
    numeroLicencia?: string | null;
    categoriaLicencia?: string | null;
    legajo?: string | null;
    fechaIngreso?: Date | null;
  };
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nombre">Nombre completo</Label>
        <Input id="nombre" name="nombre" defaultValue={defaultValues?.nombre} required />
        {errors.nombre && <p className="text-sm text-destructive">{errors.nombre[0]}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          defaultValue={defaultValues?.email}
          required
        />
        {errors.email && <p className="text-sm text-destructive">{errors.email[0]}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">
          {modo === "crear" ? "Contraseña inicial" : "Nueva contraseña"}
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          required={modo === "crear"}
          placeholder={modo === "editar" ? "Dejar en blanco para no cambiarla" : ""}
        />
        {errors.password && <p className="text-sm text-destructive">{errors.password[0]}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="dni">DNI</Label>
          <Input id="dni" name="dni" defaultValue={defaultValues?.dni ?? ""} />
          <p className="text-xs text-muted-foreground">
            El chofer puede ingresar al sistema con su DNI en vez de email.
          </p>
          {errors.dni && <p className="text-sm text-destructive">{errors.dni[0]}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="telefono">Teléfono</Label>
          <Input id="telefono" name="telefono" defaultValue={defaultValues?.telefono ?? ""} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="numeroLicencia">N° de licencia</Label>
          <Input
            id="numeroLicencia"
            name="numeroLicencia"
            defaultValue={defaultValues?.numeroLicencia ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="categoriaLicencia">Categoría</Label>
          <Input
            id="categoriaLicencia"
            name="categoriaLicencia"
            defaultValue={defaultValues?.categoriaLicencia ?? ""}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="legajo">Legajo</Label>
          <Input id="legajo" name="legajo" defaultValue={defaultValues?.legajo ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fechaIngreso">Fecha de ingreso</Label>
          <Input
            id="fechaIngreso"
            name="fechaIngreso"
            type="date"
            defaultValue={
              defaultValues?.fechaIngreso
                ? defaultValues.fechaIngreso.toISOString().slice(0, 10)
                : ""
            }
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
