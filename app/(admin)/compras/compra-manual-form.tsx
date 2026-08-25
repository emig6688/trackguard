"use client";

import { useActionState, useId, useRef, useState } from "react";
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
import {
  crearOrdenCompraManual,
  actualizarOrdenCompra,
  type CompraFormState,
} from "@/app/_actions/compras";

type Fila = { id: string; articuloId: string; descripcion: string; cantidad: string; archivoUrl: string | null };

// Sentinels para las opciones "sin elegir" de cada Select: Base UI no admite
// un SelectItem con value="" (colisiona con el estado "sin selección" del
// propio primitivo), y sin un ítem real en la lista tampoco había forma de
// volver atrás una vez elegida una OT o un artículo del pañol por error.
const SIN_OT = "__sin_ot__";
const SIN_ARTICULO = "__sin_articulo__";

const PRIORIDAD_LABEL: Record<string, string> = {
  BAJA: "Baja",
  MEDIA: "Media",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

export function CompraManualForm({
  articulos,
  ordenes,
  vehiculos,
  montoAutorizacionCompra,
  compraExistente,
}: {
  articulos: { id: string; nombre: string }[];
  ordenes?: { id: string; numero: string; titulo: string }[];
  vehiculos: { id: string; patente: string }[];
  montoAutorizacionCompra: string | null;
  compraExistente?: {
    id: string;
    montoEstimado: string | null;
    observaciones: string | null;
    ordenDeTrabajoId: string | null;
    prioridad: string | null;
    vehiculoId: string | null;
    items: {
      id: string;
      descripcion: string;
      cantidadSolicitada: number | null;
      articuloPanolId: string | null;
      archivoUrl: string | null;
    }[];
  };
}) {
  // Prefijo único por instancia: este formulario se monta varias veces a la
  // vez en /compras (uno por "Nueva compra" + uno por cada OC "Editar"), así
  // que los ids de DOM no pueden ser los mismos strings usados en `name`
  // (esos sí tienen que quedar fijos, los lee el server action) o se pisan
  // entre instancias y Base UI se confunde con qué default value es de cuál.
  const instanceId = useId();
  const domId = (sufijo: string) => `${instanceId}-${sufijo}`;

  const action = compraExistente
    ? actualizarOrdenCompra.bind(null, compraExistente.id)
    : crearOrdenCompraManual;
  const [state, formAction, pending] = useActionState<CompraFormState, FormData>(action, undefined);
  const [items, setItems] = useState<Fila[]>(
    compraExistente && compraExistente.items.length > 0
      ? compraExistente.items.map((i) => ({
          id: i.id,
          articuloId: i.articuloPanolId ?? "",
          descripcion: i.descripcion,
          cantidad: i.cantidadSolicitada != null ? String(i.cantidadSolicitada) : "",
          archivoUrl: i.archivoUrl,
        }))
      : [{ id: "new-0", articuloId: "", descripcion: "", cantidad: "", archivoUrl: null }]
  );
  const nextId = useRef(1);
  const [ordenDeTrabajoId, setOrdenDeTrabajoId] = useState(compraExistente?.ordenDeTrabajoId ?? "");
  const [prioridad, setPrioridad] = useState(compraExistente?.prioridad ?? "");
  const [vehiculoId, setVehiculoId] = useState(compraExistente?.vehiculoId ?? "");
  const sinOt = !ordenDeTrabajoId;

  function actualizarFila(id: string, cambios: Partial<Fila>) {
    setItems((prev) => prev.map((f) => (f.id === id ? { ...f, ...cambios } : f)));
  }

  function onSeleccionarArticulo(id: string, articuloId: string | null) {
    if (articuloId === SIN_ARTICULO) {
      actualizarFila(id, { articuloId: "", descripcion: "" });
      return;
    }
    const articulo = articulos.find((a) => a.id === articuloId);
    actualizarFila(id, { articuloId: articuloId ?? "", descripcion: articulo ? articulo.nombre : "" });
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="itemIds" value={items.map((f) => f.id).join(",")} />

      {ordenes && ordenes.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor={domId("ordenDeTrabajoSelect")}>Orden de trabajo (opcional)</Label>
          <input type="hidden" name="ordenDeTrabajoId" value={ordenDeTrabajoId} />
          <Select
            value={ordenDeTrabajoId || SIN_OT}
            onValueChange={(v) => setOrdenDeTrabajoId(v === SIN_OT ? "" : (v ?? ""))}
          >
            <SelectTrigger id={domId("ordenDeTrabajoSelect")} className="w-full">
              <SelectValue placeholder="No corresponde a ninguna OT">
                {(value: string) => {
                  if (value === SIN_OT) return "No corresponde a ninguna OT";
                  const ot = ordenes.find((o) => o.id === value);
                  return ot ? `${ot.numero} — ${ot.titulo}` : "OT ya cerrada";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SIN_OT}>No corresponde a ninguna OT</SelectItem>
              {ordenes.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.numero} — {o.titulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Solo se piden a mano cuando la compra no está ligada a una OT — si
      lo está, hereda ambos de esa OT (ver resolverPrioridadYVehiculo en
      app/_actions/compras.ts) y no tiene sentido elegirlos de nuevo acá. */}
      {sinOt && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={domId("vehiculoSelect")}>Vehículo</Label>
            <input type="hidden" name="vehiculoId" value={vehiculoId} />
            <Select value={vehiculoId} onValueChange={(v) => setVehiculoId(v ?? "")}>
              <SelectTrigger id={domId("vehiculoSelect")} className="w-full">
                <SelectValue placeholder="Elegí un vehículo">
                  {(value: string) => vehiculos.find((v) => v.id === value)?.patente ?? "Elegí un vehículo"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {vehiculos.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.patente}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={domId("prioridadSelect")}>Prioridad</Label>
            <input type="hidden" name="prioridad" value={prioridad} />
            <Select value={prioridad} onValueChange={(v) => setPrioridad(v ?? "")}>
              <SelectTrigger id={domId("prioridadSelect")} className="w-full">
                <SelectValue placeholder="Elegí una prioridad">
                  {(value: string) => PRIORIDAD_LABEL[value] ?? "Elegí una prioridad"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PRIORIDAD_LABEL).map(([valor, label]) => (
                  <SelectItem key={valor} value={valor}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {items.map((fila, i) => (
          <div key={fila.id} className="space-y-3 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Repuesto{items.length > 1 ? ` ${i + 1}` : ""}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={items.length === 1}
                onClick={() => setItems((prev) => prev.filter((f) => f.id !== fila.id))}
              >
                Quitar
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor={domId(`articuloPanolSelect_${fila.id}`)}>Artículo del pañol (opcional)</Label>
                <input type="hidden" name={`item_articuloPanolId_${fila.id}`} value={fila.articuloId} />
                <Select
                  value={fila.articuloId || SIN_ARTICULO}
                  onValueChange={(v) => onSeleccionarArticulo(fila.id, v === SIN_ARTICULO ? null : v)}
                >
                  <SelectTrigger id={domId(`articuloPanolSelect_${fila.id}`)} className="w-full">
                    <SelectValue placeholder="No corresponde a un artículo del pañol">
                      {(value: string) => {
                        if (value === SIN_ARTICULO) return "No corresponde a un artículo del pañol";
                        return articulos.find((a) => a.id === value)?.nombre ?? "No corresponde a un artículo del pañol";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SIN_ARTICULO}>No corresponde a un artículo del pañol</SelectItem>
                    {articulos.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor={domId(`item_cantidad_${fila.id}`)}>Cantidad</Label>
                <Input
                  id={domId(`item_cantidad_${fila.id}`)}
                  name={`item_cantidad_${fila.id}`}
                  type="number"
                  defaultValue={fila.cantidad}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor={domId(`item_descripcion_${fila.id}`)}>Qué hay que comprar</Label>
              <Input
                id={domId(`item_descripcion_${fila.id}`)}
                name={`item_descripcion_${fila.id}`}
                placeholder="Ej: guantes de trabajo talle L"
                value={fila.descripcion}
                onChange={(e) => actualizarFila(fila.id, { descripcion: e.target.value })}
                readOnly={!!fila.articuloId}
                className={fila.articuloId ? "bg-muted" : undefined}
                required
              />
              {fila.articuloId && (
                <p className="text-xs text-muted-foreground">
                  Se completa solo a partir del artículo del pañol elegido, para que coincida con el
                  stock que se va a actualizar.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor={domId(`item_foto_${fila.id}`)}>
                Foto de referencia {fila.archivoUrl ? "(reemplazar)" : "(opcional)"}
              </Label>
              <div className="flex items-center gap-2">
                {fila.archivoUrl && (
                  <a href={fila.archivoUrl} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element -- sirve desde una API autenticada, no un asset estático de /public */}
                    <img
                      src={fila.archivoUrl}
                      alt={`Referencia de ${fila.descripcion}`}
                      className="h-10 w-10 rounded border object-cover"
                    />
                  </a>
                )}
                <Input
                  id={domId(`item_foto_${fila.id}`)}
                  name={`item_foto_${fila.id}`}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          setItems((prev) => [
            ...prev,
            { id: `new-${nextId.current++}`, articuloId: "", descripcion: "", cantidad: "", archivoUrl: null },
          ])
        }
      >
        + Agregar repuesto
      </Button>

      {montoAutorizacionCompra != null && (
        <div className="max-w-xs space-y-2">
          <Label htmlFor={domId("montoEstimado")}>Monto estimado</Label>
          <Input
            id={domId("montoEstimado")}
            name="montoEstimado"
            type="number"
            step="0.01"
            defaultValue={compraExistente?.montoEstimado ?? ""}
            required
          />
          <p className="text-xs text-muted-foreground">
            Si supera ${montoAutorizacionCompra}, la compra queda sujeta a autorización de gerencia.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor={domId("observaciones")}>Observación (opcional)</Label>
        <Textarea
          id={domId("observaciones")}
          name="observaciones"
          rows={2}
          placeholder="Alguna aclaración para compras..."
          defaultValue={compraExistente?.observaciones ?? ""}
        />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.numero && (
        <p className={state.requiereAutorizacion ? "text-sm text-warning-foreground" : "text-sm text-success"}>
          {compraExistente ? "Se guardaron los cambios en " : "Se generó la orden de compra "}
          {state.numero}.
          {state.requiereAutorizacion && " Queda sujeta a autorización de gerencia antes de poder comprarse."}
        </p>
      )}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Guardando..." : compraExistente ? "Guardar cambios" : "Pedir compra"}
      </Button>
    </form>
  );
}
