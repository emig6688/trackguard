"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { confirmarReparacion } from "@/app/_actions/ordenesTrabajo";

export function ConfirmarReparacionForm({ otId }: { otId: string }) {
  const [pending, startTransition] = useTransition();
  const [mostrarComentario, setMostrarComentario] = useState(false);

  const enviar = (resultado: "OK" | "PROBLEMA", comentario?: string) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("resultado", resultado);
      if (comentario) formData.set("comentario", comentario);
      await confirmarReparacion(otId, formData);
    });
  };

  if (mostrarComentario) {
    return (
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          const comentario = (e.currentTarget.elements.namedItem("comentario") as HTMLTextAreaElement)
            .value;
          enviar("PROBLEMA", comentario);
        }}
      >
        <Textarea
          name="comentario"
          placeholder="Contanos qué sigue pasando (opcional)"
          rows={3}
          disabled={pending}
        />
        <div className="flex gap-2">
          <Button type="submit" variant="destructive" size="sm" disabled={pending}>
            {pending ? "Enviando..." : "Reabrir la OT"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => setMostrarComentario(false)}
          >
            Cancelar
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" disabled={pending} onClick={() => enviar("OK")}>
        {pending ? "Enviando..." : "Sí, quedó resuelto"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => setMostrarComentario(true)}
      >
        No, sigue el problema
      </Button>
    </div>
  );
}
