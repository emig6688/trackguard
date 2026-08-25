"use client";

import { useActionState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ImportarResultado } from "@/app/_actions/importar";

export function ImportarSeccion({
  titulo,
  descripcion,
  plantillaHref,
  action,
}: {
  titulo: string;
  descripcion: string;
  plantillaHref: string;
  action: (
    prevState: ImportarResultado | undefined,
    formData: FormData
  ) => Promise<ImportarResultado>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{descripcion}</p>

      <a href={plantillaHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
        Descargar plantilla
      </a>

      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor={`archivo-${titulo}`}>Archivo Excel completado</Label>
          <Input id={`archivo-${titulo}`} name="archivo" type="file" accept=".xlsx" required />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Importando..." : "Importar"}
        </Button>
      </form>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      {state?.creados !== undefined && (
        <div className="space-y-3 rounded-md border p-4">
          <p className="text-sm font-medium">
            {state.creados} {state.creados === 1 ? "registro creado" : "registros creados"}
            {state.errores && state.errores.length > 0
              ? ` — ${state.errores.length} ${state.errores.length === 1 ? "fila con error" : "filas con error"}`
              : "."}
          </p>
          {state.errores && state.errores.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Fila</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.errores.map((e) => (
                  <TableRow key={e.fila}>
                    <TableCell>{e.fila}</TableCell>
                    <TableCell className="whitespace-normal text-destructive">{e.motivo}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
}
