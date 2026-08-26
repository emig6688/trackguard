import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireEmpresa } from "@/lib/permisos";
import { calcularCostosPorChofer, calcularCostosPorVehiculo } from "@/lib/costos";
import { rangoExportPorDefecto } from "@/lib/export-rango";

export async function GET(request: Request) {
  const { user, prisma } = await requireEmpresa();

  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get("tipo");
  const filtro = rangoExportPorDefecto(searchParams);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TruckGuard";
  workbook.created = new Date();

  if (tipo === "chofer") {
    const filas = await calcularCostosPorChofer(prisma, user.empresaId!, filtro);
    const hoja = workbook.addWorksheet("Por chofer");
    hoja.columns = [
      { header: "Chofer", key: "nombre", width: 24 },
      { header: "Combustible", key: "combustible", width: 16 },
      { header: "Gastos", key: "gastos", width: 16 },
      { header: "Total", key: "total", width: 16 },
    ];
    hoja.getRow(1).font = { bold: true };
    for (const f of filas) hoja.addRow(f);
    for (const key of ["combustible", "gastos", "total"]) hoja.getColumn(key).numFmt = '"$"#,##0.00';

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="costos-por-chofer.xlsx"',
      },
    });
  }

  const filas = await calcularCostosPorVehiculo(prisma, filtro);
  const hoja = workbook.addWorksheet("Por vehículo");
  hoja.columns = [
    { header: "Vehículo", key: "patente", width: 14 },
    { header: "Combustible", key: "combustible", width: 16 },
    { header: "Gastos", key: "gastos", width: 16 },
    { header: "Repuestos", key: "repuestos", width: 16 },
    { header: "Facturas", key: "facturas", width: 16 },
    { header: "Total", key: "total", width: 16 },
  ];
  hoja.getRow(1).font = { bold: true };
  for (const f of filas) hoja.addRow(f);
  for (const key of ["combustible", "gastos", "repuestos", "facturas", "total"]) {
    hoja.getColumn(key).numFmt = '"$"#,##0.00';
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="costos-por-vehiculo.xlsx"',
    },
  });
}
