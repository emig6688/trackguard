"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { actualizarDerivacionExterna } from "@/app/_actions/ordenesTrabajo";

const ESTADOS_EXTERNO = [
  { value: "ENVIADO", label: "Enviado" },
  { value: "PRESUPUESTADO", label: "Presupuestado" },
  { value: "EN_REPARACION", label: "En reparación" },
  { value: "COMPLETADO", label: "Completado" },
];

export function DerivacionForm({
  derivacionId,
  otId,
  defaultEstado,
}: {
  derivacionId: string;
  otId: string;
  defaultEstado: string;
}) {
  return (
    <form
      action={actualizarDerivacionExterna.bind(null, derivacionId, otId)}
      className="space-y-4 rounded-lg border p-4"
    >
      <h3 className="font-medium">Seguimiento de la derivación</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="estadoExterno">Estado</Label>
          <Select name="estadoExterno" defaultValue={defaultEstado}>
            <SelectTrigger id="estadoExterno" className="w-full">
              <SelectValue>
                {(value: string) =>
                  ESTADOS_EXTERNO.find((e) => e.value === value)?.label ?? value
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ESTADOS_EXTERNO.map((e) => (
                <SelectItem key={e.value} value={e.value}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="presupuestoMonto">Presupuesto</Label>
          <Input id="presupuestoMonto" name="presupuestoMonto" type="number" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="fechaEstimadaEntrega">Fecha estimada de entrega</Label>
        <Input id="fechaEstimadaEntrega" name="fechaEstimadaEntrega" type="date" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="resultado">Resultado / novedades</Label>
        <Textarea id="resultado" name="resultado" />
      </div>
      <Button type="submit" size="sm">
        Guardar seguimiento
      </Button>
    </form>
  );
}
