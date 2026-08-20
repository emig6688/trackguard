import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { AreaReparacionOT, EstadoOT, TipoIntervaloPlan } from "@/app/generated/prisma/client";
import { ESTADO_VENCIMIENTO_LABEL, type EstadoVencimiento } from "@/lib/vencimientos";

const AREA_LABEL: Record<AreaReparacionOT, string> = {
  FRENOS: "Frenos",
  SUSPENSION: "Suspensión",
  ESTRUCTURA: "Estructura / carrocería",
  MOTOR: "Motor",
  ELECTRICO: "Eléctrico",
  NEUMATICOS: "Neumáticos",
  EQUIPO_FRIO: "Equipo de frío",
  OTRO: "Otro",
};

const INTERVALO_CORTO: Record<TipoIntervaloPlan, string> = {
  KM: "Km",
  TIEMPO: "Días",
  HORAS: "Horas",
  AMBOS: "Km/Días/Horas",
};

const ESTADO_OT_LABEL: Record<EstadoOT, string> = {
  PENDIENTE_APROBACION: "Pendiente de aprobación",
  APROBADA: "Aprobada",
  EN_PROGRESO: "En progreso",
  DERIVADA_EXTERNO: "Derivada a externo",
  COMPLETADA: "Completada",
  CANCELADA: "Cancelada",
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
  table: { width: "100%" },
  trHead: { flexDirection: "row", borderBottom: "1pt solid #1f2937", paddingBottom: 4, marginBottom: 4 },
  tr: { flexDirection: "row", borderBottom: "0.5pt solid #e5e7eb", paddingVertical: 4 },
  th: { flex: 1, fontWeight: 700, fontSize: 9 },
  td: { flex: 1, fontSize: 9 },
  statRow: { flexDirection: "row", gap: 24, marginBottom: 4 },
  statBox: { flex: 1 },
  statValue: { fontSize: 16, fontWeight: 700 },
  statLabel: { fontSize: 8, color: "#6b7280" },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 8, color: "#9ca3af" },
  estadoVencido: { color: "#b91c1c", fontWeight: 700 },
  estadoProximo: { color: "#b45309", fontWeight: 700 },
});

function estiloEstado(estado: EstadoVencimiento) {
  if (estado === "VENCIDO") return styles.estadoVencido;
  if (estado === "PROXIMO") return styles.estadoProximo;
  return {};
}

function formatearFecha(fecha: Date | null | undefined) {
  return fecha ? fecha.toLocaleDateString("es-AR") : "—";
}

// Qué disparó el mantenimiento preventivo (km/días/horas), según los planes
// que agrupó la OT — una OT preventiva puede agrupar varios planes con
// distinto tipo de intervalo si vencieron el mismo día.
function motivoTexto(tiposIntervalo: TipoIntervaloPlan[]) {
  if (tiposIntervalo.length === 0) return "—";
  return [...new Set(tiposIntervalo.map((t) => INTERVALO_CORTO[t]))].join(", ");
}

type OtResumen = {
  numero: string;
  titulo: string;
  areaReparacion: AreaReparacionOT | null;
  estado: EstadoOT;
  fechaAlta: Date;
  tiposIntervalo: TipoIntervaloPlan[];
  fechaFin: Date | null;
};

export type ReporteTrazabilidadData = {
  vehiculo: { patente: string; marca: string; modelo: string; kmActual: number; horasEquipoFrio: number | null };
  periodo: { desde: Date; hasta: Date };
  mantenimientos: OtResumen[];
  preventivos: OtResumen[];
  checklists: { okCount: number; conFallasCount: number; presalidaCount: number };
  documentosVigentes: {
    tipoNombre: string;
    numeroDocumento: string | null;
    fechaVencimiento: Date;
    estado: EstadoVencimiento;
  }[];
  horasEquipoFrioPeriodo: number;
  eventosRutaPeriodo: number;
};

