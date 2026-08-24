"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TODOS = "TODOS";

export function FiltrosOT({
  choferes,
  numeros,
  patentes,
}: {
  choferes: { id: string; nombre: string }[];
  numeros: string[];
  patentes: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [numero, setNumero] = useState(searchParams.get("numero") ?? "");
  const [patente, setPatente] = useState(searchParams.get("patente") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncePatenteRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function actualizarParam(clave: string, valor: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!valor || valor === TODOS) params.delete(clave);
    else params.set(clave, valor);
    router.push(`/ordenes-trabajo?${params.toString()}`);
  }

  function onNumeroChange(v: string) {
    setNumero(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => actualizarParam("numero", v), 350);
  }

  function onPatenteChange(v: string) {
    setPatente(v);
    if (debouncePatenteRef.current) clearTimeout(debouncePatenteRef.current);
    debouncePatenteRef.current = setTimeout(() => actualizarParam("patente", v), 350);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (debouncePatenteRef.current) clearTimeout(debouncePatenteRef.current);
    };
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-36 sm:w-52">
        <Input
          list="ot-numeros"
          placeholder="Buscar Nº de OT..."
          value={numero}
          onChange={(e) => onNumeroChange(e.target.value)}
        />
        <datalist id="ot-numeros">
          {numeros.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </div>
      <div className="w-32 sm:w-40">
        <Input
          list="ot-patentes"
          placeholder="Buscar patente..."
          value={patente}
          onChange={(e) => onPatenteChange(e.target.value)}
        />
        <datalist id="ot-patentes">
          {patentes.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </div>
      <Select
        value={searchParams.get("chofer") ?? TODOS}
        onValueChange={(v) => actualizarParam("chofer", v ?? TODOS)}
      >
        <SelectTrigger className="w-36 sm:w-44">
          <SelectValue placeholder="Filtrar por chofer">
            {(value: string) =>
              value === TODOS ? "Todos los choferes" : (choferes.find((c) => c.id === value)?.nombre ?? value)
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos los choferes</SelectItem>
          {choferes.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {searchParams.toString() && (
        <Button type="button" variant="ghost" size="sm" onClick={() => router.push("/ordenes-trabajo")}>
          Limpiar filtros
        </Button>
      )}
    </div>
  );
}
