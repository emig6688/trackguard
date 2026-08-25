import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireEmpresa } from "@/lib/permisos";
import { construirCondicionOTCompra } from "@/lib/compras-filtro";
import { rangoExportPorDefecto } from "@/lib/export-rango";
import { ReporteComprasDocument, type FilaCompraPdf, type FilaComposicionPdf } from "@/lib/pdf/reporte-compras";
import type { EstadoCompra, EstadoAutorizacionCompra, PrioridadOT } from "@/app/generated/prisma/client";

export const maxDuration = 60;

const SIN_CAMION = "Sin camión asignado";
const SIN_CHOFER = "Sin chofer identificado";
const SIN_PROVEEDOR = "Sin proveedor registrado";

const ESTADO_LABEL: Record<EstadoCompra, string> = {
  PENDIENTE: "Pendiente (a comprar)",
  REALIZADA: "Realizada",
  DOCUMENTADA: "Documentada",
  CANCELADA: "Cancelada",
};

const PRIORIDAD_LABEL: Record<PrioridadOT, string> = {
  BAJA: "Baja",
  MEDIA: "Media",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

function resumenAutorizacion(
  gerencia: EstadoAutorizacionCompra,
  mantenimiento: EstadoAutorizacionCompra
): string {
  if (gerencia === "RECHAZADA" || mantenimiento === "RECHAZADA") return "Rechazada";
  if (gerencia === "PENDIENTE" || mantenimiento === "PENDIENTE") return "Pendiente de autorización";
  if (gerencia === "NO_REQUERIDA" && mantenimiento === "NO_REQUERIDA") return "No requiere autorización";
  return "Autorizada";
}

export async function GET(request: Request) {
  const { prisma } = await requireEmpresa();
  const { searchParams } = new URL(request.url);
  const filtroEstado = searchParams.get("estado") ?? undefined;
  const filtroVehiculoId = searchParams.get("vehiculoId") ?? undefined;
  const filtroChoferId = searchParams.get("choferId") ?? undefined;
  const filtroBusqueda = searchParams.get("busqueda") ?? undefined;
  const { desde, hasta } = rangoExportPorDefecto(searchParams);

  const condicionOT = construirCondicionOTCompra({ vehiculoId: filtroVehiculoId, choferId: filtroChoferId });

  const compras = await prisma.ordenCompra.findMany({
    where: {
      eliminadoEn: null,
      fechaSolicitud: { gte: desde, lte: hasta },
      ...(filtroEstado
        ? { estado: filtroEstado as "PENDIENTE" | "REALIZADA" | "DOCUMENTADA" | "CANCELADA" }
        : {}),
      ...(Object.keys(condicionOT).length > 0 ? { ordenDeTrabajo: condicionOT } : {}),
      ...(filtroBusqueda
        ? {
            OR: [
              { numero: { contains: filtroBusqueda, mode: "insensitive" as const } },
              { items: { some: { descripcion: { contains: filtroBusqueda, mode: "insensitive" as const } } } },
            ],
          }
        : {}),
    },
    include: {
      ordenDeTrabajo: {
        select: {
          vehiculo: { select: { patente: true } },
          checklistRealizado: { select: { chofer: { select: { nombre: true } } } },
          eventoRuta: { select: { chofer: { select: { nombre: true } } } },
        },
      },
      vehiculo: { select: { patente: true } },
      items: {
        include: { articuloPanol: { select: { nombre: true } } },
      },
    },
    orderBy: [{ estado: "asc" }, { fechaSolicitud: "desc" }],
  });

  const filas: FilaCompraPdf[] = compras.map((c) => ({
    numero: c.numero,
    estado: ESTADO_LABEL[c.estado],
    fechaSolicitud: c.fechaSolicitud.toLocaleDateString("es-AR"),
    camion: c.ordenDeTrabajo?.vehiculo?.patente ?? c.vehiculo?.patente ?? SIN_CAMION,
    chofer:
      c.ordenDeTrabajo?.checklistRealizado?.chofer.nombre ??
      c.ordenDeTrabajo?.eventoRuta?.chofer.nombre ??
      SIN_CHOFER,
    proveedor: c.proveedor ?? SIN_PROVEEDOR,
    montoEstimado: c.montoEstimado != null ? `$${Number(c.montoEstimado).toLocaleString("es-AR")}` : "",
    montoReal: c.montoTotal != null ? `$${Number(c.montoTotal).toLocaleString("es-AR")}` : "",
    prioridad: c.prioridad ? PRIORIDAD_LABEL[c.prioridad] : "",
    autorizacion: resumenAutorizacion(c.estadoAutorizacion, c.estadoAutorizacionMantenimiento),
  }));

  const filasComposicion: FilaComposicionPdf[] = compras.flatMap((c) =>
    c.items.map((item) => ({
      numero: c.numero,
      estado: ESTADO_LABEL[c.estado],
      fecha: c.fechaSolicitud.toLocaleDateString("es-AR"),
      camion: c.ordenDeTrabajo?.vehiculo?.patente ?? c.vehiculo?.patente ?? SIN_CAMION,
      descripcion: item.descripcion,
      articulo: item.articuloPanol?.nombre ?? "",
      cantidadSolicitada: item.cantidadSolicitada?.toString() ?? "",
      cantidadRecibida: item.cantidadRecibida?.toString() ?? "",
    }))
  );

  const buffer = await renderToBuffer(
    <ReporteComprasDocument filas={filas} filasComposicion={filasComposicion} periodo={{ desde, hasta }} />
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="compras.pdf"',
    },
  });
}
