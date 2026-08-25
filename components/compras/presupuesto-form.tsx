"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { subirPresupuestoCompra } from "@/app/_actions/compras";

export function PresupuestoForm({ compraId }: { compraId: string }) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await subirPresupuestoCompra(compraId, undefined, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setError(null);
      formRef.current?.reset();
      setMostrarForm(false);
    });
  }

  if (!mostrarForm) {
    return (
      <Button type="button" size="xs" variant="outline" onClick={() => setMostrarForm(true)}>
        + Agregar presupuesto
      </Button>
    );
  }

  return (
    <form ref={formRef} action={onSubmit} className="w-full space-y-2 rounded-md border p-3">
      <div className="space-y-1">
        <Label htmlFor={`archivo-${compraId}`}>Foto o archivo del presupuesto</Label>
        <Input id={`archivo-${compraId}`} name="archivo" type="file" accept="image/*,.pdf" capture="environment" required />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor={`monto-${compraId}`}>Monto</Label>
          <Input id={`monto-${compraId}`} name="monto" type="number" step="0.01" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`proveedor-${compraId}`}>Proveedor</Label>
          <Input id={`proveedor-${compraId}`} name="proveedor" required />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="xs" disabled={pending}>
          {pending ? "Subiendo..." : "Subir"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() => setMostrarForm(false)}
          disabled={pending}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
