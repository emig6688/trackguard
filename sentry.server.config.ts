import * as Sentry from "@sentry/nextjs";

// Ver instrumentation-client.ts: mismo criterio de "sin DSN, no hace nada".
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,
  debug: false,
});
