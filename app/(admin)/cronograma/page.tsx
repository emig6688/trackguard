import Link from "next/link";
import { requireEmpresa } from "@/lib/permisos";
import { Badge } from "@/components/ui/badge";
import { GenerarOTButton } from "@/components/cronograma/generar-ot-button";
import { OrigenOTBadge } from "@/components/ordenes-trabajo/origen-ot-badge";
import {
  obtenerCronograma,
  type EventoCronograma,
  type VistaCronograma,
} from "@/lib/cronograma";
import type { EstadoOT } from "@/app/generated/prisma/client";

const VISTAS: { valor: VistaCronograma; label: string }[] = [
  { valor: "DIA", label: "Día" },
  { valor: "SEMANA", label: "Semana" },
  { valor: "MES", label: "Mes" },
];

const ESTADO_LABEL: Record<EstadoOT, string> = {
  PENDIENTE_APROBACION: "Pendiente de aprobación",
  APROBADA: "Aprobada",
  EN_PROGRESO: "En progreso",
  DERIVADA_EXTERNO: "Derivada a externo",
  COMPLETADA: "Completada",
  CANCELADA: "Cancelada",
};

const ESTADO_VARIANT: Record<
  EstadoOT,
  "default" | "secondary" | "destructive" | "outline" | "success" | "warning"
> = {
  PENDIENTE_APROBACION: "warning",
  APROBADA: "secondary",
  EN_PROGRESO: "default",
  DERIVADA_EXTERNO: "outline",
  COMPLETADA: "success",
  CANCELADA: "destructive",
};

function etiquetaDia(fecha: Date) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dia = new Date(fecha);
  dia.setHours(0, 0, 0, 0);
  const diffDias = Math.round((dia.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

  const fechaLarga = dia.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  if (diffDias === 0) return `Hoy · ${fechaLarga}`;
  if (diffDias === 1) return `Mañana · ${fechaLarga}`;
  if (diffDias === -1) return `Ayer · ${fechaLarga}`;
  if (diffDias < 0) return `Vencido hace ${-diffDias} días · ${fechaLarga}`;
  return `En ${diffDias} días · ${fechaLarga}`;
}

function claveDia(fecha: Date) {
  return fecha.toISOString().slice(0, 10);
}

function esVencido(fecha: Date) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return fecha.getTime() < hoy.getTime();
}

function agruparPorDia(eventos: EventoCronograma[]) {
  const grupos = new Map<string, { fecha: Date; eventos: EventoCronograma[] }>();
  for (const evento of eventos) {
    const fecha = evento.fecha as Date;
    const clave = claveDia(fecha);
    if (!grupos.has(clave)) grupos.set(clave, { fecha, eventos: [] });
    grupos.get(clave)!.eventos.push(evento);
  }
  return [...grupos.values()];
}

export default async function CronogramaPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string }>;
}) {
  const { user: session, prisma } = await requireEmpresa();
  const rol = session.rol;
  const userId = session.id;
  const puedeCrear = rol === "ADMIN" || rol === "ENCARGADO_MANTENIMIENTO";

  const { vista: vistaParam } = await searchParams;
  const vista: VistaCronograma =
    vistaParam === "DIA" || vistaParam === "MES" ? vistaParam : "SEMANA";

  const { conFecha, sinFecha } = await obtenerCronograma(prisma, vista, rol, userId);
  const grupos = agruparPorDia(conFecha);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Cronograma de mantenimiento</h1>
        <div className="flex flex-wrap gap-2">
          {VISTAS.map((v) => (
            <Link key={v.valor} href={`/cronograma?vista=${v.valor}`}>
              <Badge variant={vista === v.valor ? "default" : "outline"}>{v.label}</Badge>
            </Link>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {grupos.map(({ fecha, eventos }) => (
          <div key={claveDia(fecha)} className="space-y-2">
            <p className={`text-sm font-semibold ${esVencido(fecha) ? "text-destructive" : ""}`}>
              {etiquetaDia(fecha)}
            </p>
            <div className="space-y-2">
              {eventos.map((evento, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{evento.vehiculoPatente}</span>
                      <span>·</span>
                      <span>{evento.titulo}</span>
                      {evento.categoria && (
                        <Badge variant="secondary" className="text-xs">
                          {evento.categoria}
                        </Badge>
                      )}
                      {evento.tipo === "OT_EXISTENTE" && <OrigenOTBadge origen={evento.origen} />}
                    </div>
                    {evento.tipo === "PREVISTO" && (
                      <p className="text-xs text-muted-foreground">{evento.detalle}</p>
                    )}
                    {evento.tipo === "OT_EXISTENTE" && evento.itemsTotal > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {evento.itemsResueltos}/{evento.itemsTotal} revisados
                      </p>
                    )}
                  </div>
                  {evento.tipo === "OT_EXISTENTE" ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant={ESTADO_VARIANT[evento.estado]}>
                        {ESTADO_LABEL[evento.estado]}
                      </Badge>
                      <Link
                        href={`/ordenes-trabajo/${evento.otId}`}
                        className="text-sm underline"
                      >
                        Ver OT
                      </Link>
                    </div>
                  ) : (
                    puedeCrear && (
                      <div className="shrink-0">
                        <GenerarOTButton planId={evento.planId} redirectPath="/cronograma" />
                      </div>
                    )
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {grupos.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Sin actividades programadas en este período.
          </p>
        )}

        {sinFecha.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold">Según uso (sin fecha estimada)</p>
            <div className="space-y-2">
              {sinFecha.map((evento) => (
                <div
                  key={evento.planId}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{evento.vehiculoPatente}</span>
                      <span>·</span>
                      <span>{evento.titulo}</span>
                      {evento.categoria && (
                        <Badge variant="secondary" className="text-xs">
                          {evento.categoria}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{evento.detalle}</p>
                  </div>
                  {puedeCrear && (
                    <div className="shrink-0">
                      <GenerarOTButton planId={evento.planId} redirectPath="/cronograma" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
