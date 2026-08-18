"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { asignarCompraAOrdenDeTrabajo } from "@/app/_actions/compras";

export function AsignarOtCompra({
  compraId,
  ordenDeTrabajoId,
  ordenes,
}: {
  compraId: string;
  ordenDeTrabajoId: string | null;
  ordenes: { id: string; numero: string; titulo: string }[];
}) {
  const otAsignada = ordenes.find((ot) => ot.id === ordenDeTrabajoId);
  const [texto, setTexto] = useState(otAsignada?.numero ?? "");
  const [sinCoincidencia, setSinCoincidencia] = useState(false);
  const [pending, startTransition] = useTransition();
  const datalistId = `ots-disponibles-${compraId}`;

  function resolver() {
    const valor = texto.trim();
    if (!valor) {
      setSinCoincidencia(false);
      if (ordenDeTrabajoId) startTransition(() => asignarCompraAOrdenDeTrabajo(compraId, null));
      return;
    }
    const encontrada = ordenes.find((ot) => ot.numero.toLowerCase() === valor.toLowerCase());
    if (!encontrada) {
      setSinCoincidencia(true);
      return;
    }
    setSinCoincidencia(false);
    setTexto(encontrada.numero);
    if (encontrada.id !== ordenDeTrabajoId) {
      startTransition(() => asignarCompraAOrdenDeTrabajo(compraId, encontrada.id));
    }
  }

  return (
    <div className="w-56">
      <Input
        list={datalistId}
        value={texto}
        disabled={pending}
        placeholder="Nº de OT..."
        className="h-8 text-xs"
        onChange={(e) => {
          setTexto(e.target.value);
          setSinCoincidencia(false);
        }}
        onBlur={resolver}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            resolver();
          }
        }}
      />
      <datalist id={datalistId}>
        {ordenes.map((ot) => (
          <option key={ot.id} value={ot.numero}>
            {ot.titulo}
          </option>
        ))}
      </datalist>
      {sinCoincidencia && (
        <p className="mt-1 text-xs text-destructive">No se encontró esa OT.</p>
      )}
    </div>
  );
}
