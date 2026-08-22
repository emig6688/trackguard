import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: "#1f2937" },
  h1: { fontSize: 18, fontWeight: 700, marginBottom: 2 },
  subtitle: { fontSize: 10, color: "#6b7280", marginBottom: 20 },
  table: { width: "100%" },
  trHead: { flexDirection: "row", borderBottom: "1pt solid #1f2937", paddingBottom: 4, marginBottom: 4 },
  tr: { flexDirection: "row", borderBottom: "0.5pt solid #e5e7eb", paddingVertical: 3 },
  th: { flex: 1, fontWeight: 700, fontSize: 8 },
  td: { flex: 1, fontSize: 8 },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 8, color: "#9ca3af" },
});

export type FilaVencimiento = {
  entidad: string;
  tipo: string;
  numero: string;
  vencimiento: string;
  estado: string;
};

export function ReporteVencimientosDocument({ filas }: { filas: FilaVencimiento[] }) {
  const hoy = new Date().toLocaleDateString("es-AR");
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Vencimientos de documentación — TruckGuard</Text>
        <Text style={styles.subtitle}>Generado el {hoy}</Text>
        <View style={styles.table}>
          <View style={styles.trHead}>
            <Text style={styles.th}>Entidad</Text>
            <Text style={styles.th}>Tipo</Text>
            <Text style={styles.th}>Número</Text>
            <Text style={styles.th}>Vencimiento</Text>
            <Text style={styles.th}>Estado</Text>
          </View>
          {filas.map((f, i) => (
            <View key={i} style={styles.tr}>
              <Text style={styles.td}>{f.entidad}</Text>
              <Text style={styles.td}>{f.tipo}</Text>
              <Text style={styles.td}>{f.numero}</Text>
              <Text style={styles.td}>{f.vencimiento}</Text>
              <Text style={styles.td}>{f.estado}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.footer}>TruckGuard · Reporte generado automáticamente</Text>
      </Page>
    </Document>
  );
}
