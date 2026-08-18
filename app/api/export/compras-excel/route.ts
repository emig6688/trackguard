import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireEmpresa } from "@/lib/permisos";
import { construirCondicionOTCompra } from "@/lib/compras-filtro";

const SIN_CAMION = "Sin camión asignado";
const SIN_CHOFER = "Sin chofer identificado";
const SIN_PROVEEDOR = "Sin proveedor registrado";

/**
 * Reporte de compras valorizadas (solo las que ya tienen montoTotal cargado)
 * a partir de los mismos filtros que /compras (estado, vehiculoId, choferId)
 * — respeta exactamente lo que el usuario está viendo cuando pide el reporte.
 */
export async function GET(request: Request) {
  const { prisma } = await requireEmpresa();
  const { searchParams } = new URL(request.url);
  const filtroEstado = searchParams.get("estado") ?? undefined;
  const filtroVehiculoId = searchParams.get("vehiculoId") ?? undefined;
  const filtroChoferId = searchParams.get("choferId") ?? undefined;
  const filtroBusqueda = searchParams.get("busqueda") ?? undefined;

  const condicionOT = construirCondicionOTCompra({ vehiculoId: filtroVehiculoId, choferId: filtroChoferId });

  const compras = await prisma.ordenCompra.findMany({
    where: {
      eliminadoEn: null,
      montoTotal: { not: null },
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
    orderBy: { fechaCompra: "desc" },
  });

  type Fila = {
    numero: string;
    fecha: Date | null;
    camion: string;
    chofer: string;
    proveedor: string;
    monto: number;
  };

  const filas: Fila[] = compras.map((c) => ({
    numero: c.numero,
    fecha: c.fechaCompra,
    camion: c.ordenDeTrabajo?.vehiculo?.patente ?? SIN_CAMION,
    chofer:
      c.ordenDeTrabajo?.checklistRealizado?.chofer.nombre ??
      c.ordenDeTrabajo?.eventoRuta?.chofer.nombre ??
      SIN_CHOFER,
    proveedor: c.proveedor ?? SIN_PROVEEDOR,
    monto: Number(c.montoTotal),
  }));

  function agrupar(clave: keyof Pick<Fila, "camion" | "chofer" | "proveedor">) {
    const mapa = new Map<string, { cantidad: number; total: number }>();
    for (const f of filas) {
      const actual = mapa.get(f[clave]) ?? { cantidad: 0, total: 0 };
      actual.cantidad++;
      actual.total += f.monto;
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
    { header: "Fecha de compra", key: "fecha", width: 16 },
    { header: "Camión", key: "camion", width: 14 },
    { header: "Chofer", key: "chofer", width: 22 },
    { header: "Proveedor", key: "proveedor", width: 24 },
    { header: "Monto", key: "monto", width: 14 },
  ];
  detalle.getRow(1).font = { bold: true };
  for (const f of filas) {
    detalle.addRow({
      numero: f.numero,
      fecha: f.fecha ? f.fecha.toLocaleDateString("es-AR") : "",
      camion: f.camion,
      chofer: f.chofer,
      proveedor: f.proveedor,
      monto: f.monto,
    });
  }
  detalle.getColumn("monto").numFmt = '"$"#,##0.00';

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
      "Content-Disposition": 'attachment; filename="compras-valorizadas.xlsx"',
    },
  });
}
