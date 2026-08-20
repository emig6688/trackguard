import Link from "next/link";
import { requireEmpresa } from "@/lib/permisos";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function PanolPage() {
  const { prisma } = await requireEmpresa();
  const articulos = await prisma.articuloPanol.findMany({
    where: { eliminadoEn: null },
    orderBy: { nombre: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pañol de repuestos</h1>
        <Link href="/panol/nuevo" className={buttonVariants()}>
          Nuevo artículo
        </Link>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Artículo</TableHead>
            <TableHead>Unidad</TableHead>
            <TableHead>Stock actual</TableHead>
            <TableHead className="hidden md:table-cell">Stock mínimo</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {articulos.map((a) => {
            const bajoMinimo = a.stockActual <= a.stockMinimo;
            return (
              <TableRow key={a.id}>
                <TableCell>
                  <Link href={`/panol/${a.id}`} className="font-medium hover:underline">
                    {a.nombre}
                  </Link>
                </TableCell>
                <TableCell>{a.unidadMedida ?? "—"}</TableCell>
                <TableCell>{a.stockActual}</TableCell>
                <TableCell className="hidden md:table-cell">{a.stockMinimo}</TableCell>
                <TableCell className="flex gap-2">
                  {bajoMinimo && <Badge variant="warning">Al mínimo</Badge>}
                  <Badge variant={a.activo ? "success" : "secondary"}>
                    {a.activo ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
          {articulos.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                No hay artículos cargados en el pañol.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
