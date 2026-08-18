import { notFound } from "next/navigation";
import { requireEmpresa } from "@/lib/permisos";
import { actualizarTallerExterno } from "@/app/_actions/talleres-externos";
import { BackButton } from "@/components/back-button";
import { EliminarButton } from "@/components/eliminar-button";
import { TallerForm } from "../taller-form";

export default async function TallerDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user: session, prisma } = await requireEmpresa();
  const taller = await prisma.tallerExterno.findUnique({ where: { id, eliminadoEn: null } });
  if (!taller) notFound();

  const actualizarConId = actualizarTallerExterno.bind(null, taller.id);

  return (
    <div className="space-y-6">
      <BackButton fallbackHref="/talleres-externos" />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{taller.nombre}</h1>
        {session.rol === "ADMIN" && (
          <EliminarButton tipo="tallerExterno" id={taller.id} redirectPath="/talleres-externos" />
        )}
      </div>
      <TallerForm action={actualizarConId} defaultValues={taller} submitLabel="Guardar cambios" />
    </div>
  );
}
