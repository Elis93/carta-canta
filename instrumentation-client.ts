// ============================================================
// Sentry — inizializzazione lato CLIENT (browser).
// GATED via NEXT_PUBLIC_SENTRY_DSN (inlined a build-time): se la chiave
// non c'è, il ramo è dead-code e Sentry NON entra nel bundle → zero peso
// e zero tracciamento finché non si configura la chiave.
// ============================================================

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  void import('@sentry/nextjs').then((Sentry) => {
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
      // Session Replay disattivato di default (privacy + peso)
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      sendDefaultPii: false,
      environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
    })
  })
}
