import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireSession } from "@/lib/permisos";
import { calcularCostosMensuales, calcularCostosPorVehiculo, type TipoCostoMensual } from "@/lib/costos";
import { rangoExportPorDefecto } from "@/lib/export-rango";
import { ReporteCostosDocument } from "@/lib/pdf/reporte-costos";

const TIPOS_VALIDOS: TipoCostoMensual[] = ["TOTAL", "COMBUSTIBLE", "GASTOS"];

// Render de PDF con gráfico puede acercarse al límite por defecto.
export const maxDuration = 60;

export async function GET(request: Request) {
  const { prisma } = await requireSession();

  const { searchParams } = new URL(request.url);
  const tipoRaw = searchParams.get("tipo");
  const tipo: TipoCostoMensual = TIPOS_VALIDOS.includes(tipoRaw as TipoCostoMensual)
    ? (tipoRaw as TipoCostoMensual)
    : "TOTAL";
  const vehiculoId = searchParams.get("vehiculo") || undefined;
  const filtro = rangoExportPorDefecto(searchParams);

  const [serieMensual, vehiculo, porVehiculo] = await Promise.all([
    calcularCostosMensuales(prisma, { tipo, vehiculoId }),
    vehiculoId ? prisma.vehiculo.findUnique({ where: { id: vehiculoId } }) : Promise.resolve(null),
    calcularCostosPorVehiculo(prisma, filtro),
  ]);

  const buffer = await renderToBuffer(
    <ReporteCostosDocument
      tipo={tipo}
      vehiculoPatente={vehiculo?.patente ?? null}
      serieMensual={serieMensual}
      porVehiculo={porVehiculo}
      periodo={filtro}
    />
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="reporte-costos.pdf"',
    },
  });
}
