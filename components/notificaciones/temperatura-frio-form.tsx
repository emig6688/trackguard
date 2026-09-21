"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { actualizarTemperaturaFrio } from "@/app/_actions/reglasNotificacion";

export function TemperaturaFrioForm({
  minimoInicial,
  maximoInicial,
}: {
  minimoInicial: string | null;
  maximoInicial: string | null;
}) {
  const [minimo, setMinimo] = useState(minimoInicial ?? "");
  const [maximo, setMaximo] = useState(maximoInicial ?? "");
  const [pending, startTransition] = useTransition();
  const [guardado, setGuardado] = useState(false);

  function guardar() {
    startTransition(async () => {
      await actualizarTemperaturaFrio(minimo === "" ? null : Number(minimo), maximo === "" ? null : Number(maximo));
      setGuardado(true);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4">
        <div className="w-32 space-y-1.5">
          <Label htmlFor="temperaturaMinimaFrio">Mínima (°C)</Label>
          <Input
            id="temperaturaMinimaFrio"
            type="number"
            step="0.1"
            placeholder="Sin límite"
            value={minimo}
            onChange={(e) => {
              setGuardado(false);
              setMinimo(e.target.value);
            }}
          />
        </div>
        <div className="w-32 space-y-1.5">
          <Label htmlFor="temperaturaMaximaFrio">Máxima (°C)</Label>
          <Input
            id="temperaturaMaximaFrio"
            type="number"
            step="0.1"
            placeholder="Sin límite"
            value={maximo}
            onChange={(e) => {
              setGuardado(false);
              setMaximo(e.target.value);
            }}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" disabled={pending} onClick={guardar}>
          {pending ? "Guardando..." : "Guardar"}
        </Button>
        {guardado && <span className="text-xs text-success">Guardado.</span>}
      </div>
      <p className="text-xs text-muted-foreground">
        Dejá un campo vacío para no limitar de ese lado. Con los dos vacíos, la alerta de
        temperatura queda desactivada aunque el rol/canal de abajo esté configurado.
      </p>
    </div>
  );
}
