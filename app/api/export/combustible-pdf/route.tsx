import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireEmpresa } from "@/lib/permisos";
import { rangoExportPorDefecto } from "@/lib/export-rango";
import { ReporteCombustibleDocument, type FilaCombustible } from "@/lib/pdf/reporte-combustible";

export const maxDuration = 60;

export async function GET(request: Request) {
  const { prisma } = await requireEmpresa();
  const { searchParams } = new URL(request.url);
  const { desde, hasta } = rangoExportPorDefecto(searchParams);

  const cargas = await prisma.cargaCombustible.findMany({
    where: { eliminadoEn: null, fechaHora: { gte: desde, lte: hasta } },
    include: { vehiculo: true, chofer: true },
    orderBy: { fechaHora: "desc" },
  });

  const filas: FilaCombustible[] = cargas.map((c) => ({
    vehiculo: c.vehiculo.patente,
    chofer: c.chofer.nombre,
    fecha: c.fechaHora.toLocaleDateString("es-AR"),
    litros: c.litrosCargados.toString(),
    monto: `$${Math.round(Number(c.montoTotal)).toLocaleString("es-AR")}`,
    consumo: c.consumoL100km != null ? `${Number(c.consumoL100km)} L/100km` : "—",
  }));

  const buffer = await renderToBuffer(<ReporteCombustibleDocument filas={filas} periodo={{ desde, hasta }} />);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="combustible.pdf"',
    },
  });
}
