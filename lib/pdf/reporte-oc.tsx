import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { EstadoAutorizacionCompra, EstadoCompra, OrigenCompra } from "@/app/generated/prisma/client";

const ESTADO_LABEL: Record<EstadoCompra, string> = {
  PENDIENTE: "Pendiente",
  REALIZADA: "Realizada",
  DOCUMENTADA: "Documentada",
  CANCELADA: "Cancelada",
};

const ORIGEN_LABEL: Record<OrigenCompra, string> = {
  STOCK_MINIMO: "Stock mínimo",
  MANUAL: "Pedido manual",
};

const ESTADO_AUTORIZACION_LABEL: Record<EstadoAutorizacionCompra, string> = {
  NO_REQUERIDA: "No requerida",
  PENDIENTE: "Pendiente de autorización",
  APROBADA: "Autorizada",
  RECHAZADA: "Rechazada",
};

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#1f2937" },
  h1: { fontSize: 18, fontWeight: 700, marginBottom: 2 },
  subtitle: { fontSize: 10, color: "#6b7280", marginBottom: 20 },
  section: { marginBottom: 18 },
  h2: { fontSize: 13, fontWeight: 700, marginBottom: 8 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 4 },
  metaLabel: { fontSize: 9, color: "#6b7280", width: 150 },
  metaValue: { fontSize: 9, flex: 1 },
  descripcion: { fontSize: 10, lineHeight: 1.5 },
  itemRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 4,
  },
  itemDescripcion: { fontSize: 9, flex: 1 },
  itemCantidad: { fontSize: 9, width: 90, textAlign: "right" },
  presupuestoRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 4,
  },
  presupuestoProveedor: { fontSize: 9, flex: 1 },
  presupuestoMonto: { fontSize: 9, width: 90, textAlign: "right" },
  presupuestoAprobado: { fontSize: 8, color: "#15803d", fontWeight: 700 },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 8, color: "#9ca3af" },
});

function formatearFecha(fecha: Date | null | undefined) {
  return fecha ? fecha.toLocaleDateString("es-AR") : "—";
}

export type ReporteOCData = {
  numero: string;
  items: { descripcion: string; cantidadSolicitada: number | null; cantidadRecibida: number | null }[];
  origen: OrigenCompra;
  estado: EstadoCompra;
  creadoPorNombre: string | null;
  fechaSolicitud: Date;
  fechaCompra: Date | null;
  montoEstimado: string | null;
  montoTotal: string | null;
  observaciones: string | null;
  ordenDeTrabajoNumero: string | null;
  estadoAutorizacion: EstadoAutorizacionCompra;
  autorizadoPorNombre: string | null;
  autorizadoEn: Date | null;
  presupuestos: {
    id: string;
    proveedor: string | null;
    monto: string | null;
    subidoPorNombre: string;
    aprobado: boolean;
  }[];
};

export function ReporteOCDocument({ compra }: { compra: ReporteOCData }) {
  const hoy = new Date().toLocaleDateString("es-AR");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Orden de compra {compra.numero}</Text>
        <Text style={styles.subtitle}>Generado el {hoy}</Text>

        <View style={styles.section}>
          <Text style={styles.h2}>Datos generales</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Origen</Text>
            <Text style={styles.metaValue}>{ORIGEN_LABEL[compra.origen]}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Estado</Text>
            <Text style={styles.metaValue}>{ESTADO_LABEL[compra.estado]}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Pedida por</Text>
            <Text style={styles.metaValue}>{compra.creadoPorNombre ?? "Automático (stock mínimo)"}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Fecha de solicitud</Text>
            <Text style={styles.metaValue}>{formatearFecha(compra.fechaSolicitud)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Fecha de compra</Text>
            <Text style={styles.metaValue}>{formatearFecha(compra.fechaCompra)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Monto estimado</Text>
            <Text style={styles.metaValue}>{compra.montoEstimado ? `$${compra.montoEstimado}` : "—"}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Monto total</Text>
            <Text style={styles.metaValue}>{compra.montoTotal ? `$${compra.montoTotal}` : "—"}</Text>
          </View>
          {compra.ordenDeTrabajoNumero && (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>OT asociada</Text>
              <Text style={styles.metaValue}>{compra.ordenDeTrabajoNumero}</Text>
            </View>
          )}
          {compra.estadoAutorizacion !== "NO_REQUERIDA" && (
            <>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Autorización de gerencia</Text>
                <Text style={styles.metaValue}>{ESTADO_AUTORIZACION_LABEL[compra.estadoAutorizacion]}</Text>
              </View>
              {compra.autorizadoPorNombre && (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Autorizada por</Text>
                  <Text style={styles.metaValue}>
                    {compra.autorizadoPorNombre}
                    {compra.autorizadoEn ? ` el ${formatearFecha(compra.autorizadoEn)}` : ""}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Repuestos</Text>
          {compra.items.map((item, i) => (
            <View key={i} style={styles.itemRow}>
              <Text style={styles.itemDescripcion}>{item.descripcion}</Text>
              <Text style={styles.itemCantidad}>
                {item.cantidadSolicitada ?? "—"} pedidas
                {item.cantidadRecibida != null ? ` · ${item.cantidadRecibida} recibidas` : ""}
              </Text>
            </View>
          ))}
        </View>

        {compra.presupuestos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.h2}>Presupuestos</Text>
            {compra.presupuestos.map((p) => (
              <View key={p.id} style={styles.presupuestoRow}>
                <Text style={styles.presupuestoProveedor}>
                  {p.proveedor ?? "Sin nombre de proveedor"} · subido por {p.subidoPorNombre}
                  {p.aprobado ? <Text style={styles.presupuestoAprobado}> · APROBADO</Text> : ""}
                </Text>
                <Text style={styles.presupuestoMonto}>{p.monto ? `$${p.monto}` : "—"}</Text>
              </View>
            ))}
          </View>
        )}

        {compra.observaciones && (
          <View style={styles.section}>
            <Text style={styles.h2}>Observaciones</Text>
            <Text style={styles.descripcion}>{compra.observaciones}</Text>
          </View>
        )}

        <Text style={styles.footer}>TruckGuard · Reporte generado automáticamente</Text>
      </Page>
    </Document>
  );
}
