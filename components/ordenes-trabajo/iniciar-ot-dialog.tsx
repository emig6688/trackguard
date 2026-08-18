"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { IniciarOTForm } from "@/components/ordenes-trabajo/iniciar-ot-form";

export function IniciarOTDialog({ otId, numero }: { otId: string; numero: string }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button type="button" size="sm" variant="outline" />}>Comenzar</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Iniciar {numero}</DialogTitle>
        </DialogHeader>
        <IniciarOTForm otId={otId} />
      </DialogContent>
    </Dialog>
  );
}
