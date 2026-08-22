import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireEmpresa } from "@/lib/permisos";
import { calcularEstadoVencimiento, ESTADO_VENCIMIENTO_LABEL } from "@/lib/vencimientos";
import { ReporteVencimientosDocument, type FilaVencimiento } from "@/lib/pdf/reporte-vencimientos";

export const maxDuration = 60;

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

  const filas: FilaVencimiento[] = documentos
    .map((doc) => {
      const estado = calcularEstadoVencimiento(doc.fechaVencimiento, doc.tipoDocumento.diasAlertaDefault);
      const entidad =
        doc.entidadTipo === "VEHICULO"
          ? (vehiculoPorId.get(doc.entidadId)?.patente ?? "Vehículo eliminado")
          : (choferPorId.get(doc.entidadId)?.nombre ?? "Chofer eliminado");
      return { doc, estado, entidad };
    })
    .filter((f) => !filtroEstado || f.estado === filtroEstado)
    .map(({ doc, estado, entidad }) => ({
      entidad,
      tipo: doc.tipoDocumento.nombre,
      numero: doc.numeroDocumento ?? "",
      vencimiento: doc.fechaVencimiento.toLocaleDateString("es-AR"),
      estado: ESTADO_VENCIMIENTO_LABEL[estado],
    }));

  const buffer = await renderToBuffer(<ReporteVencimientosDocument filas={filas} />);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="vencimientos-documentacion.pdf"',
    },
  });
}
