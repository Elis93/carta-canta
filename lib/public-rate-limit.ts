import { Ratelimit } from '@upstash/ratelimit'
import { getRedis } from './redis'
import { checkRateLimit, rateLimitResponse } from './rate-limit'

// ============================================================
// Rate limit PERSISTENTE per gli endpoint PUBBLICI (senza login):
// accettazione/rifiuto/apertura preventivo, recensione, richiesta
// marketplace, estrazione AI. Usa Upstash Redis (durevole, condiviso
// tra le istanze serverless); se Redis non è configurato ricade sul
// contatore in-memory (per-processo — meglio di niente).
//
// Diverso da lib/rate-limit.ts (solo in-memory): quel modulo su Vercel
// conta da zero a ogni istanza/cold start, quindi i limiti pubblici
// erano di fatto molto più alti del dichiarato.
// ============================================================

interface PublicLimitConfig {
  /** Chiave logica univoca, es. `accept:${token}` o `richiesta:${ip}` */
  key: string
  /** Tentativi consentiti nella finestra */
  limit: number
  /** Finestra Upstash sliding-window, es. "1 h" | "1 m" */
  window: `${number} ${'s' | 'm' | 'h'}`
  /** Finestra fallback in-memory in millisecondi */
  windowMs: number
}

/** @returns { blocked, resetAt } — blocked=true se la richiesta va rifiutata */
export async function checkPublicRateLimit(
  cfg: PublicLimitConfig
): Promise<{ blocked: boolean; resetAt: number }> {
  const redis = getRedis()
  if (redis) {
    try {
      const limiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(cfg.limit, cfg.window),
        prefix: 'ccpub',
      })
      const { success, reset } = await limiter.limit(cfg.key)
      return { blocked: !success, resetAt: reset }
    } catch {
      // Redis down → fail-open (non blocca utenti legittimi)
      return { blocked: false, resetAt: Date.now() }
    }
  }
  const r = checkRateLimit(cfg.key, { limit: cfg.limit, windowMs: cfg.windowMs })
  return { blocked: !r.success, resetAt: r.resetAt }
}

export { rateLimitResponse }
