"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  actualizarFechaEstimada,
  aprobarOT,
  cancelarOT,
  completarDesdeExterno,
  derivarAExterno,
  volverAInternoDesdeExterno,
} from "@/app/_actions/ordenesTrabajo";
import { CompletarOTForm } from "@/components/ordenes-trabajo/completar-ot-form";
import { IniciarOTForm } from "@/components/ordenes-trabajo/iniciar-ot-form";
import { AREA_REPARACION_LABEL } from "@/lib/clasificador-averias";
import { puedeMecanicoAccionar } from "@/lib/ot";
import type { AreaReparacionOT, EstadoOT, PrioridadOT, Rol } from "@/app/generated/prisma/client";

function inputDate(fecha: Date | null) {
  return fecha ? fecha.toISOString().slice(0, 10) : undefined;
}

type OT = {
  id: string;
  estado: EstadoOT;
  asignadoAId: string | null;
  origen: string;
  prioridad: PrioridadOT;
  areaReparacion: AreaReparacionOT | null;
  fechaEstimadaFinalizacion: Date | null;
};

export function OTAcciones({
  ot,
  rol,
  userId,
  mecanicos,
  talleres,
}: {
  ot: OT;
  rol: Rol;
  userId: string;
  mecanicos: { id: string; nombre: string }[];
  talleres: { id: string; nombre: string }[];
}) {
  const puedeGestionar = rol === "ADMIN" || rol === "ENCARGADO_MANTENIMIENTO";
  const esMecanicoAsignado = rol === "MECANICO_INTERNO" && puedeMecanicoAccionar(ot, userId);

  const [aprobarState, aprobarAction] = useActionState(aprobarOT.bind(null, ot.id), undefined);
  const aprobarErrors = aprobarState?.fieldErrors ?? {};

  return (
    <div className="space-y-6">
      {ot.estado === "PENDIENTE_APROBACION" && puedeGestionar && (
        <form action={aprobarAction} className="space-y-4 rounded-lg border p-4">
          <h3 className="font-medium">Aprobar orden de trabajo</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prioridad">Prioridad</Label>
              <Select name="prioridad" defaultValue={ot.prioridad}>
                <SelectTrigger id="prioridad" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BAJA">Baja</SelectItem>
                  <SelectItem value="MEDIA">Media</SelectItem>
                  <SelectItem value="ALTA">Alta</SelectItem>
                  <SelectItem value="URGENTE">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fechaLimite">Fecha límite</Label>
              <Input id="fechaLimite" name="fechaLimite" type="date" required />
              {aprobarErrors.fechaLimite && (
                <p className="text-sm text-destructive">{aprobarErrors.fechaLimite[0]}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="areaReparacion">
                Área de reparación
                {ot.areaReparacion && ot.areaReparacion !== "OTRO" && (
                  <span className="ml-1 font-normal text-muted-foreground">(sugerida por el sistema)</span>
                )}
              </Label>
              <Select name="areaReparacion" defaultValue={ot.areaReparacion ?? "OTRO"}>
                <SelectTrigger id="areaReparacion" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(AREA_REPARACION_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="asignadoAId">Asignar a mecánico</Label>
              <Select name="asignadoAId" required>
                <SelectTrigger id="asignadoAId" className="w-full">
                  <SelectValue placeholder="Elegí un mecánico">
                    {(value: string) => mecanicos.find((m) => m.id === value)?.nombre ?? "Elegí un mecánico"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {mecanicos.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {aprobarErrors.asignadoAId && (
                <p className="text-sm text-destructive">{aprobarErrors.asignadoAId[0]}</p>
              )}
            </div>
          </div>
          <div className="space-y-2 max-w-xs">
            <Label htmlFor="ordenSecuencia">Orden de atención</Label>
            <Input id="ordenSecuencia" name="ordenSecuencia" type="number" />
          </div>
          <div className="flex gap-2">
            <Button type="submit">Aprobar</Button>
            <Button
              type="submit"
              variant="destructive"
              formNoValidate
              formAction={cancelarOT.bind(null, ot.id, undefined)}
            >
              Cancelar OT
            </Button>
          </div>
        </form>
      )}

      {ot.estado === "APROBADA" && (
        <div className="flex flex-wrap items-end gap-4">
          {(puedeGestionar || esMecanicoAsignado) && <IniciarOTForm otId={ot.id} />}
          {puedeGestionar && (
            <div className="flex flex-wrap gap-2">
              <DerivarForm otId={ot.id} talleres={talleres} />
              <form action={cancelarOT.bind(null, ot.id, undefined)}>
                <Button type="submit" variant="destructive">
                  Cancelar OT
                </Button>
              </form>
            </div>
          )}
        </div>
      )}

      {ot.estado === "EN_PROGRESO" && (
        <div className="space-y-4">
          {(puedeGestionar || esMecanicoAsignado) && (
            <form
              action={actualizarFechaEstimada.bind(null, ot.id)}
              className="flex flex-wrap items-end gap-2 rounded-lg border p-3"
            >
              <div className="space-y-2">
                <Label htmlFor="fechaEstimadaFinalizacion2">Fecha estimada de finalización</Label>
                <Input
                  id="fechaEstimadaFinalizacion2"
                  name="fechaEstimadaFinalizacion"
                  type="date"
                  required
                  defaultValue={inputDate(ot.fechaEstimadaFinalizacion)}
                />
              </div>
              <Button type="submit" variant="outline">
                Actualizar fecha estimada
              </Button>
            </form>
          )}
          {(puedeGestionar || esMecanicoAsignado) && <CompletarOTForm otId={ot.id} />}
          {puedeGestionar && (
            <div className="flex flex-wrap gap-2">
              <DerivarForm otId={ot.id} talleres={talleres} />
              <form action={cancelarOT.bind(null, ot.id, undefined)}>
                <Button type="submit" variant="destructive">
                  Cancelar OT
                </Button>
              </form>
            </div>
          )}
        </div>
      )}

      {ot.estado === "DERIVADA_EXTERNO" && puedeGestionar && (
        <div className="flex flex-wrap gap-2">
          <form action={completarDesdeExterno.bind(null, ot.id)}>
            <Button type="submit">Marcar OT como completada</Button>
          </form>
          <form action={volverAInternoDesdeExterno.bind(null, ot.id)}>
            <Button type="submit" variant="outline">
              Volver a taller interno
            </Button>
          </form>
          <form action={cancelarOT.bind(null, ot.id, undefined)}>
            <Button type="submit" variant="destructive">
              Cancelar OT
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

function DerivarForm({
  otId,
  talleres,
}: {
  otId: string;
  talleres: { id: string; nombre: string }[];
}) {
  return (
    <form
      action={derivarAExterno.bind(null, otId)}
      className="flex flex-wrap items-end gap-2 rounded-lg border p-3"
    >
      <div className="space-y-2">
        <Label htmlFor="tallerExternoId">Derivar a taller</Label>
        <Select name="tallerExternoId">
          <SelectTrigger id="tallerExternoId" className="w-48">
            <SelectValue placeholder="Elegí un taller">
              {(value: string) => talleres.find((t) => t.id === value)?.nombre ?? "Elegí un taller"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {talleres.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="presupuestoMonto">Presupuesto</Label>
        <Input id="presupuestoMonto" name="presupuestoMonto" type="number" className="w-32" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="fechaEstimadaEntrega">Fecha estimada</Label>
        <Input id="fechaEstimadaEntrega" name="fechaEstimadaEntrega" type="date" />
      </div>
      <Button type="submit" variant="outline">
        Derivar
      </Button>
    </form>
  );
}
