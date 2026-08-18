"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { aplicarPlanEstandarAFlota } from "@/app/_actions/planesMantenimiento";

export function AplicarFlotaDialog({
  vehiculos,
}: {
  vehiculos: { id: string; patente: string; marca: string; modelo: string }[];
}) {
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [resultado, setResultado] = useState<string | null>(null);

  const todosSeleccionados = vehiculos.length > 0 && seleccionados.size === vehiculos.length;

  function alternarTodos() {
    setSeleccionados(todosSeleccionados ? new Set() : new Set(vehiculos.map((v) => v.id)));
  }

  function alternarVehiculo(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function aplicar() {
    startTransition(async () => {
      const resultadoAccion = await aplicarPlanEstandarAFlota([...seleccionados]);
      if (resultadoAccion) {
        setResultado(
          resultadoAccion.aplicados === 0
            ? `No había tareas nuevas para aplicar en ${resultadoAccion.vehiculos} vehículo${resultadoAccion.vehiculos === 1 ? "" : "s"}.`
            : `Se aplicaron ${resultadoAccion.aplicados} tarea${resultadoAccion.aplicados === 1 ? "" : "s"} nueva${resultadoAccion.aplicados === 1 ? "" : "s"} en ${resultadoAccion.vehiculos} vehículo${resultadoAccion.vehiculos === 1 ? "" : "s"}.`
        );
      }
    });
  }

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          setSeleccionados(new Set());
          setResultado(null);
        }
      }}
    >
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        Aplicar a flota
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aplicar plan estándar a flota</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Elegí a qué vehículos aplicarles las tareas del catálogo estándar que todavía no tengan
          cargadas — no duplica lo que ya existe.
        </p>

        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="size-4"
            checked={todosSeleccionados}
            onChange={alternarTodos}
          />
          Seleccionar todos ({vehiculos.length})
        </label>

        <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
          {vehiculos.map((v) => (
            <label key={v.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4"
                checked={seleccionados.has(v.id)}
                onChange={() => alternarVehiculo(v.id)}
              />
              <span className="font-medium">{v.patente}</span>
              <span className="text-muted-foreground">
                {v.marca} {v.modelo}
              </span>
            </label>
          ))}
          {vehiculos.length === 0 && (
            <p className="p-2 text-sm text-muted-foreground">No hay vehículos activos.</p>
          )}
        </div>

        {resultado && <p className="text-sm text-success">{resultado}</p>}

        <Button type="button" size="sm" disabled={pending || seleccionados.size === 0} onClick={aplicar}>
          {pending ? "Aplicando..." : `Aplicar a ${seleccionados.size} vehículo${seleccionados.size === 1 ? "" : "s"}`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
