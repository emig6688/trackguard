import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  calcularCandidatosReemplazo,
  calcularCorrectivasPorChofer,
  calcularDisponibilidadHistorica,
  calcularTendenciaPreventivoCorrectivo,
} from "@/lib/estadisticas";
import { calcularReportePorChofer, calcularReportePorTodosLosChoferes } from "@/lib/estadisticas-guardia";
import { AREA_REPARACION_LABEL } from "@/lib/clasificador-averias";
import { requireEmpresa } from "@/lib/permisos";
import { TendenciaMantenimientoChart } from "@/components/estadisticas/tendencia-mantenimiento-chart";
import { DisponibilidadHistoricaChart } from "@/components/estadisticas/disponibilidad-historica-chart";
import { TrazabilidadPanel } from "@/components/vehiculos/trazabilidad-panel";
import { FiltroPeriodoAtajos } from "@/components/filtro-periodo-atajos";

function formatearMoneda(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

function badgeScore(score: number) {
  if (score >= 66) return <Badge variant="destructive">{score}</Badge>;
  if (score >= 33) return <Badge variant="warning">{score}</Badge>;
  return <Badge variant="secondary">{score}</Badge>;
}

function rangoPorDefecto(desdeStr?: string, hastaStr?: string) {
  const hasta = hastaStr ? new Date(hastaStr) : new Date();
  const desde = desdeStr ? new Date(desdeStr) : new Date(hasta.getFullYear() - 1, hasta.getMonth(), hasta.getDate());
  return { desde, hasta };
}

export default async function EstadisticasPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    vehiculoId?: string;
    choferId?: string;
    desde?: string;
    hasta?: string;
  }>;
}) {
  const { user, prisma } = await requireEmpresa([
    "ADMIN",
    "ENCARGADO_MANTENIMIENTO",
    "ENCARGADO_COMPRAS",
    "GERENTE",
    "CONTADOR",
  ]);
  const { tab, vehiculoId, choferId, desde, hasta } = await searchParams;

  const [candidatos, tendencia, disponibilidad, correctivasChofer, vehiculos, choferesActivos] = await Promise.all([
    calcularCandidatosReemplazo(prisma),
    calcularTendenciaPreventivoCorrectivo(prisma),
    calcularDisponibilidadHistorica(prisma),
    calcularCorrectivasPorChofer(prisma),
    prisma.vehiculo.findMany({
      where: { activo: true, eliminadoEn: null },
      select: { id: true, patente: true },
      orderBy: { patente: "asc" },
    }),
    prisma.usuario.findMany({
      where: { empresaId: user.empresaId!, rol: "CHOFER", activo: true, eliminadoEn: null },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);
  const { ranking: choferes, correlaciones } = correctivasChofer;

  const TODOS_CHOFERES = "TODOS";
  const choferSeleccionado =
    choferId === TODOS_CHOFERES
      ? TODOS_CHOFERES
      : (choferId && choferesActivos.some((c) => c.id === choferId) ? choferId : choferesActivos[0]?.id);
  const { desde: desdeReporte, hasta: hastaReporte } = rangoPorDefecto(desde, hasta);
  const reporteChofer =
    choferSeleccionado && choferSeleccionado !== TODOS_CHOFERES
      ? await calcularReportePorChofer(prisma, choferSeleccionado, desdeReporte, hastaReporte)
      : null;
  const reporteTodos =
    choferSeleccionado === TODOS_CHOFERES
      ? await calcularReportePorTodosLosChoferes(
          prisma,
          choferesActivos.map((c) => c.id),
          desdeReporte,
          hastaReporte
        )
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Estadísticas estratégicas</h1>
          <p className="text-sm text-muted-foreground">
            Indicadores para decisiones de flota (reemplazo, planificación de mantenimiento), no del
            día a día operativo.
          </p>
        </div>
        <div className="flex gap-2">
          <a href="/api/export/estadisticas-pdf" className={buttonVariants({ variant: "outline" })}>
            Exportar todo (PDF)
          </a>
          <a href="/api/export/estadisticas" className={buttonVariants({ variant: "outline" })}>
            Exportar todo (Excel)
          </a>
        </div>
      </div>

      <Tabs defaultValue={tab === "reportes" || tab === "choferes" ? tab : "vehiculos"}>
        <TabsList>
          <TabsTrigger value="vehiculos">Vehículos</TabsTrigger>
          <TabsTrigger value="choferes">Choferes</TabsTrigger>
          <TabsTrigger value="reportes">Reportes</TabsTrigger>
        </TabsList>

        <TabsContent value="vehiculos" className="space-y-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Candidatos a reemplazo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Score 0-100 relativo a la flota actual: 50% costo por km (últimos 12 meses), 30%
                cantidad de OT correctivas (últimos 12 meses), 20% antigüedad. A mayor score, más
                conviene evaluar el reemplazo.
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehículo</TableHead>
                    <TableHead className="hidden md:table-cell">Score</TableHead>
                    <TableHead className="max-w-[90px] md:max-w-none">Costo/km (12m)</TableHead>
                    <TableHead className="hidden md:table-cell">Costo total (12m)</TableHead>
                    <TableHead className="hidden md:table-cell">Correctivas (12m)</TableHead>
                    <TableHead className="hidden md:table-cell">Antigüedad</TableHead>
                    <TableHead className="hidden md:table-cell">Áreas repetidas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidatos.map((c) => (
                    <TableRow key={c.vehiculoId}>
                      <TableCell className="font-medium">
                        {c.patente}
                        <div className="mt-1 flex flex-wrap items-center gap-1 md:hidden">
                          {badgeScore(c.score)}
                          <span className="text-xs text-muted-foreground">{c.correctivas12m} correctivas</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{badgeScore(c.score)}</TableCell>
                      <TableCell className="max-w-[90px] tabular-nums md:max-w-none">
                        {c.kmActual > 0 ? formatearMoneda(c.costoPorKm) : "—"}
                      </TableCell>
                      <TableCell className="hidden tabular-nums md:table-cell">
                        {formatearMoneda(c.costoTotal12m)}
                      </TableCell>
                      <TableCell className="hidden tabular-nums md:table-cell">{c.correctivas12m}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        {c.antiguedadAnios != null ? `${c.antiguedadAnios} años` : "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {c.areasRepetidas.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {c.areasRepetidas.map((a) => (
                              <Badge key={a.area} variant="outline">
                                {AREA_REPARACION_LABEL[a.area as keyof typeof AREA_REPARACION_LABEL]} ({a.cantidad})
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {candidatos.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="whitespace-normal text-center text-muted-foreground">
                        No hay vehículos activos.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tendencia preventivo vs. correctivo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Cantidad mensual de OT por origen (últimos 12 meses). Un mix que se mueve hacia lo
                correctivo indica que el mantenimiento planificado no está previniendo fallas.
              </p>
              <TendenciaMantenimientoChart data={tendencia} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Disponibilidad histórica de la flota</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                % promedio mensual de vehículos disponibles (interruptor manual y no derivados a
                taller externo). Se registra desde el 2026-07-20 — los meses anteriores no tienen
                dato y no aparecen en el gráfico.
              </p>
              {disponibilidad.length > 0 ? (
                <DisponibilidadHistoricaChart data={disponibilidad} />
              ) : (
                <p className="text-center text-sm text-muted-foreground">
                  Todavía no hay datos suficientes — el snapshot diario recién empezó a registrarse.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="choferes" className="space-y-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Correctivas generadas por chofer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Cantidad de OT correctivas originadas por cada chofer (checklist pre-salida o evento
                de ruta), acumuladas por camión. No incluye correctivas cargadas manualmente por un
                administrativo, porque esas no reflejan quién manejaba el vehículo.
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="max-w-[100px] md:max-w-none">Chofer</TableHead>
                    <TableHead className="hidden md:table-cell">Total correctivas</TableHead>
                    <TableHead className="max-w-[160px] md:max-w-none">Por camión</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {choferes.map((c) => (
                    <TableRow key={c.choferId}>
                      <TableCell className="max-w-[100px] font-medium md:max-w-none">
                        {c.choferNombre}
                        <p className="text-xs font-normal text-muted-foreground md:hidden">
                          {c.total} correctivas
                        </p>
                      </TableCell>
                      <TableCell className="hidden tabular-nums md:table-cell">{c.total}</TableCell>
                      <TableCell className="max-w-[160px] md:max-w-none">
                        <div className="flex flex-wrap gap-1">
                          {c.porVehiculo.map((v) => (
                            <Badge key={v.vehiculoId} variant="outline">
                              {v.patente} ({v.cantidad})
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {choferes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="whitespace-normal text-center text-muted-foreground">
                        Todavía no hay correctivas originadas por un chofer.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Correlaciones chofer-vehículo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Casos donde un mismo chofer concentra la mayoría de las correctivas de un vehículo
                puntual (al menos 2 correctivas del par y 60% o más del total de ese vehículo) — vale
                la pena revisar si es el vehículo, el uso que le da ese chofer, o casualidad de la
                asignación.
              </p>
              {correlaciones.length > 0 ? (
                <ul className="space-y-1 text-sm">
                  {correlaciones.map((cr, i) => (
                    <li key={i}>
                      <span className="font-medium">{cr.choferNombre}</span> concentra el{" "}
                      {cr.porcentaje}% de las correctivas de <span className="font-medium">{cr.patente}</span> (
                      {cr.cantidad} de {cr.totalVehiculo}).
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No hay correlaciones que superen el umbral con los datos actuales.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reportes" className="space-y-6 pt-4">
          <FiltroPeriodoAtajos
            basePath="/reportes/estadisticas"
            params={{ tab: "reportes", vehiculoId, choferId, desde, hasta }}
          />

          <TrazabilidadPanel vehiculos={vehiculos} vehiculoId={vehiculoId} desde={desde} hasta={hasta} />

          <Card>
            <CardHeader>
              <CardTitle>Reporte por chofer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Roturas reportadas, cumplimiento de checklist pre-salida y cierre de ruta, veces que
                volvió con el tanque sin llenar, y observaciones del guardia por incumplimiento de
                checklist — para un chofer en un período.
              </p>
              {choferesActivos.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay choferes activos.</p>
              ) : (
                <>
                  <form className="flex flex-wrap items-end gap-3">
                    <input type="hidden" name="tab" value="reportes" />
                    <div className="space-y-1">
                      <Label htmlFor="rep-choferId">Chofer</Label>
                      <select
                        id="rep-choferId"
                        name="choferId"
                        defaultValue={choferSeleccionado}
                        className="block rounded-md border border-input bg-transparent p-2 text-sm"
                      >
                        <option value={TODOS_CHOFERES}>Todos los choferes</option>
                        {choferesActivos.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="rep-desde">Desde</Label>
                      <Input id="rep-desde" name="desde" type="date" defaultValue={desde} className="w-full sm:w-40" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="rep-hasta">Hasta</Label>
                      <Input id="rep-hasta" name="hasta" type="date" defaultValue={hasta} className="w-full sm:w-40" />
                    </div>
                    <Button type="submit" variant="outline">
                      Aplicar
                    </Button>
                    {(desde || hasta) && (
                      <Link
                        href={`/reportes/estadisticas?tab=reportes${choferSeleccionado ? `&choferId=${choferSeleccionado}` : ""}`}
                        className={buttonVariants({ variant: "ghost", size: "sm" })}
                      >
                        Limpiar
                      </Link>
                    )}
                  </form>
                  <p className="text-xs text-muted-foreground">Sin período elegido, se toma el último año.</p>

                  {reporteChofer && (
                    <Table>
                      <TableBody>
                        <TableRow>
                          <TableCell className="max-w-[180px] whitespace-normal font-medium md:max-w-none md:whitespace-nowrap">
                            Días operados
                          </TableCell>
                          <TableCell className="tabular-nums">{reporteChofer.diasOperados}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="max-w-[180px] whitespace-normal font-medium md:max-w-none md:whitespace-nowrap">
                            Checklist pre-salida cumplidos
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {reporteChofer.checklistPresalidaCumplidos} / {reporteChofer.diasOperados}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="max-w-[180px] whitespace-normal font-medium md:max-w-none md:whitespace-nowrap">
                            Cierres de ruta cumplidos
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {reporteChofer.cierresRutaCumplidos} / {reporteChofer.diasOperados}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="max-w-[180px] whitespace-normal font-medium md:max-w-none md:whitespace-nowrap">
                            Veces con el tanque sin llenar
                          </TableCell>
                          <TableCell className="tabular-nums">{reporteChofer.tanqueNoLlenoCount}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="max-w-[180px] whitespace-normal font-medium md:max-w-none md:whitespace-nowrap">
                            Roturas reportadas (OT correctivas)
                          </TableCell>
                          <TableCell className="tabular-nums">{reporteChofer.roturasReportadas}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="max-w-[180px] whitespace-normal font-medium md:max-w-none md:whitespace-nowrap">
                            Observaciones del guardia por incumplimiento
                          </TableCell>
                          <TableCell className="tabular-nums">{reporteChofer.observacionesGuardia}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  )}

                  {reporteTodos && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky left-0 z-10 bg-card">Métrica</TableHead>
                          {reporteTodos.map((r) => (
                            <TableHead key={r.choferNombre}>{r.choferNombre}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="sticky left-0 z-10 bg-card font-medium">Días operados</TableCell>
                          {reporteTodos.map((r) => (
                            <TableCell key={r.choferNombre} className="tabular-nums">
                              {r.diasOperados}
                            </TableCell>
                          ))}
                        </TableRow>
                        <TableRow>
                          <TableCell className="sticky left-0 z-10 bg-card font-medium">
                            Checklist pre-salida cumplidos
                          </TableCell>
                          {reporteTodos.map((r) => (
                            <TableCell key={r.choferNombre} className="tabular-nums">
                              {r.checklistPresalidaCumplidos} / {r.diasOperados}
                            </TableCell>
                          ))}
                        </TableRow>
                        <TableRow>
                          <TableCell className="sticky left-0 z-10 bg-card font-medium">
                            Cierres de ruta cumplidos
                          </TableCell>
                          {reporteTodos.map((r) => (
                            <TableCell key={r.choferNombre} className="tabular-nums">
                              {r.cierresRutaCumplidos} / {r.diasOperados}
                            </TableCell>
                          ))}
                        </TableRow>
                        <TableRow>
                          <TableCell className="sticky left-0 z-10 bg-card font-medium">
                            Veces con el tanque sin llenar
                          </TableCell>
                          {reporteTodos.map((r) => (
                            <TableCell key={r.choferNombre} className="tabular-nums">
                              {r.tanqueNoLlenoCount}
                            </TableCell>
                          ))}
                        </TableRow>
                        <TableRow>
                          <TableCell className="sticky left-0 z-10 bg-card font-medium">
                            Roturas reportadas (OT correctivas)
                          </TableCell>
                          {reporteTodos.map((r) => (
                            <TableCell key={r.choferNombre} className="tabular-nums">
                              {r.roturasReportadas}
                            </TableCell>
                          ))}
                        </TableRow>
                        <TableRow>
                          <TableCell className="sticky left-0 z-10 bg-card font-medium">
                            Observaciones del guardia por incumplimiento
                          </TableCell>
                          {reporteTodos.map((r) => (
                            <TableCell key={r.choferNombre} className="tabular-nums">
                              {r.observacionesGuardia}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableBody>
                    </Table>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
