import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireEmpresa } from "@/lib/permisos";
import {
  calcularCandidatosReemplazo,
  calcularCorrectivasPorChofer,
  calcularDisponibilidadHistorica,
  calcularTendenciaPreventivoCorrectivo,
} from "@/lib/estadisticas";
import { calcularReportePorTodosLosChoferes } from "@/lib/estadisticas-guardia";
import { rangoExportPorDefecto } from "@/lib/export-rango";

export const maxDuration = 60;

/**
 * Snapshot completo del módulo de Estadísticas en un solo Excel: candidatos
 * a reemplazo, tendencia preventivo/correctivo, disponibilidad histórica,
 * correctivas por chofer + correlaciones chofer-vehículo, y el reporte por
 * chofer (todos, el mismo período que /reportes/estadisticas toma por
 * defecto si no se pasa desde/hasta).
 */
export async function GET(request: Request) {
  const { user, prisma } = await requireEmpresa();
  const { searchParams } = new URL(request.url);
  const { desde, hasta } = rangoExportPorDefecto(searchParams);

  const [candidatos, tendencia, disponibilidad, correctivasChofer, choferesActivos] = await Promise.all([
    calcularCandidatosReemplazo(prisma),
    calcularTendenciaPreventivoCorrectivo(prisma),
    calcularDisponibilidadHistorica(prisma),
    calcularCorrectivasPorChofer(prisma),
    prisma.usuario.findMany({
      where: { empresaId: user.empresaId!, rol: "CHOFER", activo: true, eliminadoEn: null },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);
  const { ranking, correlaciones } = correctivasChofer;
  const reportePorChofer = await calcularReportePorTodosLosChoferes(
    prisma,
    choferesActivos.map((c) => c.id),
    desde,
    hasta
  );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TruckGuard";
  workbook.created = new Date();

  const hojaCandidatos = workbook.addWorksheet("Candidatos a reemplazo");
  hojaCandidatos.columns = [
    { header: "Vehículo", key: "patente", width: 14 },
    { header: "Antigüedad (años)", key: "antiguedad", width: 16 },
    { header: "Km actual", key: "km", width: 14 },
    { header: "Costo últimos 12m", key: "costo", width: 16 },
    { header: "Costo por km", key: "costoKm", width: 14 },
    { header: "Correctivas 12m", key: "correctivas", width: 14 },
    { header: "Score (0-100)", key: "score", width: 14 },
    { header: "Áreas repetidas", key: "areas", width: 32 },
  ];
  hojaCandidatos.getRow(1).font = { bold: true };
  for (const c of candidatos) {
    hojaCandidatos.addRow({
      patente: c.patente,
      antiguedad: c.antiguedadAnios ?? "",
      km: c.kmActual,
      costo: c.costoTotal12m,
      costoKm: Math.round(c.costoPorKm * 100) / 100,
      correctivas: c.correctivas12m,
      score: c.score,
      areas: c.areasRepetidas.map((a) => `${a.area} (${a.cantidad})`).join(", "),
    });
  }
  hojaCandidatos.getColumn("costo").numFmt = '"$"#,##0.00';
  hojaCandidatos.getColumn("costoKm").numFmt = '"$"#,##0.00';

  const hojaTendencia = workbook.addWorksheet("Preventivo vs correctivo");
  hojaTendencia.columns = [
    { header: "Mes", key: "mes", width: 12 },
    { header: "Preventivo", key: "preventivo", width: 14 },
    { header: "Correctivo", key: "correctivo", width: 14 },
  ];
  hojaTendencia.getRow(1).font = { bold: true };
  for (const t of tendencia) hojaTendencia.addRow(t);

  const hojaDisponibilidad = workbook.addWorksheet("Disponibilidad histórica");
  hojaDisponibilidad.columns = [
    { header: "Mes", key: "mes", width: 12 },
    { header: "Disponibilidad promedio (%)", key: "disponibilidadPromedio", width: 24 },
  ];
  hojaDisponibilidad.getRow(1).font = { bold: true };
  for (const d of disponibilidad) hojaDisponibilidad.addRow(d);

  const hojaCorrectivasChofer = workbook.addWorksheet("Correctivas por chofer");
  hojaCorrectivasChofer.columns = [
    { header: "Chofer", key: "chofer", width: 24 },
    { header: "Total correctivas", key: "total", width: 16 },
    { header: "Detalle por vehículo", key: "detalle", width: 48 },
  ];
  hojaCorrectivasChofer.getRow(1).font = { bold: true };
  for (const r of ranking) {
    hojaCorrectivasChofer.addRow({
      chofer: r.choferNombre,
      total: r.total,
      detalle: r.porVehiculo.map((v) => `${v.patente}: ${v.cantidad}`).join(", "),
    });
  }

  const hojaCorrelaciones = workbook.addWorksheet("Correlaciones chofer-vehículo");
  hojaCorrelaciones.columns = [
    { header: "Chofer", key: "chofer", width: 24 },
    { header: "Vehículo", key: "vehiculo", width: 14 },
    { header: "Correctivas del chofer", key: "cantidad", width: 18 },
    { header: "Total correctivas del vehículo", key: "totalVehiculo", width: 22 },
    { header: "% que concentra", key: "porcentaje", width: 16 },
  ];
  hojaCorrelaciones.getRow(1).font = { bold: true };
  for (const c of correlaciones) {
    hojaCorrelaciones.addRow({
      chofer: c.choferNombre,
      vehiculo: c.patente,
      cantidad: c.cantidad,
      totalVehiculo: c.totalVehiculo,
      porcentaje: c.porcentaje,
    });
  }

  const hojaReportePorChofer = workbook.addWorksheet("Reporte por chofer");
  hojaReportePorChofer.columns = [
    { header: "Chofer", key: "chofer", width: 24 },
    { header: "Días operados", key: "diasOperados", width: 14 },
    { header: "Checklist pre-salida cumplidos", key: "checklist", width: 22 },
    { header: "Cierres de ruta cumplidos", key: "cierres", width: 20 },
    { header: "Veces con tanque sin llenar", key: "tanque", width: 20 },
    { header: "Roturas reportadas", key: "roturas", width: 16 },
    { header: "Observaciones del guardia", key: "observaciones", width: 20 },
  ];
  hojaReportePorChofer.getRow(1).font = { bold: true };
  for (const r of reportePorChofer) {
    hojaReportePorChofer.addRow({
      chofer: r.choferNombre,
      diasOperados: r.diasOperados,
      checklist: `${r.checklistPresalidaCumplidos} / ${r.diasOperados}`,
      cierres: `${r.cierresRutaCumplidos} / ${r.diasOperados}`,
      tanque: r.tanqueNoLlenoCount,
      roturas: r.roturasReportadas,
      observaciones: r.observacionesGuardia,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="estadisticas.xlsx"',
    },
  });
}
