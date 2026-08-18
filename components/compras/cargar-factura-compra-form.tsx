"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cargarFacturaCompra } from "@/app/_actions/compras";
import { extraerMontoDeTexto } from "@/lib/ocr-monto";

export function CargarFacturaCompraForm({ compraId }: { compraId: string }) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [monto, setMonto] = useState("");
  const [leyendo, setLeyendo] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLeyendo(true);
    try {
      const Tesseract = await import("tesseract.js");
      const { data } = await Tesseract.recognize(file, "eng");
      const detectado = extraerMontoDeTexto(data.text);
      if (detectado != null) setMonto(String(detectado));
    } catch {
      // Si el OCR falla, el encargado completa el monto a mano.
    } finally {
      setLeyendo(false);
    }
  }

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await cargarFacturaCompra(compraId, undefined, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setError(null);
      formRef.current?.reset();
      setMonto("");
      setMostrarForm(false);
    });
  }

  if (!mostrarForm) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setMostrarForm(true)}>
        Cargar factura
      </Button>
    );
  }

  return (
    <form
      ref={formRef}
      action={onSubmit}
      className="w-full space-y-3 rounded-lg border p-3"
    >
      <div className="space-y-1">
        <Label htmlFor={`archivoFactura-${compraId}`}>Foto de la factura</Label>
        <Input
          id={`archivoFactura-${compraId}`}
          name="archivoFactura"
          type="file"
          accept="image/*"
          capture="environment"
          required
          onChange={onFileChange}
        />
        {leyendo && (
          <p className="text-xs text-muted-foreground">Leyendo el monto de la factura...</p>
        )}
      </div>

      <div className="max-w-xs space-y-1">
        <Label htmlFor={`montoTotal-${compraId}`}>Monto</Label>
        <Input
          id={`montoTotal-${compraId}`}
          name="montoTotal"
          type="number"
          step="0.01"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
        />
      </div>

      <div className="max-w-xs space-y-1">
        <Label htmlFor={`proveedor-${compraId}`}>Proveedor</Label>
        <Input id={`proveedor-${compraId}`} name="proveedor" placeholder="Ej: Repuestos del Sur" />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending || leyendo}>
          {pending ? "Guardando..." : "Confirmar"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setMostrarForm(false)}
          disabled={pending}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
