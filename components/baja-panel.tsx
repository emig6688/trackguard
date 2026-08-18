"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export function BajaPanel({
  activo,
  observacionBaja,
  fechaBaja,
  onDarDeBaja,
  onReactivar,
}: {
  activo: boolean;
  observacionBaja: string | null;
  fechaBaja: Date | null;
  onDarDeBaja: (formData: FormData) => Promise<void>;
  onReactivar: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [mostrarForm, setMostrarForm] = useState(false);

  if (!activo) {
    return (
      <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <div className="flex items-center justify-between">
          <Badge variant="destructive">Dado de baja</Badge>
          {fechaBaja && (
            <span className="text-xs text-muted-foreground">
              {fechaBaja.toLocaleDateString("es-AR")}
            </span>
          )}
        </div>
        {observacionBaja && <p className="text-sm">{observacionBaja}</p>}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => startTransition(onReactivar)}
        >
          {pending ? "Reactivando..." : "Reactivar"}
        </Button>
      </div>
    );
  }

  if (!mostrarForm) {
    return (
      <Button type="button" size="sm" variant="destructive" onClick={() => setMostrarForm(true)}>
        Dar de baja
      </Button>
    );
  }

  return (
    <form
      className="space-y-2 rounded-lg border p-4"
      action={(formData) => startTransition(() => onDarDeBaja(formData))}
    >
      <p className="text-sm font-medium">Motivo de la baja</p>
      <Textarea
        name="observacion"
        placeholder="Ej: accidente, venta, rotura de motor..."
        required
        rows={2}
      />
      <div className="flex gap-2">
        <Button type="submit" variant="destructive" size="sm" disabled={pending}>
          {pending ? "Guardando..." : "Confirmar baja"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setMostrarForm(false)}
          disabled={pending}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
