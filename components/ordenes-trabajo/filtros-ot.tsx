"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TODOS = "TODOS";

export function FiltrosOT({
  choferes,
  numeros,
}: {
  choferes: { id: string; nombre: string }[];
  numeros: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [numero, setNumero] = useState(searchParams.get("numero") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-52">
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
      <Select
        value={searchParams.get("chofer") ?? TODOS}
        onValueChange={(v) => actualizarParam("chofer", v ?? TODOS)}
      >
        <SelectTrigger className="w-44">
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
    </div>
  );
}
