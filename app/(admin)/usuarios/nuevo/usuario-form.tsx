"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UsuarioFormState } from "@/app/_actions/usuarios";

const ROLES = [
  { value: "ADMIN", label: "Admin" },
  { value: "ENCARGADO_MANTENIMIENTO", label: "Encargado de mantenimiento" },
  { value: "ENCARGADO_COMPRAS", label: "Encargado de compras" },
  { value: "MECANICO_INTERNO", label: "Mecánico interno" },
  { value: "GERENTE", label: "Gerente" },
  { value: "CONTADOR", label: "Contador" },
  { value: "GUARDIA", label: "Guardia" },
];

export function UsuarioForm({
  action,
  modo,
  defaultValues,
  submitLabel,
}: {
  action: (prevState: UsuarioFormState, formData: FormData) => Promise<UsuarioFormState>;
  modo: "crear" | "editar";
  defaultValues?: {
    nombre?: string;
    email?: string;
    dni?: string | null;
    telefono?: string | null;
    rol?: string;
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
        <Input id="email" name="email" type="email" defaultValue={defaultValues?.email} required />
        {errors.email && <p className="text-sm text-destructive">{errors.email[0]}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="dni">DNI</Label>
        <Input id="dni" name="dni" defaultValue={defaultValues?.dni ?? ""} />
        <p className="text-xs text-muted-foreground">
          Permite ingresar al sistema con el DNI en vez del email.
        </p>
        {errors.dni && <p className="text-sm text-destructive">{errors.dni[0]}</p>}
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

      <div className="space-y-2">
        <Label htmlFor="telefono">Teléfono</Label>
        <Input id="telefono" name="telefono" defaultValue={defaultValues?.telefono ?? ""} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="rol">Rol</Label>
        <Select name="rol" defaultValue={defaultValues?.rol ?? "MECANICO_INTERNO"}>
          <SelectTrigger id="rol" className="w-full">
            <SelectValue>
              {(value: string) => ROLES.find((r) => r.value === value)?.label ?? value}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Guardando..." : submitLabel}
      </Button>
    </form>
  );
}
