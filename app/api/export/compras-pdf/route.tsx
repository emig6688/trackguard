import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireEmpresa } from "@/lib/permisos";
import { construirCondicionOTCompra } from "@/lib/compras-filtro";
import { rangoExportPorDefecto } from "@/lib/export-rango";
import { ReporteComprasDocument, type FilaCompraPdf } from "@/lib/pdf/reporte-compras";
import type { EstadoCompra } from "@/app/generated/prisma/client";

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
    },
    orderBy: [{ estado: "asc" }, { fechaSolicitud: "desc" }],
  });

  const filas: FilaCompraPdf[] = compras.map((c) => ({
    numero: c.numero,
    estado: ESTADO_LABEL[c.estado],
    fechaSolicitud: c.fechaSolicitud.toLocaleDateString("es-AR"),
    camion: c.ordenDeTrabajo?.vehiculo?.patente ?? SIN_CAMION,
    chofer:
      c.ordenDeTrabajo?.checklistRealizado?.chofer.nombre ??
      c.ordenDeTrabajo?.eventoRuta?.chofer.nombre ??
      SIN_CHOFER,
    proveedor: c.proveedor ?? SIN_PROVEEDOR,
    montoEstimado: c.montoEstimado != null ? `$${Number(c.montoEstimado).toLocaleString("es-AR")}` : "",
    montoReal: c.montoTotal != null ? `$${Number(c.montoTotal).toLocaleString("es-AR")}` : "",
  }));

  const buffer = await renderToBuffer(<ReporteComprasDocument filas={filas} periodo={{ desde, hasta }} />);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="compras.pdf"',
    },
  });
}
