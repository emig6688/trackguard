"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  completarItemsPreventivos,
  type CompletarItemsPreventivosState,
} from "@/app/_actions/ordenesTrabajo";
import { RepuestoForm } from "./repuesto-form";
import { OCForm } from "./oc-form";

type Resultado = "PENDIENTE" | "OK" | "REPARADO";

type ArticuloOpcion = { id: string; nombre: string; stockActual: number; unidadMedida: string | null };

export type ItemPreventivo = {
  id: string;
  titulo: string;
  categoria: string | null;
  resultado: Resultado;
  observacion: string | null;
  archivo: { url: string } | null;
  ordenesCompra: { id: string; numero: string; items: { descripcion: string }[] }[];
  repuestos: { id: string; descripcion: string; cantidad: number }[];
};

const RESULTADO_LABEL: Record<Resultado, string> = {
  PENDIENTE: "Pendiente",
  OK: "OK",
  REPARADO: "Reparado",
};

const RESULTADO_PILL_CLASS: Record<Resultado, string> = {
  PENDIENTE: "bg-muted text-muted-foreground",
  OK: "bg-success/15 text-success",
  REPARADO: "bg-warning/20 text-warning-foreground",
};

// Alternado celeste/gris por posición (no por estado): el estado ya tiene su
// propio color en OK/Reparado, así que la separación entre actividades usa
// una escala distinta para no competir con esos dos.
const ALTERNADO_CLASS = ["border-chart-4/30 bg-chart-4/5", "border-border bg-muted/30"];

