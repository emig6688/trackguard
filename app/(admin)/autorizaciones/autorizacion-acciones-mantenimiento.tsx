"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { aprobarCompraMantenimiento, rechazarCompraMantenimiento } from "@/app/_actions/compras";

export function AutorizacionAccionesMantenimiento({ compraId }: { compraId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="xs"
        disabled={pending}
        onClick={() => startTransition(() => aprobarCompraMantenimiento(compraId))}
      >
        Aprobar
      </Button>
      <Button
        type="button"
        size="xs"
        variant="destructive"
        disabled={pending}
        onClick={() => startTransition(() => rechazarCompraMantenimiento(compraId))}
      >
        Rechazar
      </Button>
    </div>
  );
}
