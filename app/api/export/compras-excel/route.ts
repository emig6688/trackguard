import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireEmpresa } from "@/lib/permisos";
import { construirCondicionOTCompra } from "@/lib/compras-filtro";
import { rangoExportPorDefecto } from "@/lib/export-rango";
import type { EstadoCompra, EstadoAutorizacionCompra, PrioridadOT } from "@/app/generated/prisma/client";

// Armar el workbook con varias hojas puede acercarse al límite por defecto.
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

/**
 * Resume las dos compuertas de autorización (gerencia + mantenimiento) en
 * una sola columna: rechazada si cualquiera de las dos lo está, pendiente
 * si cualquiera sigue pendiente, autorizada si al menos una lo requirió y
 * ya se resolvió, o "no requiere" si ninguna de las dos aplicó nunca.
 */
function resumenAutorizacion(
  gerencia: EstadoAutorizacionCompra,
  mantenimiento: EstadoAutorizacionCompra
): string {
  if (gerencia === "RECHAZADA" || mantenimiento === "RECHAZADA") return "Rechazada";
  if (gerencia === "PENDIENTE" || mantenimiento === "PENDIENTE") return "Pendiente de autorización";
  if (gerencia === "NO_REQUERIDA" && mantenimiento === "NO_REQUERIDA") return "No requiere autorización";
  return "Autorizada";
}

/**
 * Reporte de compras a partir de los mismos filtros que /compras (estado,
 * vehiculoId, choferId, búsqueda) — respeta exactamente lo que el usuario
 * está viendo cuando pide el reporte. Incluye tanto las pendientes de
 * comprar (para que el responsable de compras las pueda resolver desde acá)
 * como las ya realizadas/documentadas — la columna "Estado" distingue unas
 * de otras, y "Monto" muestra el estimado o el real según corresponda.
 */
