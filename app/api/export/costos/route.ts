import { NextResponse } from "next/server";
import { requireSession } from "@/lib/permisos";
import { generarCsv } from "@/lib/csv";
import { calcularCostosPorChofer, calcularCostosPorVehiculo } from "@/lib/costos";

export async function GET(request: Request) {
  const { user, prisma } = await requireSession();

  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get("tipo");
  const desdeRaw = searchParams.get("desde");
  const hastaRaw = searchParams.get("hasta");
  const filtro = {
    desde: desdeRaw ? new Date(desdeRaw) : undefined,
    hasta: hastaRaw ? new Date(hastaRaw) : undefined,
  };

  if (tipo === "chofer") {
    const filas = await calcularCostosPorChofer(prisma, user.empresaId!, filtro);
    const csv = generarCsv(
      ["Chofer", "Combustible", "Gastos", "Total"],
      filas.map((f) => [f.nombre, f.combustible, f.gastos, f.total])
    );
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="costos-por-chofer.csv"',
      },
    });
  }

  const filas = await calcularCostosPorVehiculo(prisma, filtro);
  const csv = generarCsv(
    ["Vehículo", "Combustible", "Gastos", "Repuestos", "Facturas", "Total"],
    filas.map((f) => [f.patente, f.combustible, f.gastos, f.repuestos, f.facturas, f.total])
  );
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="costos-por-vehiculo.csv"',
    },
  });
}
