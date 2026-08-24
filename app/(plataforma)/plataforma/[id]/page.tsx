import { notFound } from "next/navigation";
import { requireSuperadmin } from "@/lib/permisos";
import { BackButton } from "@/components/back-button";
import { Badge } from "@/components/ui/badge";
import { ToggleActivoEmpresaButton } from "../toggle-activo-empresa-button";
import { EditarEmpresaForm } from "./editar-empresa-form";
import { EditarAdminForm } from "./editar-admin-form";

export default async function EditarEmpresaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { prisma } = await requireSuperadmin();

  const empresa = await prisma.empresa.findUnique({ where: { id } });
  if (!empresa) notFound();

  const admins = await prisma.usuario.findMany({
    where: { empresaId: id, rol: "ADMIN", eliminadoEn: null },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-8">
      <BackButton fallbackHref="/plataforma" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{empresa.nombre}</h1>
          <p className="text-sm text-muted-foreground">
            Alta el {empresa.createdAt.toLocaleDateString("es-AR")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={empresa.activo ? "success" : "secondary"}>
            {empresa.activo ? "Activa" : "Inactiva"}
          </Badge>
          <ToggleActivoEmpresaButton empresaId={empresa.id} activo={empresa.activo} />
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Datos de la empresa</h2>
        <EditarEmpresaForm
          empresaId={empresa.id}
          defaultValues={{
            nombre: empresa.nombre,
            emailContacto: empresa.emailContacto,
            telefono: empresa.telefono,
            direccion: empresa.direccion,
            contactoNombre: empresa.contactoNombre,
          }}
        />
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Administrador</h2>
        <p className="text-sm text-muted-foreground">
          Usuario y contraseña con los que el cliente entra a su cuenta.
        </p>
        <div className="space-y-4">
          {admins.map((admin) => (
            <EditarAdminForm
              key={admin.id}
              empresaId={empresa.id}
              usuarioId={admin.id}
              defaultValues={{ nombre: admin.nombre, email: admin.email, telefono: admin.telefono }}
            />
          ))}
          {admins.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Esta empresa no tiene ningún usuario ADMIN activo.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
