"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export function MobileBackLink() {
  const pathname = usePathname();
  if (pathname === "/mobile/inicio") return null;

  return (
    <div className="border-t border-sidebar-border/50 px-4 py-2">
      <Link
        href="/mobile/inicio"
        className="flex items-center gap-1 text-sm text-sidebar-foreground/80 hover:text-sidebar-foreground"
      >
        <ChevronLeft className="size-4" />
        Menú
      </Link>
    </div>
  );
}
