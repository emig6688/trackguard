"use client";

import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { marcarDiaNoOperado, desmarcarDiaNoOperado } from "@/app/_actions/guardia";

export function DiaNoOperadoControl({
  vehiculoId,
  marcado,
}: {
  vehiculoId: string;
  marcado: { choferNombre: string | null } | null;
}) {
  const [pending, startTransition] = useTransition();

  if (marcado) {
    return (
      <div className="space-y-1">
        <Badge variant="outline" className="block w-fit">
          No operó{marcado.choferNombre ? ` — ${marcado.choferNombre}` : ""}
        </Badge>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          disabled={pending}
          onClick={() => startTransition(() => desmarcarDiaNoOperado(vehiculoId))}
        >
          Deshacer
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      size="xs"
      variant="outline"
      disabled={pending}
      onClick={() => startTransition(() => marcarDiaNoOperado(vehiculoId, new FormData()))}
    >
      {pending ? "Guardando..." : "No salió a reparto"}
    </Button>
  );
}
