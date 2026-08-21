"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registrarGasto } from "@/app/_actions/gastos";

export function GastoForm({ vehiculos }: { vehiculos: { id: string; patente: string }[] }) {
  const [state, formAction, pending] = useActionState(registrarGasto, undefined);
  const [tipo, setTipo] = useState("PEAJE");
  const esOtro = tipo === "OTRO";

  return (
    <form action={formAction} className="space-y-4">
      <h1 className="text-lg font-semibold">Cargar gasto</h1>

      <div className="space-y-2">
        <Label htmlFor="tipo">Tipo de gasto</Label>
        <select
          id="tipo"
          name="tipo"
          required
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="w-full rounded-md border border-input bg-transparent p-2 text-sm"
        >
          <option value="PEAJE">Peaje</option>
          <option value="VIATICO">Viático</option>
          <option value="REPARACION_MENOR">Reparación menor</option>
          <option value="OTRO">Otro</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="monto">Monto</Label>
        <Input id="monto" name="monto" type="number" step="0.01" inputMode="decimal" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="vehiculoId">Vehículo</Label>
        <select
          id="vehiculoId"
          name="vehiculoId"
          required
          className="w-full rounded-md border border-input bg-transparent p-2 text-sm"
        >
          <option value="">Elegí un vehículo</option>
          {vehiculos.map((v) => (
            <option key={v.id} value={v.id}>
              {v.patente}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="descripcion">
          Observación{esOtro ? "" : " (opcional)"}
        </Label>
        <Input
          id="descripcion"
          name="descripcion"
          required={esOtro}
          placeholder={esOtro ? "Aclará de qué es el gasto" : undefined}
        />
        {esOtro && (
          <p className="text-xs text-muted-foreground">
            Para &quot;Otro&quot; es obligatorio aclarar de qué se trata.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="archivoComprobante">Foto del comprobante (opcional)</Label>
        <Input
          id="archivoComprobante"
          name="archivoComprobante"
          type="file"
          accept="image/*"
        />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Guardando..." : "Guardar gasto"}
      </Button>
    </form>
  );
}
