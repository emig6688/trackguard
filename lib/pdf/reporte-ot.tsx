import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type {
  AreaReparacionOT,
  EstadoOT,
  PrioridadOT,
} from "@/app/generated/prisma/client";

const ESTADO_LABEL: Record<EstadoOT, string> = {
  PENDIENTE_APROBACION: "Pendiente de aprobación",
  APROBADA: "Aprobada",
  EN_PROGRESO: "En progreso",
  DERIVADA_EXTERNO: "Derivada a externo",
  COMPLETADA: "Completada",
  CANCELADA: "Cancelada",
};

const PRIORIDAD_LABEL: Record<PrioridadOT, string> = {
  BAJA: "Baja",
  MEDIA: "Media",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

const AREA_LABEL: Record<AreaReparacionOT, string> = {
  FRENOS: "Frenos",
  SUSPENSION: "Suspensión",
  ESTRUCTURA: "Estructura / carrocería",
  MOTOR: "Motor",
  ELECTRICO: "Eléctrico",
  NEUMATICOS: "Neumáticos",
  OTRO: "Otro",
};

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#1f2937" },
  h1: { fontSize: 18, fontWeight: 700, marginBottom: 2 },
  subtitle: { fontSize: 10, color: "#6b7280", marginBottom: 20 },
  section: { marginBottom: 18 },
  h2: { fontSize: 13, fontWeight: 700, marginBottom: 8 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 4 },
  metaLabel: { fontSize: 9, color: "#6b7280", width: 130 },
  metaValue: { fontSize: 9, flex: 1 },
  descripcion: { fontSize: 10, lineHeight: 1.5 },
  table: { width: "100%" },
  trHead: { flexDirection: "row", borderBottom: "1pt solid #1f2937", paddingBottom: 4, marginBottom: 4 },
  tr: { flexDirection: "row", borderBottom: "0.5pt solid #e5e7eb", paddingVertical: 4 },
  th: { flex: 1, fontWeight: 700, fontSize: 9 },
  td: { flex: 1, fontSize: 9 },
  historialItem: { marginBottom: 6, fontSize: 9 },
  historialEstado: { fontWeight: 700 },
  historialMeta: { color: "#6b7280" },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 8, color: "#9ca3af" },
});

function formatearFecha(fecha: Date | null | undefined) {
  return fecha ? fecha.toLocaleDateString("es-AR") : "—";
}

export type ReporteOTData = {
  numero: string;
  titulo: string;
  descripcion: string | null;
  estado: EstadoOT;
  prioridad: PrioridadOT;
  areaReparacion: AreaReparacionOT | null;
  vehiculoPatente: string;
  asignadoANombre: string | null;
  creadoPorNombre: string | null;
  fechaLimite: Date | null;
  fechaEstimadaFinalizacion: Date | null;
  fechaFin: Date | null;
  observacionesMecanico: string | null;
  tiempoInsumidoMinutos: number | null;
  repuestos: { descripcion: string; cantidad: number; costoUnitario: string | null }[];
  facturas: { monto: string; createdAt: Date }[];
  historial: { estadoAnterior: EstadoOT | null; estadoNuevo: EstadoOT; actorNombre: string | null; createdAt: Date }[];
};