export async function GET(request: Request) {
  const { prisma } = await requireEmpresa();
  const { searchParams } = new URL(request.url);
  const filtroEstado = searchParams.get("estado") ?? undefined;
  const filtroVehiculoId = searchParams.get("vehiculoId") ?? undefined;
  const filtroChoferId = searchParams.get("choferId") ?? undefined;
  const filtroBusqueda = searchParams.get("busqueda") ?? undefined;
  // fechaSolicitud (no fechaCompra) porque una compra pendiente todavía no
  // tiene fecha de compra — así el rango de fechas también las incluye.
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

  type Fila = {
    numero: string;
    estado: EstadoCompra;
    fechaSolicitud: Date;
    fechaCompra: Date | null;
    camion: string;
    chofer: string;
    proveedor: string;
    montoEstimado: number | null;
    montoReal: number | null;
    prioridad: string;
    autorizacion: string;
  };

  const filas: Fila[] = compras.map((c) => ({
    numero: c.numero,
    estado: c.estado,
    fechaSolicitud: c.fechaSolicitud,
    fechaCompra: c.fechaCompra,
    camion: c.ordenDeTrabajo?.vehiculo?.patente ?? c.vehiculo?.patente ?? SIN_CAMION,
    chofer:
      c.ordenDeTrabajo?.checklistRealizado?.chofer.nombre ??
      c.ordenDeTrabajo?.eventoRuta?.chofer.nombre ??
      SIN_CHOFER,
    proveedor: c.proveedor ?? SIN_PROVEEDOR,
    montoEstimado: c.montoEstimado != null ? Number(c.montoEstimado) : null,
    montoReal: c.montoTotal != null ? Number(c.montoTotal) : null,
    prioridad: c.prioridad ? PRIORIDAD_LABEL[c.prioridad] : "",
    autorizacion: resumenAutorizacion(c.estadoAutorizacion, c.estadoAutorizacionMantenimiento),
  }));

  // Los totales "valorizados" (por camión/chofer/proveedor) solo suman
  // compras ya realizadas: mezclar montos estimados de pendientes ahí
  // haría parecer gasto real algo que todavía no se compró.
  const filasRealizadas = filas.filter((f) => f.montoReal != null);

  function agrupar(clave: keyof Pick<Fila, "camion" | "chofer" | "proveedor">) {
    const mapa = new Map<string, { cantidad: number; total: number }>();
    for (const f of filasRealizadas) {
      const actual = mapa.get(f[clave]) ?? { cantidad: 0, total: 0 };
      actual.cantidad++;
      actual.total += f.montoReal ?? 0;
      mapa.set(f[clave], actual);
    }
    return [...mapa.entries()]
      .map(([nombre, v]) => ({ nombre, ...v }))
      .sort((a, b) => b.total - a.total);
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TruckGuard";
  workbook.created = new Date();

  const detalle = workbook.addWorksheet("Detalle");
  detalle.columns = [
    { header: "Número", key: "numero", width: 16 },
    { header: "Estado", key: "estado", width: 20 },
    { header: "Fecha solicitud", key: "fechaSolicitud", width: 16 },
    { header: "Fecha de compra", key: "fechaCompra", width: 16 },
    { header: "Camión", key: "camion", width: 14 },
    { header: "Chofer", key: "chofer", width: 22 },
    { header: "Proveedor", key: "proveedor", width: 24 },
    { header: "Monto estimado", key: "montoEstimado", width: 16 },
    { header: "Monto real", key: "montoReal", width: 16 },
    { header: "Prioridad", key: "prioridad", width: 12 },
    { header: "Estado de autorización", key: "autorizacion", width: 24 },
  ];
  detalle.getRow(1).font = { bold: true };
  for (const f of filas) {
    detalle.addRow({
      numero: f.numero,
      estado: ESTADO_LABEL[f.estado],
      fechaSolicitud: f.fechaSolicitud.toLocaleDateString("es-AR"),
      fechaCompra: f.fechaCompra ? f.fechaCompra.toLocaleDateString("es-AR") : "",
      camion: f.camion,
      chofer: f.chofer,
      proveedor: f.proveedor,
      montoEstimado: f.montoEstimado,
      montoReal: f.montoReal,
      prioridad: f.prioridad,
      autorizacion: f.autorizacion,
    });
  }
  detalle.getColumn("montoEstimado").numFmt = '"$"#,##0.00';
  detalle.getColumn("montoReal").numFmt = '"$"#,##0.00';

  const composicion = workbook.addWorksheet("Composición");
  composicion.columns = [
    { header: "Número de OC", key: "numero", width: 16 },
    { header: "Estado", key: "estado", width: 20 },
    { header: "Fecha solicitud", key: "fecha", width: 16 },
    { header: "Camión", key: "camion", width: 14 },
    { header: "Ítem", key: "descripcion", width: 32 },
    { header: "Artículo de pañol", key: "articulo", width: 24 },
    { header: "Cantidad solicitada", key: "cantidadSolicitada", width: 18 },
    { header: "Cantidad recibida", key: "cantidadRecibida", width: 18 },
  ];
  composicion.getRow(1).font = { bold: true };
  for (const c of compras) {
    for (const item of c.items) {
      composicion.addRow({
        numero: c.numero,
        estado: ESTADO_LABEL[c.estado],
        fecha: c.fechaSolicitud.toLocaleDateString("es-AR"),
        camion: c.ordenDeTrabajo?.vehiculo?.patente ?? c.vehiculo?.patente ?? SIN_CAMION,
        descripcion: item.descripcion,
        articulo: item.articuloPanol?.nombre ?? "",
        cantidadSolicitada: item.cantidadSolicitada ?? "",
        cantidadRecibida: item.cantidadRecibida ?? "",
      });
    }
  }

  function agregarHojaAgrupada(nombreHoja: string, tituloColumna: string, clave: keyof Pick<Fila, "camion" | "chofer" | "proveedor">) {
    const hoja = workbook.addWorksheet(nombreHoja);
    hoja.columns = [
      { header: tituloColumna, key: "nombre", width: 26 },
      { header: "Cantidad de compras", key: "cantidad", width: 18 },
      { header: "Total valorizado", key: "total", width: 18 },
    ];
    hoja.getRow(1).font = { bold: true };
    for (const g of agrupar(clave)) {
      hoja.addRow(g);
    }
    hoja.getColumn("total").numFmt = '"$"#,##0.00';
  }

  agregarHojaAgrupada("Por camión", "Camión", "camion");
  agregarHojaAgrupada("Por chofer", "Chofer", "chofer");
  agregarHojaAgrupada("Por proveedor", "Proveedor", "proveedor");

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="compras.xlsx"',
    },
  });
}
