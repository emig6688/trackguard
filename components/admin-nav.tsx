"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  LayoutDashboard,
  CalendarClock,
  Settings,
  Wrench,
  Truck,
  UserRound,
  Users,
  Building2,
  Package,
  ShoppingCart,
  FileText,
  CircleDollarSign,
  Fuel,
  Receipt,
  BarChart3,
  Trash2,
  ListChecks,
  Bell,
  LineChart,
  ShieldCheck,
  Shield,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const ICONOS = {
  dashboard: LayoutDashboard,
  cronograma: CalendarClock,
  mantenimiento: Settings,
  vehiculos: Truck,
  choferes: UserRound,
  usuarios: Users,
  talleres: Building2,
  panol: Package,
  compras: ShoppingCart,
  documentos: FileText,
  ordenesTrabajo: Wrench,
  costos: CircleDollarSign,
  combustible: Fuel,
  gastos: Receipt,
  reportesCostos: BarChart3,
  papelera: Trash2,
  catalogoEstandar: ListChecks,
  notificaciones: Bell,
  estadisticas: LineChart,
  autorizaciones: ShieldCheck,
  guardia: Shield,
  importar: Upload,
} satisfies Record<string, LucideIcon>;

export type IconKey = keyof typeof ICONOS;
export type NavLink = { href: string; label: string; icon?: IconKey };
export type NavGroup = { label: string; icon?: IconKey; items: NavLink[] };
export type NavEntry = NavLink | NavGroup;

function esGrupo(entry: NavEntry): entry is NavGroup {
  return "items" in entry;
}

export function estaActivo(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav({ items }: { items: NavEntry[] }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-0.5">
      {items.map((entry) =>
        esGrupo(entry) ? (
          <NavGroupItem key={entry.label} grupo={entry} pathname={pathname} />
        ) : (
          <NavLinkItem key={entry.href} item={entry} pathname={pathname} />
        )
      )}
    </nav>
  );
}

function NavLinkItem({ item, pathname }: { item: NavLink; pathname: string }) {
  const activo = estaActivo(pathname, item.href);
  const Icon = item.icon ? ICONOS[item.icon] : undefined;
  return (
    <Link
      href={item.href}
      className={cn(
        "group/navlink relative flex items-center gap-2.5 rounded-md px-3 py-2 font-ui text-sm font-medium transition-colors duration-150",
        activo
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
      )}
    >
      {activo && (
        <span className="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full bg-sidebar-primary" />
      )}
      {Icon && (
        <Icon
          className={cn(
            "size-4 shrink-0 transition-colors duration-150",
            activo ? "text-sidebar-primary" : "text-sidebar-foreground/50 group-hover/navlink:text-sidebar-foreground/80"
          )}
        />
      )}
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function NavGroupItem({ grupo, pathname }: { grupo: NavGroup; pathname: string }) {
  const contieneActivo = grupo.items.some((i) => estaActivo(pathname, i.href));
  const [abierto, setAbierto] = useState(contieneActivo);
  const Icon = grupo.icon ? ICONOS[grupo.icon] : undefined;

  return (
    <div>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-md px-3 py-2 font-ui text-sm font-medium transition-colors duration-150",
          contieneActivo
            ? "text-sidebar-accent-foreground"
            : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
        )}
      >
        {Icon && (
          <Icon
            className={cn(
              "size-4 shrink-0",
              contieneActivo ? "text-sidebar-primary" : "text-sidebar-foreground/50"
            )}
          />
        )}
        <span className="flex-1 truncate text-left">{grupo.label}</span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-sidebar-foreground/40 transition-transform duration-150",
            abierto && "rotate-180"
          )}
        />
      </button>
      {abierto && (
        <div className="mt-0.5 ml-4 space-y-0.5 border-l border-sidebar-border pl-3">
          {grupo.items.map((item) => (
            <NavLinkItem key={item.href} item={item} pathname={pathname} />
          ))}
        </div>
      )}
    </div>
  );
}
