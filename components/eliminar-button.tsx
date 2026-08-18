"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { eliminarRegistroAction } from "@/app/_actions/papelera";
import type { TipoPapelera } from "@/lib/papelera";

export function EliminarButton({
  tipo,
  id,
  redirectPath,
  label = "Eliminar",
  size = "sm",
}: {
  tipo: TipoPapelera;
  id: string;
  redirectPath?: string;
  label?: string;
  size?: "xs" | "sm" | "default";
}) {
  const [pending, startTransition] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const router = useRouter();

  const onConfirmar = () => {
    startTransition(async () => {
      await eliminarRegistroAction(tipo, id, redirectPath);
      if (redirectPath) router.push(redirectPath);
    });
  };

  if (confirmando) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Se puede restaurar desde la papelera. ¿Eliminar?</span>
        <Button type="button" size={size} variant="destructive" onClick={onConfirmar} disabled={pending}>
          {pending ? "Eliminando..." : "Sí, eliminar"}
        </Button>
        <Button
          type="button"
          size={size}
          variant="outline"
          onClick={() => setConfirmando(false)}
          disabled={pending}
        >
          Cancelar
        </Button>
      </span>
    );
  }

  return (
    <Button
      type="button"
      size={size}
      variant="ghost"
      className="text-destructive hover:text-destructive"
      onClick={() => setConfirmando(true)}
    >
      {label}
    </Button>
  );
}
