"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { actualizarAdminEmpresa, type ActualizarAdminEmpresaState } from "@/app/_actions/plataforma";

export function EditarAdminForm({
  empresaId,
  usuarioId,
  defaultValues,
}: {
  empresaId: string;
  usuarioId: string;
  defaultValues: { nombre: string; email: string; telefono: string | null };
}) {
  const action = actualizarAdminEmpresa.bind(null, usuarioId, empresaId);
  const [state, formAction, pending] = useActionState<ActualizarAdminEmpresaState, FormData>(
    action,
    undefined
  );
  const errors = state?.fieldErrors ?? {};
  const [mostrarPassword, setMostrarPassword] = useState(false);

  return (
    <form action={formAction} className="max-w-md space-y-4 rounded-lg border p-4">
      <div className="space-y-2">
        <Label htmlFor={`nombre-${usuarioId}`}>Nombre</Label>
        <Input id={`nombre-${usuarioId}`} name="nombre" defaultValue={defaultValues.nombre} required />
        {errors.nombre && <p className="text-sm text-destructive">{errors.nombre[0]}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`email-${usuarioId}`}>Usuario de ingreso (email)</Label>
        <Input
          id={`email-${usuarioId}`}
          name="email"
          type="email"
          defaultValue={defaultValues.email}
          required
        />
        {errors.email && <p className="text-sm text-destructive">{errors.email[0]}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`telefono-${usuarioId}`}>Teléfono</Label>
        <Input
          id={`telefono-${usuarioId}`}
          name="telefono"
          defaultValue={defaultValues.telefono ?? ""}
        />
      </div>

      {mostrarPassword ? (
        <div className="space-y-2">
          <Label htmlFor={`password-${usuarioId}`}>Nueva contraseña</Label>
          <Input id={`password-${usuarioId}`} name="password" type="password" minLength={6} />
          {errors.password && <p className="text-sm text-destructive">{errors.password[0]}</p>}
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setMostrarPassword(true)}>
          Resetear contraseña
        </Button>
      )}

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
