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

export type FilaGasto = {
  chofer: string;
  vehiculo: string;
  tipo: string;
  monto: string;
  fecha: string;
  estado: string;
};

export function ReporteGastosDocument({
  filas,
  periodo,
}: {
  filas: FilaGasto[];
  periodo: { desde: Date; hasta: Date };
}) {
  const hoy = new Date().toLocaleDateString("es-AR");
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Gastos de choferes — TruckGuard</Text>
        <Text style={styles.subtitle}>
          {periodo.desde.toLocaleDateString("es-AR")} – {periodo.hasta.toLocaleDateString("es-AR")} · Generado el{" "}
          {hoy}
        </Text>
        <View style={styles.table}>
          <View style={styles.trHead}>
            <Text style={styles.th}>Chofer</Text>
            <Text style={styles.th}>Vehículo</Text>
            <Text style={styles.th}>Tipo</Text>
            <Text style={styles.th}>Monto</Text>
            <Text style={styles.th}>Fecha</Text>
            <Text style={styles.th}>Estado</Text>
          </View>
          {filas.map((f, i) => (
            <View key={i} style={styles.tr}>
              <Text style={styles.td}>{f.chofer}</Text>
              <Text style={styles.td}>{f.vehiculo}</Text>
              <Text style={styles.td}>{f.tipo}</Text>
              <Text style={styles.td}>{f.monto}</Text>
              <Text style={styles.td}>{f.fecha}</Text>
              <Text style={styles.td}>{f.estado}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.footer}>TruckGuard · Reporte generado automáticamente</Text>
      </Page>
    </Document>
  );
}
