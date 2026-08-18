import Link from "next/link";
import { requireEmpresa } from "@/lib/permisos";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EliminarButton } from "@/components/eliminar-button";
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Gastos de choferes</h1>
        <a
          href={`/api/export/gastos${queryString ? `?${queryString}` : ""}`}
          className={buttonVariants({ variant: "outline" })}
        >
          Exportar CSV
        </a>
      </div>

      <form className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="chofer">Chofer</Label>
          <Input
            id="chofer"
            name="chofer"
            list="choferes-con-gasto"
            defaultValue={chofer}
            placeholder="Buscar chofer..."
            className="w-56"
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
            className="w-56"
          />
          <datalist id="vehiculos-con-gasto">
            {vehiculosConGasto.map((g) => (
              <option key={g.vehiculo.id} value={g.vehiculo.patente} />
            ))}
          </datalist>
        </div>
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
        {(chofer || vehiculo || desde || hasta) && (
          <Link href="/gastos" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Limpiar
          </Link>
        )}
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Chofer</TableHead>
            <TableHead>Vehículo</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Monto</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Estado</TableHead>
            {session.rol === "ADMIN" && <TableHead>Acciones</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {gastos.map((g) => (
            <TableRow key={g.id}>
              <TableCell>{g.chofer.nombre}</TableCell>
              <TableCell>{g.vehiculo?.patente ?? "—"}</TableCell>
              <TableCell>{TIPO_LABEL[g.tipo]}</TableCell>
              <TableCell>${g.monto.toString()}</TableCell>
              <TableCell>{g.fecha.toLocaleDateString("es-AR")}</TableCell>
              <TableCell>
                <Badge variant="secondary">{g.estado}</Badge>
              </TableCell>
              {session.rol === "ADMIN" && (
                <TableCell>
                  <EliminarButton tipo="gasto" id={g.id} redirectPath="/gastos" />
                </TableCell>
              )}
            </TableRow>
          ))}
          {gastos.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                No hay gastos cargados.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
