import Link from "next/link";
import { requireEmpresa } from "@/lib/permisos";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ROL_LABEL } from "@/lib/roles";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function UsuariosPage() {
  const { user, prisma } = await requireEmpresa(["ADMIN"]);
  const usuarios = await prisma.usuario.findMany({
    where: { rol: { not: "CHOFER" }, eliminadoEn: null, empresaId: user.empresaId! },
    orderBy: { nombre: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Usuarios</h1>
        <Link href="/usuarios/nuevo" className={buttonVariants()}>
          Nuevo usuario
        </Link>
      </div>
      <p className="text-sm text-muted-foreground">
        Los choferes se gestionan desde la sección{" "}
        <Link href="/choferes" className="underline">
          Choferes
        </Link>
        .
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead className="hidden md:table-cell">Email</TableHead>
            <TableHead className="hidden md:table-cell">Rol</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {usuarios.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="font-medium">
                <Link href={`/usuarios/${u.id}`} className="hover:underline">
                  {u.nombre}
                </Link>
                <p className="text-xs font-normal text-muted-foreground md:hidden">{ROL_LABEL[u.rol]}</p>
              </TableCell>
              <TableCell className="hidden md:table-cell">{u.email}</TableCell>
              <TableCell className="hidden md:table-cell">{ROL_LABEL[u.rol]}</TableCell>
              <TableCell>
                <Badge variant={u.activo ? "success" : "secondary"}>
                  {u.activo ? "Activo" : "Inactivo"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
