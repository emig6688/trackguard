import { requireEmpresa } from "@/lib/permisos";
import { Badge } from "@/components/ui/badge";
import { EliminarButton } from "@/components/eliminar-button";
import { PlanForm } from "./plan-form";
import { AplicarPlanEstandarButton } from "./aplicar-plan-estandar-button";

const LABEL_INTERVALO = { KM: "km", TIEMPO: "días", HORAS: "horas", AMBOS: "varios" };

function textoFrecuencia(plan: {
  intervaloKm: number | null;
  intervaloDias: number | null;
  intervaloHoras: number | null;
}) {
  const partes = [
    plan.intervaloKm ? `cada ${plan.intervaloKm.toLocaleString("es-AR")} km` : null,
    plan.intervaloDias ? `cada ${plan.intervaloDias} días` : null,
    plan.intervaloHoras ? `cada ${plan.intervaloHoras.toLocaleString("es-AR")} horas` : null,
  ].filter(Boolean);
  return partes.join(" o ");
}

export async function PlanesPanel({
  vehiculoId,
  redirectPath,
}: {
  vehiculoId: string;
  redirectPath: string;
}) {
  const { user, prisma } = await requireEmpresa();
  const planes = await prisma.planMantenimiento.findMany({
    where: { vehiculoId, activo: true, eliminadoEn: null },
    orderBy: [{ categoria: "asc" }, { nombre: "asc" }],
  });

  const categorias = new Map<string, typeof planes>();
  for (const plan of planes) {
    const categoria = plan.categoria ?? "Sin categoría";
    categorias.set(categoria, [...(categorias.get(categoria) ?? []), plan]);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Planes de mantenimiento preventivo</h2>
        <AplicarPlanEstandarButton vehiculoId={vehiculoId} redirectPath={redirectPath} />
      </div>

      <div className="space-y-6">
        {[...categorias.entries()].map(([categoria, planesCategoria]) => (
          <div key={categoria} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {categoria}
            </p>
            {planesCategoria.map((plan) => (
              <div
                key={plan.id}
                className="flex items-center justify-between rounded-lg border p-3 text-sm"
              >
                <div>
                  <p className="font-medium">{plan.nombre}</p>
                  <p className="text-muted-foreground">
                    {textoFrecuencia(plan)}
                    {" · "}Último service: {plan.kmUltimoService ?? 0} km
                    {plan.horasUltimoService != null ? ` / ${plan.horasUltimoService} hs` : ""}
                    {plan.fechaUltimoService
                      ? ` (${plan.fechaUltimoService.toLocaleDateString("es-AR")})`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{LABEL_INTERVALO[plan.tipoIntervalo]}</Badge>
                  {user.rol === "ADMIN" && (
                    <EliminarButton tipo="planMantenimiento" id={plan.id} redirectPath={redirectPath} />
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
        {planes.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin planes de mantenimiento cargados.</p>
        )}
      </div>

      <PlanForm vehiculoId={vehiculoId} redirectPath={redirectPath} />
    </div>
  );
}
