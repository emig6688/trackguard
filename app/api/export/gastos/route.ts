import { NextResponse } from "next/server";
import { requireSession } from "@/lib/permisos";
import { generarCsv } from "@/lib/csv";
import { rangoExportPorDefecto } from "@/lib/export-rango";

export async function GET(request: Request) {
  const { prisma } = await requireSession();

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

  const csv = generarCsv(
    ["Chofer", "Vehículo", "Tipo", "Monto", "Fecha", "Estado", "Descripción"],
    gastos.map((g) => [
      g.chofer.nombre,
      g.vehiculo?.patente,
      g.tipo,
      g.monto.toString(),
      g.fecha.toISOString(),
      g.estado,
      g.descripcion,
    ])
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="gastos.csv"',
    },
  });
}
