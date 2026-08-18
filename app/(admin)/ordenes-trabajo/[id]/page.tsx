import { notFound } from "next/navigation";
import Link from "next/link";
import { Wrench } from "lucide-react";
import { requireEmpresa } from "@/lib/permisos";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/back-button";
import { EliminarButton } from "@/components/eliminar-button";
import { AREA_REPARACION_LABEL } from "@/lib/clasificador-averias";
import { otEstaAtrasada } from "@/lib/ot";
import { vehiculosEnTallerExterno } from "@/lib/disponibilidad";
import { DisponibilidadToggle } from "@/components/vehiculos/disponibilidad-toggle";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { OTAcciones } from "./ot-acciones";
import { RepuestoForm } from "./repuesto-form";
import { DerivacionForm } from "./derivacion-form";
import { ItemsPreventivosForm } from "./items-preventivos-form";
import { OCForm } from "./oc-form";
import { EliminarRepuestoButton } from "./eliminar-repuesto-button";

const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE_APROBACION: "Pendiente de aprobación",
  APROBADA: "Aprobada",
  EN_PROGRESO: "En progreso",
  DERIVADA_EXTERNO: "Derivada a externo",
  COMPLETADA: "Completada",
  CANCELADA: "Cancelada",
};

const ESTADO_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline" | "success" | "warning"
> = {
  PENDIENTE_APROBACION: "warning",
  APROBADA: "secondary",
  EN_PROGRESO: "default",
  DERIVADA_EXTERNO: "outline",
  COMPLETADA: "success",
  CANCELADA: "destructive",
};

const ORIGEN_LABEL: Record<string, string> = {
  PREVENTIVO: "Mantenimiento preventivo",
  CHECKLIST: "Checklist con falla",
  EVENTO_RUTA: "Evento de ruta",
  MANUAL: "Carga manual",
};

const ESTADO_COMPRA_LABEL: Record<string, string> = {
  PENDIENTE: "Pendiente",
  REALIZADA: "Realizada",
  DOCUMENTADA: "Documentada",
  CANCELADA: "Cancelada",
};

const ESTADO_COMPRA_VARIANT: Record<string, "success" | "warning" | "destructive"> = {
  PENDIENTE: "warning",
  REALIZADA: "warning",
  DOCUMENTADA: "success",
  CANCELADA: "destructive",
};

const ESTADO_AUTORIZACION_LABEL: Record<string, string> = {
  PENDIENTE: "Pendiente de autorización",
  APROBADA: "Autorizada",
  RECHAZADA: "Rechazada",
};

const ESTADO_AUTORIZACION_VARIANT: Record<string, "success" | "warning" | "destructive"> = {
  PENDIENTE: "warning",
  APROBADA: "success",
  RECHAZADA: "destructive",
};

