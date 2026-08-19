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
import type { VehiculoFormState } from "@/app/_actions/vehiculos";

const TIPOS_VEHICULO = ["CAMION", "ACOPLADO", "UTILITARIO", "OTRO"] as const;

export function VehiculoForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (prevState: VehiculoFormState, formData: FormData) => Promise<VehiculoFormState>;
  defaultValues?: {
    patente?: string;
    marca?: string;
    modelo?: string;
    anio?: number | null;
    tipo?: string;
    numeroInterno?: string | null;
    kmActual?: number;
    horasEquipoFrio?: number | null;
    tipoCarroceria?: string | null;
    equipoFrioTipo?: string | null;
  };
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      <div className="space-y-2">
        <Label htmlFor="patente">Patente</Label>
        <Input id="patente" name="patente" defaultValue={defaultValues?.patente} required />
        {errors.patente && <p className="text-sm text-destructive">{errors.patente[0]}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="marca">Marca</Label>
          <Input id="marca" name="marca" defaultValue={defaultValues?.marca} required />
          {errors.marca && <p className="text-sm text-destructive">{errors.marca[0]}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="modelo">Modelo</Label>
          <Input id="modelo" name="modelo" defaultValue={defaultValues?.modelo} required />
          {errors.modelo && <p className="text-sm text-destructive">{errors.modelo[0]}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="anio">Año</Label>
          <Input id="anio" name="anio" type="number" defaultValue={defaultValues?.anio ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tipo">Tipo</Label>
          <Select name="tipo" defaultValue={defaultValues?.tipo ?? "CAMION"}>
            <SelectTrigger id="tipo" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_VEHICULO.map((tipo) => (
                <SelectItem key={tipo} value={tipo}>
                  {tipo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="numeroInterno">Número interno</Label>
          <Input
            id="numeroInterno"
            name="numeroInterno"
            defaultValue={defaultValues?.numeroInterno ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="kmActual">Km actual</Label>
          <Input
            id="kmActual"
            name="kmActual"
            type="number"
            defaultValue={defaultValues?.kmActual ?? 0}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="horasEquipoFrio">Horas del equipo de frío</Label>
          <Input
            id="horasEquipoFrio"
            name="horasEquipoFrio"
            type="number"
            placeholder="Horómetro del motor auxiliar"
            defaultValue={defaultValues?.horasEquipoFrio ?? ""}
          />
          <p className="text-xs text-muted-foreground">
            Se suma solo automáticamente con cada checklist pre-salida → cierre del chofer. Editar
            acá corrige el valor a mano, pero no reemplaza esa carga automática.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="equipoFrioTipo">Tipo de equipo de frío</Label>
          <Input
            id="equipoFrioTipo"
            name="equipoFrioTipo"
            placeholder="Ej: Termoking autónomo"
            defaultValue={defaultValues?.equipoFrioTipo ?? ""}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tipoCarroceria">Tipo de carrocería</Label>
        <Input
          id="tipoCarroceria"
          name="tipoCarroceria"
          placeholder="Ej: Balancín, Chasis"
          defaultValue={defaultValues?.tipoCarroceria ?? ""}
        />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Guardando..." : submitLabel}
      </Button>
    </form>
  );
}
