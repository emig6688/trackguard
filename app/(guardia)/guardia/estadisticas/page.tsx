import { requireEmpresa, ROLES_GUARDIA } from "@/lib/permisos";
import {
  calcularCumplimientoPorAnio,
  calcularCumplimientoPorDia,
  calcularCumplimientoPorMes,
  type EstadoDia,
} from "@/lib/estadisticas-guardia";
import { CumplimientoChart } from "@/components/guardia/cumplimiento-chart";
import { Badge } from "@/components/ui/badge";

type Granularidad = "DIA" | "MES" | "ANIO";
const GRANULARIDADES: { value: Granularidad; label: string }[] = [
  { value: "DIA", label: "Por día (mes)" },
  { value: "MES", label: "Por mes (año)" },
  { value: "ANIO", label: "Por año" },
];

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function formatearFechaDia(fecha: string) {
  const [, mes, dia] = fecha.split("-").map(Number);
  return `${dia} de ${MESES[mes - 1]}`;
}

function EstadoBadge({ ok, na, excluido }: { ok: boolean; na?: boolean; excluido?: boolean }) {
  if (excluido) return <Badge variant="outline">No operó</Badge>;
  if (na) return <Badge variant="outline">—</Badge>;
  return ok ? <Badge variant="success">Cumplió</Badge> : <Badge variant="destructive">No cumplió</Badge>;
}

export default async function EstadisticasGuardiaPage({
  searchParams,
}: {
  searchParams: Promise<{ choferId?: string; granularidad?: string; anio?: string; mes?: string }>;
}) {
  const { user, prisma } = await requireEmpresa(ROLES_GUARDIA);
  const params = await searchParams;

  const choferes = await prisma.usuario.findMany({
    where: { empresaId: user.empresaId!, rol: "CHOFER", activo: true, eliminadoEn: null },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true },
  });

  const choferId = params.choferId && choferes.some((c) => c.id === params.choferId)
    ? params.choferId
    : choferes[0]?.id;

  const granularidad: Granularidad = GRANULARIDADES.some((g) => g.value === params.granularidad)
    ? (params.granularidad as Granularidad)
    : "MES";

  const ahora = new Date();
  const anio = params.anio ? Number(params.anio) : ahora.getFullYear();
  const mes = params.mes ? Number(params.mes) : ahora.getMonth() + 1;

  let datosDia: EstadoDia[] = [];
  let datosAgregados: { clave: string; checklistSalida: number; cierreRuta: number; tanqueLleno: number }[] = [];

  if (choferId) {
    if (granularidad === "DIA") {
      datosDia = await calcularCumplimientoPorDia(prisma, choferId, anio, mes);
    } else if (granularidad === "MES") {
      datosAgregados = await calcularCumplimientoPorMes(prisma, choferId, anio);
    } else {
      datosAgregados = await calcularCumplimientoPorAnio(prisma, choferId);
    }
  }

  const aniosSelector = Array.from({ length: 6 }, (_, i) => ahora.getFullYear() - i);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Estadísticas</h1>
        <p className="text-sm text-muted-foreground">
          Seguimiento del cumplimiento de checklist de salida, cierre de ruta y tanque lleno por chofer.
        </p>
      </div>

      {choferes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay choferes activos.</p>
      ) : (
        <>
          <form className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
            <div className="space-y-1">
              <label htmlFor="choferId" className="text-sm font-medium">
                Chofer
              </label>
              <select
                id="choferId"
                name="choferId"
                defaultValue={choferId}
                className="block rounded-md border border-input bg-transparent p-2 text-sm"
              >
                {choferes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="granularidad" className="text-sm font-medium">
                Ver
              </label>
              <select
                id="granularidad"
                name="granularidad"
                defaultValue={granularidad}
                className="block rounded-md border border-input bg-transparent p-2 text-sm"
              >
                {GRANULARIDADES.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
            {granularidad !== "ANIO" && (
              <div className="space-y-1">
                <label htmlFor="anio" className="text-sm font-medium">
                  Año
                </label>
                <select
                  id="anio"
                  name="anio"
                  defaultValue={String(anio)}
                  className="block rounded-md border border-input bg-transparent p-2 text-sm"
                >
                  {aniosSelector.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {granularidad === "DIA" && (
              <div className="space-y-1">
                <label htmlFor="mes" className="text-sm font-medium">
                  Mes
                </label>
                <select
                  id="mes"
                  name="mes"
                  defaultValue={String(mes)}
                  className="block rounded-md border border-input bg-transparent p-2 text-sm"
                >
                  {MESES.map((nombre, i) => (
                    <option key={nombre} value={i + 1}>
                      {nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button
              type="submit"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              Aplicar
            </button>
          </form>

          {granularidad === "DIA" ? (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3 font-medium">Día</th>
                    <th className="p-3 font-medium">Checklist salida</th>
                    <th className="p-3 font-medium">Cierre de ruta</th>
                    <th className="p-3 font-medium">Tanque lleno</th>
                  </tr>
                </thead>
                <tbody>
                  {datosDia.map((d) => (
                    <tr key={d.fecha} className="border-t">
                      <td className="p-3 whitespace-nowrap">{formatearFechaDia(d.fecha)}</td>
                      <td className="p-3">
                        <EstadoBadge ok={d.checklistSalida} excluido={d.excluido} />
                      </td>
                      <td className="p-3">
                        <EstadoBadge ok={d.cierreRuta} excluido={d.excluido} />
                      </td>
                      <td className="p-3">
                        <EstadoBadge ok={d.tanqueLleno === true} na={d.tanqueLleno === null} excluido={d.excluido} />
                      </td>
                    </tr>
                  ))}
                  {datosDia.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-muted-foreground">
                        Sin datos para este mes.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-4 rounded-lg border p-4">
              {datosAgregados.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  {granularidad === "ANIO" ? "Todavía no hay datos registrados para este chofer." : "Sin datos para este año."}
                </p>
              ) : (
                <CumplimientoChart data={datosAgregados} granularidad={granularidad === "MES" ? "MES" : "ANIO"} />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
