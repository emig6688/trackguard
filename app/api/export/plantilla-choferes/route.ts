import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireEmpresa, ROLES_ADMIN_MANTENIMIENTO } from "@/lib/permisos";

export async function GET() {
  await requireEmpresa(ROLES_ADMIN_MANTENIMIENTO);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TruckGuard";
  workbook.created = new Date();

  const hoja = workbook.addWorksheet("Choferes");
  hoja.columns = [
    { header: "Nombre*", key: "nombre", width: 24 },
    { header: "Email*", key: "email", width: 26 },
    { header: "Contraseña inicial*", key: "password", width: 20 },
    { header: "DNI", key: "dni", width: 14 },
    { header: "Teléfono", key: "telefono", width: 16 },
    { header: "Número de licencia", key: "numeroLicencia", width: 18 },
    { header: "Categoría de licencia", key: "categoriaLicencia", width: 18 },
    { header: "Legajo", key: "legajo", width: 12 },
    { header: "Fecha de ingreso (AAAA-MM-DD)", key: "fechaIngreso", width: 24 },
  ];
  hoja.getRow(1).font = { bold: true };

  const filaEjemplo = hoja.addRow({
    nombre: "Juan Ejemplo",
    email: "juan.ejemplo@empresa.com",
    password: "cambiar123",
    dni: "30111222",
    telefono: "3411234567",
    numeroLicencia: "12345678",
    categoriaLicencia: "D3",
    legajo: "1001",
    fechaIngreso: "2024-03-01",
  });
  filaEjemplo.font = { italic: true, color: { argb: "FF808080" } };

  hoja.getCell("A1").note =
    "Campos con * son obligatorios. Reemplazá o borrá la fila de ejemplo (fila 2) antes de importar — si la dejás, se crea un usuario real con ese email. El chofer puede cambiar la contraseña después de iniciar sesión.";

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-choferes.xlsx"',
    },
  });
}
