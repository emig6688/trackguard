"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { aprobarCompra, rechazarCompra } from "@/app/_actions/compras";

export function AutorizacionAcciones({
  compraId,
  presupuestos,
}: {
  compraId: string;
  presupuestos: { id: string; proveedor: string | null }[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {presupuestos.map((p) => (
        <Button
          key={p.id}
          type="button"
          size="xs"
          disabled={pending}
          onClick={() => startTransition(() => aprobarCompra(compraId, p.id))}
        >
          Aprobar {p.proveedor ?? "este presupuesto"}
        </Button>
      ))}
      <Button
        type="button"
        size="xs"
        variant="outline"
        disabled={pending}
        onClick={() => startTransition(() => aprobarCompra(compraId))}
      >
        Aprobar sin elegir presupuesto
      </Button>
      <Button
        type="button"
        size="xs"
        variant="destructive"
        disabled={pending}
        onClick={() => startTransition(() => rechazarCompra(compraId))}
      >
        Rechazar
      </Button>
    </div>
  );
}
