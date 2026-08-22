import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: "#1f2937" },
  h1: { fontSize: 18, fontWeight: 700, marginBottom: 2 },
  subtitle: { fontSize: 10, color: "#6b7280", marginBottom: 16 },
  section: { marginBottom: 18 },
  h2: { fontSize: 12, fontWeight: 700, marginBottom: 8 },
  empty: { fontSize: 9, color: "#9ca3af", marginBottom: 4 },
  table: { width: "100%" },
  trHead: { flexDirection: "row", borderBottom: "1pt solid #1f2937", paddingBottom: 4, marginBottom: 4 },
  tr: { flexDirection: "row", borderBottom: "0.5pt solid #e5e7eb", paddingVertical: 3 },
  th: { flex: 1, fontWeight: 700, fontSize: 8 },
  td: { flex: 1, fontSize: 8 },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 8, color: "#9ca3af" },
});

export type FilaCandidato = {
  patente: string;
  antiguedad: string;
  km: string;
  costo: string;
  score: string;
  areas: string;
};
export type FilaTendencia = { mes: string; preventivo: number; correctivo: number };
export type FilaDisponibilidad = { mes: string; disponibilidad: string };
export type FilaCorrectivaChofer = { chofer: string; total: number; detalle: string };
export type FilaCorrelacion = { chofer: string; vehiculo: string; cantidad: number; porcentaje: string };
export type FilaReporteChofer = {
  chofer: string;
  diasOperados: number;
  checklist: string;
  cierres: string;
  tanque: number;
  roturas: number;
  observaciones: number;
};

function Tabla<T extends Record<string, string | number>>({
  columnas,
  filas,
}: {
  columnas: { label: string; key: keyof T }[];
  filas: T[];
}) {
  if (filas.length === 0) return <Text style={styles.empty}>Sin datos.</Text>;
  return (
    <View style={styles.table}>
      <View style={styles.trHead}>
        {columnas.map((c) => (
          <Text key={String(c.key)} style={styles.th}>
            {c.label}
          </Text>
        ))}
      </View>
      {filas.map((f, i) => (
        <View key={i} style={styles.tr}>
          {columnas.map((c) => (
            <Text key={String(c.key)} style={styles.td}>
              {f[c.key]}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

export function ReporteEstadisticasDocument({
  candidatos,
  tendencia,
  disponibilidad,
  correctivasChofer,
  correlaciones,
  reportePorChofer,
}: {
  candidatos: FilaCandidato[];
  tendencia: FilaTendencia[];
  disponibilidad: FilaDisponibilidad[];
  correctivasChofer: FilaCorrectivaChofer[];
  correlaciones: FilaCorrelacion[];
  reportePorChofer: FilaReporteChofer[];
}) {
  const hoy = new Date().toLocaleDateString("es-AR");
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Estadísticas estratégicas — TruckGuard</Text>
        <Text style={styles.subtitle}>Generado el {hoy}</Text>

        <View style={styles.section}>
          <Text style={styles.h2}>Candidatos a reemplazo</Text>
          <Tabla
            columnas={[
              { label: "Vehículo", key: "patente" },
              { label: "Antigüedad", key: "antiguedad" },
              { label: "Km", key: "km" },
              { label: "Costo 12m", key: "costo" },
              { label: "Score", key: "score" },
              { label: "Áreas repetidas", key: "areas" },
            ]}
            filas={candidatos}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Preventivo vs. correctivo por mes</Text>
          <Tabla
            columnas={[
              { label: "Mes", key: "mes" },
              { label: "Preventivo", key: "preventivo" },
              { label: "Correctivo", key: "correctivo" },
            ]}
            filas={tendencia}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Disponibilidad histórica</Text>
          <Tabla
            columnas={[
              { label: "Mes", key: "mes" },
              { label: "Disponibilidad promedio", key: "disponibilidad" },
            ]}
            filas={disponibilidad}
          />
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.h2}>Correctivas por chofer</Text>
          <Tabla
            columnas={[
              { label: "Chofer", key: "chofer" },
              { label: "Total", key: "total" },
              { label: "Detalle por vehículo", key: "detalle" },
            ]}
            filas={correctivasChofer}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Correlaciones chofer-vehículo</Text>
          <Tabla
            columnas={[
              { label: "Chofer", key: "chofer" },
              { label: "Vehículo", key: "vehiculo" },
              { label: "Correctivas", key: "cantidad" },
              { label: "% que concentra", key: "porcentaje" },
            ]}
            filas={correlaciones}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Reporte por chofer</Text>
          <Tabla
            columnas={[
              { label: "Chofer", key: "chofer" },
              { label: "Días operados", key: "diasOperados" },
              { label: "Checklist cumplidos", key: "checklist" },
              { label: "Cierres cumplidos", key: "cierres" },
              { label: "Tanque sin llenar", key: "tanque" },
              { label: "Roturas", key: "roturas" },
              { label: "Observaciones guardia", key: "observaciones" },
            ]}
            filas={reportePorChofer}
          />
        </View>

        <Text style={styles.footer}>TruckGuard · Reporte generado automáticamente</Text>
      </Page>
    </Document>
  );
}
