"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { actualizarDisponibilidadVehiculo } from "@/app/_actions/vehiculos";

export function DisponibilidadToggle({
  vehiculoId,
  disponible,
  motivoNoOperativo,
  enTallerExterno,
}: {
  vehiculoId: string;
  disponible: boolean;
  motivoNoOperativo: string | null;
  enTallerExterno: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const efectiva = disponible && !enTallerExterno;
  // El botón "Marcar operativo" solo se muestra cuando !disponible, así que
  // acá alcanza con enTallerExterno para bloquearlo.
  const bloqueado = enTallerExterno;

  function marcarNoOperativo(formData: FormData) {
    setError(null);
    const motivo = (formData.get("motivo") as string | null) ?? "";
    startTransition(async () => {
      try {
        await actualizarDisponibilidadVehiculo(vehiculoId, false, motivo);
        setMostrarForm(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo actualizar la disponibilidad.");
      }
    });
  }

  function marcarOperativo() {
    setError(null);
    startTransition(async () => {
      try {
        await actualizarDisponibilidadVehiculo(vehiculoId, true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo actualizar la disponibilidad.");
      }
    });
  }

  if (disponible && mostrarForm) {
    return (
      <form action={marcarNoOperativo} className="space-y-2 rounded-lg border p-3">
        <p className="text-sm font-medium">¿Qué problema tiene la unidad?</p>
        <Textarea
          name="motivo"
          placeholder="Ej: compresor de frío roto, pinchadura, sin frenos..."
          required
          rows={2}
        />
        <div className="flex gap-2">
          <Button type="submit" variant="destructive" size="sm" disabled={pending}>
            {pending ? "Guardando..." : "Confirmar"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => setMostrarForm(false)}
          >
            Cancelar
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </form>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={efectiva ? "success" : "destructive"}>
          {efectiva ? "Operativo" : "No operativo"}
        </Badge>
        {disponible ? (
          <Button type="button" variant="outline" size="xs" onClick={() => setMostrarForm(true)}>
            Marcar no operativo
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={pending || bloqueado}
            onClick={marcarOperativo}
            title={bloqueado ? "Derivado a taller externo: no se puede marcar disponible" : undefined}
          >
            {pending ? "Guardando..." : "Marcar operativo"}
          </Button>
        )}
      </div>
      {!disponible && motivoNoOperativo && (
        <p className="mt-1 text-xs text-muted-foreground">{motivoNoOperativo}</p>
      )}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
