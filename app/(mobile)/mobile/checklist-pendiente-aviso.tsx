import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function ChecklistPendienteAviso() {
  return (
    <div className="space-y-3 rounded-lg border border-warning/40 bg-warning/5 p-4 text-center">
      <TriangleAlert className="mx-auto size-6 text-warning" strokeWidth={2} />
      <p className="font-medium">Completá el checklist pre-salida primero</p>
      <p className="text-sm text-muted-foreground">
        Esta empresa exige el checklist pre-salida antes de cualquier otra acción del día.
      </p>
      <Link href="/mobile/checklist" className={buttonVariants({ className: "w-full" })}>
        Hacer el checklist
      </Link>
    </div>
  );
}
