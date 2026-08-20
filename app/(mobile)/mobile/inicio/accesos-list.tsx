"use client";

import Link from "next/link";
import { toast } from "sonner";
import type { ReactNode } from "react";

type Acceso = { href: string; label: string; desc: string; icon: ReactNode };

export function AccesosList({
  accesos,
  bloqueado,
  motivo,
}: {
  accesos: Acceso[];
  bloqueado: boolean;
  motivo: string;
}) {
  return (
    <div className="grid gap-3">
      {accesos.map((a) =>
        bloqueado ? (
          <button
            key={a.href}
            type="button"
            onClick={() => toast.warning(motivo)}
            className="flex items-center gap-4 rounded-lg border p-4 text-left text-muted-foreground opacity-50"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
              {a.icon}
            </span>
            <span>
              <p className="font-medium">{a.label}</p>
              <p className="text-sm">{a.desc}</p>
            </span>
          </button>
        ) : (
          <Link
            key={a.href}
            href={a.href}
            className="flex items-center gap-4 rounded-lg border p-4 transition-colors duration-150 hover:bg-accent active:scale-[0.98] active:bg-accent"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
              {a.icon}
            </span>
            <span>
              <p className="font-medium">{a.label}</p>
              <p className="text-sm text-muted-foreground">{a.desc}</p>
            </span>
          </Link>
        )
      )}
    </div>
  );
}
