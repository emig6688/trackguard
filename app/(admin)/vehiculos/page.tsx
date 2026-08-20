import Link from "next/link";
import { requireEmpresa } from "@/lib/permisos";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BackToDashboard } from "@/components/back-to-dashboard";
import { DisponibilidadToggle } from "@/components/vehiculos/disponibilidad-toggle";
import { vehiculosEnTallerExterno } from "@/lib/disponibilidad";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function VehiculosPage() {
  const { prisma } = await requireEmpresa();
  const vehiculos = await prisma.vehiculo.findMany({
    where: { eliminadoEn: null },
    orderBy: { patente: "asc" },
  });
  const enTaller = await vehiculosEnTallerExterno(
    prisma,
    vehiculos.map((v) => v.id)
  );

  return (
    <div className="space-y-6">
      <BackToDashboard />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Vehículos</h1>
        <Link href="/vehiculos/nuevo" className={buttonVariants()}>
          Nuevo vehículo
        </Link>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Patente</TableHead>
            <TableHead className="hidden md:table-cell">Marca / Modelo</TableHead>
            <TableHead className="hidden md:table-cell">Tipo</TableHead>
            <TableHead>Km actual</TableHead>
            <TableHead className="hidden md:table-cell">Equipo de frío</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Operativo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vehiculos.map((v) => (
            <TableRow key={v.id}>
              <TableCell>
                <Link href={`/vehiculos/${v.id}`} className="font-medium hover:underline">
                  {v.patente}
                </Link>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {v.marca} {v.modelo}
              </TableCell>
              <TableCell className="hidden md:table-cell">{v.tipoCarroceria ?? v.tipo}</TableCell>
              <TableCell>{v.kmActual.toLocaleString("es-AR")} km</TableCell>
              <TableCell className="hidden md:table-cell">{v.equipoFrioTipo ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={v.activo ? "success" : "secondary"}>
                  {v.activo ? "Activo" : "Inactivo"}
                </Badge>
              </TableCell>
              <TableCell>
                <DisponibilidadToggle
                  vehiculoId={v.id}
                  disponible={v.disponible}
                  motivoNoOperativo={v.motivoNoOperativo}
                  enTallerExterno={enTaller.has(v.id)}
                />
              </TableCell>
            </TableRow>
          ))}
          {vehiculos.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                No hay vehículos cargados.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
