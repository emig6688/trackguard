import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#1f2937" },
  h1: { fontSize: 18, fontWeight: 700, marginBottom: 2 },
  subtitle: { fontSize: 10, color: "#6b7280", marginBottom: 20 },
  section: { marginBottom: 18 },
  h2: { fontSize: 13, fontWeight: 700, marginBottom: 8 },
  item: { fontSize: 10, marginBottom: 3 },
  vacio: { fontSize: 10, color: "#6b7280" },
  table: { width: "100%" },
  trHead: { flexDirection: "row", borderBottom: "1pt solid #1f2937", paddingBottom: 4, marginBottom: 4 },
  tr: { flexDirection: "row", borderBottom: "0.5pt solid #e5e7eb", paddingVertical: 4 },
  th: { flex: 1, fontWeight: 700, fontSize: 9 },
  td: { flex: 1, fontSize: 9 },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 8, color: "#9ca3af" },
});

export function ReporteGuardiaDiarioDocument({
  fecha,
  vehiculosSinPresalida,
  vehiculosSinCierre,
  vehiculosTanqueNoLleno,
  devoluciones,
}: {
  fecha: Date;
  vehiculosSinPresalida: string[];
  vehiculosSinCierre: string[];
  vehiculosTanqueNoLleno: string[];
  devoluciones: { chofer: string; cliente: string; remito: string }[];
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Resumen diario de guardia — TruckGuard</Text>
        <Text style={styles.subtitle}>{fecha.toLocaleDateString("es-AR")}</Text>

        <View style={styles.section}>
          <Text style={styles.h2}>Vehículos sin checklist pre-salida</Text>
          {vehiculosSinPresalida.length === 0 ? (
            <Text style={styles.vacio}>Todos los vehículos activos hicieron su checklist pre-salida hoy.</Text>
          ) : (
            vehiculosSinPresalida.map((p) => (
              <Text key={p} style={styles.item}>
                • {p}
              </Text>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Vehículos sin cierre de ruta</Text>
          {vehiculosSinCierre.length === 0 ? (
            <Text style={styles.vacio}>Todos los vehículos activos cerraron su ruta hoy.</Text>
          ) : (
            vehiculosSinCierre.map((p) => (
              <Text key={p} style={styles.item}>
                • {p}
              </Text>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Vehículos que volvieron con el tanque sin llenar</Text>
          {vehiculosTanqueNoLleno.length === 0 ? (
            <Text style={styles.vacio}>Ninguno.</Text>
          ) : (
            vehiculosTanqueNoLleno.map((p) => (
              <Text key={p} style={styles.item}>
                • {p}
              </Text>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Devoluciones de hoy</Text>
          {devoluciones.length === 0 ? (
            <Text style={styles.vacio}>No se registraron devoluciones hoy.</Text>
          ) : (
            <View style={styles.table}>
              <View style={styles.trHead}>
                <Text style={styles.th}>Chofer</Text>
                <Text style={styles.th}>Cliente</Text>
                <Text style={styles.th}>Remito</Text>
              </View>
              {devoluciones.map((d, i) => (
                <View key={i} style={styles.tr}>
                  <Text style={styles.td}>{d.chofer}</Text>
                  <Text style={styles.td}>{d.cliente}</Text>
                  <Text style={styles.td}>{d.remito}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <Text style={styles.footer}>TruckGuard · Reporte generado automáticamente</Text>
      </Page>
    </Document>
  );
}
