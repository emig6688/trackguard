"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Se dispara solo cuando falla el layout raíz en sí (app/layout.tsx) — un
 * caso mucho más raro que los errores normales que ya cubre app/error.tsx.
 * Al reemplazar el layout raíz, tiene que traer su propio <html>/<body>.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    console.error(error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
          <h1 className="text-xl font-semibold">Algo salió mal</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            Ocurrió un error inesperado. Recargá la página en unos minutos.
          </p>
        </div>
      </body>
    </html>
  );
}
