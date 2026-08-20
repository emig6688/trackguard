"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { marcarCompraRealizada, cancelarOrdenCompra } from "@/app/_actions/compras";
import { extraerMontoDeTexto } from "@/lib/ocr-monto";

export function RealizarCompraForm({
  compraId,
  items,
  puedeRealizar = true,
}: {
  compraId: string;
  items: { id: string; descripcion: string; cantidadSolicitada: number | null }[];
  puedeRealizar?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [mostrarForm, setMostrarForm] = useState(false);
  const [monto, setMonto] = useState("");
  const [leyendo, setLeyendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCancelar = () => {
    startTransition(() => cancelarOrdenCompra(compraId));
  };

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await marcarCompraRealizada(compraId, undefined, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setMostrarForm(false);
    });
  }

  async function onFacturaChange(e: React.ChangeEvent<HTMLInputElement>) {
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

  if (mostrarForm) {
    return (
      <form className="w-full space-y-3 rounded-lg border p-3" action={onSubmit}>
        <div className="space-y-2">
          <Label>Cantidad recibida por repuesto</Label>
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm">{item.descripcion}</span>
              <Input
                name={`cantidadRecibida_${item.id}`}
                type="number"
                defaultValue={item.cantidadSolicitada ?? undefined}
                className="w-24"
              />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor={`montoTotal-${compraId}`}>Monto total</Label>
            <Input
              id={`montoTotal-${compraId}`}
              name="montoTotal"
              type="number"
              step="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`fechaCompra-${compraId}`}>Fecha de compra</Label>
            <Input
              id={`fechaCompra-${compraId}`}
              name="fechaCompra"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              required
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`proveedor-${compraId}`}>Proveedor</Label>
          <Input id={`proveedor-${compraId}`} name="proveedor" placeholder="Ej: Repuestos del Sur" />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`archivoFactura-${compraId}`}>Foto de la factura (opcional)</Label>
          <Input
            id={`archivoFactura-${compraId}`}
            name="archivoFactura"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onFacturaChange}
          />
          {leyendo && (
            <p className="text-xs text-muted-foreground">Leyendo el monto de la factura...</p>
          )}
          <p className="text-xs text-muted-foreground">
            Si la cargás ahora, la compra queda directamente documentada. Si no la tenés a mano,
            se puede adjuntar más adelante desde el listado.
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`observaciones-${compraId}`}>Observaciones</Label>
          <Textarea id={`observaciones-${compraId}`} name="observaciones" rows={2} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={pending || leyendo}>
            {pending ? "Guardando..." : "Confirmar compra"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setMostrarForm(false);
              setError(null);
            }}
            disabled={pending}
          >
            Cancelar
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex shrink-0 gap-2">
      {puedeRealizar && (
        <Button type="button" size="sm" onClick={() => setMostrarForm(true)}>
          Recibir Compra
        </Button>
      )}
      <Button type="button" variant="destructive" size="sm" onClick={onCancelar} disabled={pending}>
        Cancelar pedido
      </Button>
    </div>
  );
}
