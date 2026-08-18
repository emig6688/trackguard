"use client";

import { useActionState, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
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
import { EliminarButton } from "@/components/eliminar-button";
import {
  actualizarItemCatalogoEstandar,
  alternarActivoItemCatalogoEstandar,
  type ItemCatalogoFormState,
} from "@/app/_actions/planMantenimientoEstandar";

const LABEL_INTERVALO = { KM: "km", TIEMPO: "días", HORAS: "horas", AMBOS: "varios" };

type ItemCatalogo = {
  id: string;
  categoria: string;
  nombre: string;
  tipoIntervalo: "KM" | "TIEMPO" | "HORAS" | "AMBOS";
  intervaloKm: number | null;
  intervaloDias: number | null;
  intervaloHoras: number | null;
  activo: boolean;
};

function textoFrecuencia(item: ItemCatalogo) {
  const partes = [
    item.intervaloKm ? `cada ${item.intervaloKm.toLocaleString("es-AR")} km` : null,
    item.intervaloDias ? `cada ${item.intervaloDias} días` : null,
    item.intervaloHoras ? `cada ${item.intervaloHoras.toLocaleString("es-AR")} horas` : null,
  ].filter(Boolean);
  return partes.join(" o ") || "sin frecuencia definida";
}

export function ItemCatalogoRow({ item }: { item: ItemCatalogo }) {
  const [editando, setEditando] = useState(false);
  const [pendingToggle, startTransition] = useTransition();
  const actualizarConId = actualizarItemCatalogoEstandar.bind(null, item.id);
  const [state, formAction, pending] = useActionState<ItemCatalogoFormState, FormData>(
    actualizarConId,
    undefined
  );

  if (state?.success && editando) setEditando(false);

  if (editando) {
    const errors = state?.fieldErrors ?? {};
    return (
      <form action={formAction} className="space-y-3 rounded-lg border bg-muted/30 p-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor={`categoria-${item.id}`}>Categoría</Label>
            <Input id={`categoria-${item.id}`} name="categoria" defaultValue={item.categoria} required />
            {errors.categoria && <p className="text-xs text-destructive">{errors.categoria[0]}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor={`nombre-${item.id}`}>Nombre</Label>
            <Input id={`nombre-${item.id}`} name="nombre" defaultValue={item.nombre} required />
            {errors.nombre && <p className="text-xs text-destructive">{errors.nombre[0]}</p>}
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`tipoIntervalo-${item.id}`}>Se repite por</Label>
          <Select name="tipoIntervalo" defaultValue={item.tipoIntervalo}>
            <SelectTrigger id={`tipoIntervalo-${item.id}`} className="w-full">
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
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label htmlFor={`intervaloKm-${item.id}`}>Cada cuántos km</Label>
            <Input
              id={`intervaloKm-${item.id}`}
              name="intervaloKm"
              type="number"
              defaultValue={item.intervaloKm ?? ""}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`intervaloDias-${item.id}`}>Cada cuántos días</Label>
            <Input
              id={`intervaloDias-${item.id}`}
              name="intervaloDias"
              type="number"
              defaultValue={item.intervaloDias ?? ""}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`intervaloHoras-${item.id}`}>Cada cuántas horas</Label>
            <Input
              id={`intervaloHoras-${item.id}`}
              name="intervaloHoras"
              type="number"
              defaultValue={item.intervaloHoras ?? ""}
            />
          </div>
        </div>
        {state?.error && <p className="text-xs text-destructive">{state.error}</p>}
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Guardando..." : "Guardar"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setEditando(false)}>
            Cancelar
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
      <div>
        <p className="font-medium">{item.nombre}</p>
        <p className="text-muted-foreground">{textoFrecuencia(item)}</p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="secondary">{LABEL_INTERVALO[item.tipoIntervalo]}</Badge>
        <Badge variant={item.activo ? "success" : "secondary"}>
          {item.activo ? "Activa" : "Inactiva"}
        </Badge>
        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={pendingToggle}
          onClick={() =>
            startTransition(() => alternarActivoItemCatalogoEstandar(item.id, !item.activo))
          }
        >
          {item.activo ? "Desactivar" : "Activar"}
        </Button>
        <Button type="button" variant="outline" size="xs" onClick={() => setEditando(true)}>
          Editar
        </Button>
        <EliminarButton tipo="planMantenimientoEstandarItem" id={item.id} size="xs" />
      </div>
    </div>
  );
}
