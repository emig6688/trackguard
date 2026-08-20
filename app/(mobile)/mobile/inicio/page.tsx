import Link from "next/link";
import { ClipboardCheck, Fuel, TriangleAlert, Receipt, Wrench } from "lucide-react";
import { requireEmpresa } from "@/lib/permisos";
import { checklistObligatorioPendiente, MOTIVO_CHECKLIST_PENDIENTE } from "@/lib/checklist";
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

  const vehiculos = await prisma.vehiculo.findMany({
    where: { activo: true, eliminadoEn: null },
    orderBy: { patente: "asc" },
  });

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

  const accesos = [
    ...ACCESOS,
    {
      href: "/mobile/reparaciones",
      label: "Confirmar reparaciones",
      desc:
        reparacionesPendientes > 0
          ? `${reparacionesPendientes} esperando tu confirmación`
          : "Revisá si tus novedades ya se resolvieron",
      icon: <Wrench {...ICON_PROPS} />,
    },
  ];

  const bloqueado =
    session.rol === "CHOFER" && (await checklistObligatorioPendiente(prisma, session.empresaId!, session.id));

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

      <SinNovedadesForm vehiculos={vehiculos} bloqueado={bloqueado} motivo={MOTIVO_CHECKLIST_PENDIENTE} />

      <AccesosList accesos={accesos} bloqueado={bloqueado} motivo={MOTIVO_CHECKLIST_PENDIENTE} />
    </div>
  );
}
