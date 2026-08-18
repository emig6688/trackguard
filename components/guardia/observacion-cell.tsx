"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { guardarObservacionGuardia } from "@/app/_actions/guardia";
import type { EtapaObservacionGuardia } from "@/app/generated/prisma/client";

export function ObservacionCell({
  vehiculoId,
  etapa,
  valorInicial,
}: {
  vehiculoId: string;
  etapa: EtapaObservacionGuardia;
  valorInicial: string;
}) {
  const [abierto, setAbierto] = useState(valorInicial.trim().length > 0);

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <input
          type="checkbox"
          className="size-3.5"
          checked={abierto}
          onChange={(e) => setAbierto(e.target.checked)}
        />
        Observación
      </label>
      {abierto && (
        <form
          action={guardarObservacionGuardia.bind(null, vehiculoId, etapa)}
          className="flex flex-col gap-1.5"
        >
          <Textarea
            name="observacion"
            defaultValue={valorInicial}
            rows={2}
            className="min-w-48 text-sm"
            placeholder="Observación..."
          />
          <Button type="submit" size="xs" variant="outline" className="self-start">
            Guardar
          </Button>
        </form>
      )}
    </div>
  );
}
