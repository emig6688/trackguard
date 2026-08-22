import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireEmpresa } from "@/lib/permisos";
import { rangoExportPorDefecto } from "@/lib/export-rango";
import { ReporteGastosDocument, type FilaGasto } from "@/lib/pdf/reporte-gastos";

export const maxDuration = 60;

const TIPO_LABEL: Record<string, string> = {
  PEAJE: "Peaje",
  VIATICO: "Viático",
  REPARACION_MENOR: "Reparación menor",
  OTRO: "Otro",
};

export async function GET(request: Request) {
  const { prisma } = await requireEmpresa();
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

  const filas: FilaGasto[] = gastos.map((g) => ({
    chofer: g.chofer.nombre,
    vehiculo: g.vehiculo?.patente ?? "—",
    tipo: TIPO_LABEL[g.tipo] ?? g.tipo,
    monto: `$${g.monto.toString()}`,
    fecha: g.fecha.toLocaleDateString("es-AR"),
    estado: g.estado,
  }));

  const buffer = await renderToBuffer(<ReporteGastosDocument filas={filas} periodo={{ desde, hasta }} />);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="gastos.pdf"',
    },
  });
}
