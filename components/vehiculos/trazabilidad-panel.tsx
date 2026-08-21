import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TrazabilidadPanel({
  vehiculos,
  vehiculoId,
  desde,
  hasta,
}: {
  vehiculos: { id: string; patente: string }[];
  vehiculoId?: string;
  desde?: string;
  hasta?: string;
}) {
  const vehiculoSeleccionado = vehiculoId && vehiculos.some((v) => v.id === vehiculoId) ? vehiculoId : vehiculos[0]?.id;

  const query = new URLSearchParams();
  if (vehiculoSeleccionado) query.set("vehiculoId", vehiculoSeleccionado);
  if (desde) query.set("desde", desde);
  if (hasta) query.set("hasta", hasta);
  const queryString = query.toString();

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <h2 className="text-lg font-semibold">Reporte de trazabilidad por vehículo</h2>

      {vehiculos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay vehículos activos.</p>
      ) : (
        <>
          <form className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="tab" value="reportes" />
            <div className="space-y-1">
              <Label htmlFor="trz-vehiculoId">Vehículo</Label>
              <select
                id="trz-vehiculoId"
                name="vehiculoId"
                defaultValue={vehiculoSeleccionado}
                className="block rounded-md border border-input bg-transparent p-2 text-sm"
              >
                {vehiculos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.patente}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="trz-desde">Desde</Label>
              <Input id="trz-desde" name="desde" type="date" defaultValue={desde} className="w-full sm:w-40" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="trz-hasta">Hasta</Label>
              <Input id="trz-hasta" name="hasta" type="date" defaultValue={hasta} className="w-full sm:w-40" />
            </div>
            <Button type="submit" variant="outline">
              Aplicar
            </Button>
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
          <p className="text-xs text-muted-foreground">Sin período elegido, el reporte toma el último año.</p>
        </>
      )}
    </div>
  );
}
