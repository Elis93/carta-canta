// Sentry — inizializzazione lato server (Node runtime).
// Caricato da instrumentation.ts SOLO se il DSN è configurato.
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    // Non inviare dati personali di default (privacy)
    sendDefaultPii: false,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  })
}
