import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireSession } from "@/lib/permisos";
import { rangoExportPorDefecto } from "@/lib/export-rango";

export async function GET(request: Request) {
  const { prisma } = await requireSession();

  const { searchParams } = new URL(request.url);
  const { desde, hasta } = rangoExportPorDefecto(searchParams);

  const cargas = await prisma.cargaCombustible.findMany({
    where: { eliminadoEn: null, fechaHora: { gte: desde, lte: hasta } },
    include: { vehiculo: true, chofer: true },
    orderBy: { fechaHora: "desc" },
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TruckGuard";
  workbook.created = new Date();

  const hoja = workbook.addWorksheet("Combustible");
  hoja.columns = [
    { header: "Vehículo", key: "vehiculo", width: 14 },
    { header: "Chofer", key: "chofer", width: 22 },
    { header: "Fecha", key: "fecha", width: 18 },
    { header: "Km odómetro", key: "kmOdometro", width: 14 },
    { header: "Km recorridos", key: "kmRecorridos", width: 16 },
    { header: "Litros", key: "litros", width: 12 },
    { header: "Monto", key: "monto", width: 14 },
    { header: "Consumo L/100km", key: "consumo", width: 16 },
  ];
  hoja.getRow(1).font = { bold: true };
  for (const c of cargas) {
    hoja.addRow({
      vehiculo: c.vehiculo.patente,
      chofer: c.chofer.nombre,
      fecha: c.fechaHora,
      kmOdometro: c.kmOdometro,
      kmRecorridos: c.kmRecorridosDesdeUltimaCarga,
      litros: Number(c.litrosCargados),
      monto: Number(c.montoTotal),
      consumo: c.consumoL100km != null ? Number(c.consumoL100km) : null,
    });
  }
  hoja.getColumn("fecha").numFmt = "dd/mm/yyyy hh:mm";
  hoja.getColumn("monto").numFmt = '"$"#,##0.00';

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="combustible.xlsx"',
    },
  });
}
