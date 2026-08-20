import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TrazabilidadPanel({
  vehiculoId,
  desde,
  hasta,
}: {
  vehiculoId: string;
  desde?: string;
  hasta?: string;
}) {
  const query = new URLSearchParams({ vehiculoId });
  if (desde) query.set("desde", desde);
  if (hasta) query.set("hasta", hasta);
  const queryString = query.toString();

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <h2 className="text-lg font-semibold">Reporte de trazabilidad</h2>

      <form className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="desde">Desde</Label>
          <Input id="desde" name="desde" type="date" defaultValue={desde} className="w-full sm:w-40" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="hasta">Hasta</Label>
          <Input id="hasta" name="hasta" type="date" defaultValue={hasta} className="w-full sm:w-40" />
        </div>
        <Button type="submit" variant="outline">
          Aplicar período
        </Button>
        {(desde || hasta) && (
          <Link
            href={`/vehiculos/${vehiculoId}`}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Limpiar
          </Link>
        )}
      </form>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <a
          href={`/api/export/trazabilidad-pdf?${queryString}`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Exportar PDF
        </a>
        <span className="text-muted-foreground">CSV:</span>
        <a
          href={`/api/export/trazabilidad-csv?${queryString}&tipo=mantenimientos`}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Correctivos
        </a>
        <a
          href={`/api/export/trazabilidad-csv?${queryString}&tipo=preventivo`}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Preventivo
        </a>
        <a
          href={`/api/export/trazabilidad-csv?${queryString}&tipo=documentacion`}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Documentación
        </a>
      </div>
      <p className="text-xs text-muted-foreground">
        Sin período elegido, el reporte toma el último año.
      </p>
    </div>
  );
}
