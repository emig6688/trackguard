import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function BackToDashboard() {
  return (
    <Link
      href="/dashboard"
      className="-ml-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Volver al dashboard
    </Link>
  );
}
