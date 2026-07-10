// ============================================================
// ⚠️ TEMPORANEO — sonda di verifica per Sentry.
// Invia UN evento di test a Sentry per confermare che DSN e trasporto
// funzionino in produzione. Protetto da chiave così non è attivabile
// da bot/estranei. DA RIMUOVERE subito dopo la verifica.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get('key') !== 'cc-sentry-probe-2026') {
    return NextResponse.json({ ok: false }, { status: 404 })
  }

  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) {
    return NextResponse.json({ sent: false, reason: 'DSN non configurato' }, { status: 200 })
  }

  const Sentry = await import('@sentry/nextjs')
  Sentry.captureException(new Error('Carta Canta — Sentry probe (evento di test, ignorare)'))
  await Sentry.flush(3000)
  return NextResponse.json({ sent: true })
}
