import Link from "next/link";
import { requireSuperadmin } from "@/lib/permisos";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleActivoEmpresaButton } from "./toggle-activo-empresa-button";

export default async function PlataformaPage() {
  const { prisma } = await requireSuperadmin();

  const empresas = await prisma.empresa.findMany({
    include: { _count: { select: { usuarios: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Empresas</h1>
          <p className="text-sm text-muted-foreground">
            Cada empresa opera de forma completamente aislada: nadie de una empresa ve ni toca
            datos de otra.
          </p>
        </div>
        <Link href="/plataforma/nueva" className={buttonVariants()}>
          Nueva empresa
        </Link>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Usuarios</TableHead>
            <TableHead>Alta</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {empresas.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="font-medium">{e.nombre}</TableCell>
              <TableCell>{e._count.usuarios}</TableCell>
              <TableCell>{e.createdAt.toLocaleDateString("es-AR")}</TableCell>
              <TableCell>
                <Badge variant={e.activo ? "success" : "secondary"}>
                  {e.activo ? "Activa" : "Inactiva"}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Link href={`/plataforma/${e.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    Editar
                  </Link>
                  <ToggleActivoEmpresaButton empresaId={e.id} activo={e.activo} />
                </div>
              </TableCell>
            </TableRow>
          ))}
          {empresas.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Todavía no hay empresas dadas de alta.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
