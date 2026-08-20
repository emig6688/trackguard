"use client";

import { useActionState, useEffect, useState } from "react";
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
import { agregarRepuesto, type AgregarRepuestoState } from "@/app/_actions/ordenesTrabajo";

type ArticuloOpcion = { id: string; nombre: string; stockActual: number; unidadMedida: string | null };

// Base UI no admite un SelectItem con value="" — sin un ítem real que
// represente "ninguno", el trigger mostraba el id crudo del artículo elegido
// en vez de su nombre (SelectValue necesita resolver el value actual contra
// algún ítem de la lista).
const SIN_ARTICULO = "__sin_articulo__";

export function RepuestoForm({
  otId,
  articulos,
  defaultDescripcion = "",
  otItemPreventivoId,
  onGuardado,
}: {
  otId: string;
  articulos: ArticuloOpcion[];
  defaultDescripcion?: string;
  otItemPreventivoId?: string;
  onGuardado?: () => void;
}) {
  const [state, formAction, pending] = useActionState<AgregarRepuestoState, FormData>(
    agregarRepuesto.bind(null, otId),
    undefined
  );

  useEffect(() => {
    if (state?.mensaje) onGuardado?.();
  }, [state, onGuardado]);
  const [articuloId, setArticuloId] = useState("");
  const [descripcion, setDescripcion] = useState(defaultDescripcion);

  const onSeleccionarArticulo = (id: string | null) => {
    if (id === SIN_ARTICULO) {
      setArticuloId("");
      return;
    }
    setArticuloId(id ?? "");
    const articulo = articulos.find((a) => a.id === id);
    if (articulo) setDescripcion(articulo.nombre);
  };

  return (
    <form action={formAction} className="space-y-2 rounded-lg border p-3">
      {otItemPreventivoId && <input type="hidden" name="otItemPreventivoId" value={otItemPreventivoId} />}
      <div className="flex flex-wrap items-end gap-2">
        {articulos.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="articuloPanolSelect">Del pañol (opcional)</Label>
            <input type="hidden" name="articuloPanolId" value={articuloId} />
            <Select value={articuloId || SIN_ARTICULO} onValueChange={onSeleccionarArticulo}>
              <SelectTrigger id="articuloPanolSelect" className="w-52">
                <SelectValue placeholder="Repuesto en stock...">
                  {(value: string) => {
                    if (value === SIN_ARTICULO) return "Repuesto en stock...";
                    const a = articulos.find((a) => a.id === value);
                    return a ? `${a.nombre} (${a.stockActual} ${a.unidadMedida ?? "u."})` : "Repuesto en stock...";
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_ARTICULO}>Repuesto en stock...</SelectItem>
                {articulos.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nombre} ({a.stockActual} {a.unidadMedida ?? "u."})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="descripcion">Repuesto</Label>
          <Input
            id="descripcion"
            name="descripcion"
            className="w-48"
            value={descripcion}
            onChange={(e) => {
              setDescripcion(e.target.value);
              setArticuloId("");
            }}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cantidad">Cantidad</Label>
          <Input id="cantidad" name="cantidad" type="number" defaultValue={1} className="w-20" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="costoUnitario">Costo unitario</Label>
          <Input id="costoUnitario" name="costoUnitario" type="number" className="w-28" />
        </div>
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? "Agregando..." : "Agregar"}
        </Button>
      </div>
      {state?.mensaje && <p className="text-sm text-success">{state.mensaje}</p>}
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
