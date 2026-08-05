// ============================================================
// POST /api/csp-report — raccolta delle violazioni della CSP.
//
// PERCHÉ ESISTE: la Content-Security-Policy vera è ancora permissiva sugli
// script (serve a non rompere Turnstile, Stripe, Supabase…), e stringerla al
// buio significherebbe scoprire in produzione che il login non funziona più.
// Quindi accanto a quella attiva viaggia una policy STRETTA in modalità
// `Report-Only`: non blocca nulla, ma ogni risorsa che la violerebbe finisce
// qui. Dopo qualche giorno di traffico vero, se il registro resta pulito, la
// policy stretta può diventare quella effettiva (next.config.ts).
//
// Non salva niente nel database: scrive nei log di Vercel (Observability →
// Logs, cerca "[csp]"). È un endpoint pubblico, quindi tratta il corpo come
// non fidato: nessun uso dei dati oltre il log troncato.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { checkPublicRateLimit } from '@/lib/public-rate-limit'
import { clientIpFrom } from '@/lib/client-ip'

// Il corpo di un report è piccolo: oltre questa soglia è rumore o abuso.
const MAX_BODY = 8_000

export async function POST(request: NextRequest) {
  // Silenzioso in ogni caso: un browser che riporta una violazione non deve
  // ricevere errori, e chi provasse a inondarci non deve ottenere risposte
  // diverse (nessun segnale utile all'attaccante).
  const ip = clientIpFrom(request.headers)
  const rl = await checkPublicRateLimit({ key: `csp:${ip ?? 'sconosciuto'}`, limit: 30, window: '1 h', windowMs: 3_600_000 })
  if (rl.blocked) return new NextResponse(null, { status: 204 })

  try {
    const raw = await request.text()
    // ⚠️ Tagliare PRIMA di JSON.parse spezzerebbe i report legittimi grossi
    // (capita con `script-sample`): diventerebbero JSON invalido e finirebbero
    // scartati in silenzio, cioè proprio i casi che vogliamo vedere. Meglio
    // dirlo nel registro e non parsarli affatto.
    if (raw.length > MAX_BODY) {
      console.warn(`[csp] report troppo grande (${raw.length} byte): ignorato`)
    } else if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      // Due formati in giro: `csp-report` (classico) e Reporting API (array).
      const r = (parsed['csp-report'] ?? parsed) as Record<string, unknown>
      const pick = (k: string, k2: string) => String(r[k] ?? r[k2] ?? '').slice(0, 200)
      console.warn('[csp] violazione:', JSON.stringify({
        directive: pick('violated-directive', 'effectiveDirective'),
        blocked: pick('blocked-uri', 'blockedURL'),
        document: pick('document-uri', 'documentURL'),
        // Anche questo passa da String()+taglio come gli altri: è l'unico
        // campo che arrivava grezzo, e il corpo non è fidato.
        line: pick('line-number', 'lineNumber'),
      }))
    }
  } catch {
    // Corpo illeggibile: non è un problema nostro, si ignora.
  }

  return new NextResponse(null, { status: 204 })
}
