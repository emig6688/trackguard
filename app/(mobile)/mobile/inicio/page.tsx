import Link from "next/link";
import { ClipboardCheck, Fuel, TriangleAlert, Receipt, Wrench } from "lucide-react";
import { requireEmpresa } from "@/lib/permisos";
import { checklistObligatorioPendiente, vehiculoActivoParaCierre, MOTIVO_CHECKLIST_PENDIENTE } from "@/lib/checklist";
import { SinNovedadesForm } from "./sin-novedades-form";
import { AccesosList } from "./accesos-list";

const ICON_PROPS = { className: "size-5", strokeWidth: 2 } as const;

const ACCESOS = [
  {
    href: "/mobile/combustible",
    label: "Cargar combustible",
    desc: "Foto del ticket + km actual",
    icon: <Fuel {...ICON_PROPS} />,
  },
  {
    href: "/mobile/evento",
    label: "Cierre ruta",
    desc: "Reportar un desperfecto — al terminar el reparto, suma horas del equipo de frío",
    icon: <TriangleAlert {...ICON_PROPS} />,
  },
  {
    href: "/mobile/gastos",
    label: "Cargar gasto",
    desc: "Peajes, viáticos, etc.",
    icon: <Receipt {...ICON_PROPS} />,
  },
];

export default async function MobileInicioPage() {
  const { user: session, prisma } = await requireEmpresa();

  const reparacionesPendientes = await prisma.ordenDeTrabajo.count({
    where: {
      eliminadoEn: null,
      estado: "COMPLETADA",
      confirmacionReparacion: "PENDIENTE",
      OR: [
        { eventoRuta: { choferId: session.id } },
        { checklistRealizado: { choferId: session.id } },
      ],
    },
  });

  const bloqueado =
    session.rol === "CHOFER" && (await checklistObligatorioPendiente(prisma, session.empresaId!, session.id));

  const vehiculoActivo =
    session.rol === "CHOFER" && !bloqueado ? await vehiculoActivoParaCierre(prisma, session.id) : null;
  const sinRondaAbierta = session.rol === "CHOFER" && !bloqueado && !vehiculoActivo;
  const MOTIVO_SIN_RONDA =
    "No tenés ningún reparto abierto — hacé el checklist pre-salida del vehículo con el que vas a salir primero.";

  const vehiculos =
    session.rol === "CHOFER"
      ? []
      : await prisma.vehiculo.findMany({ where: { activo: true, eliminadoEn: null }, orderBy: { patente: "asc" } });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Hola, {session.nombre}</h1>

      {bloqueado && (
        <p className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm text-warning-foreground">
          {MOTIVO_CHECKLIST_PENDIENTE} El resto de las opciones queda deshabilitado hasta que lo hagas.
        </p>
      )}

      <Link
        href="/mobile/checklist"
        className="flex items-center gap-4 rounded-lg border p-4 transition-colors duration-150 hover:bg-accent active:scale-[0.98] active:bg-accent"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <ClipboardCheck className="size-5" strokeWidth={2} />
        </span>
        <span>
          <p className="font-medium">Checklist pre-salida</p>
          <p className="text-sm text-muted-foreground">Control del camión antes de salir</p>
        </span>
      </Link>

      <SinNovedadesForm
        vehiculos={vehiculos}
        vehiculoActivo={vehiculoActivo}
        bloqueado={bloqueado || sinRondaAbierta}
        motivo={bloqueado ? MOTIVO_CHECKLIST_PENDIENTE : MOTIVO_SIN_RONDA}
      />

      <AccesosList accesos={ACCESOS} bloqueado={bloqueado} motivo={MOTIVO_CHECKLIST_PENDIENTE} />

      {/* Sin checklist pre-salida, esto queda como la única opción disponible:
          el chofer necesita poder confirmar/rechazar una reparación ya hecha
          aunque todavía no haya arrancado el día de hoy. */}
      <Link
        href="/mobile/reparaciones"
        className="flex items-center gap-4 rounded-lg border p-4 transition-colors duration-150 hover:bg-accent active:scale-[0.98] active:bg-accent"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Wrench className="size-5" strokeWidth={2} />
        </span>
        <span>
          <p className="font-medium">Confirmar reparaciones</p>
          <p className="text-sm text-muted-foreground">
            {reparacionesPendientes > 0
              ? `${reparacionesPendientes} esperando tu confirmación`
              : "Revisá si tus novedades ya se resolvieron"}
          </p>
        </span>
      </Link>
    </div>
  );
}
