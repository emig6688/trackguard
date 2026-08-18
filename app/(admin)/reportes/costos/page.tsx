import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  calcularCostosMensuales,
  calcularCostosPorChofer,
  calcularCostosPorVehiculo,
  type TipoCostoMensual,
} from "@/lib/costos";
import { requireEmpresa } from "@/lib/permisos";
import { CostosMensualesChart } from "@/components/costos/costos-mensuales-chart";

function formatearMoneda(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

const TIPOS_MENSUALES: { value: TipoCostoMensual; label: string }[] = [
  { value: "TOTAL", label: "Costos totales" },
  { value: "COMBUSTIBLE", label: "Combustible" },
  { value: "GASTOS", label: "Gastos" },
];

export default async function CostosPage({
  searchParams,
}: {
  searchParams: Promise<{
    desde?: string;
    hasta?: string;
    tipoMensual?: string;
    vehiculoMensual?: string;
  }>;
}) {
  const { user, prisma } = await requireEmpresa();
  const { desde, hasta, tipoMensual, vehiculoMensual } = await searchParams;
  const filtro = {
    desde: desde ? new Date(desde) : undefined,
    hasta: hasta ? new Date(hasta) : undefined,
  };

  const tipoMensualValido: TipoCostoMensual = TIPOS_MENSUALES.some((t) => t.value === tipoMensual)
    ? (tipoMensual as TipoCostoMensual)
    : "TOTAL";

  const [porVehiculo, porChofer, vehiculos, costosMensuales] = await Promise.all([
    calcularCostosPorVehiculo(prisma, filtro),
    calcularCostosPorChofer(prisma, user.empresaId!, filtro),
    prisma.vehiculo.findMany({
      where: { eliminadoEn: null },
      select: { id: true, patente: true },
      orderBy: { patente: "asc" },
    }),
    calcularCostosMensuales(prisma, {
      tipo: tipoMensualValido,
      vehiculoId: vehiculoMensual || undefined,
    }),
  ]);

  const query = new URLSearchParams();
  if (desde) query.set("desde", desde);
  if (hasta) query.set("hasta", hasta);
  const queryString = query.toString();

  const queryMensual = new URLSearchParams();
  queryMensual.set("tipo", tipoMensualValido);
  if (vehiculoMensual) queryMensual.set("vehiculo", vehiculoMensual);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Costos por vehículo y por chofer</h1>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>Evolución mensual (últimos 12 meses)</CardTitle>
          <a
            href={`/api/export/costos-pdf?${queryMensual.toString()}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Exportar reporte PDF
          </a>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label htmlFor="tipoMensual" className="text-sm font-medium">
                Tipo de costo
              </label>
              <select
                id="tipoMensual"
                name="tipoMensual"
                defaultValue={tipoMensualValido}
                className="block rounded-md border border-input bg-transparent p-2 text-sm"
              >
                {TIPOS_MENSUALES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="vehiculoMensual" className="text-sm font-medium">
                Vehículo
              </label>
              <select
                id="vehiculoMensual"
                name="vehiculoMensual"
                defaultValue={vehiculoMensual ?? ""}
                className="block rounded-md border border-input bg-transparent p-2 text-sm"
              >
                <option value="">Todos los vehículos</option>
                {vehiculos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.patente}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className={buttonVariants({ variant: "outline" })}>
              Aplicar
            </button>
          </form>
          <CostosMensualesChart data={costosMensuales} />
        </CardContent>
      </Card>

      <form className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="desde" className="text-sm font-medium">
            Desde
          </label>
          <input
            id="desde"
            name="desde"
            type="date"
            defaultValue={desde}
            className="block rounded-md border border-input bg-transparent p-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="hasta" className="text-sm font-medium">
            Hasta
          </label>
          <input
            id="hasta"
            name="hasta"
            type="date"
            defaultValue={hasta}
            className="block rounded-md border border-input bg-transparent p-2 text-sm"
          />
        </div>
        <button type="submit" className={buttonVariants({ variant: "outline" })}>
          Filtrar
        </button>
      </form>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Por vehículo</h2>
          <a
            href={`/api/export/costos?tipo=vehiculo${queryString ? `&${queryString}` : ""}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Exportar CSV
          </a>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vehículo</TableHead>
              <TableHead>Combustible</TableHead>
              <TableHead>Gastos</TableHead>
              <TableHead>Repuestos</TableHead>
              <TableHead>Facturas</TableHead>
              <TableHead>Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {porVehiculo.map((c) => (
              <TableRow key={c.vehiculoId}>
                <TableCell className="font-medium">{c.patente}</TableCell>
                <TableCell>{formatearMoneda(c.combustible)}</TableCell>
                <TableCell>{formatearMoneda(c.gastos)}</TableCell>
                <TableCell>{formatearMoneda(c.repuestos)}</TableCell>
                <TableCell>{formatearMoneda(c.facturas)}</TableCell>
                <TableCell className="font-semibold">{formatearMoneda(c.total)}</TableCell>
              </TableRow>
            ))}
            {porVehiculo.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No hay vehículos cargados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Por chofer</h2>
          <a
            href={`/api/export/costos?tipo=chofer${queryString ? `&${queryString}` : ""}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Exportar CSV
          </a>
        </div>
        <p className="text-sm text-muted-foreground">
          Solo combustible y gastos: son los dos registros que tienen un chofer real asociado.
          Repuestos y facturas pertenecen a la orden de trabajo / vehículo, no a un chofer.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Chofer</TableHead>
              <TableHead>Combustible</TableHead>
              <TableHead>Gastos</TableHead>
              <TableHead>Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {porChofer.map((c) => (
              <TableRow key={c.choferId}>
                <TableCell className="font-medium">{c.nombre}</TableCell>
                <TableCell>{formatearMoneda(c.combustible)}</TableCell>
                <TableCell>{formatearMoneda(c.gastos)}</TableCell>
                <TableCell className="font-semibold">{formatearMoneda(c.total)}</TableCell>
              </TableRow>
            ))}
            {porChofer.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No hay choferes cargados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
