"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registrarCargaCombustible } from "@/app/_actions/combustible";
import { leerTicketCombustibleAction } from "@/app/_actions/ocrTicketCombustible";

// Las fotos de cámara de un celular actual (sobre todo Android de alta resolución)
// suelen pesar varios MB — de sobra para que la IA lea un ticket, pero innecesario
// para OpenAI y con riesgo de chocar contra el límite de tamaño de la Server
// Action. Se reescala a un máximo razonable en el propio celular antes de mandarla
// a leer; el archivo original (sin tocar) es el que se guarda al enviar el
// formulario, esto solo afecta a la copia que se le manda a la IA.
async function reducirImagenParaLectura(file: File): Promise<File> {
  const MAX_LADO = 1600;
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;
  if (width > MAX_LADO || height > MAX_LADO) {
    const escala = MAX_LADO / Math.max(width, height);
    width = Math.round(width * escala);
    height = Math.round(height * escala);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("sin contexto 2d");
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("no se pudo comprimir la imagen");
  return new File([blob], "ticket.jpg", { type: "image/jpeg" });
}

export function CombustibleForm({
  vehiculos,
  vehiculoActivo,
}: {
  vehiculos: { id: string; patente: string }[];
  vehiculoActivo: { id: string; patente: string } | null;
}) {
  const [state, formAction, pending] = useActionState(registrarCargaCombustible, undefined);
  const [kmOdometro, setKmOdometro] = useState("");
  const [litros, setLitros] = useState("");
  const [monto, setMonto] = useState("");
  const [estacionServicio, setEstacionServicio] = useState("");
  const [leyendoTicket, setLeyendoTicket] = useState(false);
  const [errorTicket, setErrorTicket] = useState<string | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const archivoTicketRef = useRef<HTMLInputElement>(null);

  function abrirCamara() {
    archivoTicketRef.current?.setAttribute("capture", "environment");
    archivoTicketRef.current?.click();
  }

  function abrirGaleria() {
    archivoTicketRef.current?.removeAttribute("capture");
    archivoTicketRef.current?.click();
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setNombreArchivo(file.name);
    setLeyendoTicket(true);
    setErrorTicket(null);
    try {
      const archivoParaLeer = await reducirImagenParaLectura(file).catch(() => file);
      const datosArchivo = new FormData();
      datosArchivo.set("archivoTicket", archivoParaLeer);
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
        {vehiculoActivo ? (
          <>
            <input type="hidden" name="vehiculoId" value={vehiculoActivo.id} />
            <p className="rounded-md border bg-muted/40 p-2 text-sm font-medium">
              {vehiculoActivo.patente}{" "}
              <span className="font-normal text-muted-foreground">(el que usaste en tu checklist de hoy)</span>
            </p>
          </>
        ) : (
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
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="archivoTicket">Foto del ticket</Label>
        {/* accept explícito (no "image/*"): en iPhones con formato HEIC, esto es lo
        que hace que Safari convierta la foto a JPEG antes de subirla — la API de
        OpenAI no acepta HEIC, y con "image/*" Safari la deja pasar sin convertir.
        El input real queda oculto con sr-only (no "hidden"/display:none, para que
        la validación "required" del navegador lo siga teniendo en cuenta) y dos
        botones lo disparan con o sin "capture" para elegir cámara o galería. */}
        <input
          ref={archivoTicketRef}
          id="archivoTicket"
          name="archivoTicket"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          onChange={onFileChange}
          className="sr-only"
        />
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={abrirCamara}>
            Sacar foto
          </Button>
          <Button type="button" variant="outline" className="flex-1" onClick={abrirGaleria}>
            Elegir de galería
          </Button>
        </div>
        {nombreArchivo && !leyendoTicket && !errorTicket && (
          <p className="text-xs text-muted-foreground">Foto elegida: {nombreArchivo}</p>
        )}
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

      <p className="rounded-md border border-warning-foreground/30 bg-warning/10 p-2 text-xs text-warning-foreground">
        Cargá el tanque lleno. Si la carga es parcial, el consumo calculado para este tramo va a
        quedar mal.
      </p>

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
