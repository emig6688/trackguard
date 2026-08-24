import { notFound } from "next/navigation";
import { requireEmpresa } from "@/lib/permisos";
import { actualizarChofer, darDeBajaChofer, reactivarChofer } from "@/app/_actions/choferes";
import { DocumentosPanel } from "@/components/documentos/documentos-panel";
import { BajaPanel } from "@/components/baja-panel";
import { BackButton } from "@/components/back-button";
import { EliminarButton } from "@/components/eliminar-button";
import { ChoferForm } from "../chofer-form";

export default async function ChoferDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, prisma } = await requireEmpresa();
  const chofer = await prisma.usuario.findUnique({
    where: { id, rol: "CHOFER", eliminadoEn: null, empresaId: user.empresaId! },
    include: { perfilChofer: true },
  });
  if (!chofer) notFound();

  const actualizarConId = actualizarChofer.bind(null, chofer.id);

  return (
    <div className="space-y-10">
      <div className="space-y-6">
        <BackButton fallbackHref="/choferes" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">{chofer.nombre}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <BajaPanel
              activo={chofer.activo}
              observacionBaja={chofer.observacionBaja}
              fechaBaja={chofer.fechaBaja}
              onDarDeBaja={darDeBajaChofer.bind(null, chofer.id)}
              onReactivar={reactivarChofer.bind(null, chofer.id)}
            />
            {user.rol === "ADMIN" && (
              <EliminarButton tipo="usuario" id={chofer.id} redirectPath="/choferes" />
            )}
          </div>
        </div>
        <ChoferForm
          action={actualizarConId}
          modo="editar"
          defaultValues={{
            nombre: chofer.nombre,
            email: chofer.email,
            dni: chofer.dni,
            telefono: chofer.telefono,
            numeroLicencia: chofer.perfilChofer?.numeroLicencia,
            categoriaLicencia: chofer.perfilChofer?.categoriaLicencia,
            legajo: chofer.perfilChofer?.legajo,
            fechaIngreso: chofer.perfilChofer?.fechaIngreso,
          }}
          submitLabel="Guardar cambios"
        />
      </div>

      <DocumentosPanel
        entidadTipo="CHOFER"
        entidadId={chofer.id}
        redirectPath={`/choferes/${chofer.id}`}
      />
    </div>
  );
}
