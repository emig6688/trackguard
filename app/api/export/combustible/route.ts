import { NextResponse } from "next/server";
import { requireSession } from "@/lib/permisos";
import { generarCsv } from "@/lib/csv";
import { rangoExportPorDefecto } from "@/lib/export-rango";

export async function GET(request: Request) {
  const { prisma } = await requireSession();

  const { searchParams } = new URL(request.url);
  const { desde, hasta } = rangoExportPorDefecto(searchParams);

  const cargas = await prisma.cargaCombustible.findMany({
    where: { eliminadoEn: null, fechaHora: { gte: desde, lte: hasta } },
    include: { vehiculo: true, chofer: true },
    orderBy: { fechaHora: "desc" },
  });

  const csv = generarCsv(
    ["Vehículo", "Chofer", "Fecha", "Km odómetro", "Km recorridos", "Litros", "Monto", "Consumo L/100km"],
    cargas.map((c) => [
      c.vehiculo.patente,
      c.chofer.nombre,
      c.fechaHora.toISOString(),
      c.kmOdometro,
      c.kmRecorridosDesdeUltimaCarga,
      c.litrosCargados.toString(),
      c.montoTotal.toString(),
      c.consumoL100km?.toString(),
    ])
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="combustible.csv"',
    },
  });
}
