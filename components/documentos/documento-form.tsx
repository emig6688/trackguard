"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { crearDocumento, type DocumentoFormState } from "@/app/_actions/documentos";

export function DocumentoForm({
  entidadTipo,
  entidadId,
  redirectPath,
  tiposDocumento,
}: {
  entidadTipo: "VEHICULO" | "CHOFER";
  entidadId: string;
  redirectPath: string;
  tiposDocumento: { id: string; nombre: string }[];
}) {
  const action = crearDocumento.bind(null, redirectPath);
  const [state, formAction, pending] = useActionState<DocumentoFormState, FormData>(
    action,
    undefined
  );
  const errors = state?.fieldErrors ?? {};
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4 rounded-lg border p-4">
      <input type="hidden" name="entidadTipo" value={entidadTipo} />
      <input type="hidden" name="entidadId" value={entidadId} />

      <div className="space-y-2">
        <Label htmlFor="tipoDocumentoId">Tipo de documento</Label>
        <Select name="tipoDocumentoId">
          <SelectTrigger id="tipoDocumentoId" className="w-full">
            <SelectValue placeholder="Elegí un tipo">
              {(value: string) =>
                tiposDocumento.find((tipo) => tipo.id === value)?.nombre ?? "Elegí un tipo"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {tiposDocumento.map((tipo) => (
              <SelectItem key={tipo.id} value={tipo.id}>
                {tipo.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.tipoDocumentoId && (
          <p className="text-sm text-destructive">{errors.tipoDocumentoId[0]}</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="numeroDocumento">Número (opcional)</Label>
          <Input id="numeroDocumento" name="numeroDocumento" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fechaEmision">Fecha de emisión</Label>
          <Input id="fechaEmision" name="fechaEmision" type="date" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="fechaVencimiento">Fecha de vencimiento</Label>
        <Input id="fechaVencimiento" name="fechaVencimiento" type="date" required />
        {errors.fechaVencimiento && (
          <p className="text-sm text-destructive">{errors.fechaVencimiento[0]}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="observaciones">Observaciones</Label>
        <Input id="observaciones" name="observaciones" />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-600">Documento agregado.</p>}

      <Button type="submit" disabled={pending} size="sm">
        {pending ? "Guardando..." : "Agregar documento"}
      </Button>
    </form>
  );
}
