"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { actualizarMontoAutorizacionCompra } from "@/app/_actions/reglasNotificacion";

export function MontoAutorizacionForm({
  montoInicial,
  idPrefix = "montoAutorizacionCompra",
  action = actualizarMontoAutorizacionCompra,
  descripcion = "Si está desactivado, ninguna orden de compra requiere autorización de gerencia sin importar el monto.",
}: {
  montoInicial: string | null;
  idPrefix?: string;
  action?: (monto: number | null) => Promise<void>;
  descripcion?: string;
}) {
  const [desactivado, setDesactivado] = useState(montoInicial == null);
  const [monto, setMonto] = useState(montoInicial ?? "");
  const [pending, startTransition] = useTransition();
  const [guardado, setGuardado] = useState(false);

  function guardar() {
    startTransition(async () => {
      await action(desactivado ? null : Number(monto));
      setGuardado(true);
    });
  }

  return (
    <div className="space-y-3">
      <div className="max-w-xs space-y-1.5">
        <Label htmlFor={idPrefix}>Monto máximo sin autorización</Label>
        <Input
          id={idPrefix}
          type="number"
          min={0}
          step="0.01"
          value={monto}
          disabled={desactivado}
          onChange={(e) => {
            setGuardado(false);
            setMonto(e.target.value);
          }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setGuardado(false);
            setDesactivado((v) => !v);
          }}
        >
          <Badge variant={desactivado ? "secondary" : "success"}>
            {desactivado ? "Función desactivada" : "Función activa"}
          </Badge>
        </button>
        <Button
          type="button"
          size="sm"
          disabled={pending || (!desactivado && !monto)}
          onClick={guardar}
        >
          {pending ? "Guardando..." : "Guardar"}
        </Button>
        {guardado && <span className="text-xs text-success">Guardado.</span>}
      </div>
      <p className="text-xs text-muted-foreground">{descripcion}</p>
    </div>
  );
}
