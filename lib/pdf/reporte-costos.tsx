import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { CostoMensual, CostoPorVehiculo, TipoCostoMensual } from "@/lib/costos";

const TIPO_LABEL: Record<TipoCostoMensual, string> = {
  TOTAL: "Costos totales",
  COMBUSTIBLE: "Combustible",
  GASTOS: "Gastos",
};

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#1f2937" },
  h1: { fontSize: 18, fontWeight: 700, marginBottom: 2 },
  subtitle: { fontSize: 10, color: "#6b7280", marginBottom: 20 },
  section: { marginBottom: 22 },
  h2: { fontSize: 13, fontWeight: 700, marginBottom: 10 },
  chartWrap: {
    height: 170,
    flexDirection: "row",
    alignItems: "flex-end",
    borderBottom: "1pt solid #d1d5db",
    paddingBottom: 2,
  },
  barCol: { flex: 1, alignItems: "center", height: "100%", justifyContent: "flex-end" },
  barValue: { fontSize: 6, marginBottom: 3, color: "#374151" },
  bar: { width: "60%", backgroundColor: "#e8791e", borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  barLabels: { flexDirection: "row", marginTop: 4 },
  barLabelCol: { flex: 1, alignItems: "center" },
  barLabel: { fontSize: 7, color: "#6b7280" },
  table: { width: "100%" },
  trHead: { flexDirection: "row", borderBottom: "1pt solid #1f2937", paddingBottom: 4, marginBottom: 4 },
  tr: { flexDirection: "row", borderBottom: "0.5pt solid #e5e7eb", paddingVertical: 4 },
  th: { flex: 1, fontWeight: 700, fontSize: 9 },
  td: { flex: 1, fontSize: 9 },
  analysis: { fontSize: 10, lineHeight: 1.6 },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 8, color: "#9ca3af" },
});

function formatearMoneda(n: number) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

function formatearFecha(fecha: Date) {
  return fecha.toLocaleDateString("es-AR");
}

function formatearMes(mes: string) {
  const [anio, mesNum] = mes.split("-").map(Number);
  const fecha = new Date(anio, mesNum - 1, 1);
  return fecha.toLocaleDateString("es-AR", { month: "short", year: "2-digit" }).replace(".", "");
}

function analizar(serie: CostoMensual[]) {
  const total = serie.reduce((acc, m) => acc + m.monto, 0);
  const mesesConDatos = serie.filter((m) => m.monto > 0);
  const promedio = mesesConDatos.length > 0 ? total / mesesConDatos.length : 0;

  let mesMayor = serie[0];
  for (const m of serie) if (m.monto > mesMayor.monto) mesMayor = m;

  const ultimo = serie[serie.length - 1];
  const anterior = serie[serie.length - 2];
  let variacionTexto = "No hay suficientes meses con datos para calcular una variación.";
  if (anterior && anterior.monto > 0) {
    const variacion = ((ultimo.monto - anterior.monto) / anterior.monto) * 100;
    const direccion = variacion >= 0 ? "un aumento" : "una baja";
    variacionTexto = `El último mes con datos (${formatearMes(ultimo.mes)}) muestra ${direccion} del ${Math.abs(variacion).toFixed(0)}% respecto al mes anterior (${formatearMes(anterior.mes)}).`;
  }

  return { total, promedio, mesMayor, variacionTexto };
}

export function ReporteCostosDocument({
  tipo,
  vehiculoPatente,
  serieMensual,
  porVehiculo,
  periodo,
}: {
  tipo: TipoCostoMensual;
  vehiculoPatente: string | null;
  serieMensual: CostoMensual[];
  porVehiculo: CostoPorVehiculo[];
  periodo: { desde: Date; hasta: Date };
}) {
  const max = Math.max(1, ...serieMensual.map((m) => m.monto));
  const analisis = analizar(serieMensual);
  const hoy = new Date().toLocaleDateString("es-AR");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Reporte de costos — TruckGuard</Text>
        <Text style={styles.subtitle}>
          {TIPO_LABEL[tipo]} · {vehiculoPatente ? `Vehículo ${vehiculoPatente}` : "Todos los vehículos"} ·
          Generado el {hoy}
        </Text>

        <View style={styles.section}>
          <Text style={styles.h2}>Evolución mensual (últimos 12 meses)</Text>
          <View style={styles.chartWrap}>
            {serieMensual.map((m) => (
              <View key={m.mes} style={styles.barCol}>
                {m.monto > 0 && <Text style={styles.barValue}>{formatearMonedaCorta(m.monto)}</Text>}
                <View style={[styles.bar, { height: `${Math.max(2, (m.monto / max) * 100)}%` }]} />
              </View>
            ))}
          </View>
          <View style={styles.barLabels}>
            {serieMensual.map((m) => (
              <View key={m.mes} style={styles.barLabelCol}>
                <Text style={styles.barLabel}>{formatearMes(m.mes)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Análisis</Text>
          <Text style={styles.analysis}>
            El total del período fue de {formatearMoneda(analisis.total)}, con un promedio mensual de{" "}
            {formatearMoneda(analisis.promedio)} sobre los meses con movimientos. El mes de mayor costo fue{" "}
            {formatearMes(analisis.mesMayor.mes)} con {formatearMoneda(analisis.mesMayor.monto)}.{"\n"}
            {analisis.variacionTexto}
          </Text>
        </View>

        {!vehiculoPatente && (
          <View style={styles.section}>
            <Text style={styles.h2}>
              Costos por vehículo ({formatearFecha(periodo.desde)} – {formatearFecha(periodo.hasta)})
            </Text>
            <View style={styles.table}>
              <View style={styles.trHead}>
                <Text style={styles.th}>Vehículo</Text>
                <Text style={styles.th}>Combustible</Text>
                <Text style={styles.th}>Gastos</Text>
                <Text style={styles.th}>Repuestos</Text>
                <Text style={styles.th}>Facturas</Text>
                <Text style={styles.th}>Total</Text>
              </View>
              {porVehiculo.map((v) => (
                <View key={v.vehiculoId} style={styles.tr}>
                  <Text style={styles.td}>{v.patente}</Text>
                  <Text style={styles.td}>{formatearMoneda(v.combustible)}</Text>
                  <Text style={styles.td}>{formatearMoneda(v.gastos)}</Text>
                  <Text style={styles.td}>{formatearMoneda(v.repuestos)}</Text>
                  <Text style={styles.td}>{formatearMoneda(v.facturas)}</Text>
                  <Text style={styles.td}>{formatearMoneda(v.total)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <Text style={styles.footer}>TruckGuard · Reporte generado automáticamente</Text>
      </Page>
    </Document>
  );
}

function formatearMonedaCorta(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}
