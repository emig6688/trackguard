import { Wrench, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { OrigenOT } from "@/app/generated/prisma/client";

export function OrigenOTBadge({ origen }: { origen: OrigenOT }) {
  if (origen === "PREVENTIVO") {
    return (
      <Badge variant="outline" className="gap-1 border-chart-4/40 text-chart-4">
        <Wrench className="size-3" />
        Preventivo
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 border-warning/40 text-warning-foreground">
      <TriangleAlert className="size-3" />
      Correctivo
    </Badge>
  );
}
