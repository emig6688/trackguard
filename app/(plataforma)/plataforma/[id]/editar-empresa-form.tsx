"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { actualizarEmpresa, type ActualizarEmpresaState } from "@/app/_actions/plataforma";

export function EditarEmpresaForm({
  empresaId,
  defaultValues,
}: {
  empresaId: string;
  defaultValues: {
    nombre: string;
    emailContacto: string | null;
    telefono: string | null;
    direccion: string | null;
    contactoNombre: string | null;
  };
}) {
  const action = actualizarEmpresa.bind(null, empresaId);
  const [state, formAction, pending] = useActionState<ActualizarEmpresaState, FormData>(
    action,
    undefined
  );
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nombre">Nombre de la empresa</Label>
        <Input id="nombre" name="nombre" defaultValue={defaultValues.nombre} required />
        {errors.nombre && <p className="text-sm text-destructive">{errors.nombre[0]}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="contactoNombre">Nombre de contacto</Label>
        <Input
          id="contactoNombre"
          name="contactoNombre"
          defaultValue={defaultValues.contactoNombre ?? ""}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="emailContacto">Email de contacto</Label>
        <Input
          id="emailContacto"
          name="emailContacto"
          type="email"
          defaultValue={defaultValues.emailContacto ?? ""}
        />
        {errors.emailContacto && (
          <p className="text-sm text-destructive">{errors.emailContacto[0]}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="telefono">Teléfono</Label>
        <Input id="telefono" name="telefono" defaultValue={defaultValues.telefono ?? ""} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="direccion">Dirección</Label>
        <Input id="direccion" name="direccion" defaultValue={defaultValues.direccion ?? ""} />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  );
}
