"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { restaurarRegistroAction } from "@/app/_actions/papelera";
import type { TipoPapelera } from "@/lib/papelera";

export function RestaurarButton({ tipo, id }: { tipo: TipoPapelera; id: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => startTransition(() => restaurarRegistroAction(tipo, id))}
    >
      {pending ? "Restaurando..." : "Restaurar"}
    </Button>
  );
}
