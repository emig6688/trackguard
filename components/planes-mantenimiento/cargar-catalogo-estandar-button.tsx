"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cargarCatalogoEstandar } from "@/app/_actions/planMantenimientoEstandar";

export function CargarCatalogoEstandarButton() {
  const [pending, startTransition] = useTransition();
  const [resultado, setResultado] = useState<string | null>(null);

  function cargar() {
    startTransition(async () => {
      const { agregados } = await cargarCatalogoEstandar();
      setResultado(
        agregados === 0
          ? "No había tareas nuevas para agregar — el catálogo ya las tiene todas."
          : `Se agregaron ${agregados} tarea${agregados === 1 ? "" : "s"} nueva${agregados === 1 ? "" : "s"} al catálogo.`
      );
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="outline" size="sm" onClick={cargar} disabled={pending}>
        {pending ? "Cargando..." : "Cargar catálogo estándar"}
      </Button>
      {resultado && <p className="text-xs text-muted-foreground">{resultado}</p>}
    </div>
  );
}
