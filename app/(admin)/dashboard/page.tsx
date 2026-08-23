import Link from "next/link";
import {
  ClipboardList,
  TriangleAlert,
  AlarmClockOff,
  FileWarning,
  CircleCheck,
  CalendarX,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireEmpresa } from "@/lib/permisos";
import {
  condicionOTAtrasada,
  condicionOTSinFechaEstimada,
  fechaReferenciaAtraso,
  puedeMecanicoAccionar,
} from "@/lib/ot";
import { actualizarFechaEstimada } from "@/app/_actions/ordenesTrabajo";
import { AREA_REPARACION_LABEL } from "@/lib/clasificador-averias";
import { vehiculosEnTallerExterno, disponibilidadEfectiva } from "@/lib/disponibilidad";
import {
  calcularEstadoVencimiento,
  ESTADO_VENCIMIENTO_LABEL,
  ESTADO_VENCIMIENTO_VARIANT,
} from "@/lib/vencimientos";

const ORIGEN_REACTIVO_LABEL: Record<string, string> = {
  CHECKLIST: "Checklist con falla",
  EVENTO_RUTA: "Evento de ruta",
  MANUAL: "Carga manual",
};

type Tone = "neutral" | "good" | "warning" | "bad";

const TONE_STYLES: Record<Tone, { border: string; chip: string; value: string }> = {
  neutral: { border: "", chip: "bg-primary/10 text-primary", value: "text-foreground" },
  good: { border: "border-l-4 border-l-success", chip: "bg-success/15 text-success", value: "text-success" },
  warning: {
    border: "border-l-4 border-l-warning",
    chip: "bg-warning/20 text-warning-foreground",
    value: "text-warning-foreground",
  },
  bad: {
    border: "border-l-4 border-l-destructive",
    chip: "bg-destructive/10 text-destructive",
    value: "text-destructive",
  },
};

