import Link from "next/link";
import { requireEmpresa } from "@/lib/permisos";
import { Badge } from "@/components/ui/badge";
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
import { ConsumoChart } from "@/components/combustible/consumo-chart";
import { EliminarButton } from "@/components/eliminar-button";

const UMBRAL_ANOMALIA = 1.3;

export default async function CombustiblePage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const { desde, hasta } = await searchParams;
  const { user: session, prisma } = await requireEmpresa();

  const rangoFecha =
    desde || hasta
      ? { ...(desde ? { gte: new Date(desde) } : {}), ...(hasta ? { lte: new Date(hasta) } : {}) }
      : undefined;

  const cargas = await prisma.cargaCombustible.findMany({
    where: { eliminadoEn: null, ...(rangoFecha ? { fechaHora: rangoFecha } : {}) },
    include: { vehiculo: true, chofer: true },
    orderBy: { fechaHora: "desc" },
  });

  const query = new URLSearchParams();
  if (desde) query.set("desde", desde);
  if (hasta) query.set("hasta", hasta);
  const queryString = query.toString();

  const consumosPorVehiculo = new Map<string, { patente: string; consumos: number[] }>();
  for (const carga of cargas) {
    if (carga.consumoL100km == null) continue;
    const entry = consumosPorVehiculo.get(carga.vehiculoId) ?? {
      patente: carga.vehiculo.patente,
      consumos: [],
    };
    entry.consumos.push(Number(carga.consumoL100km));
    consumosPorVehiculo.set(carga.vehiculoId, entry);
  }

  const promedios = new Map<string, number>();
  const dataChart = Array.from(consumosPorVehiculo.entries()).map(([vehiculoId, { patente, consumos }]) => {
    const promedio = consumos.reduce((a, b) => a + b, 0) / consumos.length;
    promedios.set(vehiculoId, promedio);
    return { patente, consumoPromedio: Math.round(promedio * 100) / 100 };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Consumo de combustible</h1>
        <a
          href={`/api/export/combustible${queryString ? `?${queryString}` : ""}`}
          className={buttonVariants({ variant: "outline" })}
        >
          Exportar CSV
        </a>
      </div>

      <form className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="desde">Desde</Label>
          <Input id="desde" name="desde" type="date" defaultValue={desde} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="hasta">Hasta</Label>
          <Input id="hasta" name="hasta" type="date" defaultValue={hasta} className="w-40" />
        </div>
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
        {(desde || hasta) && (
          <Link href="/combustible" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Limpiar
          </Link>
        )}
      </form>

      {dataChart.length > 0 && (
        <div className="rounded-lg border p-4">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">
            Consumo promedio por vehículo (L/100km)
          </h2>
          <ConsumoChart data={dataChart} />
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vehículo</TableHead>
            <TableHead>Chofer</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Km odómetro</TableHead>
            <TableHead>Litros</TableHead>
            <TableHead>Consumo</TableHead>
            {session.rol === "ADMIN" && <TableHead>Acciones</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {cargas.map((c) => {
            const promedio = promedios.get(c.vehiculoId);
            const consumo = c.consumoL100km != null ? Number(c.consumoL100km) : null;
            const esAnomalia =
              consumo != null && promedio != null && consumo > promedio * UMBRAL_ANOMALIA;

            return (
              <TableRow key={c.id}>
                <TableCell>{c.vehiculo.patente}</TableCell>
                <TableCell>{c.chofer.nombre}</TableCell>
                <TableCell>{c.fechaHora.toLocaleDateString("es-AR")}</TableCell>
                <TableCell>{c.kmOdometro.toLocaleString("es-AR")}</TableCell>
                <TableCell>{c.litrosCargados.toString()}</TableCell>
                <TableCell>
                  {consumo != null ? (
                    <span className="flex items-center gap-2">
                      {consumo} L/100km
                      {esAnomalia && <Badge variant="destructive">Anómalo</Badge>}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                {session.rol === "ADMIN" && (
                  <TableCell>
                    <EliminarButton tipo="cargaCombustible" id={c.id} redirectPath="/combustible" />
                  </TableCell>
                )}
              </TableRow>
            );
          })}
          {cargas.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                No hay cargas de combustible registradas.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
