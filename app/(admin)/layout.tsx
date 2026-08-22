import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { type NavEntry, type NavLink } from "@/components/admin-nav";
import { AdminSidebar, SidebarMobileToggle } from "@/components/admin-sidebar";
import { NotificationBell } from "@/components/notificaciones/notification-bell";
import { PushToggle } from "@/components/notificaciones/push-toggle";
import { Badge } from "@/components/ui/badge";
import { ROL_LABEL } from "@/lib/roles";
import type { Rol } from "@/app/generated/prisma/client";

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}

function navItemsPorRol(rol: Rol): NavEntry[] {
  const items: NavEntry[] = [{ href: "/dashboard", label: "Dashboard", icon: "dashboard" }];

  const grupoCostos: NavEntry = {
    label: "Costos",
    icon: "costos",
    items: [
      { href: "/combustible", label: "Combustible", icon: "combustible" },
      { href: "/gastos", label: "Gastos", icon: "gastos" },
      { href: "/reportes/costos", label: "Costos", icon: "reportesCostos" },
    ],
  };

  // Mismas pantallas que ve el usuario GUARDIA (/guardia/*, con el rol
  // ampliado en app/(guardia)/layout.tsx) — para que admin y gerencia no
  // necesiten loguearse con ese usuario para ver lo mismo.
  const grupoGuardia: NavEntry = {
    label: "Guardia",
    icon: "guardia",
    items: [
      { href: "/guardia", label: "Vehículos", icon: "vehiculos" },
      { href: "/guardia/devoluciones", label: "Devoluciones", icon: "documentos" },
    ],
  };

  if (rol === "ADMIN" || rol === "ENCARGADO_MANTENIMIENTO") {
    const mantenimientoItems: NavLink[] = [
      { href: "/vehiculos", label: "Vehículos", icon: "vehiculos" },
      { href: "/choferes", label: "Choferes", icon: "choferes" },
      ...(rol === "ADMIN"
        ? [{ href: "/usuarios", label: "Usuarios", icon: "usuarios" as const }]
        : []),
      { href: "/talleres-externos", label: "Talleres externos", icon: "talleres" },
      { href: "/panol", label: "Pañol de repuestos", icon: "panol" },
      {
        href: "/mantenimiento-estandar",
        label: "Plan preventivo estándar",
        icon: "catalogoEstandar",
      },
      { href: "/notificaciones", label: "Parámetros", icon: "notificaciones" },
    ];

    items.push(
      { href: "/cronograma", label: "Cronograma", icon: "cronograma" },
      { label: "Mantenedor", icon: "mantenimiento", items: mantenimientoItems },
      { href: "/documentos", label: "Documentación", icon: "documentos" },
      { href: "/ordenes-trabajo", label: "Órdenes de trabajo", icon: "ordenesTrabajo" },
      { href: "/compras", label: "Compras", icon: "compras" },
      ...(rol === "ADMIN" || rol === "ENCARGADO_MANTENIMIENTO"
        ? [{ href: "/autorizaciones", label: "Autorizaciones", icon: "autorizaciones" as const }]
        : []),
      grupoCostos,
      { href: "/reportes/estadisticas", label: "Estadísticas", icon: "estadisticas" },
      ...(rol === "ADMIN" ? [grupoGuardia] : [])
    );
  } else if (rol === "MECANICO_INTERNO") {
    items.push(
      { href: "/cronograma", label: "Cronograma", icon: "cronograma" },
      { href: "/ordenes-trabajo", label: "Mis órdenes de trabajo", icon: "ordenesTrabajo" }
    );
  } else if (rol === "ENCARGADO_COMPRAS") {
    items.push(
      { href: "/compras", label: "Compras", icon: "compras" },
      { href: "/ordenes-trabajo", label: "Órdenes de trabajo", icon: "ordenesTrabajo" },
      grupoCostos,
      { href: "/reportes/estadisticas", label: "Estadísticas", icon: "estadisticas" }
    );
  } else if (rol === "GERENTE") {
    // GERENTE: mismo criterio de solo lectura que CONTADOR (ve Compras pero
    // sin botones de gestión), más el módulo de Autorizaciones (ver
    // ROLES_AUTORIZAR_COMPRA en lib/permisos.ts — también lo tiene ADMIN).
    items.push(
      { href: "/ordenes-trabajo", label: "Órdenes de trabajo", icon: "ordenesTrabajo" },
      { href: "/documentos", label: "Documentación", icon: "documentos" },
      { href: "/compras", label: "Compras", icon: "compras" },
      { href: "/autorizaciones", label: "Autorizaciones", icon: "autorizaciones" },
      grupoCostos,
      { href: "/reportes/estadisticas", label: "Estadísticas", icon: "estadisticas" },
      grupoGuardia
    );
  } else {
    // CONTADOR: mismo criterio de solo lectura que el resto de la app — ve
    // Compras pero sin botones de gestión (gating ya resuelto en la propia
    // página vía ROLES_COMPRAS/ROLES_CREAR_COMPRA).
    items.push(
      { href: "/ordenes-trabajo", label: "Órdenes de trabajo", icon: "ordenesTrabajo" },
      { href: "/documentos", label: "Documentación", icon: "documentos" },
      { href: "/compras", label: "Compras", icon: "compras" },
      grupoCostos,
      { href: "/reportes/estadisticas", label: "Estadísticas", icon: "estadisticas" }
    );
  }

  if (rol === "ADMIN") {
    items.push({ href: "/papelera", label: "Papelera", icon: "papelera" });
  }

  return items;
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.rol === "SUPERADMIN") redirect("/plataforma");

  const NAV_ITEMS = navItemsPorRol(session.user.rol);

  return (
    <div className="flex min-h-screen">
      <AdminSidebar items={NAV_ITEMS} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/95 px-4 py-3.5 backdrop-blur-sm sm:px-6">
          <div className="flex items-center gap-3">
            <SidebarMobileToggle />
            <div className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {iniciales(session.user.nombre)}
            </div>
            <div className="text-sm">
              <p className="font-medium text-foreground">{session.user.nombre}</p>
              <Badge variant="secondary" className="mt-0.5">
                {ROL_LABEL[session.user.rol]}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <PushToggle />
            <NotificationBell />
          </div>
        </header>
        <main className="flex-1 animate-in fade-in duration-300 p-6">{children}</main>
      </div>
    </div>
  );
}
