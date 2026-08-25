import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireEmpresa, ROLES_ADMIN_MANTENIMIENTO } from "@/lib/permisos";

export async function GET() {
  await requireEmpresa(ROLES_ADMIN_MANTENIMIENTO);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TruckGuard";
  workbook.created = new Date();

  const hoja = workbook.addWorksheet("Vehículos");
  hoja.columns = [
    { header: "Patente*", key: "patente", width: 14 },
    { header: "Marca*", key: "marca", width: 16 },
    { header: "Modelo*", key: "modelo", width: 16 },
    { header: "Año", key: "anio", width: 10 },
    { header: "Tipo* (CAMION/ACOPLADO/UTILITARIO/OTRO)", key: "tipo", width: 30 },
    { header: "Número interno", key: "numeroInterno", width: 16 },
    { header: "Km actual", key: "kmActual", width: 12 },
    { header: "Horas equipo frío", key: "horasEquipoFrio", width: 16 },
    { header: "Tipo de carrocería", key: "tipoCarroceria", width: 18 },
    { header: "Tipo de equipo de frío", key: "equipoFrioTipo", width: 18 },
  ];
  hoja.getRow(1).font = { bold: true };

  const filaEjemplo = hoja.addRow({
    patente: "AA000EJ",
    marca: "Mercedes-Benz",
    modelo: "Atego 1726",
    anio: 2018,
    tipo: "CAMION",
    numeroInterno: "12",
    kmActual: 150000,
    horasEquipoFrio: 4200,
    tipoCarroceria: "Furgón",
    equipoFrioTipo: "Carrier",
  });
  filaEjemplo.font = { italic: true, color: { argb: "FF808080" } };

  hoja.getCell("A1").note =
    "Campos con * son obligatorios. Reemplazá o borrá la fila de ejemplo (fila 2, patente AA000EJ) antes de importar — si la dejás, se crea un vehículo real con esa patente.";

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-vehiculos.xlsx"',
    },
  });
}
