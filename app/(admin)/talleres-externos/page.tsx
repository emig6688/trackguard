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

export default async function TalleresExternosPage() {
  const { prisma } = await requireEmpresa();
  const talleres = await prisma.tallerExterno.findMany({
    where: { eliminadoEn: null },
    orderBy: { nombre: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Talleres externos</h1>
        <Link href="/talleres-externos/nuevo" className={buttonVariants()}>
          Nuevo taller
        </Link>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead className="hidden md:table-cell">Contacto</TableHead>
            <TableHead className="hidden md:table-cell">Teléfono</TableHead>
            <TableHead>Especialidad</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {talleres.map((t) => (
            <TableRow key={t.id}>
              <TableCell>
                <Link href={`/talleres-externos/${t.id}`} className="font-medium hover:underline">
                  {t.nombre}
                </Link>
              </TableCell>
              <TableCell className="hidden md:table-cell">{t.contactoNombre ?? "—"}</TableCell>
              <TableCell className="hidden md:table-cell">{t.telefono ?? "—"}</TableCell>
              <TableCell>{t.especialidad ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={t.activo ? "success" : "secondary"}>
                  {t.activo ? "Activo" : "Inactivo"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
          {talleres.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="whitespace-normal text-center text-muted-foreground">
                No hay talleres cargados.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
