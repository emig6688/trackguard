import Link from "next/link";
import { requireEmpresa } from "@/lib/permisos";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BackToDashboard } from "@/components/back-to-dashboard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ChoferesPage() {
  const { user, prisma } = await requireEmpresa();
  const choferes = await prisma.usuario.findMany({
    where: { rol: "CHOFER", eliminadoEn: null, empresaId: user.empresaId! },
    include: { perfilChofer: true },
    orderBy: { nombre: "asc" },
  });

  return (
    <div className="space-y-6">
      <BackToDashboard />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Choferes</h1>
        <Link href="/choferes/nuevo" className={buttonVariants()}>
          Nuevo chofer
        </Link>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>DNI</TableHead>
            <TableHead>Legajo</TableHead>
            <TableHead>Licencia</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {choferes.map((c) => (
            <TableRow key={c.id}>
              <TableCell>
                <Link href={`/choferes/${c.id}`} className="font-medium hover:underline">
                  {c.nombre}
                </Link>
              </TableCell>
              <TableCell>{c.email}</TableCell>
              <TableCell>{c.dni ?? "—"}</TableCell>
              <TableCell>{c.perfilChofer?.legajo ?? "—"}</TableCell>
              <TableCell>{c.perfilChofer?.numeroLicencia ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={c.activo ? "success" : "secondary"}>
                  {c.activo ? "Activo" : "Inactivo"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
          {choferes.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No hay choferes cargados.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
