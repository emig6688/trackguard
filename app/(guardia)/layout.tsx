import Link from "next/link";
import { requireEmpresa, ROLES_GUARDIA } from "@/lib/permisos";
import { Logo } from "@/components/brand/logo";
import { LogoutButton } from "@/components/logout-button";
import { NotificationBell } from "@/components/notificaciones/notification-bell";
import { PushToggle } from "@/components/notificaciones/push-toggle";
import { ROL_LABEL } from "@/lib/roles";

export default async function GuardiaLayout({ children }: { children: React.ReactNode }) {
  const { user: session } = await requireEmpresa(ROLES_GUARDIA);
  const esGuardia = session.rol === "GUARDIA";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b bg-sidebar text-sidebar-foreground">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <Logo textClassName="text-sidebar-foreground text-base" />
            <span className="text-sm text-sidebar-foreground/70">
              {session.nombre} · {ROL_LABEL[session.rol]}
            </span>
            {!esGuardia && (
              <Link
                href="/dashboard"
                className="text-sm text-sidebar-foreground/70 underline-offset-2 hover:text-sidebar-foreground hover:underline"
              >
                Volver al panel
              </Link>
            )}
          </div>
          <div className="flex items-center gap-1">
            <PushToggle />
            <NotificationBell />
            <LogoutButton />
          </div>
        </div>
        <nav className="flex gap-4 px-6 pb-3 text-sm font-medium">
          <Link href="/guardia" className="text-sidebar-foreground/80 hover:text-sidebar-foreground">
            Vehículos
          </Link>
          <Link
            href="/guardia/devoluciones"
            className="text-sidebar-foreground/80 hover:text-sidebar-foreground"
          >
            Devoluciones
          </Link>
        </nav>
      </header>
      <main className="flex-1 animate-in fade-in duration-300 p-6">{children}</main>
    </div>
  );
}
