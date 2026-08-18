import Link from "next/link";
import { requireEmpresa } from "@/lib/permisos";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BackToDashboard } from "@/components/back-to-dashboard";
import { AREA_REPARACION_LABEL } from "@/lib/clasificador-averias";
import {
  condicionOTAtrasada,
  condicionOTSinFechaEstimada,
  otEstaAtrasada,
  fechaReferenciaAtraso,
  condicionVisibleParaMecanico,
  puedeMecanicoAccionar,
} from "@/lib/ot";
import { FinalizarOTDialog } from "@/components/ordenes-trabajo/finalizar-ot-dialog";
import { IniciarOTDialog } from "@/components/ordenes-trabajo/iniciar-ot-dialog";
import { OrigenOTBadge } from "@/components/ordenes-trabajo/origen-ot-badge";
import { FiltrosOT } from "@/components/ordenes-trabajo/filtros-ot";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EstadoOT, PrioridadOT, Prisma } from "@/app/generated/prisma/client";

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

const PRIORIDAD_LABEL: Record<PrioridadOT, string> = {
  BAJA: "Baja",
  MEDIA: "Media",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

const PRIORIDAD_VARIANT: Record<
  PrioridadOT,
  "default" | "secondary" | "destructive" | "outline" | "success" | "warning"
> = {
  BAJA: "success",
  MEDIA: "secondary",
  ALTA: "warning",
  URGENTE: "destructive",
};

// El borde de "tr" no se ve con border-collapse (preflight de Tailwind lo fuerza
// en <table>), así que el acento de color va en la primera celda, no en la fila.
// "default" (naranja marca) queda descartado para prioridad: es sólido y se
// confunde con "warning" a simple vista, así que media usa un gris neutro.
const PRIORIDAD_ROW_BG: Record<PrioridadOT, string> = {
  BAJA: "",
  MEDIA: "",
  ALTA: "bg-warning/5",
  URGENTE: "bg-destructive/5",
};

const PRIORIDAD_ACCENT_CLASS: Record<PrioridadOT, string> = {
  BAJA: "border-l-4 border-l-success/60 pl-2.5",
  MEDIA: "border-l-4 border-l-muted-foreground/30 pl-2.5",
  ALTA: "border-l-4 border-l-warning pl-2.5",
  URGENTE: "border-l-4 border-l-destructive pl-2.5",
};

export default async function OrdenesTrabajoPage({
  searchParams,
}: {
  searchParams: Promise<{
    estado?: string;
    prioridad?: string;
    atraso?: string;
    sinFecha?: string;
    chofer?: string;
    numero?: string;
  }>;
}) {
  const { user: session, prisma } = await requireEmpresa();
  const {
    estado: filtroEstado,
    prioridad: filtroPrioridad,
    atraso: filtroAtraso,
    sinFecha: filtroSinFecha,
    chofer: filtroChoferId,
    numero: filtroNumero,
  } = await searchParams;
  const rol = session.rol;
  const esMecanico = rol === "MECANICO_INTERNO";
  const puedeGestionar = rol === "ADMIN" || rol === "ENCARGADO_MANTENIMIENTO";
  const puedeCrear = puedeGestionar;
  const soloAtrasadas = filtroAtraso === "1";
  const soloSinFecha = filtroSinFecha === "1";

  const ahoraDate = new Date();
  // Se combinan con AND (no spread) porque tanto condicionVisibleParaMecanico
  // como condicionOTAtrasada devuelven su propia clave "OR" — si se
  // mezclaran en el mismo objeto, la segunda pisaría a la primera y un
  // mecánico vería OT atrasadas de otros al filtrar por "Con atraso".
  const condiciones: Prisma.OrdenDeTrabajoWhereInput[] = [{ eliminadoEn: null }];
  if (filtroEstado) condiciones.push({ estado: filtroEstado as EstadoOT });
  if (filtroPrioridad) condiciones.push({ prioridad: filtroPrioridad as PrioridadOT });
  if (esMecanico) condiciones.push(condicionVisibleParaMecanico(session.id));
  if (soloAtrasadas) condiciones.push(condicionOTAtrasada(ahoraDate));
  if (soloSinFecha) condiciones.push(condicionOTSinFechaEstimada());
  if (filtroChoferId) {
    condiciones.push({
      OR: [
        { checklistRealizado: { choferId: filtroChoferId } },
        { eventoRuta: { choferId: filtroChoferId } },
      ],
    });
  }
  if (filtroNumero) condiciones.push({ numero: { contains: filtroNumero, mode: "insensitive" } });

  const [ordenes, choferes, numerosDisponibles] = await Promise.all([
    prisma.ordenDeTrabajo.findMany({
      where: { AND: condiciones },
      include: {
        vehiculo: true,
        asignadoA: true,
        itemsPreventivos: { select: { resultado: true } },
      },
      orderBy: [{ prioridad: "desc" }, { createdAt: "desc" }],
    }),
    prisma.usuario.findMany({
      where: { rol: "CHOFER", activo: true, eliminadoEn: null },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.ordenDeTrabajo.findMany({
      where: { eliminadoEn: null },
      select: { numero: true },
      orderBy: { numero: "desc" },
    }),
  ]);

  const ESTADOS: EstadoOT[] = [
    "PENDIENTE_APROBACION",
    "APROBADA",
    "EN_PROGRESO",
    "DERIVADA_EXTERNO",
    "COMPLETADA",
    "CANCELADA",
  ];
  const PRIORIDADES: PrioridadOT[] = ["URGENTE", "ALTA", "MEDIA", "BAJA"];

  const construirHref = (params: {
    estado?: string;
    prioridad?: string;
    atraso?: string;
    sinFecha?: string;
  }) => {
    const query = new URLSearchParams();
    const estado = "estado" in params ? params.estado : filtroEstado;
    const prioridad = "prioridad" in params ? params.prioridad : filtroPrioridad;
    const atraso = "atraso" in params ? params.atraso : filtroAtraso;
    const sinFecha = "sinFecha" in params ? params.sinFecha : filtroSinFecha;
    if (estado) query.set("estado", estado);
    if (prioridad) query.set("prioridad", prioridad);
    if (atraso) query.set("atraso", atraso);
    if (sinFecha) query.set("sinFecha", sinFecha);
    const queryString = query.toString();
    return queryString ? `/ordenes-trabajo?${queryString}` : "/ordenes-trabajo";
  };

  return (
    <div className="space-y-6">
      <BackToDashboard />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {esMecanico ? "Mis órdenes de trabajo" : "Órdenes de trabajo"}
        </h1>
        <div className="flex gap-2">
          {!esMecanico && (
            <a href="/api/export/ordenes-trabajo" className={buttonVariants({ variant: "outline" })}>
              Exportar CSV
            </a>
          )}
          {puedeCrear && (
            <Link href="/ordenes-trabajo/nueva" className={buttonVariants()}>
              Nueva OT
            </Link>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Link href={construirHref({ estado: undefined })}>
            <Badge variant={!filtroEstado ? "default" : "outline"}>Todas</Badge>
          </Link>
          {ESTADOS.map((estado) => (
            <Link key={estado} href={construirHref({ estado })}>
              <Badge variant={filtroEstado === estado ? ESTADO_VARIANT[estado] : "outline"}>
                {ESTADO_LABEL[estado]}
              </Badge>
            </Link>
          ))}
          <Link href={construirHref({ atraso: soloAtrasadas ? undefined : "1" })}>
            <Badge variant={soloAtrasadas ? "destructive" : "outline"}>Con atraso</Badge>
          </Link>
          <Link href={construirHref({ sinFecha: soloSinFecha ? undefined : "1" })}>
            <Badge variant={soloSinFecha ? "warning" : "outline"}>Sin fecha estimada</Badge>
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Prioridad:</span>
          <Link href={construirHref({ prioridad: undefined })}>
            <Badge variant={!filtroPrioridad ? "default" : "outline"}>Todas</Badge>
          </Link>
          {PRIORIDADES.map((prioridad) => (
            <Link key={prioridad} href={construirHref({ prioridad })}>
              <Badge variant={filtroPrioridad === prioridad ? PRIORIDAD_VARIANT[prioridad] : "outline"}>
                {PRIORIDAD_LABEL[prioridad]}
              </Badge>
            </Link>
          ))}
        </div>
        <FiltrosOT choferes={choferes} numeros={numerosDisponibles.map((o) => o.numero)} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Número</TableHead>
            <TableHead>Vehículo</TableHead>
            <TableHead>Título</TableHead>
            <TableHead>Área</TableHead>
            <TableHead>Prioridad</TableHead>
            <TableHead>Asignado a</TableHead>
            <TableHead>Fecha estimada</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ordenes.map((ot) => {
            const atrasada = otEstaAtrasada(ot, ahoraDate);
            const fechaMostrada = fechaReferenciaAtraso(ot);
            const puedeComenzar =
              ot.estado === "APROBADA" &&
              (puedeGestionar || (esMecanico && puedeMecanicoAccionar(ot, session.id)));
            const puedeFinalizar =
              ot.estado === "EN_PROGRESO" &&
              (puedeGestionar || (esMecanico && puedeMecanicoAccionar(ot, session.id)));
            return (
              <TableRow key={ot.id} className={PRIORIDAD_ROW_BG[ot.prioridad]}>
                <TableCell className={PRIORIDAD_ACCENT_CLASS[ot.prioridad]}>
                  <Link href={`/ordenes-trabajo/${ot.id}`} className="font-medium hover:underline">
                    {ot.numero}
                  </Link>
                </TableCell>
                <TableCell>{ot.vehiculo.patente}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span>{ot.titulo}</span>
                    <OrigenOTBadge origen={ot.origen} />
                    {ot.itemsPreventivos.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {ot.itemsPreventivos.filter((i) => i.resultado !== "PENDIENTE").length}/
                        {ot.itemsPreventivos.length} revisados
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>{ot.areaReparacion ? AREA_REPARACION_LABEL[ot.areaReparacion] : "—"}</TableCell>
                <TableCell>
                  <Badge variant={PRIORIDAD_VARIANT[ot.prioridad]}>{PRIORIDAD_LABEL[ot.prioridad]}</Badge>
                </TableCell>
                <TableCell>{ot.asignadoA?.nombre ?? "—"}</TableCell>
                <TableCell>
                  {fechaMostrada ? (
                    <span className={atrasada ? "font-medium text-destructive" : ""}>
                      {fechaMostrada.toLocaleDateString("es-AR")}
                      {atrasada ? " · Atrasada" : ""}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={ESTADO_VARIANT[ot.estado]}>{ESTADO_LABEL[ot.estado]}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {puedeComenzar && <IniciarOTDialog otId={ot.id} numero={ot.numero} />}
                    {puedeFinalizar && <FinalizarOTDialog otId={ot.id} numero={ot.numero} />}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {ordenes.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground">
                No hay órdenes de trabajo para mostrar.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
