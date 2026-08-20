import Link from "next/link";
import { ClipboardCheck, Fuel, TriangleAlert, Receipt, Wrench } from "lucide-react";
import { requireEmpresa } from "@/lib/permisos";
import { SinNovedadesForm } from "./sin-novedades-form";

const ACCESOS = [
  {
    href: "/mobile/checklist",
    label: "Checklist pre-salida",
    desc: "Control del camión antes de salir",
    icon: ClipboardCheck,
  },
  {
    href: "/mobile/combustible",
    label: "Cargar combustible",
    desc: "Foto del ticket + km actual",
    icon: Fuel,
  },
  {
    href: "/mobile/evento",
    label: "Cierre ruta",
    desc: "Reportar un desperfecto — al terminar el reparto, suma horas del equipo de frío",
    icon: TriangleAlert,
  },
  {
    href: "/mobile/gastos",
    label: "Cargar gasto",
    desc: "Peajes, viáticos, etc.",
    icon: Receipt,
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
      icon: Wrench,
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Hola, {session.nombre}</h1>

      <SinNovedadesForm vehiculos={vehiculos} />

      <div className="grid gap-3">
        {accesos.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="flex items-center gap-4 rounded-lg border p-4 transition-colors duration-150 hover:bg-accent active:scale-[0.98] active:bg-accent"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <a.icon className="size-5" strokeWidth={2} />
            </span>
            <span>
              <p className="font-medium">{a.label}</p>
              <p className="text-sm text-muted-foreground">{a.desc}</p>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
