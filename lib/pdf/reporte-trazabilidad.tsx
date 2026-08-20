import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { AreaReparacionOT, TipoIntervaloPlan } from "@/app/generated/prisma/client";

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

const INTERVALO_LABEL: Record<TipoIntervaloPlan, string> = {
  KM: "Kilómetros",
  TIEMPO: "Tiempo",
  HORAS: "Horas de frío",
  AMBOS: "Km y/o tiempo",
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
});

function formatearFecha(fecha: Date | null | undefined) {
  return fecha ? fecha.toLocaleDateString("es-AR") : "—";
}

function formatearMonto(monto: number) {
  return `$${Math.round(monto).toLocaleString("es-AR")}`;
}

export type ReporteTrazabilidadData = {
  vehiculo: { patente: string; marca: string; modelo: string; kmActual: number; horasEquipoFrio: number | null };
  periodo: { desde: Date; hasta: Date };
  mantenimientos: {
    numero: string;
    titulo: string;
    areaReparacion: AreaReparacionOT | null;
    fechaFin: Date | null;
    totalRepuestos: number;
    totalFacturas: number;
  }[];
  planesPreventivos: {
    nombre: string;
    categoria: string | null;
    tipoIntervalo: TipoIntervaloPlan;
    intervaloKm: number | null;
    intervaloDias: number | null;
    intervaloHoras: number | null;
    kmUltimoService: number | null;
    fechaUltimoService: Date | null;
  }[];
  checklists: { okCount: number; conFallasCount: number; presalidaCount: number };
  documentosVigentes: { tipoNombre: string; numeroDocumento: string | null; fechaVencimiento: Date }[];
  horasEquipoFrioPeriodo: number;
  eventosRutaPeriodo: number;
};

export function ReporteTrazabilidadDocument({ data }: { data: ReporteTrazabilidadData }) {
  const hoy = new Date().toLocaleDateString("es-AR");
  const {
    vehiculo,
    periodo,
    mantenimientos,
    planesPreventivos,
    checklists,
    documentosVigentes,
    horasEquipoFrioPeriodo,
    eventosRutaPeriodo,
  } = data;

  const totalRepuestos = mantenimientos.reduce((acc, m) => acc + m.totalRepuestos, 0);
  const totalFacturas = mantenimientos.reduce((acc, m) => acc + m.totalFacturas, 0);

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
          <Text style={styles.h2}>Mantenimientos completados en el período</Text>
          {mantenimientos.length > 0 ? (
            <View style={styles.table}>
              <View style={styles.trHead}>
                <Text style={styles.th}>OT</Text>
                <Text style={styles.th}>Título</Text>
                <Text style={styles.th}>Área</Text>
                <Text style={styles.th}>Fecha fin</Text>
                <Text style={styles.th}>Repuestos</Text>
                <Text style={styles.th}>Facturas</Text>
              </View>
              {mantenimientos.map((m, i) => (
                <View key={i} style={styles.tr}>
                  <Text style={styles.td}>{m.numero}</Text>
                  <Text style={styles.td}>{m.titulo}</Text>
                  <Text style={styles.td}>{m.areaReparacion ? AREA_LABEL[m.areaReparacion] : "—"}</Text>
                  <Text style={styles.td}>{formatearFecha(m.fechaFin)}</Text>
                  <Text style={styles.td}>{formatearMonto(m.totalRepuestos)}</Text>
                  <Text style={styles.td}>{formatearMonto(m.totalFacturas)}</Text>
                </View>
              ))}
              <View style={styles.tr}>
                <Text style={[styles.td, { fontWeight: 700 }]}>Total</Text>
                <Text style={styles.td} />
                <Text style={styles.td} />
                <Text style={styles.td} />
                <Text style={[styles.td, { fontWeight: 700 }]}>{formatearMonto(totalRepuestos)}</Text>
                <Text style={[styles.td, { fontWeight: 700 }]}>{formatearMonto(totalFacturas)}</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.descripcion}>Sin órdenes de trabajo completadas en el período.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Mantenimiento preventivo</Text>
          {planesPreventivos.length > 0 ? (
            <View style={styles.table}>
              <View style={styles.trHead}>
                <Text style={styles.th}>Plan</Text>
                <Text style={styles.th}>Intervalo</Text>
                <Text style={styles.th}>Último service (km)</Text>
                <Text style={styles.th}>Último service (fecha)</Text>
              </View>
              {planesPreventivos.map((p, i) => (
                <View key={i} style={styles.tr}>
                  <Text style={styles.td}>
                    {p.nombre}
                    {p.categoria ? ` (${p.categoria})` : ""}
                  </Text>
                  <Text style={styles.td}>
                    {INTERVALO_LABEL[p.tipoIntervalo]}
                    {p.intervaloKm ? ` · ${p.intervaloKm.toLocaleString("es-AR")} km` : ""}
                    {p.intervaloDias ? ` · ${p.intervaloDias} días` : ""}
                    {p.intervaloHoras ? ` · ${p.intervaloHoras} hs` : ""}
                  </Text>
                  <Text style={styles.td}>{p.kmUltimoService?.toLocaleString("es-AR") ?? "—"}</Text>
                  <Text style={styles.td}>{formatearFecha(p.fechaUltimoService)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.descripcion}>Sin planes de mantenimiento preventivo activos.</Text>
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
          <Text style={styles.h2}>Documentación vigente</Text>
          {documentosVigentes.length > 0 ? (
            <View style={styles.table}>
              <View style={styles.trHead}>
                <Text style={styles.th}>Tipo</Text>
                <Text style={styles.th}>Número</Text>
                <Text style={styles.th}>Vencimiento</Text>
              </View>
              {documentosVigentes.map((d, i) => (
                <View key={i} style={styles.tr}>
                  <Text style={styles.td}>{d.tipoNombre}</Text>
                  <Text style={styles.td}>{d.numeroDocumento ?? "—"}</Text>
                  <Text style={styles.td}>{formatearFecha(d.fechaVencimiento)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.descripcion}>Sin documentación vigente cargada.</Text>
          )}
        </View>

        <Text style={styles.footer}>TruckGuard · Reporte de trazabilidad generado automáticamente</Text>
      </Page>
    </Document>
  );
}
