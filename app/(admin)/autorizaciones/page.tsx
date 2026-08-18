import Link from "next/link";
import { requireEmpresa, ROLES_AUTORIZAR_COMPRA } from "@/lib/permisos";
import { Badge } from "@/components/ui/badge";
import { AutorizacionAcciones } from "./autorizacion-acciones";
import type { EstadoAutorizacionCompra } from "@/app/generated/prisma/client";

const ESTADO_LABEL: Record<EstadoAutorizacionCompra, string> = {
  NO_REQUERIDA: "No requerida",
  PENDIENTE: "Pendiente",
  APROBADA: "Aprobada",
  RECHAZADA: "Rechazada",
};

const ESTADO_VARIANT: Record<EstadoAutorizacionCompra, "success" | "warning" | "destructive" | "secondary"> = {
  NO_REQUERIDA: "secondary",
  PENDIENTE: "warning",
  APROBADA: "success",
  RECHAZADA: "destructive",
};

export default async function AutorizacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado } = await searchParams;
  const { prisma } = await requireEmpresa(ROLES_AUTORIZAR_COMPRA);

  const filtro = (estado as EstadoAutorizacionCompra | undefined) ?? "PENDIENTE";

  const compras = await prisma.ordenCompra.findMany({
    where: { eliminadoEn: null, estadoAutorizacion: filtro },
    include: {
      items: { include: { archivo: true } },
      presupuestos: { include: { archivo: true, subidoPor: true }, orderBy: { createdAt: "asc" } },
      creadoPor: true,
      ordenDeTrabajo: true,
      autorizadoPor: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const PESTANAS: EstadoAutorizacionCompra[] = ["PENDIENTE", "APROBADA", "RECHAZADA"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Autorizaciones</h1>
        <p className="text-sm text-muted-foreground">
          Órdenes de compra que superan el monto configurado en Mantenedor/Parámetros y
          necesitan tu aprobación antes de poder comprarse.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PESTANAS.map((p) => (
          <Link key={p} href={`/autorizaciones?estado=${p}`}>
            <Badge variant={filtro === p ? ESTADO_VARIANT[p] : "outline"}>{ESTADO_LABEL[p]}</Badge>
          </Link>
        ))}
      </div>

      <div className="space-y-3">
        {compras.map((c) => (
          <div key={c.id} className="space-y-3 rounded-lg border p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{c.numero}</span>
                  <Badge variant={ESTADO_VARIANT[c.estadoAutorizacion]}>
                    {ESTADO_LABEL[c.estadoAutorizacion]}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Pedida el {c.fechaSolicitud.toLocaleDateString("es-AR")}
                  {c.creadoPor ? ` por ${c.creadoPor.nombre}` : ""}
                  {c.montoEstimado ? ` · Estimada en $${c.montoEstimado.toString()}` : ""}
                </p>
                {c.ordenDeTrabajo && (
                  <Link href={`/ordenes-trabajo/${c.ordenDeTrabajo.id}`} className="text-xs hover:underline">
                    OT {c.ordenDeTrabajo.numero}
                  </Link>
                )}
              </div>
              <Link href={`/compras?estado=${c.estado}`} className="text-xs text-muted-foreground hover:underline">
                Ver en Compras
              </Link>
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

            <div className="space-y-1.5 rounded-md bg-muted/40 p-2">
              <p className="text-xs font-medium text-muted-foreground">Presupuestos</p>
              {c.presupuestos.map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-xs">
                  <a href={p.archivo.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {p.proveedor ?? "Presupuesto"}
                  </a>
                  {p.monto && <span className="text-muted-foreground">${p.monto.toString()}</span>}
                  <span className="text-muted-foreground">· subido por {p.subidoPor.nombre}</span>
                  {c.presupuestoAprobadoId === p.id && <Badge variant="success">Aprobado</Badge>}
                </div>
              ))}
              {c.presupuestos.length === 0 && (
                <p className="text-xs text-muted-foreground">Todavía no se subió ningún presupuesto.</p>
              )}
            </div>

            {c.estadoAutorizacion === "PENDIENTE" ? (
              <AutorizacionAcciones
                compraId={c.id}
                presupuestos={c.presupuestos.map((p) => ({ id: p.id, proveedor: p.proveedor }))}
              />
            ) : (
              c.autorizadoPor && (
                <p className="text-xs text-muted-foreground">
                  {ESTADO_LABEL[c.estadoAutorizacion]} por {c.autorizadoPor.nombre}
                  {c.autorizadoEn ? ` el ${c.autorizadoEn.toLocaleDateString("es-AR")}` : ""}
                </p>
              )
            )}
          </div>
        ))}
        {compras.length === 0 && (
          <p className="text-sm text-muted-foreground">No hay órdenes de compra en este estado.</p>
        )}
      </div>
    </div>
  );
}
