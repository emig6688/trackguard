import Link from "next/link";
import { requireEmpresa } from "@/lib/permisos";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EliminarButton } from "@/components/eliminar-button";
import { FiltroPeriodoAtajos } from "@/components/filtro-periodo-atajos";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const TIPO_LABEL: Record<string, string> = {
  PEAJE: "Peaje",
  VIATICO: "Viático",
  REPARACION_MENOR: "Reparación menor",
  OTRO: "Otro",
};

export default async function GastosPage({
  searchParams,
}: {
  searchParams: Promise<{ chofer?: string; vehiculo?: string; desde?: string; hasta?: string }>;
}) {
  const { chofer, vehiculo, desde, hasta } = await searchParams;
  const { user: session, prisma } = await requireEmpresa();

  const rangoFecha =
    desde || hasta
      ? { ...(desde ? { gte: new Date(desde) } : {}), ...(hasta ? { lte: new Date(hasta) } : {}) }
      : undefined;

  const [gastos, choferesConGasto, vehiculosConGasto] = await Promise.all([
    prisma.gasto.findMany({
      where: {
        monto: { gt: 0 },
        eliminadoEn: null,
        ...(chofer ? { chofer: { nombre: { equals: chofer, mode: "insensitive" } } } : {}),
        ...(vehiculo ? { vehiculo: { patente: { equals: vehiculo, mode: "insensitive" } } } : {}),
        ...(rangoFecha ? { fecha: rangoFecha } : {}),
      },
      include: { chofer: true, vehiculo: true },
      orderBy: { fecha: "desc" },
    }),
    prisma.gasto.findMany({
      where: { monto: { gt: 0 }, eliminadoEn: null },
      distinct: ["choferId"],
      select: { chofer: { select: { id: true, nombre: true } } },
      orderBy: { chofer: { nombre: "asc" } },
    }),
    prisma.gasto.findMany({
      where: { monto: { gt: 0 }, eliminadoEn: null },
      distinct: ["vehiculoId"],
      select: { vehiculo: { select: { id: true, patente: true } } },
      orderBy: { vehiculo: { patente: "asc" } },
    }),
  ]);

  const query = new URLSearchParams();
  if (chofer) query.set("chofer", chofer);
  if (vehiculo) query.set("vehiculo", vehiculo);
  if (desde) query.set("desde", desde);
  if (hasta) query.set("hasta", hasta);
  const queryString = query.toString();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Gastos de choferes</h1>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/export/gastos-pdf${queryString ? `?${queryString}` : ""}`}
            className={buttonVariants({ variant: "outline" })}
          >
            Exportar PDF
          </a>
          <a
            href={`/api/export/gastos${queryString ? `?${queryString}` : ""}`}
            className={buttonVariants({ variant: "outline" })}
          >
            Exportar Excel
          </a>
        </div>
      </div>

      <form className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="chofer">Chofer</Label>
          <Input
            id="chofer"
            name="chofer"
            list="choferes-con-gasto"
            defaultValue={chofer}
            placeholder="Buscar chofer..."
            className="w-full sm:w-56"
          />
          <datalist id="choferes-con-gasto">
            {choferesConGasto.map((g) => (
              <option key={g.chofer.id} value={g.chofer.nombre} />
            ))}
          </datalist>
        </div>
        <div className="space-y-1">
          <Label htmlFor="vehiculo">Vehículo</Label>
          <Input
            id="vehiculo"
            name="vehiculo"
            list="vehiculos-con-gasto"
            defaultValue={vehiculo}
            placeholder="Buscar patente..."
            className="w-full sm:w-56"
          />
          <datalist id="vehiculos-con-gasto">
            {vehiculosConGasto.map((g) => (
              <option key={g.vehiculo.id} value={g.vehiculo.patente} />
            ))}
          </datalist>
        </div>
        <div className="space-y-1">
          <Label htmlFor="desde">Desde</Label>
          <Input id="desde" name="desde" type="date" defaultValue={desde} className="w-32 sm:w-40" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="hasta">Hasta</Label>
          <Input id="hasta" name="hasta" type="date" defaultValue={hasta} className="w-32 sm:w-40" />
        </div>
        <Button type="submit" variant="outline" size="sm">
          Filtrar
        </Button>
        {(chofer || vehiculo || desde || hasta) && (
          <Link href="/gastos" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Limpiar filtros
          </Link>
        )}
      </form>

      <FiltroPeriodoAtajos basePath="/gastos" params={{ chofer, vehiculo, desde, hasta }} />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="hidden md:table-cell">Chofer</TableHead>
            <TableHead className="max-w-[110px] md:max-w-none">Vehículo</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Monto</TableHead>
            <TableHead className="hidden md:table-cell">Fecha</TableHead>
            <TableHead>Estado</TableHead>
            {session.rol === "ADMIN" && <TableHead className="hidden md:table-cell">Acciones</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {gastos.map((g) => (
            <TableRow key={g.id}>
              <TableCell className="hidden md:table-cell">{g.chofer.nombre}</TableCell>
              <TableCell className="max-w-[110px] whitespace-normal md:max-w-none md:whitespace-nowrap">
                {g.vehiculo?.patente ?? "—"}
                <p className="text-xs text-muted-foreground md:hidden">
                  {g.chofer.nombre} · {g.fecha.toLocaleDateString("es-AR")}
                </p>
              </TableCell>
              <TableCell>{TIPO_LABEL[g.tipo]}</TableCell>
              <TableCell>${g.monto.toString()}</TableCell>
              <TableCell className="hidden md:table-cell">{g.fecha.toLocaleDateString("es-AR")}</TableCell>
              <TableCell>
                <div className="flex flex-col items-start gap-1">
                  <Badge variant="secondary">{g.estado}</Badge>
                  {session.rol === "ADMIN" && (
                    <span className="md:hidden">
                      <EliminarButton tipo="gasto" id={g.id} redirectPath="/gastos" />
                    </span>
                  )}
                </div>
              </TableCell>
              {session.rol === "ADMIN" && (
                <TableCell className="hidden md:table-cell">
                  <EliminarButton tipo="gasto" id={g.id} redirectPath="/gastos" />
                </TableCell>
              )}
            </TableRow>
          ))}
          {gastos.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="whitespace-normal text-center text-muted-foreground">
                No hay gastos cargados.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
