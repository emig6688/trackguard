"use client";

import { useActionState, useEffect, useRef } from "react";
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
import {
  crearItemCatalogoEstandar,
  type ItemCatalogoFormState,
} from "@/app/_actions/planMantenimientoEstandar";

export function ItemCatalogoForm() {
  const [state, formAction, pending] = useActionState<ItemCatalogoFormState, FormData>(
    crearItemCatalogoEstandar,
    undefined
  );
  const errors = state?.fieldErrors ?? {};
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4 rounded-lg border p-4">
      <h2 className="text-sm font-semibold">Agregar tarea al catálogo estándar</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="categoria">Categoría</Label>
          <Input id="categoria" name="categoria" placeholder="Ej: Sistema de motor" required />
          {errors.categoria && <p className="text-sm text-destructive">{errors.categoria[0]}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="nombre">Nombre de la tarea</Label>
          <Input id="nombre" name="nombre" placeholder="Ej: Cambio de aceite" required />
          {errors.nombre && <p className="text-sm text-destructive">{errors.nombre[0]}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tipoIntervalo">Se repite por</Label>
        <Select name="tipoIntervalo" defaultValue="KM">
          <SelectTrigger id="tipoIntervalo" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="KM">Kilómetros</SelectItem>
            <SelectItem value="TIEMPO">Tiempo</SelectItem>
            <SelectItem value="HORAS">Horas de equipo de frío</SelectItem>
            <SelectItem value="AMBOS">Varios (lo que ocurra primero)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="intervaloKm">Cada cuántos km</Label>
          <Input id="intervaloKm" name="intervaloKm" type="number" placeholder="Ej: 10000" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="intervaloDias">Cada cuántos días</Label>
          <Input id="intervaloDias" name="intervaloDias" type="number" placeholder="Ej: 180" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="intervaloHoras">Cada cuántas horas</Label>
          <Input id="intervaloHoras" name="intervaloHoras" type="number" placeholder="Ej: 1500" />
        </div>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-600">Tarea agregada al catálogo.</p>}

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Guardando..." : "Agregar tarea"}
      </Button>
    </form>
  );
}
