"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { aplicarPlanEstandar } from "@/app/_actions/planesMantenimiento";

export function AplicarPlanEstandarButton({
  vehiculoId,
  redirectPath,
}: {
  vehiculoId: string;
  redirectPath: string;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const onConfirmar = () => {
    startTransition(async () => {
      const resultado = await aplicarPlanEstandar(vehiculoId, redirectPath);
      setConfirmando(false);
      setMensaje(
        resultado && resultado.aplicados > 0
          ? `Se agregaron ${resultado.aplicados} tareas nuevas.`
          : "Este vehículo ya tenía cargado todo el plan estándar."
      );
    });
  };

  if (confirmando) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">
          Se cargarán las tareas estándar que falten. ¿Confirmar?
        </span>
        <Button type="button" size="sm" onClick={onConfirmar} disabled={pending}>
          {pending ? "Aplicando..." : "Sí, aplicar"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setConfirmando(false)}
          disabled={pending}
        >
          Cancelar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" size="sm" onClick={() => setConfirmando(true)}>
        Aplicar plan estándar
      </Button>
      {mensaje && <p className="text-sm text-muted-foreground">{mensaje}</p>}
    </div>
  );
}
