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

export function CompraManualForm({
  articulos,
  ordenes,
  montoAutorizacionCompra,
  compraExistente,
}: {
  articulos: { id: string; nombre: string }[];
  ordenes?: { id: string; numero: string; titulo: string }[];
  montoAutorizacionCompra: string | null;
  compraExistente?: {
    id: string;
    montoEstimado: string | null;
    observaciones: string | null;
    ordenDeTrabajoId: string | null;
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

  function actualizarFila(id: string, cambios: Partial<Fila>) {
    setItems((prev) => prev.map((f) => (f.id === id ? { ...f, ...cambios } : f)));
  }

  function onSeleccionarArticulo(id: string, articuloId: string | null) {
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
          <Select value={ordenDeTrabajoId} onValueChange={(v) => setOrdenDeTrabajoId(v ?? "")}>
            <SelectTrigger id={domId("ordenDeTrabajoSelect")} className="w-full">
              <SelectValue placeholder="No corresponde a ninguna OT">
                {(value: string) => {
                  const ot = ordenes.find((o) => o.id === value);
                  return ot ? `${ot.numero} — ${ot.titulo}` : "OT ya cerrada";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ordenes.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.numero} — {o.titulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor={domId(`articuloPanolSelect_${fila.id}`)}>Artículo del pañol (opcional)</Label>
                <input type="hidden" name={`item_articuloPanolId_${fila.id}`} value={fila.articuloId} />
                <Select
                  value={fila.articuloId}
                  onValueChange={(v) => onSeleccionarArticulo(fila.id, v)}
                >
                  <SelectTrigger id={domId(`articuloPanolSelect_${fila.id}`)} className="w-full">
                    <SelectValue placeholder="No corresponde a un artículo del pañol" />
                  </SelectTrigger>
                  <SelectContent>
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
