import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireEmpresa } from "@/lib/permisos";
import { calcularEstadoVencimiento, ESTADO_VENCIMIENTO_LABEL } from "@/lib/vencimientos";

export async function GET(request: Request) {
  const { user, prisma } = await requireEmpresa();
  const { searchParams } = new URL(request.url);
  const filtroEstado = searchParams.get("estado") ?? undefined;
  const filtroTipo = searchParams.get("tipo") ?? undefined;

  const documentos = await prisma.documento.findMany({
    where: {
      activo: true,
      eliminadoEn: null,
      ...(filtroTipo ? { tipoDocumento: { nombre: { equals: filtroTipo, mode: "insensitive" } } } : {}),
    },
    include: { tipoDocumento: true },
    orderBy: { fechaVencimiento: "asc" },
  });

  const vehiculoIds = documentos.filter((d) => d.entidadTipo === "VEHICULO").map((d) => d.entidadId);
  const choferIds = documentos.filter((d) => d.entidadTipo === "CHOFER").map((d) => d.entidadId);
  const [vehiculos, choferes] = await Promise.all([
    prisma.vehiculo.findMany({ where: { id: { in: vehiculoIds }, eliminadoEn: null } }),
    prisma.usuario.findMany({ where: { id: { in: choferIds }, eliminadoEn: null, empresaId: user.empresaId! } }),
  ]);
  const vehiculoPorId = new Map(vehiculos.map((v) => [v.id, v]));
  const choferPorId = new Map(choferes.map((c) => [c.id, c]));

  const filas = documentos
    .map((doc) => {
      const estado = calcularEstadoVencimiento(doc.fechaVencimiento, doc.tipoDocumento.diasAlertaDefault);
      const entidad =
        doc.entidadTipo === "VEHICULO"
          ? (vehiculoPorId.get(doc.entidadId)?.patente ?? "Vehículo eliminado")
          : (choferPorId.get(doc.entidadId)?.nombre ?? "Chofer eliminado");
      return { doc, estado, entidad };
    })
    .filter((f) => !filtroEstado || f.estado === filtroEstado);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TruckGuard";
  workbook.created = new Date();

  const hoja = workbook.addWorksheet("Vencimientos");
  hoja.columns = [
    { header: "Entidad", key: "entidad", width: 24 },
    { header: "Tipo de documento", key: "tipo", width: 24 },
    { header: "Número", key: "numero", width: 18 },
    { header: "Vencimiento", key: "vencimiento", width: 16 },
    { header: "Estado", key: "estado", width: 16 },
  ];
  hoja.getRow(1).font = { bold: true };
  for (const { doc, estado, entidad } of filas) {
    hoja.addRow({
      entidad,
      tipo: doc.tipoDocumento.nombre,
      numero: doc.numeroDocumento,
      vencimiento: doc.fechaVencimiento,
      estado: ESTADO_VENCIMIENTO_LABEL[estado],
    });
  }
  hoja.getColumn("vencimiento").numFmt = "dd/mm/yyyy";

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="vencimientos-documentacion.xlsx"',
    },
  });
}
