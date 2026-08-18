"use client";

import { useActionState, useRef, useState } from "react";
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
import { crearDevolucion, type DevolucionFormState } from "@/app/_actions/devoluciones";

type Fila = { id: number };

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

export function DevolucionForm({ choferes }: { choferes: { id: string; nombre: string }[] }) {
  const [state, formAction, pending] = useActionState<DevolucionFormState, FormData>(
    crearDevolucion,
    undefined
  );

  const [productos, setProductos] = useState<Fila[]>([{ id: 0 }]);
  const [cambios, setCambios] = useState<Fila[]>([{ id: 0 }]);
  const nextProductoId = useRef(1);
  const nextCambioId = useRef(1);
  const [choferId, setChoferId] = useState("");

  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="max-w-3xl space-y-8">
      {/* Sección 1: Devoluciones */}
      <section className="space-y-4 rounded-lg border p-4">
        <h2 className="font-semibold">1. Devoluciones</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fecha">Fecha</Label>
            <Input id="fecha" name="fecha" type="date" defaultValue={hoyISO()} required />
            {errors.fecha && <p className="text-sm text-destructive">{errors.fecha[0]}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="choferId">Chofer</Label>
            <input type="hidden" name="choferId" value={choferId} />
            <Select value={choferId} onValueChange={(v) => setChoferId(v ?? "")}>
              <SelectTrigger id="choferId" className="w-full">
                <SelectValue placeholder="Elegí un chofer...">
                  {(value: string) => choferes.find((c) => c.id === value)?.nombre ?? value}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {choferes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.choferId && <p className="text-sm text-destructive">{errors.choferId[0]}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="cliente">Cliente</Label>
            <Input id="cliente" name="cliente" required />
            {errors.cliente && <p className="text-sm text-destructive">{errors.cliente[0]}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="remito">Remito</Label>
            <Input id="remito" name="remito" required />
            {errors.remito && <p className="text-sm text-destructive">{errors.remito[0]}</p>}
          </div>
        </div>
      </section>

      {/* Sección 2: Regresa a frigorífico */}
      <section className="space-y-4 rounded-lg border p-4">
        <h2 className="font-semibold">2. Regresa a frigorífico</h2>
        <input type="hidden" name="productoIds" value={productos.map((f) => f.id).join(",")} />
        <div className="space-y-4">
          {productos.map((fila) => (
            <div key={fila.id} className="space-y-2 rounded-md border p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                <div className="space-y-1">
                  <Label htmlFor={`prod_producto_${fila.id}`}>Producto</Label>
                  <Input id={`prod_producto_${fila.id}`} name={`prod_producto_${fila.id}`} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`prod_correlativo_${fila.id}`}>Correlativo</Label>
                  <Input id={`prod_correlativo_${fila.id}`} name={`prod_correlativo_${fila.id}`} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`prod_ubicacion_${fila.id}`}>Ubicación guardado</Label>
                  <Input id={`prod_ubicacion_${fila.id}`} name={`prod_ubicacion_${fila.id}`} />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={productos.length === 1}
                  onClick={() => setProductos((prev) => prev.filter((f) => f.id !== fila.id))}
                >
                  Quitar
                </Button>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`prod_observacion_${fila.id}`}>Observación</Label>
                <Textarea id={`prod_observacion_${fila.id}`} name={`prod_observacion_${fila.id}`} rows={2} />
              </div>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setProductos((prev) => [...prev, { id: nextProductoId.current++ }])
          }
        >
          + Agregar producto
        </Button>
      </section>

      {/* Sección 3: Cambios */}
      <section className="space-y-4 rounded-lg border p-4">
        <h2 className="font-semibold">3. Cambios</h2>
        <input type="hidden" name="cambioIds" value={cambios.map((f) => f.id).join(",")} />
        <div className="space-y-4">
          {cambios.map((fila) => (
            <div key={fila.id} className="space-y-2 rounded-md border p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] sm:items-end">
                <div className="space-y-1">
                  <Label htmlFor={`cam_cliente_${fila.id}`}>Cliente al que se entregó</Label>
                  <Input id={`cam_cliente_${fila.id}`} name={`cam_cliente_${fila.id}`} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`cam_producto_${fila.id}`}>Producto</Label>
                  <Input id={`cam_producto_${fila.id}`} name={`cam_producto_${fila.id}`} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`cam_correlativo_${fila.id}`}>Correlativo</Label>
                  <Input id={`cam_correlativo_${fila.id}`} name={`cam_correlativo_${fila.id}`} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`cam_autoriz_${fila.id}`}>Autoriz.</Label>
                  <Input id={`cam_autoriz_${fila.id}`} name={`cam_autoriz_${fila.id}`} />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={cambios.length === 1}
                  onClick={() => setCambios((prev) => prev.filter((f) => f.id !== fila.id))}
                >
                  Quitar
                </Button>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`cam_observacion_${fila.id}`}>Observación</Label>
                <Textarea id={`cam_observacion_${fila.id}`} name={`cam_observacion_${fila.id}`} rows={2} />
              </div>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setCambios((prev) => [...prev, { id: nextCambioId.current++ }])}
        >
          + Agregar cambio
        </Button>
      </section>

      {state?.error && <p className="text-sm font-medium text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Guardando..." : "Guardar devolución"}
      </Button>
    </form>
  );
}
