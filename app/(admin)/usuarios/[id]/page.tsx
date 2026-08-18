import { notFound } from "next/navigation";
import { requireEmpresa } from "@/lib/permisos";
import { actualizarUsuario, darDeBajaUsuario, reactivarUsuario } from "@/app/_actions/usuarios";
import { BajaPanel } from "@/components/baja-panel";
import { BackButton } from "@/components/back-button";
import { EliminarButton } from "@/components/eliminar-button";
import { UsuarioForm } from "../nuevo/usuario-form";

export default async function UsuarioDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, prisma } = await requireEmpresa(["ADMIN"]);
  const usuario = await prisma.usuario.findUnique({
    where: { id, rol: { not: "CHOFER" }, eliminadoEn: null, empresaId: user.empresaId! },
  });
  if (!usuario) notFound();

  const actualizarConId = actualizarUsuario.bind(null, usuario.id);

  return (
    <div className="space-y-6">
      <BackButton fallbackHref="/usuarios" />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{usuario.nombre}</h1>
        <div className="flex items-center gap-2">
          <BajaPanel
            activo={usuario.activo}
            observacionBaja={usuario.observacionBaja}
            fechaBaja={usuario.fechaBaja}
            onDarDeBaja={darDeBajaUsuario.bind(null, usuario.id)}
            onReactivar={reactivarUsuario.bind(null, usuario.id)}
          />
          {user.rol === "ADMIN" && (
            <EliminarButton tipo="usuario" id={usuario.id} redirectPath="/usuarios" />
          )}
        </div>
      </div>
      <UsuarioForm
        action={actualizarConId}
        modo="editar"
        defaultValues={{
          nombre: usuario.nombre,
          email: usuario.email,
          dni: usuario.dni,
          telefono: usuario.telefono,
          rol: usuario.rol,
        }}
        submitLabel="Guardar cambios"
      />
    </div>
  );
}
