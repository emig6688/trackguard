"use client";

import { useActionState, useId, useState } from "react";
import { ArrowUp, ArrowDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { guardarChecklistTemplate } from "@/app/_actions/checklistTemplate";

export function ChecklistTemplateForm({ itemsIniciales }: { itemsIniciales: string[] }) {
  const [state, formAction, pending] = useActionState(guardarChecklistTemplate, undefined);
  const [items, setItems] = useState<{ id: string; texto: string }[]>(
    itemsIniciales.map((texto) => ({ id: crypto.randomUUID(), texto }))
  );
  const [nuevoItem, setNuevoItem] = useState("");
  const nuevoItemId = useId();

  function agregar() {
    const texto = nuevoItem.trim();
    if (!texto) return;
    setItems((prev) => [...prev, { id: crypto.randomUUID(), texto }]);
    setNuevoItem("");
  }

  function quitar(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function mover(id: string, direccion: -1 | 1) {
    setItems((prev) => {
      const i = prev.findIndex((it) => it.id === id);
      const j = i + direccion;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const copia = [...prev];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      return copia;
    });
  }

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={item.id} className="flex items-center gap-2">
            <Input name="item" defaultValue={item.texto} className="flex-1" />
            <Button
              type="button"
              variant="outline"
              size="icon-xs"
              disabled={i === 0}
              onClick={() => mover(item.id, -1)}
              aria-label="Subir"
            >
              <ArrowUp className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-xs"
              disabled={i === items.length - 1}
              onClick={() => mover(item.id, 1)}
              aria-label="Bajar"
            >
              <ArrowDown className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-xs"
              onClick={() => quitar(item.id)}
              aria-label="Quitar ítem"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">Todavía no hay ítems cargados.</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Input
          id={nuevoItemId}
          value={nuevoItem}
          onChange={(e) => setNuevoItem(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              agregar();
            }
          }}
          placeholder="Ej: Nivel de líquido de frenos"
          className="flex-1"
        />
        <Button type="button" variant="outline" size="sm" onClick={agregar}>
          Agregar ítem
        </Button>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && <p className="text-sm text-success">Checklist actualizado.</p>}

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Guardando..." : "Guardar checklist"}
      </Button>
    </form>
  );
}
