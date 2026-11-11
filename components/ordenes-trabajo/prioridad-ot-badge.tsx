import { Badge } from "@/components/ui/badge";
import type { PrioridadOT } from "@/app/generated/prisma/client";

const PRIORIDAD_LABEL: Record<PrioridadOT, string> = {
  BAJA: "Baja",
  MEDIA: "Media",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

const PRIORIDAD_VARIANT: Record<PrioridadOT, "secondary" | "success" | "warning" | "destructive"> = {
  BAJA: "success",
  MEDIA: "secondary",
  ALTA: "warning",
  URGENTE: "destructive",
};

// Mismo criterio visual que el listado de /ordenes-trabajo: acento de color a
// la izquierda y un tinte suave de fondo solo para alta/urgente.
export const PRIORIDAD_ACENTO_CLASS: Record<PrioridadOT, string> = {
  BAJA: "border-l-4 border-l-success/60",
  MEDIA: "border-l-4 border-l-muted-foreground/30",
  ALTA: "border-l-4 border-l-warning bg-warning/5",
  URGENTE: "border-l-4 border-l-destructive bg-destructive/5",
};

export function PrioridadOTBadge({ prioridad }: { prioridad: PrioridadOT }) {
  return <Badge variant={PRIORIDAD_VARIANT[prioridad]}>Prioridad {PRIORIDAD_LABEL[prioridad].toLowerCase()}</Badge>;
}
