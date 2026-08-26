import * as Sentry from "@sentry/nextjs";

// Sin NEXT_PUBLIC_SENTRY_DSN configurado, Sentry.init con dsn vacío queda
// inerte (no manda nada, no tira error) — mismo criterio que
// OPENAI_API_KEY/RESEND_API_KEY en el resto de la app: funciona sin
// configurar, se activa solo al cargar la variable de entorno.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // 100% en dev para no perderse nada mientras se prueba; bajo en
  // producción porque cada transacción de performance cuenta contra la
  // cuota gratuita de Sentry.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,
  // Session Replay y Feedback quedan afuera a propósito: más cuota
  // consumida y no los pidieron — se puede sumar después si hace falta.
  debug: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
