"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { crearEmpresa } from "@/app/_actions/plataforma";

export function EmpresaForm() {
  const [state, formAction, pending] = useActionState(crearEmpresa, undefined);
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nombreEmpresa">Nombre de la empresa</Label>
        <Input id="nombreEmpresa" name="nombreEmpresa" required />
        {errors.nombreEmpresa && (
          <p className="text-sm text-destructive">{errors.nombreEmpresa[0]}</p>
        )}
      </div>

      <div className="space-y-2 border-t pt-4">
        <p className="text-sm font-medium">Primer usuario administrador</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="nombreAdmin">Nombre</Label>
        <Input id="nombreAdmin" name="nombreAdmin" required />
        {errors.nombreAdmin && <p className="text-sm text-destructive">{errors.nombreAdmin[0]}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
        {errors.email && <p className="text-sm text-destructive">{errors.email[0]}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input id="password" name="password" type="password" required minLength={6} />
        {errors.password && <p className="text-sm text-destructive">{errors.password[0]}</p>}
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Creando..." : "Crear empresa"}
      </Button>
    </form>
  );
}
