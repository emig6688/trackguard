import Link from "next/link";
import { requireEmpresa } from "@/lib/permisos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatearFechaHora } from "@/lib/fecha";

export default async function CalidadPage() {
  const { prisma } = await requireEmpresa(["ADMIN", "ENCARGADO_MANTENIMIENTO", "GERENTE"]);

  const vehiculos = await prisma.vehiculo.findMany({
    where: { tieneSensorFrio: true, eliminadoEn: null },
    orderBy: { patente: "asc" },
    include: {
      sensorFrio: true,
    },
  });

  // Última lectura por vehículo — una consulta por vehículo (findFirst con
  // orderBy) en vez de traer todo el historial: la flota es chica (piloto de
  // 1-2 vehículos primero), no hace falta optimizar esto a una sola query
  // todavía.
  const [ultimasLecturas, alertasAbiertas] = await Promise.all([
    Promise.all(
      vehiculos.map((v) =>
        prisma.lecturaFrio.findFirst({ where: { vehiculoId: v.id }, orderBy: { fechaHora: "desc" } })
      )
    ),
    prisma.alertaFrio.findMany({
      where: { vehiculoId: { in: vehiculos.map((v) => v.id) }, resuelta: false },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const ultimaLecturaPorVehiculo = new Map(vehiculos.map((v, i) => [v.id, ultimasLecturas[i]]));
  const alertasPorVehiculo = new Map<string, typeof alertasAbiertas>();
  for (const a of alertasAbiertas) {
    const lista = alertasPorVehiculo.get(a.vehiculoId) ?? [];
    lista.push(a);
    alertasPorVehiculo.set(a.vehiculoId, lista);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Calidad</h1>
        <p className="text-sm text-muted-foreground">
          Temperatura y estado del equipo de frío de los vehículos con sensor Rinho instalado.
        </p>
      </div>

      {vehiculos.length === 0 ? (
        <Card>
          <CardContent className="space-y-2 pt-6 text-sm text-muted-foreground">
            <p>Todavía no hay ningún vehículo con sensor de frío activado.</p>
            <p>
              Se activa desde la ficha de cada vehículo en{" "}
              <Link href="/vehiculos" className="underline">
                Mantenedor → Vehículos
              </Link>
              , una vez que el sensor Rinho esté instalado y dado de alta en Flespi.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vehiculos.map((v) => {
            const lectura = ultimaLecturaPorVehiculo.get(v.id) ?? null;
            const alertas = alertasPorVehiculo.get(v.id) ?? [];
            const sinSensorActivo = !v.sensorFrio?.activo;

            return (
              <Card key={v.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>{v.patente}</span>
                    {sinSensorActivo ? (
                      <Badge variant="secondary">Sensor desactivado</Badge>
                    ) : alertas.length > 0 ? (
                      <Badge variant="destructive">{alertas.length} alerta(s)</Badge>
                    ) : lectura ? (
                      <Badge variant="success">OK</Badge>
                    ) : (
                      <Badge variant="outline">Sin datos</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {lectura ? (
                    <>
                      <p>
                        <span className="text-muted-foreground">Temperatura: </span>
                        <span className="font-medium">
                          {lectura.temperatura != null ? `${lectura.temperatura}°C` : "sin dato"}
                        </span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Equipo de frío: </span>
                        <span className="font-medium">
                          {lectura.equipoEncendido == null
                            ? "sin dato"
                            : lectura.equipoEncendido
                              ? "Encendido"
                              : "Apagado"}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Última lectura: {formatearFechaHora(lectura.fechaHora)}
                      </p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">
                      Sensor dado de alta, todavía sin ninguna lectura recibida.
                    </p>
                  )}

                  {alertas.length > 0 && (
                    <ul className="space-y-1 border-t pt-2">
                      {alertas.map((a) => (
                        <li key={a.id} className="text-xs text-destructive">
                          {a.detalle ?? "Temperatura fuera de rango"} — desde{" "}
                          {formatearFechaHora(a.createdAt)}
                        </li>
                      ))}
                    </ul>
                  )}

                  <Link href={`/vehiculos/${v.id}`} className="block pt-1 text-xs underline">
                    Ver ficha del vehículo
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
