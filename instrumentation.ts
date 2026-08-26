import * as Sentry from "@sentry/nextjs";

/**
 * Next.js llama a register() una vez al arrancar cada runtime — server
 * (nodejs) y edge son procesos separados, cada uno con su propio init de
 * Sentry (sentry.server.config.ts / sentry.edge.config.ts). proxy.ts corre
 * en edge; todo lo demás (Server Components, Route Handlers, Server
 * Actions, los 6 crons) corre en nodejs.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