function ItemPreventivoRow({
  numero,
  otId,
  item,
  resultado,
  onResultadoChange,
  invalido,
  alternado,
  puedeGenerarOC,
  articulosPanol,
  montoAutorizacionCompra,
}: {
  numero: number;
  otId: string;
  item: ItemPreventivo;
  resultado: Resultado;
  onResultadoChange: (r: Resultado) => void;
  invalido: boolean;
  alternado: string;
  puedeGenerarOC: boolean;
  articulosPanol: ArticuloOpcion[];
  montoAutorizacionCompra: string | null;
}) {
  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [dialogPanolAbierto, setDialogPanolAbierto] = useState(false);

  return (
    <div
      className={`space-y-3 rounded-lg border-2 p-4 ${invalido ? "border-destructive bg-destructive/5" : alternado}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold">
            <span className="text-muted-foreground">{numero}.</span> {item.titulo}
          </p>
          {item.categoria && <p className="text-xs text-muted-foreground">{item.categoria}</p>}
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${RESULTADO_PILL_CLASS[resultado]}`}>
          {RESULTADO_LABEL[resultado]}
        </span>
      </div>

      <input type="hidden" name={`resultado_${item.id}`} value={resultado} />

      <div className="flex gap-2">
        <Button
          type="button"
          size="xs"
          variant="outline"
          className={resultado === "OK" ? "border-success bg-success text-success-foreground hover:bg-success/90" : ""}
          onClick={() => onResultadoChange(resultado === "OK" ? "PENDIENTE" : "OK")}
        >
          OK
        </Button>
        <Button
          type="button"
          size="xs"
          variant="outline"
          className={
            resultado === "REPARADO" ? "border-warning bg-warning text-warning-foreground hover:bg-warning/90" : ""
          }
          onClick={() => onResultadoChange(resultado === "REPARADO" ? "PENDIENTE" : "REPARADO")}
        >
          Reparado
        </Button>
      </div>

      <Textarea
        name={`observacion_${item.id}`}
        placeholder="Observación (obligatoria si no subís foto)"
        defaultValue={item.observacion ?? ""}
        rows={2}
        className="text-sm"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Input name={`foto_${item.id}`} type="file" accept="image/*" capture="environment" className="max-w-56 text-xs" />
        {item.archivo && (
          <a
            href={item.archivo.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground underline"
          >
            Ver foto cargada
          </a>
        )}
      </div>
      {invalido && (
        <p className="text-xs font-medium text-destructive">Falta observación o foto en este ítem.</p>
      )}

      {(item.ordenesCompra.length > 0 || item.repuestos.length > 0) && (
        <div className="space-y-1 rounded-md border border-dashed p-2">
          {item.repuestos.map((r) => (
            <p key={r.id} className="text-xs text-muted-foreground">
              Repuesto usado: <span className="font-medium text-foreground">{r.cantidad}x</span> {r.descripcion}
            </p>
          ))}
          {item.ordenesCompra.map((oc) => (
            <p key={oc.id} className="text-xs text-muted-foreground">
              OC generada: <span className="font-medium text-foreground">{oc.numero}</span> ·{" "}
              {oc.items.map((i) => i.descripcion).join(", ")}
            </p>
          ))}
        </div>
      )}

      {resultado === "REPARADO" && (
        <div className="flex flex-wrap gap-2">
          <Dialog open={dialogPanolAbierto} onOpenChange={setDialogPanolAbierto}>
            <DialogTrigger render={<Button type="button" size="xs" variant="outline" />}>
              Usar repuesto de pañol
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Usar repuesto de pañol — {item.titulo}</DialogTitle>
              </DialogHeader>
              <RepuestoForm
                otId={otId}
                articulos={articulosPanol}
                defaultDescripcion={item.titulo}
                otItemPreventivoId={item.id}
                onGuardado={() => setDialogPanolAbierto(false)}
              />
            </DialogContent>
          </Dialog>

          {puedeGenerarOC && (
            <Dialog open={dialogAbierto} onOpenChange={setDialogAbierto}>
              <DialogTrigger render={<Button type="button" size="xs" variant="outline" />}>
                Generar orden de compra
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Generar orden de compra — {item.titulo}</DialogTitle>
                </DialogHeader>
                <OCForm
                  otId={otId}
                  otItemPreventivoId={item.id}
                  descripcionSugerida={item.titulo}
                  montoAutorizacionCompra={montoAutorizacionCompra}
                  onGenerada={() => setDialogAbierto(false)}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
      )}
    </div>
  );
}

export function ItemsPreventivosForm({
  otId,
  items,
  puedeGenerarOC,
  articulosPanol,
  montoAutorizacionCompra,
}: {
  otId: string;
  items: ItemPreventivo[];
  puedeGenerarOC: boolean;
  articulosPanol: ArticuloOpcion[];
  montoAutorizacionCompra: string | null;
}) {
  const [resultados, setResultados] = useState<Record<string, Resultado>>(() =>
    Object.fromEntries(items.map((i) => [i.id, i.resultado]))
  );
  const [state, formAction, pending] = useActionState<CompletarItemsPreventivosState, FormData>(
    completarItemsPreventivos.bind(null, otId),
    undefined
  );

  const resueltos = Object.values(resultados).filter((r) => r !== "PENDIENTE").length;
  const total = items.length;
  const itemsInvalidos = new Set(state?.itemsInvalidos ?? []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Ítems de mantenimiento preventivo</h2>
        <span className="text-sm text-muted-foreground">
          {resueltos}/{total} revisados
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-success"
          style={{ width: `${total > 0 ? Math.round((resueltos / total) * 100) : 0}%` }}
        />
      </div>

      <form action={formAction} className="space-y-3">
        {items.map((item, i) => (
          <ItemPreventivoRow
            key={item.id}
            numero={i + 1}
            otId={otId}
            item={item}
            resultado={resultados[item.id]}
            onResultadoChange={(r) => setResultados((prev) => ({ ...prev, [item.id]: r }))}
            invalido={itemsInvalidos.has(item.id)}
            alternado={ALTERNADO_CLASS[i % 2]}
            puedeGenerarOC={puedeGenerarOC}
            articulosPanol={articulosPanol}
            montoAutorizacionCompra={montoAutorizacionCompra}
          />
        ))}

        {state?.error && <p className="text-sm font-medium text-destructive">{state.error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando..." : "Guardar"}
        </Button>
      </form>
    </div>
  );
}
