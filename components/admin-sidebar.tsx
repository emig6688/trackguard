"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, LogOut, Menu, X } from "lucide-react";
import { AdminNav, ICONOS, estaActivo, type NavEntry, type NavGroup } from "@/components/admin-nav";
import { Logo } from "@/components/brand/logo";
import { logoutAction } from "@/app/_actions/auth";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "tg-sidebar-collapsed";
const listeners = new Set<() => void>();

function suscribir(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function leerColapsado() {
  return localStorage.getItem(STORAGE_KEY) === "1";
}

function leerColapsadoServidor() {
  return false;
}

function escribirColapsado(valor: boolean) {
  localStorage.setItem(STORAGE_KEY, valor ? "1" : "0");
  listeners.forEach((listener) => listener());
}

// Estado del drawer en mobile: a diferencia de `colapsado`, es transitorio
// (en memoria, no localStorage) — cada carga de página arranca cerrado.
let sidebarMobileAbierto = false;
const listenersMobile = new Set<() => void>();

function suscribirMobile(listener: () => void) {
  listenersMobile.add(listener);
  return () => listenersMobile.delete(listener);
}

function leerAbiertoMobile() {
  return sidebarMobileAbierto;
}

function leerAbiertoMobileServidor() {
  return false;
}

function escribirAbiertoMobile(valor: boolean) {
  sidebarMobileAbierto = valor;
  listenersMobile.forEach((listener) => listener());
}

export function useSidebarMobileAbierto() {
  return useSyncExternalStore(suscribirMobile, leerAbiertoMobile, leerAbiertoMobileServidor);
}

export function abrirSidebarMobile() {
  escribirAbiertoMobile(true);
}

export function cerrarSidebarMobile() {
  escribirAbiertoMobile(false);
}

function esGrupo(entry: NavEntry): entry is NavGroup {
  return "items" in entry;
}

/** Botón hamburguesa del header — visible solo en mobile. */
export function SidebarMobileToggle() {
  return (
    <button
      type="button"
      onClick={abrirSidebarMobile}
      title="Abrir menú"
      className="flex size-9 shrink-0 items-center justify-center rounded-md text-foreground/70 hover:bg-accent md:hidden"
    >
      <Menu className="size-5" />
    </button>
  );
}

/**
 * Drawer off-canvas para mobile (< md) — independiente del colapsado de
 * desktop, siempre muestra la nav completa. Arranca cerrado en cada carga
 * de página y se cierra solo al navegar.
 */
function SidebarMobileDrawer({ items }: { items: NavEntry[] }) {
  const abierto = useSidebarMobileAbierto();
  const pathname = usePathname();

  useEffect(() => {
    cerrarSidebarMobile();
  }, [pathname]);

  return (
    <div className="md:hidden">
      {abierto && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={cerrarSidebarMobile}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen w-72 shrink-0 flex-col bg-sidebar text-sidebar-foreground shadow-[1px_0_0_0_var(--sidebar-border)] transition-transform duration-200",
          abierto ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-sidebar-border px-4 py-5">
          <Logo textClassName="text-sidebar-foreground text-base" />
          <button
            type="button"
            onClick={cerrarSidebarMobile}
            title="Cerrar menú"
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <AdminNav items={items} />
        </div>
        <form action={logoutAction} className="shrink-0 border-t border-sidebar-border p-3">
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors duration-150 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
          >
            <LogOut className="size-4" />
            Cerrar sesión
          </button>
        </form>
      </aside>
    </div>
  );
}

export function AdminSidebar({ items }: { items: NavEntry[] }) {
  const colapsado = useSyncExternalStore(suscribir, leerColapsado, leerColapsadoServidor);
  const pathname = usePathname();

  function alternar() {
    escribirColapsado(!colapsado);
  }

  if (colapsado) {
    return (
      <>
        <SidebarMobileDrawer items={items} />
        <aside className="sticky top-0 hidden h-screen w-12 shrink-0 flex-col items-center bg-sidebar text-sidebar-foreground shadow-[1px_0_0_0_var(--sidebar-border)] md:flex">
        <button
          type="button"
          onClick={alternar}
          title="Mostrar menú"
          className="flex h-12 w-full shrink-0 items-center justify-center text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
        >
          <ChevronRight className="size-4" />
        </button>
        <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto py-2">
          {items.map((entry) => {
            if (esGrupo(entry)) {
              const Icon = entry.icon ? ICONOS[entry.icon] : undefined;
              const contieneActivo = entry.items.some((i) => estaActivo(pathname, i.href));
              return (
                <button
                  key={entry.label}
                  type="button"
                  onClick={alternar}
                  title={`${entry.label} (expandir menú)`}
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-md transition-colors duration-150",
                    contieneActivo
                      ? "bg-sidebar-accent text-sidebar-primary"
                      : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                  )}
                >
                  {Icon && <Icon className="size-4" />}
                </button>
              );
            }

            const Icon = entry.icon ? ICONOS[entry.icon] : undefined;
            const activo = estaActivo(pathname, entry.href);
            return (
              <Link
                key={entry.href}
                href={entry.href}
                title={entry.label}
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-md transition-colors duration-150",
                  activo
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )}
              >
                {Icon && <Icon className="size-4" />}
              </Link>
            );
          })}
        </nav>
        <form action={logoutAction} className="w-full shrink-0 border-t border-sidebar-border p-2">
          <button
            type="submit"
            title="Cerrar sesión"
            className="flex size-9 items-center justify-center rounded-md text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
          >
            <LogOut className="size-4" />
          </button>
        </form>
      </aside>
      </>
    );
  }

  return (
    <>
      <SidebarMobileDrawer items={items} />
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground shadow-[1px_0_0_0_var(--sidebar-border)] md:flex">
      <div className="flex shrink-0 items-center justify-between border-b border-sidebar-border px-4 py-5">
        <Logo textClassName="text-sidebar-foreground text-base" />
        <button
          type="button"
          onClick={alternar}
          title="Ocultar menú"
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/50",
            "hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
          )}
        >
          <ChevronLeft className="size-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <AdminNav items={items} />
      </div>
      <form action={logoutAction} className="shrink-0 border-t border-sidebar-border p-3">
        <button
          type="submit"
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors duration-150 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
        >
          <LogOut className="size-4" />
          Cerrar sesión
        </button>
      </form>
      </aside>
    </>
  );
}
