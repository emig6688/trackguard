import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireEmpresa, ROLES_ADMIN_MANTENIMIENTO } from "@/lib/permisos";

export async function GET() {
  await requireEmpresa(ROLES_ADMIN_MANTENIMIENTO);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TruckGuard";
  workbook.created = new Date();

  const hoja = workbook.addWorksheet("Pañol");
  hoja.columns = [
    { header: "Nombre*", key: "nombre", width: 28 },
    { header: "Descripción", key: "descripcion", width: 32 },
    { header: "Unidad de medida", key: "unidadMedida", width: 18 },
    { header: "Stock actual", key: "stockActual", width: 14 },
    { header: "Stock mínimo", key: "stockMinimo", width: 14 },
  ];
  hoja.getRow(1).font = { bold: true };

  const filaEjemplo = hoja.addRow({
    nombre: "Filtro de aceite",
    descripcion: "Filtro de aceite motor diésel",
    unidadMedida: "unidad",
    stockActual: 10,
    stockMinimo: 3,
  });
  filaEjemplo.font = { italic: true, color: { argb: "FF808080" } };

  hoja.getCell("A1").note =
    "Campos con * son obligatorios. Borrá la fila de ejemplo (fila 2) antes de importar, o dejala: se importa como un artículo más.";

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-panol.xlsx"',
    },
  });
}
