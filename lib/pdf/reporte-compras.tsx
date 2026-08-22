import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 8, fontFamily: "Helvetica", color: "#1f2937" },
  h1: { fontSize: 18, fontWeight: 700, marginBottom: 2 },
  subtitle: { fontSize: 10, color: "#6b7280", marginBottom: 20 },
  table: { width: "100%" },
  trHead: { flexDirection: "row", borderBottom: "1pt solid #1f2937", paddingBottom: 4, marginBottom: 4 },
  tr: { flexDirection: "row", borderBottom: "0.5pt solid #e5e7eb", paddingVertical: 3 },
  th: { flex: 1, fontWeight: 700, fontSize: 7 },
  td: { flex: 1, fontSize: 7 },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 8, color: "#9ca3af" },
});

export type FilaCompraPdf = {
  numero: string;
  estado: string;
  fechaSolicitud: string;
  camion: string;
  chofer: string;
  proveedor: string;
  montoEstimado: string;
  montoReal: string;
};

export function ReporteComprasDocument({
  filas,
  periodo,
}: {
  filas: FilaCompraPdf[];
  periodo: { desde: Date; hasta: Date };
}) {
  const hoy = new Date().toLocaleDateString("es-AR");
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.h1}>Órdenes de compra — TruckGuard</Text>
        <Text style={styles.subtitle}>
          {periodo.desde.toLocaleDateString("es-AR")} – {periodo.hasta.toLocaleDateString("es-AR")} · Generado el{" "}
          {hoy} · Incluye pendientes de comprar y ya realizadas
        </Text>
        <View style={styles.table}>
          <View style={styles.trHead}>
            <Text style={styles.th}>Número</Text>
            <Text style={styles.th}>Estado</Text>
            <Text style={styles.th}>Fecha solicitud</Text>
            <Text style={styles.th}>Camión</Text>
            <Text style={styles.th}>Chofer</Text>
            <Text style={styles.th}>Proveedor</Text>
            <Text style={styles.th}>Monto estimado</Text>
            <Text style={styles.th}>Monto real</Text>
          </View>
          {filas.map((f, i) => (
            <View key={i} style={styles.tr}>
              <Text style={styles.td}>{f.numero}</Text>
              <Text style={styles.td}>{f.estado}</Text>
              <Text style={styles.td}>{f.fechaSolicitud}</Text>
              <Text style={styles.td}>{f.camion}</Text>
              <Text style={styles.td}>{f.chofer}</Text>
              <Text style={styles.td}>{f.proveedor}</Text>
              <Text style={styles.td}>{f.montoEstimado}</Text>
              <Text style={styles.td}>{f.montoReal}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.footer}>TruckGuard · Reporte generado automáticamente</Text>
      </Page>
    </Document>
  );
}