const PRIORIDAD_LABEL: Record<string, string> = {
  BAJA: "Baja",
  MEDIA: "Media",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

const PRIORIDAD_VARIANT: Record<string, "secondary" | "success" | "warning" | "destructive"> = {
  BAJA: "success",
  MEDIA: "secondary",
  ALTA: "warning",
  URGENTE: "destructive",
};

const PRIORIDAD_ACCENT_CLASS: Record<string, string> = {
  BAJA: "border-l-4 border-l-success/60",
  MEDIA: "border-l-4 border-l-muted-foreground/30",
  ALTA: "border-l-4 border-l-warning",
  URGENTE: "border-l-4 border-l-destructive",
};

export default async function OTDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user: session, prisma } = await requireEmpresa();

  const ot = await prisma.ordenDeTrabajo.findUnique({
    where: { id, eliminadoEn: null },
    include: {
      vehiculo: true,
      asignadoA: true,
      creadoPor: true,
      historial: { include: { actor: true }, orderBy: { createdAt: "asc" } },
      repuestos: { where: { eliminadoEn: null } },
      facturas: {
        where: { eliminadoEn: null },
        include: { archivo: true, cargadoPor: true },
        orderBy: { createdAt: "desc" },
      },
      derivacionExterna: { include: { tallerExterno: true } },
      fotoReparacion: true,
      eventoRuta: { include: { chofer: true, archivo: true } },
      checklistRealizado: { include: { chofer: true } },
      comprasAsignadas: {
        where: { eliminadoEn: null },
        include: { facturaArchivo: true, items: { include: { archivo: true } } },
        orderBy: { fechaSolicitud: "desc" },
      },
      itemsPreventivos: {
        include: {
          archivo: true,
          ordenesCompra: {
            where: { eliminadoEn: null },
            include: { items: true },
            orderBy: { createdAt: "asc" },
          },
          repuestos: { where: { eliminadoEn: null }, orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!ot) notFound();

  const [mecanicos, talleres, articulosPanol, enTaller, empresa] = await Promise.all([
    prisma.usuario.findMany({
      where: { rol: "MECANICO_INTERNO", activo: true, eliminadoEn: null, empresaId: session.empresaId! },
    }),
    prisma.tallerExterno.findMany({ where: { activo: true, eliminadoEn: null } }),
    prisma.articuloPanol.findMany({
      where: { activo: true, stockActual: { gt: 0 }, eliminadoEn: null },
      orderBy: { nombre: "asc" },
    }),
    vehiculosEnTallerExterno(prisma, [ot.vehiculoId]),
    prisma.empresa.findUniqueOrThrow({ where: { id: session.empresaId! } }),
  ]);

  const soloLectura = session.rol === "GERENTE" || session.rol === "CONTADOR";
  const puedeGenerarOC = session.rol === "ADMIN" || session.rol === "ENCARGADO_MANTENIMIENTO";

  const atrasada = otEstaAtrasada(ot);

  return (
    <div className="space-y-8">
      <BackButton fallbackHref="/ordenes-trabajo" />
      <div className={`${PRIORIDAD_ACCENT_CLASS[ot.prioridad]} pl-4`}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            <Link href={`/vehiculos/${ot.vehiculoId}`} className="hover:underline">
              {ot.vehiculo.patente}
            </Link>{" "}
            · {ORIGEN_LABEL[ot.origen]}
          </span>
          {!soloLectura && (
            <DisponibilidadToggle
              vehiculoId={ot.vehiculoId}
              disponible={ot.vehiculo.disponible}
              motivoNoOperativo={ot.vehiculo.motivoNoOperativo}
              enTallerExterno={enTaller.has(ot.vehiculoId)}
            />
          )}
          {ot.origen === "PREVENTIVO" && (
            <Badge variant="outline" className="gap-1 border-chart-4/40 text-chart-4">
              <Wrench className="size-3" />
              Mantenimiento preventivo
            </Badge>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">
              {ot.numero} — {ot.titulo}
            </h1>
            <Badge variant={ESTADO_VARIANT[ot.estado]}>{ESTADO_LABEL[ot.estado]}</Badge>
            {ot.confirmacionReparacion === "PENDIENTE" && (
              <Badge variant="warning">Esperando confirmación del chofer</Badge>
            )}
            {ot.confirmacionReparacion === "CONFIRMADA" && (
              <Badge variant="success">Chofer confirmó que quedó resuelto</Badge>
            )}
            {ot.confirmacionReparacion === "RECHAZADA" && (
              <Badge variant="destructive">El chofer indicó que el problema persiste</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/api/export/ot-pdf?id=${ot.id}`}
              className="text-sm text-muted-foreground hover:text-foreground hover:underline"
            >
              Imprimir
            </a>
            {session.rol === "ADMIN" && (
              <EliminarButton tipo="ordenDeTrabajo" id={ot.id} redirectPath="/ordenes-trabajo" />
            )}
          </div>
        </div>
        {ot.descripcion && <p className="mt-2 text-sm text-muted-foreground">{ot.descripcion}</p>}
        {ot.eventoRuta && (
          <div className="mt-2 space-y-2">
            <p className="text-xs text-muted-foreground">
              Reportado por {ot.eventoRuta.chofer.nombre} el{" "}
              {ot.eventoRuta.fechaHora.toLocaleString("es-AR")}
            </p>
            {ot.eventoRuta.archivo && (
              <a href={ot.eventoRuta.archivo.url} target="_blank" rel="noopener noreferrer" className="inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element -- sirve desde una API autenticada, no un asset estático de /public */}
                <img
                  src={ot.eventoRuta.archivo.url}
                  alt="Foto adjuntada por el chofer"
                  className="h-32 w-auto rounded-md border object-cover"
                />
              </a>
            )}
          </div>
        )}
        {ot.checklistRealizado && (
          <p className="mt-2 text-xs text-muted-foreground">
            Reportado por {ot.checklistRealizado.chofer.nombre} en el checklist pre-salida del{" "}
            {ot.checklistRealizado.fechaHora.toLocaleString("es-AR")}
          </p>
        )}
        {ot.confirmacionReparacion === "RECHAZADA" && ot.confirmacionReparacionComentario && (
          <p className="mt-2 text-sm text-destructive">
            Comentario del chofer: {ot.confirmacionReparacionComentario}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            Prioridad:{" "}
            <Badge variant={PRIORIDAD_VARIANT[ot.prioridad]}>{PRIORIDAD_LABEL[ot.prioridad]}</Badge>
          </span>
          {ot.areaReparacion && (
            <span>
              Área: {AREA_REPARACION_LABEL[ot.areaReparacion]}
              {ot.estado === "PENDIENTE_APROBACION" && ot.origen === "EVENTO_RUTA" && " (sugerida)"}
            </span>
          )}
          {ot.fechaLimite && (
            <span className={atrasada && !ot.fechaEstimadaFinalizacion ? "font-medium text-destructive" : ""}>
              Fecha límite: {ot.fechaLimite.toLocaleDateString("es-AR")}
              {atrasada && !ot.fechaEstimadaFinalizacion && " · Atrasada"}
            </span>
          )}
          {ot.fechaEstimadaFinalizacion && (
            <span className={atrasada ? "font-medium text-destructive" : ""}>
              Fecha estimada de finalización: {ot.fechaEstimadaFinalizacion.toLocaleDateString("es-AR")}
              {atrasada && " · Atrasada"}
            </span>
          )}
          {ot.asignadoA && <span>Asignado a: {ot.asignadoA.nombre}</span>}
        </div>
      </div>

      {!soloLectura && (
        <OTAcciones
          ot={ot}
          rol={session.rol}
          userId={session.id}
          mecanicos={mecanicos}
          talleres={talleres}
        />
      )}

      {ot.itemsPreventivos.length > 0 && (
        <ItemsPreventivosForm
          otId={ot.id}
          items={ot.itemsPreventivos}
          puedeGenerarOC={puedeGenerarOC}
          articulosPanol={articulosPanol}
          montoAutorizacionCompra={empresa.montoAutorizacionCompra?.toString() ?? null}
        />
      )}

      {ot.derivacionExterna && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Derivación externa</h2>
          <p className="text-sm text-muted-foreground">
            Taller: {ot.derivacionExterna.tallerExterno.nombre} · Estado:{" "}
            {ot.derivacionExterna.estadoExterno}
            {ot.derivacionExterna.presupuestoMonto
              ? ` · Presupuesto: $${ot.derivacionExterna.presupuestoMonto}`
              : ""}
          </p>
          {!soloLectura && (
            <DerivacionForm
              derivacionId={ot.derivacionExterna.id}
              otId={ot.id}
              defaultEstado={ot.derivacionExterna.estadoExterno}
            />
          )}
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Repuestos utilizados</h2>
        <div className="space-y-2">
          {ot.repuestos.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-sm">
              <span>
                {r.cantidad}x {r.descripcion}
              </span>
              <div className="flex items-center gap-2">
                {r.costoUnitario && <span>${r.costoUnitario.toString()}</span>}
                {!soloLectura && <EliminarRepuestoButton otId={ot.id} repuestoId={r.id} />}
              </div>
            </div>
          ))}
          {ot.repuestos.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin repuestos cargados.</p>
          )}
        </div>
        {!soloLectura && (
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-64 flex-1">
              <RepuestoForm otId={ot.id} articulos={articulosPanol} />
            </div>
            {puedeGenerarOC && (
              <Dialog>
                <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
                  Generar orden de compra
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Generar orden de compra</DialogTitle>
                  </DialogHeader>
                  <OCForm otId={ot.id} montoAutorizacionCompra={empresa.montoAutorizacionCompra?.toString() ?? null} />
                </DialogContent>
              </Dialog>
            )}
          </div>
        )}
      </div>

      {(ot.observacionesMecanico || ot.fotoReparacion) && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Reparación realizada</h2>
          {ot.observacionesMecanico && <p className="text-sm">{ot.observacionesMecanico}</p>}
          {ot.fotoReparacion && (
            <a
              href={ot.fotoReparacion.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- sirve desde una API autenticada, no un asset estático de /public */}
              <img
                src={ot.fotoReparacion.url}
                alt="Foto de la reparación"
                className="h-48 w-auto rounded-md border object-cover"
              />
            </a>
          )}
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Facturas</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ot.facturas.map((f) => (
            <div key={f.id} className="space-y-2 rounded-lg border p-3 text-sm">
              <a
                href={f.archivo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block space-y-2 hover:opacity-90"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- sirve desde una API autenticada, no un asset estático de /public */}
                <img
                  src={f.archivo.url}
                  alt={`Factura ${f.monto}`}
                  className="h-32 w-full rounded-md border object-cover"
                />
                <p className="font-medium">${f.monto.toString()}</p>
                {f.observaciones && <p className="text-muted-foreground">{f.observaciones}</p>}
                <p className="text-xs text-muted-foreground">
                  {f.cargadoPor?.nombre ?? "—"} · {f.createdAt.toLocaleDateString("es-AR")}
                </p>
              </a>
              {session.rol === "ADMIN" && (
                <EliminarButton
                  tipo="factura"
                  id={f.id}
                  redirectPath={`/ordenes-trabajo/${ot.id}`}
                  size="xs"
                />
              )}
            </div>
          ))}
          {ot.facturas.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin facturas cargadas.</p>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          La carga de facturas se hace desde el módulo de Compras.
        </p>
      </div>

      {ot.comprasAsignadas.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Compras asociadas</h2>
          <div className="space-y-2">
            {ot.comprasAsignadas.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                <div className="min-w-0 space-y-1">
                  <Link href={`/compras?estado=${c.estado}`} className="hover:underline">
                    {c.numero} · {c.items.map((i) => i.descripcion).join(", ")}
                  </Link>
                  {c.montoTotal && (
                    <p className="text-xs text-muted-foreground">${c.montoTotal.toString()}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {c.facturaArchivo && (
                    <a
                      href={c.facturaArchivo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block hover:opacity-90"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- sirve desde una API autenticada, no un asset estático de /public */}
                      <img
                        src={c.facturaArchivo.url}
                        alt="Factura de la compra"
                        className="h-10 w-auto rounded-md border object-cover"
                      />
                    </a>
                  )}
                  {c.estadoAutorizacion !== "NO_REQUERIDA" && (
                    <Badge variant={ESTADO_AUTORIZACION_VARIANT[c.estadoAutorizacion]}>
                      {ESTADO_AUTORIZACION_LABEL[c.estadoAutorizacion]}
                    </Badge>
                  )}
                  <Badge variant={ESTADO_COMPRA_VARIANT[c.estado]}>{ESTADO_COMPRA_LABEL[c.estado]}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Historial</h2>
        <div className="space-y-2 border-l-2 pl-4">
          {ot.historial.map((h) => (
            <div key={h.id} className="text-sm">
              <span className="font-medium">
                {h.estadoAnterior ? `${ESTADO_LABEL[h.estadoAnterior]} → ` : ""}
                {ESTADO_LABEL[h.estadoNuevo]}
              </span>{" "}
              <span className="text-muted-foreground">
                por {h.actor?.nombre ?? "sistema"} el {h.createdAt.toLocaleString("es-AR")}
              </span>
              {h.comentario && <p className="text-muted-foreground">{h.comentario}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
