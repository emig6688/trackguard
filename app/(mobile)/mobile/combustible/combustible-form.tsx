"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registrarCargaCombustible } from "@/app/_actions/combustible";
import { leerTicketCombustibleAction } from "@/app/_actions/ocrTicketCombustible";

export function CombustibleForm({ vehiculos }: { vehiculos: { id: string; patente: string }[] }) {
  const [state, formAction, pending] = useActionState(registrarCargaCombustible, undefined);
  const [kmOdometro, setKmOdometro] = useState("");
  const [litros, setLitros] = useState("");
  const [monto, setMonto] = useState("");
  const [estacionServicio, setEstacionServicio] = useState("");
  const [leyendoTicket, setLeyendoTicket] = useState(false);
  const [errorTicket, setErrorTicket] = useState<string | null>(null);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLeyendoTicket(true);
    setErrorTicket(null);
    try {
      const datosArchivo = new FormData();
      datosArchivo.set("archivoTicket", file);
      const resultado = await leerTicketCombustibleAction(datosArchivo);
      if (resultado.leido) {
        const { litros, monto, proveedor, kmOdometro } = resultado.datos;
        if (litros != null) setLitros(String(litros));
        if (monto != null) setMonto(String(monto));
        if (proveedor) setEstacionServicio(proveedor);
        if (kmOdometro != null) setKmOdometro(String(kmOdometro));
        if (litros == null && monto == null && proveedor == null && kmOdometro == null) {
          setErrorTicket("No pudimos reconocer ningún dato en la foto. Completá los campos a mano.");
        }
      } else if (resultado.motivo === "archivo_invalido") {
        setErrorTicket("Esa foto está en un formato que no podemos leer. Completá los campos a mano.");
      } else {
        setErrorTicket("No se pudo leer el ticket automáticamente. Completá los campos a mano.");
      }
    } catch {
      setErrorTicket("No se pudo leer el ticket automáticamente. Completá los campos a mano.");
    } finally {
      setLeyendoTicket(false);
    }
  }

  if (state?.success) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-lg font-semibold">Carga registrada</h1>
        {state.kmRecorridos != null && state.consumoL100km != null ? (
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Km recorridos desde la última carga</p>
            <p className="text-2xl font-semibold">{state.kmRecorridos} km</p>
            <p className="mt-2 text-sm text-muted-foreground">Consumo</p>
            <p className="text-2xl font-semibold">{state.consumoL100km} L/100km</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Es la primera carga registrada para este vehículo, todavía no hay consumo para calcular.
          </p>
        )}
        <a href="/mobile/inicio" className="block underline">
          Volver al inicio
        </a>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <h1 className="text-lg font-semibold">Cargar combustible</h1>

      <div className="space-y-2">
        <Label htmlFor="vehiculoId">Vehículo</Label>
        <select
          id="vehiculoId"
          name="vehiculoId"
          required
          className="w-full rounded-md border border-input bg-transparent p-2 text-sm"
        >
          <option value="">Elegí un vehículo</option>
          {vehiculos.map((v) => (
            <option key={v.id} value={v.id}>
              {v.patente}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="archivoTicket">Foto del ticket</Label>
        {/* accept explícito (no "image/*"): en iPhones con formato HEIC, esto es lo
        que hace que Safari convierta la foto a JPEG antes de subirla — la API de
        OpenAI no acepta HEIC, y con "image/*" Safari la deja pasar sin convertir. */}
        <Input
          id="archivoTicket"
          name="archivoTicket"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          onChange={onFileChange}
        />
        {leyendoTicket && (
          <p className="text-xs text-muted-foreground">Leyendo el ticket con IA...</p>
        )}
        {!leyendoTicket && errorTicket && (
          <p className="text-xs text-warning-foreground">{errorTicket}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="kmOdometro">Km actual del odómetro</Label>
        <Input
          id="kmOdometro"
          name="kmOdometro"
          type="number"
          inputMode="numeric"
          required
          value={kmOdometro}
          onChange={(e) => setKmOdometro(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="litrosCargados">Litros</Label>
          <Input
            id="litrosCargados"
            name="litrosCargados"
            type="number"
            step="0.01"
            inputMode="decimal"
            required
            value={litros}
            onChange={(e) => setLitros(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="montoTotal">Monto total</Label>
          <Input
            id="montoTotal"
            name="montoTotal"
            type="number"
            step="0.01"
            inputMode="decimal"
            required
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="estacionServicio">Estación de servicio (opcional)</Label>
        <Input
          id="estacionServicio"
          name="estacionServicio"
          value={estacionServicio}
          onChange={(e) => setEstacionServicio(e.target.value)}
        />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Guardando..." : "Guardar carga"}
      </Button>
    </form>
  );
}
