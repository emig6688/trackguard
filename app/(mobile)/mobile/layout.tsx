import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LogoutButton } from "@/components/logout-button";
import { Logo } from "@/components/brand/logo";
import { MobileBackLink } from "@/components/mobile-back-link";
import { NotificationBell } from "@/components/notificaciones/notification-bell";
import { PushToggle } from "@/components/notificaciones/push-toggle";

export default async function MobileLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
      <header className="bg-sidebar text-sidebar-foreground">
        <div className="flex items-center justify-between p-4">
          <Logo textClassName="hidden" markClassName="size-9" />
          <div className="flex-1 px-3">
            <p className="text-sm font-semibold">{session.user.nombre}</p>
            <p className="text-xs text-sidebar-foreground/70">{session.user.rol}</p>
          </div>
          <PushToggle />
          <NotificationBell />
          <LogoutButton />
        </div>
        <MobileBackLink />
      </header>
      <main className="flex-1 animate-in fade-in duration-300 p-4">{children}</main>
    </div>
  );
}
