import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LogoutButton } from "@/components/logout-button";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";

export default async function PlataformaLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.rol !== "SUPERADMIN") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b bg-card px-6 py-3.5">
        <div className="flex items-center gap-3">
          <Logo textClassName="text-base" />
          <Badge variant="secondary">Superadmin</Badge>
        </div>
        <LogoutButton />
      </header>
      <main className="mx-auto max-w-4xl p-6">{children}</main>
    </div>
  );
}
