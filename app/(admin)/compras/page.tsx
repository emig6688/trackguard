import Link from "next/link";
import { requireEmpresa, ROLES_COMPRAS, ROLES_CREAR_COMPRA } from "@/lib/permisos";
import { construirCondicionOTCompra } from "@/lib/compras-filtro";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EliminarButton } from "@/components/eliminar-button";
import { RealizarCompraForm } from "@/components/compras/realizar-compra-form";
import { CargarFacturaCompraForm } from "@/components/compras/cargar-factura-compra-form";
import { PresupuestoForm } from "@/components/compras/presupuesto-form";
import { AsignarOtCompra } from "@/components/compras/asignar-ot-compra";
import { FiltrosCompra } from "@/components/compras/filtros-compra";
import { CompraManualForm } from "./compra-manual-form";

const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE: "Pendiente",
  REALIZADA: "Realizada",
  DOCUMENTADA: "Documentada",
  CANCELADA: "Cancelada",
};

const ESTADO_VARIANT: Record<string, "success" | "warning" | "destructive"> = {
  PENDIENTE: "warning",
  REALIZADA: "warning",
  DOCUMENTADA: "success",
  CANCELADA: "destructive",
};

const ORIGEN_LABEL: Record<string, string> = {
  STOCK_MINIMO: "Stock mínimo",
  MANUAL: "Pedido manual",
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

export default async function ComprasPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; vehiculoId?: string; choferId?: string; busqueda?: string }>;
}) {
  const {
    estado: filtroEstado,
    vehiculoId: filtroVehiculoId,
    choferId: filtroChoferId,
    busqueda: filtroBusqueda,
  } = await searchParams;
  const { user: session, prisma } = await requireEmpresa();
  const puedeGestionarCompras = (ROLES_COMPRAS as string[]).includes(session.rol);
  const puedeCrearCompras = (ROLES_CREAR_COMPRA as string[]).includes(session.rol);

  const condicionOT = construirCondicionOTCompra({
    vehiculoId: filtroVehiculoId,
    choferId: filtroChoferId,
  });

  const [compras, articulos, ordenesDeTrabajo, empresa, vehiculos, choferes, itemsExistentes] = await Promise.all([
    prisma.ordenCompra.findMany({
      where: {
        eliminadoEn: null,
        ...(filtroEstado
          ? { estado: filtroEstado as "PENDIENTE" | "REALIZADA" | "DOCUMENTADA" | "CANCELADA" }
          : {}),
        ...(Object.keys(condicionOT).length > 0 ? { ordenDeTrabajo: condicionOT } : {}),
        ...(filtroBusqueda
          ? {
              OR: [
                { numero: { contains: filtroBusqueda, mode: "insensitive" } },
                { items: { some: { descripcion: { contains: filtroBusqueda, mode: "insensitive" } } } },
              ],
            }
          : {}),
      },
      include: {
        items: { include: { articuloPanol: true, archivo: true } },
        creadoPor: true,
        facturaArchivo: true,
        ordenDeTrabajo: true,
        presupuestos: { include: { archivo: true, subidoPor: true }, orderBy: { createdAt: "asc" } },
      },
      orderBy: [{ estado: "asc" }, { fechaSolicitud: "desc" }],
    }),
    prisma.articuloPanol.findMany({ where: { activo: true, eliminadoEn: null }, orderBy: { nombre: "asc" } }),
    puedeGestionarCompras || puedeCrearCompras
      ? prisma.ordenDeTrabajo.findMany({
          where: { eliminadoEn: null, estado: { notIn: ["COMPLETADA", "CANCELADA"] } },
          select: { id: true, numero: true, titulo: true },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    prisma.empresa.findUniqueOrThrow({ where: { id: session.empresaId! } }),
    prisma.vehiculo.findMany({
      where: { activo: true, eliminadoEn: null },
      select: { id: true, patente: true },
      orderBy: { patente: "asc" },
    }),
    prisma.usuario.findMany({
      where: { empresaId: session.empresaId!, rol: "CHOFER", activo: true, eliminadoEn: null },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.ordenCompraItem.findMany({
      where: { ordenCompra: { eliminadoEn: null } },
      select: { descripcion: true },
      distinct: ["descripcion"],
    }),
  ]);

  const sugerencias = [
    ...new Set([...compras.map((c) => c.numero), ...itemsExistentes.map((i) => i.descripcion)]),
  ];

  const ESTADOS = ["PENDIENTE", "REALIZADA", "DOCUMENTADA", "CANCELADA"];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Compras</h1>
        {puedeCrearCompras && (
          <Dialog>
            <DialogTrigger render={<Button type="button" size="sm" />}>+ Nueva compra</DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Nueva compra</DialogTitle>
              </DialogHeader>
              <CompraManualForm
                articulos={articulos}
                ordenes={ordenesDeTrabajo}
                montoAutorizacionCompra={empresa.montoAutorizacionCompra?.toString() ?? null}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Link href="/compras">
            <Badge variant={!filtroEstado ? "default" : "outline"}>Todas</Badge>
          </Link>
          {ESTADOS.map((estado) => (
            <Link key={estado} href={`/compras?estado=${estado}`}>
              <Badge variant={filtroEstado === estado ? ESTADO_VARIANT[estado] : "outline"}>
                {ESTADO_LABEL[estado]}
              </Badge>
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FiltrosCompra vehiculos={vehiculos} choferes={choferes} sugerencias={sugerencias} />
          <a
            href={`/api/export/compras-excel?${new URLSearchParams({
              ...(filtroEstado ? { estado: filtroEstado } : {}),
              ...(filtroVehiculoId ? { vehiculoId: filtroVehiculoId } : {}),
              ...(filtroChoferId ? { choferId: filtroChoferId } : {}),
              ...(filtroBusqueda ? { busqueda: filtroBusqueda } : {}),
            }).toString()}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Generar reporte (Excel)
          </a>
        </div>
      </div>

      <div className="space-y-2">
        {compras.map((c) => (
          <div key={c.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3 text-sm">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{c.numero}</span>
                <Badge variant="secondary" className="text-xs">
                  {ORIGEN_LABEL[c.origen]}
                </Badge>
                <Badge variant={ESTADO_VARIANT[c.estado]}>{ESTADO_LABEL[c.estado]}</Badge>
                {c.estadoAutorizacion !== "NO_REQUERIDA" && (
                  <Badge variant={ESTADO_AUTORIZACION_VARIANT[c.estadoAutorizacion]}>
                    {ESTADO_AUTORIZACION_LABEL[c.estadoAutorizacion]}
                  </Badge>
                )}
              </div>
              <div className="space-y-1">
                {c.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    {item.archivo && (
                      <a href={item.archivo.url} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element -- sirve desde una API autenticada, no un asset estático de /public */}
                        <img
                          src={item.archivo.url}
                          alt={`Referencia de ${item.descripcion}`}
                          className="h-8 w-8 rounded border object-cover"
                        />
                      </a>
                    )}
                    <span>
                      {item.descripcion}
                      {item.cantidadSolicitada && (
                        <span className="text-muted-foreground"> x{item.cantidadSolicitada}</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Pedida el {c.fechaSolicitud.toLocaleDateString("es-AR")}
                {c.creadoPor ? ` por ${c.creadoPor.nombre}` : " automáticamente"}
                {c.montoEstimado ? ` · Estimada en $${c.montoEstimado.toString()}` : ""}
                {(c.estado === "REALIZADA" || c.estado === "DOCUMENTADA") && c.fechaCompra
                  ? ` · Comprada el ${c.fechaCompra.toLocaleDateString("es-AR")}${c.montoTotal ? ` · $${c.montoTotal.toString()}` : ""}`
                  : ""}
              </p>
              {c.observaciones && (
                <p className="text-xs text-muted-foreground italic">&ldquo;{c.observaciones}&rdquo;</p>
              )}
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
                    className="h-16 w-auto rounded-md border object-cover"
                  />
                </a>
              )}
              {puedeGestionarCompras ? (
                <AsignarOtCompra
                  compraId={c.id}
                  ordenDeTrabajoId={c.ordenDeTrabajoId}
                  ordenes={ordenesDeTrabajo}
                />
              ) : (
                c.ordenDeTrabajo && (
                  <Link
                    href={`/ordenes-trabajo/${c.ordenDeTrabajo.id}`}
                    className="block text-xs text-muted-foreground hover:underline"
                  >
                    Asignada a {c.ordenDeTrabajo.numero}
                  </Link>
                )
              )}
              {c.estadoAutorizacion !== "NO_REQUERIDA" && (
                <div className="space-y-1.5 rounded-md bg-muted/40 p-2">
                  <p className="text-xs font-medium text-muted-foreground">Presupuestos</p>
                  {c.presupuestos.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 text-xs">
                      <a href={p.archivo.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {p.proveedor ?? "Presupuesto"}
                      </a>
                      {p.monto && <span className="text-muted-foreground">${p.monto.toString()}</span>}
                      {c.presupuestoAprobadoId === p.id && <Badge variant="success">Aprobado</Badge>}
                    </div>
                  ))}
                  {puedeGestionarCompras && c.estadoAutorizacion === "PENDIENTE" && (
                    <PresupuestoForm compraId={c.id} />
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`/api/export/oc-pdf?id=${c.id}`}
                className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                Imprimir
              </a>
              {puedeCrearCompras && c.estado === "PENDIENTE" && (
                <Dialog>
                  <DialogTrigger render={<Button type="button" variant="outline" size="xs" />}>
                    Editar
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Editar {c.numero}</DialogTitle>
                    </DialogHeader>
                    <CompraManualForm
                      articulos={articulos}
                      ordenes={ordenesDeTrabajo}
                      montoAutorizacionCompra={empresa.montoAutorizacionCompra?.toString() ?? null}
                      compraExistente={{
                        id: c.id,
                        montoEstimado: c.montoEstimado?.toString() ?? null,
                        observaciones: c.observaciones,
                        ordenDeTrabajoId: c.ordenDeTrabajoId,
                        items: c.items.map((item) => ({
                          id: item.id,
                          descripcion: item.descripcion,
                          cantidadSolicitada: item.cantidadSolicitada,
                          articuloPanolId: item.articuloPanolId,
                          archivoUrl: item.archivo?.url ?? null,
                        })),
                      }}
                    />
                  </DialogContent>
                </Dialog>
              )}
              {puedeGestionarCompras && c.estado === "PENDIENTE" && (
                <RealizarCompraForm
                  compraId={c.id}
                  items={c.items}
                  puedeRealizar={c.estadoAutorizacion !== "PENDIENTE" && c.estadoAutorizacion !== "RECHAZADA"}
                />
              )}
              {puedeGestionarCompras && c.estado === "PENDIENTE" && c.estadoAutorizacion === "PENDIENTE" && (
                <p className="text-xs text-muted-foreground">Esperando autorización de gerencia.</p>
              )}
              {puedeGestionarCompras && c.estado === "REALIZADA" && (
                <CargarFacturaCompraForm compraId={c.id} />
              )}
              {session.rol === "ADMIN" && (
                <EliminarButton tipo="ordenCompra" id={c.id} redirectPath="/compras" />
              )}
            </div>
          </div>
        ))}
        {compras.length === 0 && (
          <p className="text-sm text-muted-foreground">No hay órdenes de compra en este estado.</p>
        )}
      </div>
    </div>
  );
}
