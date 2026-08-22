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

export type FilaOT = {
  numero: string;
  vehiculo: string;
  origen: string;
  titulo: string;
  prioridad: string;
  estado: string;
  asignadoA: string;
  creada: string;
};

export function ReporteOrdenesTrabajoDocument({ filas }: { filas: FilaOT[] }) {
  const hoy = new Date().toLocaleDateString("es-AR");
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.h1}>Órdenes de trabajo — TruckGuard</Text>
        <Text style={styles.subtitle}>Generado el {hoy}</Text>
        <View style={styles.table}>
          <View style={styles.trHead}>
            <Text style={styles.th}>Número</Text>
            <Text style={styles.th}>Vehículo</Text>
            <Text style={styles.th}>Origen</Text>
            <Text style={[styles.th, { flex: 2 }]}>Título</Text>
            <Text style={styles.th}>Prioridad</Text>
            <Text style={styles.th}>Estado</Text>
            <Text style={styles.th}>Asignado a</Text>
            <Text style={styles.th}>Creada</Text>
          </View>
          {filas.map((f, i) => (
            <View key={i} style={styles.tr}>
              <Text style={styles.td}>{f.numero}</Text>
              <Text style={styles.td}>{f.vehiculo}</Text>
              <Text style={styles.td}>{f.origen}</Text>
              <Text style={[styles.td, { flex: 2 }]}>{f.titulo}</Text>
              <Text style={styles.td}>{f.prioridad}</Text>
              <Text style={styles.td}>{f.estado}</Text>
              <Text style={styles.td}>{f.asignadoA}</Text>
              <Text style={styles.td}>{f.creada}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.footer}>TruckGuard · Reporte generado automáticamente</Text>
      </Page>
    </Document>
  );
}
