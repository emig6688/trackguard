import { requireEmpresa } from "@/lib/permisos";
import { ConfirmarReparacionForm } from "@/components/confirmar-reparacion-form";

export default async function ReparacionesPage() {
  const { user: session, prisma } = await requireEmpresa();

  const ots = await prisma.ordenDeTrabajo.findMany({
    where: {
      eliminadoEn: null,
      estado: "COMPLETADA",
      confirmacionReparacion: "PENDIENTE",
      OR: [
        { eventoRuta: { choferId: session.id } },
        { checklistRealizado: { choferId: session.id } },
      ],
    },
    include: { vehiculo: true },
    orderBy: { fechaFin: "desc" },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Confirmar reparaciones</h1>
        <p className="text-sm text-muted-foreground">
          Novedades tuyas que el mecánico marcó como reparadas. Confirmanos si quedaron resueltas.
        </p>
      </div>

      <div className="space-y-3">
        {ots.map((ot) => (
          <div key={ot.id} className="space-y-3 rounded-lg border p-4">
            <div>
              <p className="font-medium">
                {ot.vehiculo.patente} · {ot.titulo}
              </p>
              {ot.observacionesMecanico && (
                <p className="mt-1 text-sm text-muted-foreground">{ot.observacionesMecanico}</p>
              )}
              {ot.fechaFin && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Reparado el {ot.fechaFin.toLocaleDateString("es-AR")}
                </p>
              )}
            </div>
            <ConfirmarReparacionForm otId={ot.id} />
          </div>
        ))}
        {ots.length === 0 && (
          <p className="text-sm text-muted-foreground">No tenés reparaciones pendientes de confirmar.</p>
        )}
      </div>
    </div>
  );
}
