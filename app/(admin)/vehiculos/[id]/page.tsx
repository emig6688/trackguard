import { notFound } from "next/navigation";
import Link from "next/link";
import { requireEmpresa } from "@/lib/permisos";
import { actualizarVehiculo, darDeBajaVehiculo, reactivarVehiculo } from "@/app/_actions/vehiculos";
import { DocumentosPanel } from "@/components/documentos/documentos-panel";
import { PlanesPanel } from "@/components/planes-mantenimiento/planes-panel";
import { BajaPanel } from "@/components/baja-panel";
import { BackButton } from "@/components/back-button";
import { EliminarButton } from "@/components/eliminar-button";
import { DisponibilidadToggle } from "@/components/vehiculos/disponibilidad-toggle";
import { vehiculosEnTallerExterno } from "@/lib/disponibilidad";
import { VehiculoForm } from "../nuevo/vehiculo-form";

export default async function VehiculoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, prisma } = await requireEmpresa();
  const vehiculo = await prisma.vehiculo.findUnique({ where: { id, eliminadoEn: null } });
  if (!vehiculo) notFound();
  const enTaller = await vehiculosEnTallerExterno(prisma, [vehiculo.id]);

  const actualizarConId = actualizarVehiculo.bind(null, vehiculo.id);

  return (
    <div className="space-y-10">
      <div className="space-y-6">
        <BackButton fallbackHref="/vehiculos" />
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">
            {vehiculo.patente} — {vehiculo.marca} {vehiculo.modelo}
          </h1>
          <div className="flex items-center gap-2">
            <DisponibilidadToggle
              vehiculoId={vehiculo.id}
              disponible={vehiculo.disponible}
              motivoNoOperativo={vehiculo.motivoNoOperativo}
              enTallerExterno={enTaller.has(vehiculo.id)}
            />
            <BajaPanel
              activo={vehiculo.activo}
              observacionBaja={vehiculo.observacionBaja}
              fechaBaja={vehiculo.fechaBaja}
              onDarDeBaja={darDeBajaVehiculo.bind(null, vehiculo.id)}
              onReactivar={reactivarVehiculo.bind(null, vehiculo.id)}
            />
            {user.rol === "ADMIN" && (
              <EliminarButton tipo="vehiculo" id={vehiculo.id} redirectPath="/vehiculos" />
            )}
          </div>
        </div>
        <VehiculoForm
          action={actualizarConId}
          defaultValues={vehiculo}
          submitLabel="Guardar cambios"
        />
      </div>

      <p className="text-sm text-muted-foreground">
        El reporte de trazabilidad de este vehículo se armó en{" "}
        <Link href={`/reportes/estadisticas?tab=reportes&vehiculoId=${vehiculo.id}`} className="underline">
          Estadísticas → Reportes
        </Link>
        .
      </p>

      <PlanesPanel vehiculoId={vehiculo.id} redirectPath={`/vehiculos/${vehiculo.id}`} />

      <DocumentosPanel
        entidadTipo="VEHICULO"
        entidadId={vehiculo.id}
        redirectPath={`/vehiculos/${vehiculo.id}`}
      />
    </div>
  );
}
