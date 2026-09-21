"use client";

import { useActionState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatearFechaHora } from "@/lib/fecha";
import { guardarSensorFrio, desactivarSensorFrio } from "@/app/_actions/sensoresFrio";

export function SensorFrioPanel({
  vehiculoId,
  sensor,
}: {
  vehiculoId: string;
  sensor: { dispositivoId: string; activo: boolean; ultimaLecturaEn: Date | null } | null;
}) {
  const guardarConId = guardarSensorFrio.bind(null, vehiculoId);
  const [state, formAction, pending] = useActionState(guardarConId, undefined);
  const [desactivando, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sensor de frío (Rinho)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Asociá este vehículo al ID de dispositivo que Flespi te da al configurar el sensor —
          es lo que permite que las lecturas de temperatura lleguen a este vehículo en Calidad.
        </p>

        {sensor?.activo && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-2 text-sm">
            <Badge variant="success">Sensor activo</Badge>
            <span className="font-mono text-xs">{sensor.dispositivoId}</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {sensor.ultimaLecturaEn
                ? `Última lectura: ${formatearFechaHora(sensor.ultimaLecturaEn)}`
                : "Todavía sin lecturas"}
            </span>
          </div>
        )}

        <form action={formAction} className="flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1 space-y-1.5">
            <Label htmlFor="dispositivoId">ID de dispositivo Flespi</Label>
            <Input
              key={sensor?.dispositivoId ?? "nuevo"}
              id="dispositivoId"
              name="dispositivoId"
              defaultValue={sensor?.dispositivoId ?? ""}
              placeholder="Ej: 350612345678901"
            />
          </div>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Guardando..." : sensor ? "Actualizar" : "Activar sensor"}
          </Button>
          {sensor?.activo && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={desactivando}
              onClick={() => startTransition(() => desactivarSensorFrio(vehiculoId))}
            >
              {desactivando ? "Desactivando..." : "Desactivar"}
            </Button>
          )}
        </form>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      </CardContent>
    </Card>
  );
}
