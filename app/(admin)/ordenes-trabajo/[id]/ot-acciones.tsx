"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
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
  // A quién se asigna la reparación al aprobar: un mecánico interno (queda
  // APROBADA, como siempre) o directo a un taller externo (queda
  // DERIVADA_EXTERNO sin pasar por APROBADA) — antes esto último obligaba a
  // elegir igual un mecánico interno y derivar recién después, en un segundo
  // paso.
  const [modoAprobacion, setModoAprobacion] = useState<"MECANICO" | "EXTERNO">("MECANICO");

  const [cancelarState, cancelarAction] = useActionState(cancelarOT.bind(null, ot.id), undefined);
  const [fechaState, fechaAction] = useActionState(actualizarFechaEstimada.bind(null, ot.id), undefined);
  const [completarExtState, completarExtAction] = useActionState(
    completarDesdeExterno.bind(null, ot.id),
    undefined
  );
  const [volverInternoState, volverInternoAction] = useActionState(
    volverAInternoDesdeExterno.bind(null, ot.id),
    undefined
  );

  // La aprobación pasa el estado de PENDIENTE_APROBACION a APROBADA, así que
  // el formulario de arriba desaparece solo (deja de cumplir la condición de
  // abajo) — acá solo falta el aviso de que quedó aprobada y asignada, para
  // que el encargado sepa que la acción se completó sin tener que adivinarlo
  // por la desaparición del formulario.
  const estadoAnteriorRef = useRef(ot.estado);
  useEffect(() => {
    if (estadoAnteriorRef.current === "PENDIENTE_APROBACION" && ot.estado === "APROBADA") {
      toast.success("Orden aprobada y asignada.");
    }
    estadoAnteriorRef.current = ot.estado;
  }, [ot.estado]);

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
            <div className="space-y-2 sm:col-span-2">
              <Label>¿Quién hace la reparación?</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={modoAprobacion === "MECANICO" ? "default" : "outline"}
                  onClick={() => setModoAprobacion("MECANICO")}
                >
                  Mecánico interno
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={modoAprobacion === "EXTERNO" ? "default" : "outline"}
                  onClick={() => setModoAprobacion("EXTERNO")}
                >
                  Taller externo
                </Button>
              </div>
            </div>
            {modoAprobacion === "MECANICO" ? (
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
            ) : (
              <div className="space-y-2">
                <Label htmlFor="tallerExternoId">Taller externo</Label>
                <Select name="tallerExternoId" required>
                  <SelectTrigger id="tallerExternoId" className="w-full">
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
                {aprobarErrors.tallerExternoId && (
                  <p className="text-sm text-destructive">{aprobarErrors.tallerExternoId[0]}</p>
                )}
              </div>
            )}
          </div>
          {modoAprobacion === "EXTERNO" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="presupuestoMonto">Presupuesto</Label>
                <Input id="presupuestoMonto" name="presupuestoMonto" type="number" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fechaEstimadaEntrega">Fecha estimada de entrega</Label>
                <Input id="fechaEstimadaEntrega" name="fechaEstimadaEntrega" type="date" />
              </div>
            </div>
          )}
          <div className="space-y-2 max-w-xs">
            <Label htmlFor="ordenSecuencia">Orden de atención</Label>
            <Input id="ordenSecuencia" name="ordenSecuencia" type="number" />
          </div>
          <div className="flex gap-2">
            <Button type="submit">
              {modoAprobacion === "EXTERNO" ? "Aprobar y derivar a taller" : "Aprobar"}
            </Button>
            <Button type="submit" variant="destructive" formNoValidate formAction={cancelarAction}>
              Cancelar OT
            </Button>
          </div>
          {cancelarState?.error && <p className="text-sm text-destructive">{cancelarState.error}</p>}
        </form>
      )}

      {ot.estado === "APROBADA" && (
        <div className="flex flex-wrap items-end gap-4">
          {(puedeGestionar || esMecanicoAsignado) && <IniciarOTForm otId={ot.id} />}
          {puedeGestionar && (
            <div className="flex flex-wrap items-start gap-2">
              <DerivarForm otId={ot.id} talleres={talleres} />
              <form action={cancelarAction} className="space-y-1">
                <Button type="submit" variant="destructive">
                  Cancelar OT
                </Button>
                {cancelarState?.error && <p className="text-sm text-destructive">{cancelarState.error}</p>}
              </form>
            </div>
          )}
        </div>
      )}

      {ot.estado === "EN_PROGRESO" && (
        <div className="space-y-4">
          {(puedeGestionar || esMecanicoAsignado) && (
            <form action={fechaAction} className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
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
              {fechaState?.error && <p className="w-full text-sm text-destructive">{fechaState.error}</p>}
            </form>
          )}
          {puedeGestionar && (
            <div className="flex flex-wrap items-start gap-2">
              <DerivarForm otId={ot.id} talleres={talleres} />
              <form action={cancelarAction} className="space-y-1">
                <Button type="submit" variant="destructive">
                  Cancelar OT
                </Button>
                {cancelarState?.error && <p className="text-sm text-destructive">{cancelarState.error}</p>}
              </form>
            </div>
          )}
        </div>
      )}

      {ot.estado === "DERIVADA_EXTERNO" && puedeGestionar && (
        <div className="flex flex-wrap items-start gap-2">
          <form action={completarExtAction} className="space-y-1">
            <Button type="submit">Marcar OT como completada</Button>
            {completarExtState?.error && (
              <p className="text-sm text-destructive">{completarExtState.error}</p>
            )}
          </form>
          <form action={volverInternoAction} className="space-y-1">
            <Button type="submit" variant="outline">
              Volver a taller interno
            </Button>
            {volverInternoState?.error && (
              <p className="text-sm text-destructive">{volverInternoState.error}</p>
            )}
          </form>
          <form action={cancelarAction} className="space-y-1">
            <Button type="submit" variant="destructive">
              Cancelar OT
            </Button>
            {cancelarState?.error && <p className="text-sm text-destructive">{cancelarState.error}</p>}
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
  const [state, action] = useActionState(derivarAExterno.bind(null, otId), undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
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
      {state?.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
