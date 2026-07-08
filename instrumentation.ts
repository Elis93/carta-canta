// ============================================================
// Sentry — strumentazione server/edge (Next.js instrumentation hook).
// GATED: senza DSN configurato non carica né esegue nulla di Sentry.
// ============================================================

const DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN

export async function register() {
  if (!DSN) return
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

// Cattura gli errori delle richieste server (App Router). No-op senza DSN.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- firma passata a Sentry as-is
export async function onRequestError(...args: any[]) {
  if (!DSN) return
  const Sentry = await import('@sentry/nextjs')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(Sentry.captureRequestError as any)(...args)
}
