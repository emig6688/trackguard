import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { AREA_REPARACION_LABEL } from "@/lib/clasificador-averias";
import { requireEmpresa } from "@/lib/permisos";
import { TendenciaMantenimientoChart } from "@/components/estadisticas/tendencia-mantenimiento-chart";
import { DisponibilidadHistoricaChart } from "@/components/estadisticas/disponibilidad-historica-chart";

function formatearMoneda(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

function badgeScore(score: number) {
  if (score >= 66) return <Badge variant="destructive">{score}</Badge>;
  if (score >= 33) return <Badge variant="warning">{score}</Badge>;
  return <Badge variant="secondary">{score}</Badge>;
}

export default async function EstadisticasPage() {
  const { prisma } = await requireEmpresa([
    "ADMIN",
    "ENCARGADO_MANTENIMIENTO",
    "ENCARGADO_COMPRAS",
    "GERENTE",
    "CONTADOR",
  ]);

  const [candidatos, tendencia, disponibilidad, correctivasChofer] = await Promise.all([
    calcularCandidatosReemplazo(prisma),
    calcularTendenciaPreventivoCorrectivo(prisma),
    calcularDisponibilidadHistorica(prisma),
    calcularCorrectivasPorChofer(prisma),
  ]);
  const { ranking: choferes, correlaciones } = correctivasChofer;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Estadísticas estratégicas</h1>
        <p className="text-sm text-muted-foreground">
          Indicadores para decisiones de flota (reemplazo, planificación de mantenimiento), no del
          día a día operativo.
        </p>
      </div>

      <Tabs defaultValue="vehiculos">
        <TabsList>
          <TabsTrigger value="vehiculos">Vehículos</TabsTrigger>
          <TabsTrigger value="choferes">Choferes</TabsTrigger>
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
                    <TableHead>Score</TableHead>
                    <TableHead>Costo/km (12m)</TableHead>
                    <TableHead>Costo total (12m)</TableHead>
                    <TableHead>Correctivas (12m)</TableHead>
                    <TableHead>Antigüedad</TableHead>
                    <TableHead>Áreas repetidas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidatos.map((c) => (
                    <TableRow key={c.vehiculoId}>
                      <TableCell className="font-medium">{c.patente}</TableCell>
                      <TableCell>{badgeScore(c.score)}</TableCell>
                      <TableCell className="tabular-nums">
                        {c.kmActual > 0 ? formatearMoneda(c.costoPorKm) : "—"}
                      </TableCell>
                      <TableCell className="tabular-nums">{formatearMoneda(c.costoTotal12m)}</TableCell>
                      <TableCell className="tabular-nums">{c.correctivas12m}</TableCell>
                      <TableCell>{c.antiguedadAnios != null ? `${c.antiguedadAnios} años` : "—"}</TableCell>
                      <TableCell>
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
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
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
                    <TableHead>Chofer</TableHead>
                    <TableHead>Total correctivas</TableHead>
                    <TableHead>Por camión</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {choferes.map((c) => (
                    <TableRow key={c.choferId}>
                      <TableCell className="font-medium">{c.choferNombre}</TableCell>
                      <TableCell className="tabular-nums">{c.total}</TableCell>
                      <TableCell>
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
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
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
      </Tabs>
    </div>
  );
}