export function ReporteOTDocument({ ot }: { ot: ReporteOTData }) {
  const hoy = new Date().toLocaleDateString("es-AR");
  const totalRepuestos = ot.repuestos.reduce(
    (acc, r) => acc + (r.costoUnitario ? Number(r.costoUnitario) * r.cantidad : 0),
    0
  );
  const totalFacturas = ot.facturas.reduce((acc, f) => acc + Number(f.monto), 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>
          {ot.numero} — {ot.titulo}
        </Text>
        <Text style={styles.subtitle}>
          Vehículo {ot.vehiculoPatente} · Generado el {hoy}
        </Text>

        <View style={styles.section}>
          <Text style={styles.h2}>Datos generales</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Estado</Text>
            <Text style={styles.metaValue}>{ESTADO_LABEL[ot.estado]}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Prioridad</Text>
            <Text style={styles.metaValue}>{PRIORIDAD_LABEL[ot.prioridad]}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Área</Text>
            <Text style={styles.metaValue}>{ot.areaReparacion ? AREA_LABEL[ot.areaReparacion] : "—"}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Asignado a</Text>
            <Text style={styles.metaValue}>{ot.asignadoANombre ?? "—"}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Creado por</Text>
            <Text style={styles.metaValue}>{ot.creadoPorNombre ?? "—"}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Fecha límite</Text>
            <Text style={styles.metaValue}>{formatearFecha(ot.fechaLimite)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Fecha estimada de fin</Text>
            <Text style={styles.metaValue}>{formatearFecha(ot.fechaEstimadaFinalizacion)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Fecha de finalización</Text>
            <Text style={styles.metaValue}>{formatearFecha(ot.fechaFin)}</Text>
          </View>
          {ot.tiempoInsumidoMinutos != null && (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Tiempo insumido</Text>
              <Text style={styles.metaValue}>{ot.tiempoInsumidoMinutos} minutos</Text>
            </View>
          )}
        </View>

        {ot.descripcion && (
          <View style={styles.section}>
            <Text style={styles.h2}>Descripción</Text>
            <Text style={styles.descripcion}>{ot.descripcion}</Text>
          </View>
        )}

        {ot.observacionesMecanico && (
          <View style={styles.section}>
            <Text style={styles.h2}>Reparación realizada</Text>
            <Text style={styles.descripcion}>{ot.observacionesMecanico}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.h2}>Repuestos utilizados</Text>
          {ot.repuestos.length > 0 ? (
            <View style={styles.table}>
              <View style={styles.trHead}>
                <Text style={styles.th}>Descripción</Text>
                <Text style={styles.th}>Cantidad</Text>
                <Text style={styles.th}>Costo unitario</Text>
              </View>
              {ot.repuestos.map((r, i) => (
                <View key={i} style={styles.tr}>
                  <Text style={styles.td}>{r.descripcion}</Text>
                  <Text style={styles.td}>{r.cantidad}</Text>
                  <Text style={styles.td}>{r.costoUnitario ? `$${r.costoUnitario}` : "—"}</Text>
                </View>
              ))}
              <View style={styles.tr}>
                <Text style={[styles.td, { fontWeight: 700 }]}>Total</Text>
                <Text style={styles.td} />
                <Text style={[styles.td, { fontWeight: 700 }]}>${Math.round(totalRepuestos).toLocaleString("es-AR")}</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.descripcion}>Sin repuestos cargados.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Facturas</Text>
          {ot.facturas.length > 0 ? (
            <View style={styles.table}>
              <View style={styles.trHead}>
                <Text style={styles.th}>Fecha</Text>
                <Text style={styles.th}>Monto</Text>
              </View>
              {ot.facturas.map((f, i) => (
                <View key={i} style={styles.tr}>
                  <Text style={styles.td}>{formatearFecha(f.createdAt)}</Text>
                  <Text style={styles.td}>${f.monto}</Text>
                </View>
              ))}
              <View style={styles.tr}>
                <Text style={[styles.td, { fontWeight: 700 }]}>Total</Text>
                <Text style={[styles.td, { fontWeight: 700 }]}>${Math.round(totalFacturas).toLocaleString("es-AR")}</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.descripcion}>Sin facturas cargadas.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Historial</Text>
          {ot.historial.map((h, i) => (
            <Text key={i} style={styles.historialItem}>
              <Text style={styles.historialEstado}>
                {h.estadoAnterior ? `${ESTADO_LABEL[h.estadoAnterior]} → ` : ""}
                {ESTADO_LABEL[h.estadoNuevo]}
              </Text>
              <Text style={styles.historialMeta}>
                {" "}
                por {h.actorNombre ?? "sistema"} el {h.createdAt.toLocaleString("es-AR")}
              </Text>
            </Text>
          ))}
        </View>

        <Text style={styles.footer}>TruckGuard · Reporte generado automáticamente</Text>
      </Page>
    </Document>
  );
}
