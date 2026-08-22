import Link from "next/link";
import { requireEmpresa, ROLES_GUARDIA } from "@/lib/permisos";
import { inicioDeHoy } from "@/lib/checklist";
import { formatearHora as hora } from "@/lib/fecha";
import { Badge } from "@/components/ui/badge";
import { ObservacionCell } from "@/components/guardia/observacion-cell";
import { DiaNoOperadoControl } from "@/components/guardia/dia-no-operado-control";

type FiltroEstado = "PENDIENTE" | "HECHO";

export default async function GuardiaPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { prisma } = await requireEmpresa(ROLES_GUARDIA);
  const fecha = inicioDeHoy();
  const { estado } = await searchParams;
  const filtroEstado: FiltroEstado | undefined =
    estado === "PENDIENTE" || estado === "HECHO" ? estado : undefined;

  const [vehiculos, checklists, eventos, observaciones, diasNoOperados] = await Promise.all([
    prisma.vehiculo.findMany({
      where: { activo: true, eliminadoEn: null },
      orderBy: { patente: "asc" },
    }),
    prisma.checklistRealizado.findMany({
      where: { fechaHora: { gte: fecha } },
      orderBy: { fechaHora: "desc" },
      include: { chofer: { select: { nombre: true } } },
    }),
    prisma.eventoRuta.findMany({
      where: { fechaHora: { gte: fecha } },
      orderBy: { fechaHora: "desc" },
    }),
    prisma.observacionGuardia.findMany({ where: { fecha } }),
    prisma.diaNoOperado.findMany({ where: { fecha }, include: { chofer: { select: { nombre: true } } } }),
  ]);

  const checklistPorVehiculo = new Map<string, (typeof checklists)[number]>();
  for (const c of checklists) {
    if (!checklistPorVehiculo.has(c.vehiculoId)) checklistPorVehiculo.set(c.vehiculoId, c);
  }

  const eventoPorVehiculo = new Map<string, (typeof eventos)[number]>();
  for (const e of eventos) {
    if (!eventoPorVehiculo.has(e.vehiculoId)) eventoPorVehiculo.set(e.vehiculoId, e);
  }

  const obsPorVehiculoEtapa = new Map<string, string>();
  for (const o of observaciones) obsPorVehiculoEtapa.set(`${o.vehiculoId}_${o.etapa}`, o.observacion);

  const noOperadoPorVehiculo = new Map<string, { choferNombre: string | null }>();
  for (const d of diasNoOperados) noOperadoPorVehiculo.set(d.vehiculoId, { choferNombre: d.chofer?.nombre ?? null });

  // Un vehículo cuenta como "Hecho" cuando terminó las dos etapas del día
  // (checklist pre-salida y cierre de ruta), o cuando el guardia lo marcó
  // como que no salió a reparto (no hay nada pendiente que hacerle).
  const vehiculosFiltrados = vehiculos.filter((v) => {
    if (!filtroEstado) return true;
    const completo =
      (checklistPorVehiculo.has(v.id) && eventoPorVehiculo.has(v.id)) || noOperadoPorVehiculo.has(v.id);
    return filtroEstado === "HECHO" ? completo : !completo;
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Control de portería</h1>
        <p className="text-sm text-muted-foreground">
          Checklist pre-salida y cierre de ruta de hoy, por vehículo.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/guardia">
          <Badge variant={!filtroEstado ? "default" : "outline"}>Todos</Badge>
        </Link>
        <Link href="/guardia?estado=PENDIENTE">
          <Badge variant={filtroEstado === "PENDIENTE" ? "warning" : "outline"}>Pendiente</Badge>
        </Link>
        <Link href="/guardia?estado=HECHO">
          <Badge variant={filtroEstado === "HECHO" ? "success" : "outline"}>Hecho</Badge>
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="sticky left-0 z-10 bg-muted/50 p-3 font-medium">Vehículo</th>
              <th className="p-3 font-medium">Checklist pre-salida</th>
              <th className="p-3 font-medium">Observación (salida)</th>
              <th className="p-3 font-medium">Cierre de ruta</th>
              <th className="p-3 font-medium">Observación (regreso)</th>
              <th className="p-3 font-medium">No salió a reparto</th>
            </tr>
          </thead>
          <tbody>
            {vehiculosFiltrados.map((v) => {
              const checklist = checklistPorVehiculo.get(v.id);
              const evento = eventoPorVehiculo.get(v.id);
              const obsSalida = obsPorVehiculoEtapa.get(`${v.id}_SALIDA`) ?? "";
              const obsRegreso = obsPorVehiculoEtapa.get(`${v.id}_REGRESO`) ?? "";
              const noOperado = noOperadoPorVehiculo.get(v.id) ?? null;

              return (
                <tr key={v.id} className="border-t align-top">
                  <td className="sticky left-0 z-10 whitespace-nowrap border-r bg-card p-3">
                    <span className="font-medium">{v.patente}</span>
                    {checklist && (
                      <span className="block text-xs text-muted-foreground">{checklist.chofer.nombre}</span>
                    )}
                  </td>

                  <td className="p-3">
                    {checklist ? (
                      <Badge variant="success">Hecho a las {hora(checklist.fechaHora)}</Badge>
                    ) : noOperado ? (
                      <Badge variant="outline">No operó</Badge>
                    ) : (
                      <Badge variant="warning">Pendiente</Badge>
                    )}
                  </td>

                  <td className="p-3">
                    <ObservacionCell vehiculoId={v.id} etapa="SALIDA" valorInicial={obsSalida} />
                  </td>

                  <td className="p-3">
                    {evento ? (
                      <div className="space-y-1">
                        <Badge variant="success">Hecho a las {hora(evento.fechaHora)}</Badge>
                        {evento.tanqueLleno === true && (
                          <Badge variant="success" className="block w-fit">
                            Tanque lleno
                          </Badge>
                        )}
                        {evento.tanqueLleno === false && (
                          <Badge variant="warning" className="block w-fit">
                            Tanque no lleno
                          </Badge>
                        )}
                        {evento.tanqueLleno === null && (
                          <Badge variant="outline" className="block w-fit">
                            Sin dato de tanque
                          </Badge>
                        )}
                      </div>
                    ) : noOperado ? (
                      <Badge variant="outline">No operó</Badge>
                    ) : (
                      <Badge variant="warning">Pendiente</Badge>
                    )}
                  </td>

                  <td className="p-3">
                    <ObservacionCell vehiculoId={v.id} etapa="REGRESO" valorInicial={obsRegreso} />
                  </td>

                  <td className="p-3">
                    <DiaNoOperadoControl vehiculoId={v.id} marcado={noOperado} />
                  </td>
                </tr>
              );
            })}
            {vehiculosFiltrados.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  {vehiculos.length === 0
                    ? "No hay vehículos activos."
                    : "Ningún vehículo coincide con el filtro."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
