"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CompletarOTForm } from "@/components/ordenes-trabajo/completar-ot-form";

export function FinalizarOTDialog({ otId, numero }: { otId: string; numero: string }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button type="button" size="sm" variant="outline" />}>Finalizar</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Completar {numero}</DialogTitle>
        </DialogHeader>
        <CompletarOTForm otId={otId} />
      </DialogContent>
    </Dialog>
  );
}
