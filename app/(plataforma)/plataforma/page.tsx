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
            <TableHead className="max-w-[120px] md:max-w-none">Nombre</TableHead>
            <TableHead className="hidden md:table-cell">Usuarios</TableHead>
            <TableHead className="hidden md:table-cell">Alta</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="hidden md:table-cell">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {empresas.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="max-w-[120px] whitespace-normal font-medium md:max-w-none md:whitespace-nowrap">
                {e.nombre}
                <p className="text-xs font-normal text-muted-foreground md:hidden">
                  {e._count.usuarios} usuarios · alta {e.createdAt.toLocaleDateString("es-AR")}
                </p>
              </TableCell>
              <TableCell className="hidden md:table-cell">{e._count.usuarios}</TableCell>
              <TableCell className="hidden md:table-cell">{e.createdAt.toLocaleDateString("es-AR")}</TableCell>
              <TableCell>
                <div className="flex flex-col items-start gap-1">
                  <Badge variant={e.activo ? "success" : "secondary"}>
                    {e.activo ? "Activa" : "Inactiva"}
                  </Badge>
                  <div className="flex flex-wrap items-center gap-2 md:hidden">
                    <Link href={`/plataforma/${e.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                      Editar
                    </Link>
                    <ToggleActivoEmpresaButton empresaId={e.id} activo={e.activo} />
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">
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
              <TableCell colSpan={5} className="whitespace-normal text-center text-muted-foreground">
                Todavía no hay empresas dadas de alta.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
