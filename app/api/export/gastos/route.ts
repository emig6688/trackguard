import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireSession } from "@/lib/permisos";
import { rangoExportPorDefecto } from "@/lib/export-rango";

export async function GET(request: Request) {
  const { prisma } = await requireSession();

  const { searchParams } = new URL(request.url);
  const chofer = searchParams.get("chofer") ?? undefined;
  const vehiculo = searchParams.get("vehiculo") ?? undefined;
  const { desde, hasta } = rangoExportPorDefecto(searchParams);

  const gastos = await prisma.gasto.findMany({
    where: {
      monto: { gt: 0 },
      eliminadoEn: null,
      ...(chofer ? { chofer: { nombre: { equals: chofer, mode: "insensitive" } } } : {}),
      ...(vehiculo ? { vehiculo: { patente: { equals: vehiculo, mode: "insensitive" } } } : {}),
      fecha: { gte: desde, lte: hasta },
    },
    include: { chofer: true, vehiculo: true },
    orderBy: { fecha: "desc" },
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TruckGuard";
  workbook.created = new Date();

  const hoja = workbook.addWorksheet("Gastos");
  hoja.columns = [
    { header: "Chofer", key: "chofer", width: 22 },
    { header: "Vehículo", key: "vehiculo", width: 14 },
    { header: "Tipo", key: "tipo", width: 16 },
    { header: "Monto", key: "monto", width: 14 },
    { header: "Fecha", key: "fecha", width: 18 },
    { header: "Estado", key: "estado", width: 16 },
    { header: "Descripción", key: "descripcion", width: 32 },
  ];
  hoja.getRow(1).font = { bold: true };
  for (const g of gastos) {
    hoja.addRow({
      chofer: g.chofer.nombre,
      vehiculo: g.vehiculo?.patente ?? "",
      tipo: g.tipo,
      monto: Number(g.monto),
      fecha: g.fecha,
      estado: g.estado,
      descripcion: g.descripcion,
    });
  }
  hoja.getColumn("fecha").numFmt = "dd/mm/yyyy hh:mm";
  hoja.getColumn("monto").numFmt = '"$"#,##0.00';

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="gastos.xlsx"',
    },
  });
}
