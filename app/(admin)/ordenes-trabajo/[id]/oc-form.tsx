"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { crearOrdenCompraManual, type CompraFormState } from "@/app/_actions/compras";

type Fila = { id: number };

export function OCForm({
  otId,
  otItemPreventivoId,
  descripcionSugerida = "",
  montoAutorizacionCompra = null,
  onGenerada,
}: {
  otId: string;
  otItemPreventivoId?: string;
  descripcionSugerida?: string;
  montoAutorizacionCompra?: string | null;
  onGenerada?: () => void;
}) {
  const [state, formAction, pending] = useActionState<CompraFormState, FormData>(
    crearOrdenCompraManual,
    undefined
  );
  const [items, setItems] = useState<Fila[]>([{ id: 0 }]);
  const nextId = useRef(1);
  // Este formulario se monta una vez por ítem preventivo (cada uno con su
  // propio diálogo) más el de la OT en general — los ids de DOM tienen que
  // ser únicos por instancia para no pisarse entre ellos (el `name` sí queda
  // fijo, lo lee el server action).
  const instanceId = useId();
  const domId = (sufijo: string) => `${instanceId}-${sufijo}`;

  useEffect(() => {
    // La OC generada queda visible de forma persistente en "Compras
    // asociadas" (y, si viene de un ítem, en la tarjeta de ese ítem) — no
    // depende de este mensaje.
    if (state?.numero) onGenerada?.();
  }, [state, onGenerada]);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="itemIds" value={items.map((f) => f.id).join(",")} />
      <div className="space-y-3">
        {items.map((fila, i) => (
          <div key={fila.id} className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <Label htmlFor={domId(`item_descripcion_${fila.id}`)}>
                Repuesto{items.length > 1 ? ` ${i + 1}` : ""}
              </Label>
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
            <Input
              id={domId(`item_descripcion_${fila.id}`)}
              name={`item_descripcion_${fila.id}`}
              defaultValue={i === 0 ? descripcionSugerida : ""}
              placeholder="Qué hay que comprar"
              required
            />
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor={domId(`item_cantidad_${fila.id}`)}>Cantidad</Label>
                <Input id={domId(`item_cantidad_${fila.id}`)} name={`item_cantidad_${fila.id}`} type="number" />
              </div>
              <div className="space-y-1">
                <Label htmlFor={domId(`item_foto_${fila.id}`)}>Foto de referencia</Label>
                <Input
                  id={domId(`item_foto_${fila.id}`)}
                  name={`item_foto_${fila.id}`}
                  type="file"
                  accept="image/*"
                  capture="environment"
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
        onClick={() => setItems((prev) => [...prev, { id: nextId.current++ }])}
      >
        + Agregar repuesto
      </Button>

      {montoAutorizacionCompra != null && (
        <div className="max-w-xs space-y-1">
          <Label htmlFor={domId("montoEstimado")}>Monto estimado</Label>
          <Input id={domId("montoEstimado")} name="montoEstimado" type="number" step="0.01" required />
          <p className="text-xs text-muted-foreground">
            Si supera ${montoAutorizacionCompra}, la compra queda sujeta a autorización de gerencia.
          </p>
        </div>
      )}

      <div className="space-y-1">
        <Label htmlFor={domId("observaciones")}>Observación (opcional)</Label>
        <Textarea id={domId("observaciones")} name="observaciones" rows={2} placeholder="Alguna aclaración para compras..." />
      </div>

      <input type="hidden" name="ordenDeTrabajoId" value={otId} />
      {otItemPreventivoId && <input type="hidden" name="otItemPreventivoId" value={otItemPreventivoId} />}
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.numero && (
        <p className={state.requiereAutorizacion ? "text-sm text-warning-foreground" : "text-sm text-success"}>
          Se generó la orden de compra {state.numero}.
          {state.requiereAutorizacion && " Queda sujeta a autorización de gerencia antes de poder comprarse."}
        </p>
      )}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Generando..." : "Generar OC"}
      </Button>
    </form>
  );
}
