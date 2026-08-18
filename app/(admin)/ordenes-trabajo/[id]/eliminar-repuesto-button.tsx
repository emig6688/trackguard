"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { eliminarRepuestoUsado } from "@/app/_actions/ordenesTrabajo";

export function EliminarRepuestoButton({ otId, repuestoId }: { otId: string; repuestoId: string }) {
  const [pending, startTransition] = useTransition();
  const [confirmando, setConfirmando] = useState(false);

  const onConfirmar = () => {
    startTransition(() => eliminarRepuestoUsado(otId, repuestoId));
  };

  if (confirmando) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">¿Sacar este repuesto?</span>
        <Button type="button" size="xs" variant="destructive" onClick={onConfirmar} disabled={pending}>
          {pending ? "Sacando..." : "Sí"}
        </Button>
        <Button type="button" size="xs" variant="outline" onClick={() => setConfirmando(false)} disabled={pending}>
          Cancelar
        </Button>
      </span>
    );
  }

  return (
    <Button
      type="button"
      size="xs"
      variant="ghost"
      className="text-destructive hover:text-destructive"
      onClick={() => setConfirmando(true)}
    >
      Quitar
    </Button>
  );
}