function StatCard({
  icon: Icon,
  label,
  value,
  total,
  tone = "neutral",
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  total?: number;
  tone?: Tone;
  href: string;
}) {
  const s = TONE_STYLES[tone];
  return (
    <Link href={href}>
      <Card className={`h-full transition-colors hover:bg-muted/40 ${s.border}`}>
        <CardContent className="flex items-center gap-4">
          <div className={`flex size-12 shrink-0 items-center justify-center rounded-lg ${s.chip}`}>
            <Icon className="size-6" />
          </div>
          <div className="min-w-0">
            <p className={`text-3xl leading-none font-bold tabular-nums ${s.value}`}>
              {value}
              {total != null && (
                <span className="text-lg font-medium text-muted-foreground">/{total}</span>
              )}
            </p>
            <p className="mt-1.5 text-sm leading-tight font-medium text-muted-foreground">{label}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default async function DashboardPage() {
  const { user: session, prisma } = await requireEmpresa();
  const empresaId = session.empresaId!;

  const documentos = await prisma.documento.findMany({
    where: { activo: true, eliminadoEn: null },
    include: { tipoDocumento: true },
  });

  const vehiculoIds = documentos
    .filter((d) => d.entidadTipo === "VEHICULO")
    .map((d) => d.entidadId);
  const choferIds = documentos.filter((d) => d.entidadTipo === "CHOFER").map((d) => d.entidadId);
  const [vehiculos, choferes] = await Promise.all([
    prisma.vehiculo.findMany({ where: { id: { in: vehiculoIds }, eliminadoEn: null } }),
    prisma.usuario.findMany({ where: { id: { in: choferIds }, eliminadoEn: null, empresaId } }),
  ]);
  const vehiculoPorId = new Map(vehiculos.map((v) => [v.id, v]));
  const choferPorId = new Map(choferes.map((c) => [c.id, c]));

  const vehiculosActivos = await prisma.vehiculo.findMany({
    where: { activo: true, eliminadoEn: null },
    select: { id: true, disponible: true },
  });
  const enTallerExterno = await vehiculosEnTallerExterno(
    prisma,
    vehiculosActivos.map((v) => v.id)
  );
  const totalOperativos = vehiculosActivos.filter((v) =>
    disponibilidadEfectiva(v, enTallerExterno.has(v.id))
  ).length;

  const otPorEstado = await prisma.ordenDeTrabajo.groupBy({
    by: ["estado"],
    where: { eliminadoEn: null },
    _count: true,
  });
  const conteoOT = Object.fromEntries(otPorEstado.map((r) => [r.estado, r._count])) as Record<
    string,
    number
  >;
  const otAbiertas =
    (conteoOT.PENDIENTE_APROBACION ?? 0) +
    (conteoOT.APROBADA ?? 0) +
    (conteoOT.EN_PROGRESO ?? 0) +
    (conteoOT.DERIVADA_EXTERNO ?? 0);

  // Preventivo vs. correctivo: todo lo que no nace de un plan de mantenimiento
  // (checklist con falla, evento de ruta, carga manual) es trabajo reactivo —
  // se excluyen las canceladas porque no llegaron a consumir recursos reales.
  const otPorOrigen = await prisma.ordenDeTrabajo.groupBy({
    by: ["origen"],
    where: { eliminadoEn: null, estado: { not: "CANCELADA" } },
    _count: true,
  });
  const conteoOrigen = Object.fromEntries(otPorOrigen.map((r) => [r.origen, r._count])) as Record<
    string,
    number
  >;
  const totalConOrigen = Object.values(conteoOrigen).reduce((acc, n) => acc + n, 0);
  const totalPreventivo = conteoOrigen.PREVENTIVO ?? 0;
  const totalReactivo = totalConOrigen - totalPreventivo;
  const pctPreventivo =
    totalConOrigen > 0 ? Math.round((totalPreventivo / totalConOrigen) * 100) : null;

  const ahora = new Date();
  const [
    otsAtrasadasSinOrdenar,
    totalAtrasadas,
    otsCompletadasConEstimacion,
    otsSinFechaEstimada,
    totalSinFechaEstimada,
  ] = await Promise.all([
    prisma.ordenDeTrabajo.findMany({
      where: condicionOTAtrasada(ahora),
      include: { vehiculo: true },
    }),
    prisma.ordenDeTrabajo.count({ where: condicionOTAtrasada(ahora) }),
    prisma.ordenDeTrabajo.findMany({
      where: {
        eliminadoEn: null,
        estado: "COMPLETADA",
        fechaEstimadaFinalizacion: { not: null },
        fechaFin: { not: null },
      },
      select: { fechaFin: true, fechaEstimadaFinalizacion: true },
    }),
    prisma.ordenDeTrabajo.findMany({
      where: condicionOTSinFechaEstimada(),
      include: { vehiculo: true },
      orderBy: { createdAt: "asc" },
      take: 8,
    }),
    prisma.ordenDeTrabajo.count({ where: condicionOTSinFechaEstimada() }),
  ]);

  // Se ordena en JS porque la fecha relevante es fechaEstimadaFinalizacion o,
  // si todavía no se fijó, fechaLimite — Prisma no puede ordenar por un campo
  // "coalescido" entre dos columnas.
  const otsAtrasadas = otsAtrasadasSinOrdenar
    .slice()
    .sort(
      (a, b) =>
        (fechaReferenciaAtraso(a)?.getTime() ?? 0) - (fechaReferenciaAtraso(b)?.getTime() ?? 0)
    )
    .slice(0, 8);

  const totalConEstimacion = otsCompletadasConEstimacion.length;
  const enTiempo = otsCompletadasConEstimacion.filter(
    (ot) => ot.fechaFin!.getTime() <= ot.fechaEstimadaFinalizacion!.getTime()
  ).length;
  const atrasadasHistorico = totalConEstimacion - enTiempo;
  const pctEnTiempo = totalConEstimacion > 0 ? Math.round((enTiempo / totalConEstimacion) * 100) : null;

  const criticos = documentos
    .map((doc) => ({
      doc,
      estado: calcularEstadoVencimiento(doc.fechaVencimiento, doc.tipoDocumento.diasAlertaDefault),
      entidadLabel:
        doc.entidadTipo === "VEHICULO"
          ? vehiculoPorId.get(doc.entidadId)?.patente
          : choferPorId.get(doc.entidadId)?.nombre,
    }))
    .filter((d) => d.estado !== "VIGENTE")
    .sort((a, b) => a.doc.fechaVencimiento.getTime() - b.doc.fechaVencimiento.getTime());

  const criticosVisibles = criticos.slice(0, 8);
  const hayVencidos = criticos.some((c) => c.estado === "VENCIDO");

  // El preventivo nace directo en APROBADA (ver cron/planes-mantenimiento) —
  // nunca pasa por PENDIENTE_APROBACION, así que esta tarjeta muestra lo
  // generado automáticamente que un mecánico todavía no tomó (sigue en
  // APROBADA en vez de EN_PROGRESO).
  const preventivosPendientes = await prisma.ordenDeTrabajo.findMany({
    where: { origen: "PREVENTIVO", estado: "APROBADA", eliminadoEn: null },
    include: { vehiculo: true },
    orderBy: { createdAt: "asc" },
    take: 8,
  });
  const totalPreventivosPendientes = await prisma.ordenDeTrabajo.count({
    where: { origen: "PREVENTIVO", estado: "APROBADA", eliminadoEn: null },
  });

  const haceSieteDias = new Date();
  haceSieteDias.setDate(haceSieteDias.getDate() - 7);
  const comprasRecibidas = await prisma.ordenCompra.findMany({
    where: {
      estado: { in: ["REALIZADA", "DOCUMENTADA"] },
      fechaCompra: { gte: haceSieteDias },
      eliminadoEn: null,
    },
    include: { items: true },
    orderBy: { fechaCompra: "desc" },
    take: 8,
  });

  const [comprasSinDocumentar, totalComprasSinDocumentar] = await Promise.all([
    prisma.ordenCompra.findMany({
      where: { estado: "REALIZADA", eliminadoEn: null },
      include: { items: true },
      orderBy: { fechaCompra: "asc" },
      take: 8,
    }),
    prisma.ordenCompra.count({ where: { estado: "REALIZADA", eliminadoEn: null } }),
  ]);

  const comprasPendientesAutorizacion = await prisma.ordenCompra.findMany({
    where: { estadoAutorizacion: "PENDIENTE", eliminadoEn: null },
    include: { items: true, presupuestos: true },
    orderBy: { fechaSolicitud: "asc" },
  });
  const comprasSinPresupuesto = comprasPendientesAutorizacion.filter((c) => c.presupuestos.length === 0);
  const comprasConPresupuestoPendiente = comprasPendientesAutorizacion.filter((c) => c.presupuestos.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Hola, {session.nombre?.split(" ")[0]} — así está la flota hoy.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Preventivo vs. correctivo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {pctPreventivo === null ? (
            <p className="text-sm text-muted-foreground">
              Todavía no hay órdenes de trabajo para calcular este indicador.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-semibold text-success">
                  {pctPreventivo}% preventivo ({totalPreventivo})
                </span>
                <span className="font-semibold text-warning-foreground">
                  {100 - pctPreventivo}% correctivo ({totalReactivo})
                </span>
                <span className="text-muted-foreground">de {totalConOrigen} OT (sin canceladas)</span>
              </div>
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-success" style={{ width: `${pctPreventivo}%` }} />
                <div className="h-full bg-warning" style={{ width: `${100 - pctPreventivo}%` }} />
              </div>
              {totalReactivo > 0 && (
                <p className="text-xs text-muted-foreground">
                  Correctivo por origen:{" "}
                  {Object.entries(ORIGEN_REACTIVO_LABEL)
                    .map(([origen, label]) => `${label}: ${conteoOrigen[origen] ?? 0}`)
                    .join(" · ")}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={CircleCheck}
          label="Vehículos operativos"
          value={totalOperativos}
          total={vehiculosActivos.length}
          tone={
            vehiculosActivos.length === 0 || totalOperativos === vehiculosActivos.length
              ? "good"
              : totalOperativos === 0
                ? "bad"
                : "warning"
          }
          href="/vehiculos"
        />
        <StatCard
          icon={ClipboardList}
          label="OT abiertas"
          value={otAbiertas}
          href="/ordenes-trabajo"
        />
        <StatCard
          icon={AlarmClockOff}
          label="OT con atraso"
          value={totalAtrasadas}
          tone={totalAtrasadas === 0 ? "good" : "bad"}
          href="/ordenes-trabajo?atraso=1"
        />
        <StatCard
          icon={CalendarX}
          label="OT sin fecha estimada"
          value={totalSinFechaEstimada}
          tone={totalSinFechaEstimada === 0 ? "good" : "warning"}
          href="/ordenes-trabajo?sinFecha=1"
        />
        <StatCard
          icon={TriangleAlert}
          label="Vencimientos próximos"
          value={criticos.length}
          tone={criticos.length === 0 ? "good" : hayVencidos ? "bad" : "warning"}
          href="/documentos"
        />
        <StatCard
          icon={FileWarning}
          label="Compras sin documentar"
          value={totalComprasSinDocumentar}
          tone={totalComprasSinDocumentar === 0 ? "good" : "warning"}
          href="/compras?estado=REALIZADA"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Órdenes de trabajo por estado</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-sm">
          <span>Pendientes: {conteoOT.PENDIENTE_APROBACION ?? 0}</span>
          <span>· Aprobadas: {conteoOT.APROBADA ?? 0}</span>
          <span>· En progreso: {conteoOT.EN_PROGRESO ?? 0}</span>
          <span>· Derivadas: {conteoOT.DERIVADA_EXTERNO ?? 0}</span>
          <span>· Completadas: {conteoOT.COMPLETADA ?? 0}</span>
          <span>· Canceladas: {conteoOT.CANCELADA ?? 0}</span>
          <Link href="/ordenes-trabajo" className="block w-full pt-2 underline">
            Ver todas las órdenes de trabajo
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cumplimiento de plazos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {pctEnTiempo === null ? (
            <p className="text-sm text-muted-foreground">
              Todavía no hay OT completadas con fecha estimada de finalización para calcular este
              indicador.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-3 text-sm">
                <span
                  className={`font-semibold ${pctEnTiempo >= 80 ? "text-success" : pctEnTiempo >= 50 ? "text-warning-foreground" : "text-destructive"}`}
                >
                  {pctEnTiempo}% en tiempo
                </span>
                <span className="text-muted-foreground">
                  {100 - pctEnTiempo}% atrasadas · {enTiempo} de {totalConEstimacion} OT completadas
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-destructive/20">
                <div
                  className={`h-full rounded-full ${pctEnTiempo >= 80 ? "bg-success" : pctEnTiempo >= 50 ? "bg-warning" : "bg-destructive"}`}
                  style={{ width: `${pctEnTiempo}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {atrasadasHistorico} OT se completaron después de la fecha estimada.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>OT con atraso</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {otsAtrasadas.map((ot) => {
            const diasAtraso = Math.floor(
              (ahora.getTime() - fechaReferenciaAtraso(ot)!.getTime()) / 86_400_000
            );
            return (
              <div key={ot.id} className="flex items-center justify-between text-sm">
                <Link href={`/ordenes-trabajo/${ot.id}`} className="hover:underline">
                  {ot.vehiculo.patente} · {ot.titulo}
                  {ot.areaReparacion && ` · ${AREA_REPARACION_LABEL[ot.areaReparacion]}`}
                </Link>
                <Badge variant="destructive">{diasAtraso}d de atraso</Badge>
              </div>
            );
          })}
          {otsAtrasadas.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin OT atrasadas.</p>
          )}
          {totalAtrasadas > otsAtrasadas.length && (
            <p className="text-sm text-muted-foreground">
              y {totalAtrasadas - otsAtrasadas.length} más...
            </p>
          )}
          <Link href="/ordenes-trabajo?atraso=1" className="block pt-2 text-sm underline">
            Ver todas las OT con atraso
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>OT sin fecha estimada</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {otsSinFechaEstimada.map((ot) => {
            const puedeEditarFecha =
              session.rol === "ADMIN" ||
              session.rol === "ENCARGADO_MANTENIMIENTO" ||
              (session.rol === "MECANICO_INTERNO" && puedeMecanicoAccionar(ot, session.id));
            return (
              <div key={ot.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <Link href={`/ordenes-trabajo/${ot.id}`} className="hover:underline">
                  {ot.vehiculo.patente} · {ot.titulo}
                  {ot.areaReparacion && ` · ${AREA_REPARACION_LABEL[ot.areaReparacion]}`}
                </Link>
                {puedeEditarFecha ? (
                  <form
                    action={async (formData: FormData) => {
                      "use server";
                      await actualizarFechaEstimada(ot.id, undefined, formData);
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <Input
                      type="date"
                      name="fechaEstimadaFinalizacion"
                      required
                      className="h-7 w-36 text-xs"
                    />
                    <Button type="submit" size="xs" variant="outline">
                      Guardar
                    </Button>
                  </form>
                ) : (
                  <Badge variant="warning">Sin fecha</Badge>
                )}
              </div>
            );
          })}
          {otsSinFechaEstimada.length === 0 && (
            <p className="text-sm text-muted-foreground">Todas las OT abiertas tienen fecha estimada.</p>
          )}
          {totalSinFechaEstimada > otsSinFechaEstimada.length && (
            <p className="text-sm text-muted-foreground">
              y {totalSinFechaEstimada - otsSinFechaEstimada.length} más...
            </p>
          )}
          <Link href="/ordenes-trabajo?sinFecha=1" className="block pt-2 text-sm underline">
            Ver todas las OT sin fecha estimada
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mantenimiento preventivo generado, sin iniciar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {preventivosPendientes.map((ot) => (
            <div key={ot.id} className="flex items-center justify-between text-sm">
              <Link href={`/ordenes-trabajo/${ot.id}`} className="hover:underline">
                {ot.vehiculo.patente} · {ot.titulo}
              </Link>
              <Badge variant="outline">{ot.createdAt.toLocaleDateString("es-AR")}</Badge>
            </div>
          ))}
          {preventivosPendientes.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin mantenimientos preventivos generados sin iniciar.</p>
          )}
          {totalPreventivosPendientes > preventivosPendientes.length && (
            <p className="text-sm text-muted-foreground">
              y {totalPreventivosPendientes - preventivosPendientes.length} más...
            </p>
          )}
          <Link href="/ordenes-trabajo?estado=APROBADA" className="block pt-2 text-sm underline">
            Ver órdenes de trabajo generadas
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Compras sin documentar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {comprasSinDocumentar.map((c) => (
            <div key={c.id} className="flex items-center justify-between text-sm">
              <Link href="/compras?estado=REALIZADA" className="hover:underline">
                {c.numero} · {c.items[0]?.descripcion ?? ""}
                {c.items.length > 1 ? ` y ${c.items.length - 1} más` : ""}
              </Link>
              <Badge variant="warning">
                {c.fechaCompra ? `Comprada ${c.fechaCompra.toLocaleDateString("es-AR")}` : "Sin fecha"}
              </Badge>
            </div>
          ))}
          {comprasSinDocumentar.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Todas las compras realizadas tienen su factura cargada.
            </p>
          )}
          {totalComprasSinDocumentar > comprasSinDocumentar.length && (
            <p className="text-sm text-muted-foreground">
              y {totalComprasSinDocumentar - comprasSinDocumentar.length} más...
            </p>
          )}
          <Link href="/compras?estado=REALIZADA" className="block pt-2 text-sm underline">
            Ver compras sin documentar
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Presupuestos pendientes de subir</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {comprasSinPresupuesto.map((c) => (
            <div key={c.id} className="flex items-center justify-between text-sm">
              <Link href="/compras" className="hover:underline">
                {c.numero} · {c.items[0]?.descripcion ?? ""}
                {c.items.length > 1 ? ` y ${c.items.length - 1} más` : ""}
              </Link>
              <Badge variant="warning">
                {c.montoEstimado ? `$${c.montoEstimado.toString()}` : "Sin monto"}
              </Badge>
            </div>
          ))}
          {comprasSinPresupuesto.length === 0 && (
            <p className="text-sm text-muted-foreground">No hay compras esperando presupuestos.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Presupuestos pendientes de aprobar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {comprasConPresupuestoPendiente.map((c) => (
            <div key={c.id} className="flex items-center justify-between text-sm">
              <Link href="/autorizaciones" className="hover:underline">
                {c.numero} · {c.items[0]?.descripcion ?? ""}
                {c.items.length > 1 ? ` y ${c.items.length - 1} más` : ""}
              </Link>
              <Badge variant="warning">
                {c.presupuestos.length} presupuesto{c.presupuestos.length === 1 ? "" : "s"}
              </Badge>
            </div>
          ))}
          {comprasConPresupuestoPendiente.length === 0 && (
            <p className="text-sm text-muted-foreground">No hay presupuestos esperando aprobación.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Compras recibidas recientemente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {comprasRecibidas.map((c) => (
            <div key={c.id} className="flex items-center justify-between text-sm">
              <span>
                {c.items[0]?.descripcion ?? ""}
                {c.items.length > 1 ? ` y ${c.items.length - 1} más` : ""}
              </span>
              <Badge variant="secondary">
                {c.fechaCompra?.toLocaleDateString("es-AR") ?? ""}
              </Badge>
            </div>
          ))}
          {comprasRecibidas.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin compras recibidas en los últimos 7 días.</p>
          )}
          <Link href="/compras" className="block pt-2 text-sm underline">
            Ver compras
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vencimientos críticos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {criticosVisibles.map(({ doc, estado, entidadLabel }) => (
            <div key={doc.id} className="flex items-center justify-between text-sm">
              <span>
                {entidadLabel} · {doc.tipoDocumento.nombre} ·{" "}
                {doc.fechaVencimiento.toLocaleDateString("es-AR")}
              </span>
              <Badge variant={ESTADO_VENCIMIENTO_VARIANT[estado]}>
                {ESTADO_VENCIMIENTO_LABEL[estado]}
              </Badge>
            </div>
          ))}
          {criticosVisibles.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin vencimientos próximos.</p>
          )}
          <Link href="/documentos" className="block pt-2 text-sm underline">
            Ver todos los documentos
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
