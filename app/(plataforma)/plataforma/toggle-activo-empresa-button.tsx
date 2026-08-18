"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { alternarActivoEmpresa } from "@/app/_actions/plataforma";

export function ToggleActivoEmpresaButton({
  empresaId,
  activo,
}: {
  empresaId: string;
  activo: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => startTransition(() => alternarActivoEmpresa(empresaId, !activo))}
    >
      {pending ? "Guardando..." : activo ? "Desactivar" : "Activar"}
    </Button>
  );
}