export function ReporteTrazabilidadDocument({ data }: { data: ReporteTrazabilidadData }) {
  const hoy = new Date().toLocaleDateString("es-AR");
  const {
    vehiculo,
    periodo,
    mantenimientos,
    preventivos,
    checklists,
    documentosVigentes,
    horasEquipoFrioPeriodo,
    eventosRutaPeriodo,
  } = data;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Reporte de trazabilidad — {vehiculo.patente}</Text>
        <Text style={styles.subtitle}>
          {vehiculo.marca} {vehiculo.modelo} · Período {formatearFecha(periodo.desde)} – {formatearFecha(periodo.hasta)} ·
          Generado el {hoy}
        </Text>

        <View style={styles.section}>
          <Text style={styles.h2}>Estado actual</Text>
          <View style={styles.statRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{vehiculo.kmActual.toLocaleString("es-AR")}</Text>
              <Text style={styles.statLabel}>Km actuales</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{vehiculo.horasEquipoFrio?.toLocaleString("es-AR") ?? "—"}</Text>
              <Text style={styles.statLabel}>Horas de equipo de frío (acumulado)</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{horasEquipoFrioPeriodo.toLocaleString("es-AR")}</Text>
              <Text style={styles.statLabel}>Horas de frío en el período</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Mantenimientos correctivos en el período</Text>
          {mantenimientos.length > 0 ? (
            <View style={styles.table}>
              <View style={styles.trHead}>
                <Text style={[styles.th, { flex: 0.9 }]}>OT</Text>
                <Text style={[styles.th, { flex: 2.2 }]}>Título</Text>
                <Text style={[styles.th, { flex: 1.2 }]}>Área</Text>
                <Text style={[styles.th, { flex: 1 }]}>Alta</Text>
                <Text style={[styles.th, { flex: 1.3 }]}>Estado</Text>
                <Text style={[styles.th, { flex: 1 }]}>Finalización</Text>
              </View>
              {mantenimientos.map((m, i) => (
                <View key={i} style={styles.tr}>
                  <Text style={[styles.td, { flex: 0.9 }]}>{m.numero}</Text>
                  <Text style={[styles.td, { flex: 2.2 }]}>{m.titulo}</Text>
                  <Text style={[styles.td, { flex: 1.2 }]}>
                    {m.areaReparacion ? AREA_LABEL[m.areaReparacion] : "—"}
                  </Text>
                  <Text style={[styles.td, { flex: 1 }]}>{formatearFecha(m.fechaAlta)}</Text>
                  <Text style={[styles.td, { flex: 1.3 }]}>{ESTADO_OT_LABEL[m.estado]}</Text>
                  <Text style={[styles.td, { flex: 1 }]}>{formatearFecha(m.fechaFin)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.descripcion}>Sin mantenimientos correctivos en el período.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Mantenimiento preventivo en el período</Text>
          {preventivos.length > 0 ? (
            <View style={styles.table}>
              <View style={styles.trHead}>
                <Text style={[styles.th, { flex: 1 }]}>OT</Text>
                <Text style={[styles.th, { flex: 1.1 }]}>Alta</Text>
                <Text style={[styles.th, { flex: 1.4 }]}>Motivo</Text>
                <Text style={[styles.th, { flex: 1.4 }]}>Estado</Text>
                <Text style={[styles.th, { flex: 1.1 }]}>Finalización</Text>
              </View>
              {preventivos.map((p, i) => (
                <View key={i} style={styles.tr}>
                  <Text style={[styles.td, { flex: 1 }]}>{p.numero}</Text>
                  <Text style={[styles.td, { flex: 1.1 }]}>{formatearFecha(p.fechaAlta)}</Text>
                  <Text style={[styles.td, { flex: 1.4 }]}>{motivoTexto(p.tiposIntervalo)}</Text>
                  <Text style={[styles.td, { flex: 1.4 }]}>{ESTADO_OT_LABEL[p.estado]}</Text>
                  <Text style={[styles.td, { flex: 1.1 }]}>{formatearFecha(p.fechaFin)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.descripcion}>Sin mantenimiento preventivo disparado en el período.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Checklists en el período</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Pre-salida realizados</Text>
            <Text style={styles.metaValue}>{checklists.presalidaCount}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Sin fallas / con fallas</Text>
            <Text style={styles.metaValue}>
              {checklists.okCount} OK · {checklists.conFallasCount} con fallas
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Cierres de ruta registrados</Text>
            <Text style={styles.metaValue}>{eventosRutaPeriodo}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Documentación</Text>
          {documentosVigentes.length > 0 ? (
            <View style={styles.table}>
              <View style={styles.trHead}>
                <Text style={[styles.th, { flex: 1.6 }]}>Tipo</Text>
                <Text style={[styles.th, { flex: 1.2 }]}>Número</Text>
                <Text style={[styles.th, { flex: 1 }]}>Vencimiento</Text>
                <Text style={[styles.th, { flex: 1 }]}>Estado</Text>
              </View>
              {documentosVigentes.map((d, i) => (
                <View key={i} style={styles.tr}>
                  <Text style={[styles.td, { flex: 1.6 }]}>{d.tipoNombre}</Text>
                  <Text style={[styles.td, { flex: 1.2 }]}>{d.numeroDocumento ?? "—"}</Text>
                  <Text style={[styles.td, { flex: 1 }]}>{formatearFecha(d.fechaVencimiento)}</Text>
                  <Text style={[styles.td, { flex: 1 }, estiloEstado(d.estado)]}>
                    {ESTADO_VENCIMIENTO_LABEL[d.estado]}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.descripcion}>Sin documentación cargada.</Text>
          )}
        </View>

        <Text style={styles.footer}>TruckGuard · Reporte de trazabilidad generado automáticamente</Text>
      </Page>
    </Document>
  );
}
