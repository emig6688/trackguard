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
  prioridad: string;
  autorizacion: string;
};

export type FilaComposicionPdf = {
  numero: string;
  estado: string;
  fecha: string;
  camion: string;
  descripcion: string;
  articulo: string;
  cantidadSolicitada: string;
  cantidadRecibida: string;
};

export function ReporteComprasDocument({
  filas,
  filasComposicion,
  periodo,
}: {
  filas: FilaCompraPdf[];
  filasComposicion: FilaComposicionPdf[];
  periodo: { desde: Date; hasta: Date };
}) {
  const hoy = new Date().toLocaleDateString("es-AR");
  const subtitulo = (
    <Text style={styles.subtitle}>
      {periodo.desde.toLocaleDateString("es-AR")} – {periodo.hasta.toLocaleDateString("es-AR")} · Generado el{" "}
      {hoy} · Incluye pendientes de comprar y ya realizadas
    </Text>
  );
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.h1}>Órdenes de compra — TruckGuard</Text>
        {subtitulo}
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
            <Text style={styles.th}>Prioridad</Text>
            <Text style={styles.th}>Autorización</Text>
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
              <Text style={styles.td}>{f.prioridad}</Text>
              <Text style={styles.td}>{f.autorizacion}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.footer}>TruckGuard · Reporte generado automáticamente</Text>
      </Page>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.h1}>Composición de las órdenes de compra — TruckGuard</Text>
        {subtitulo}
        <View style={styles.table}>
          <View style={styles.trHead}>
            <Text style={styles.th}>Número de OC</Text>
            <Text style={styles.th}>Estado</Text>
            <Text style={styles.th}>Fecha solicitud</Text>
            <Text style={styles.th}>Camión</Text>
            <Text style={{ ...styles.th, flex: 2 }}>Ítem</Text>
            <Text style={styles.th}>Artículo de pañol</Text>
            <Text style={styles.th}>Cant. solicitada</Text>
            <Text style={styles.th}>Cant. recibida</Text>
          </View>
          {filasComposicion.map((f, i) => (
            <View key={i} style={styles.tr}>
              <Text style={styles.td}>{f.numero}</Text>
              <Text style={styles.td}>{f.estado}</Text>
              <Text style={styles.td}>{f.fecha}</Text>
              <Text style={styles.td}>{f.camion}</Text>
              <Text style={{ ...styles.td, flex: 2 }}>{f.descripcion}</Text>
              <Text style={styles.td}>{f.articulo}</Text>
              <Text style={styles.td}>{f.cantidadSolicitada}</Text>
              <Text style={styles.td}>{f.cantidadRecibida}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.footer}>TruckGuard · Reporte generado automáticamente</Text>
      </Page>
    </Document>
  );
}
