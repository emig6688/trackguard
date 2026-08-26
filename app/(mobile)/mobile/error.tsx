"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";

export default function MobileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <h1 className="text-lg font-semibold">Algo salió mal</h1>
      <p className="text-sm text-muted-foreground">
        Ocurrió un error inesperado. Podés intentar de nuevo.
      </p>
      <Button onClick={reset} className="w-full">
        Reintentar
      </Button>
    </div>
  );
}
