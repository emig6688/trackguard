import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireEmpresa } from "@/lib/permisos";
import {
  calcularCandidatosReemplazo,
  calcularCorrectivasPorChofer,
  calcularDisponibilidadHistorica,
  calcularTendenciaPreventivoCorrectivo,
} from "@/lib/estadisticas";
import { calcularReportePorTodosLosChoferes } from "@/lib/estadisticas-guardia";
import { rangoExportPorDefecto } from "@/lib/export-rango";
import { ReporteEstadisticasDocument } from "@/lib/pdf/reporte-estadisticas";

export const maxDuration = 60;

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

  const buffer = await renderToBuffer(
    <ReporteEstadisticasDocument
      candidatos={candidatos.map((c) => ({
        patente: c.patente,
        antiguedad: c.antiguedadAnios != null ? `${c.antiguedadAnios} años` : "—",
        km: c.kmActual.toLocaleString("es-AR"),
        costo: `$${Math.round(c.costoTotal12m).toLocaleString("es-AR")}`,
        score: String(c.score),
        areas: c.areasRepetidas.map((a) => `${a.area} (${a.cantidad})`).join(", ") || "—",
      }))}
      tendencia={tendencia}
      disponibilidad={disponibilidad.map((d) => ({ mes: d.mes, disponibilidad: `${d.disponibilidadPromedio}%` }))}
      correctivasChofer={ranking.map((r) => ({
        chofer: r.choferNombre,
        total: r.total,
        detalle: r.porVehiculo.map((v) => `${v.patente}: ${v.cantidad}`).join(", "),
      }))}
      correlaciones={correlaciones.map((c) => ({
        chofer: c.choferNombre,
        vehiculo: c.patente,
        cantidad: c.cantidad,
        porcentaje: `${c.porcentaje}%`,
      }))}
      reportePorChofer={reportePorChofer.map((r) => ({
        chofer: r.choferNombre,
        diasOperados: r.diasOperados,
        checklist: `${r.checklistPresalidaCumplidos} / ${r.diasOperados}`,
        cierres: `${r.cierresRutaCumplidos} / ${r.diasOperados}`,
        tanque: r.tanqueNoLlenoCount,
        roturas: r.roturasReportadas,
        observaciones: r.observacionesGuardia,
      }))}
    />
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="estadisticas.pdf"',
    },
  });
}
