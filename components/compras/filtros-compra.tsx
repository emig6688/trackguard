"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TODOS = "TODOS";

export function FiltrosCompra({
  vehiculos,
  choferes,
  sugerencias,
}: {
  vehiculos: { id: string; patente: string }[];
  choferes: { id: string; nombre: string }[];
  sugerencias: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busqueda, setBusqueda] = useState(searchParams.get("busqueda") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function actualizarParam(clave: string, valor: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!valor || valor === TODOS) params.delete(clave);
    else params.set(clave, valor);
    router.push(`/compras?${params.toString()}`);
  }

  function onBusquedaChange(v: string) {
    setBusqueda(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => actualizarParam("busqueda", v), 350);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="flex flex-wrap gap-2">
      <div className="w-52">
        <Input
          list="compras-sugerencias"
          placeholder="Buscar por Nº o repuesto..."
          value={busqueda}
          onChange={(e) => onBusquedaChange(e.target.value)}
        />
        <datalist id="compras-sugerencias">
          {sugerencias.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>

      <Select
        value={searchParams.get("vehiculoId") ?? TODOS}
        onValueChange={(v) => actualizarParam("vehiculoId", v ?? TODOS)}
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Filtrar por camión">
            {(value: string) => (value === TODOS ? "Todos los camiones" : vehiculos.find((v) => v.id === value)?.patente ?? value)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos los camiones</SelectItem>
          {vehiculos.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              {v.patente}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("choferId") ?? TODOS}
        onValueChange={(v) => actualizarParam("choferId", v ?? TODOS)}
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Filtrar por chofer">
            {(value: string) => (value === TODOS ? "Todos los choferes" : choferes.find((c) => c.id === value)?.nombre ?? value)}
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
        <Button type="button" variant="ghost" size="sm" onClick={() => router.push("/compras")}>
          Limpiar filtros
        </Button>
      )}
    </div>
  );
}
