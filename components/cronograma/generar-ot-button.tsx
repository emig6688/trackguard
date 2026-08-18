"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { crearOTDesdePlan } from "@/app/_actions/ordenesTrabajo";

export function GenerarOTButton({ planId, redirectPath }: { planId: string; redirectPath: string }) {
  const [pending, startTransition] = useTransition();
  const [creada, setCreada] = useState(false);
  const router = useRouter();

  const onClick = () => {
    startTransition(async () => {
      const otId = await crearOTDesdePlan(planId, redirectPath);
      if (otId) {
        setCreada(true);
        router.push(`/ordenes-trabajo/${otId}`);
      }
    });
  };

  if (creada) return <span className="text-xs text-muted-foreground">OT creada</span>;

  return (
    <Button type="button" size="sm" variant="outline" onClick={onClick} disabled={pending}>
      {pending ? "Generando..." : "Generar OT"}
    </Button>
  );
}
