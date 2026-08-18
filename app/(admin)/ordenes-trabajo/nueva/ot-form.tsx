"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { crearOTManual } from "@/app/_actions/ordenesTrabajo";
import { AREA_REPARACION_LABEL } from "@/lib/clasificador-averias";

export function OTForm({
  vehiculos,
  mecanicos,
}: {
  vehiculos: { id: string; patente: string }[];
  mecanicos: { id: string; nombre: string }[];
}) {
  const [state, formAction, pending] = useActionState(crearOTManual, undefined);
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      <div className="space-y-2">
        <Label htmlFor="vehiculoId">Vehículo</Label>
        <Select name="vehiculoId">
          <SelectTrigger id="vehiculoId" className="w-full">
            <SelectValue placeholder="Elegí un vehículo">
              {(value: string) => vehiculos.find((v) => v.id === value)?.patente ?? "Elegí un vehículo"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {vehiculos.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.patente}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.vehiculoId && <p className="text-sm text-destructive">{errors.vehiculoId[0]}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="titulo">Título</Label>
        <Input id="titulo" name="titulo" required />
        {errors.titulo && <p className="text-sm text-destructive">{errors.titulo[0]}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="descripcion">Descripción</Label>
        <Textarea id="descripcion" name="descripcion" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="prioridad">Prioridad</Label>
          <Select name="prioridad" defaultValue="MEDIA">
            <SelectTrigger id="prioridad" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BAJA">Baja</SelectItem>
              <SelectItem value="MEDIA">Media</SelectItem>
              <SelectItem value="ALTA">Alta</SelectItem>
              <SelectItem value="URGENTE">Urgente</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="fechaLimite">Fecha límite</Label>
          <Input id="fechaLimite" name="fechaLimite" type="date" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="areaReparacion">Área de reparación (opcional)</Label>
        <Select name="areaReparacion">
          <SelectTrigger id="areaReparacion" className="w-full">
            <SelectValue placeholder="Sin especificar" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(AREA_REPARACION_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="asignadoAId">Asignar a mecánico (opcional)</Label>
        <Select name="asignadoAId">
          <SelectTrigger id="asignadoAId" className="w-full">
            <SelectValue placeholder="Sin asignar">
              {(value: string) => mecanicos.find((m) => m.id === value)?.nombre ?? "Sin asignar"}
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
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Creando..." : "Crear orden de trabajo"}
      </Button>
    </form>
  );
}
