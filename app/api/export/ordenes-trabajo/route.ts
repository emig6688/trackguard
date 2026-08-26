import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireEmpresa } from "@/lib/permisos";

export async function GET() {
  const { prisma } = await requireEmpresa();

  const ordenes = await prisma.ordenDeTrabajo.findMany({
    where: { eliminadoEn: null },
    include: { vehiculo: true, asignadoA: true },
    orderBy: { createdAt: "desc" },
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TruckGuard";
  workbook.created = new Date();

  const hoja = workbook.addWorksheet("Órdenes de trabajo");
  hoja.columns = [
    { header: "Número", key: "numero", width: 16 },
    { header: "Vehículo", key: "vehiculo", width: 14 },
    { header: "Origen", key: "origen", width: 16 },
    { header: "Título", key: "titulo", width: 32 },
    { header: "Prioridad", key: "prioridad", width: 12 },
    { header: "Estado", key: "estado", width: 20 },
    { header: "Asignado a", key: "asignadoA", width: 22 },
    { header: "Creada", key: "creada", width: 18 },
  ];
  hoja.getRow(1).font = { bold: true };
  for (const ot of ordenes) {
    hoja.addRow({
      numero: ot.numero,
      vehiculo: ot.vehiculo.patente,
      origen: ot.origen,
      titulo: ot.titulo,
      prioridad: ot.prioridad,
      estado: ot.estado,
      asignadoA: ot.asignadoA?.nombre ?? "",
      creada: ot.createdAt,
    });
  }
  hoja.getColumn("creada").numFmt = "dd/mm/yyyy hh:mm";

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="ordenes-de-trabajo.xlsx"',
    },
  });
}
