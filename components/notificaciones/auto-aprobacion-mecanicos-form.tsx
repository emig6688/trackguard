"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { actualizarAutoAprobacionMecanicos } from "@/app/_actions/reglasNotificacion";

export function AutoAprobacionMecanicosForm({ activoInicial }: { activoInicial: boolean }) {
  const [activo, setActivo] = useState(activoInicial);
  const [pending, startTransition] = useTransition();
  const [guardado, setGuardado] = useState(false);

  function guardar() {
    startTransition(async () => {
      await actualizarAutoAprobacionMecanicos(activo);
      setGuardado(true);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => {
          setGuardado(false);
          setActivo((v) => !v);
        }}
      >
        <Badge variant={activo ? "success" : "secondary"}>{activo ? "Función activa" : "Función desactivada"}</Badge>
      </button>
      <Button type="button" size="sm" disabled={pending || activo === activoInicial} onClick={guardar}>
        {pending ? "Guardando..." : "Guardar"}
      </Button>
      {guardado && <span className="text-xs text-success">Guardado.</span>}
    </div>
  );
}
