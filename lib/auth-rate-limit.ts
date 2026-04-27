import { Ratelimit } from '@upstash/ratelimit'
import { headers } from 'next/headers'
import { getRedis } from './redis'
import { checkRateLimit } from './rate-limit'

/** Estrae l'IP reale dal proxy header Vercel / Cloudflare */
async function getClientIp(): Promise<string> {
  const h = await headers()
  const xff = h.get('x-forwarded-for')
  return xff?.split(',')[0]?.trim() ?? 'anonymous'
}

interface AuthLimitConfig {
  /** Chiave logica dell'azione, es. "login" | "signup" */
  action: string
  /** Numero massimo di tentativi consentiti nella finestra */
  requests: number
  /** Finestra Upstash sliding-window, es. "15 m" | "1 h" */
  window: `${number} ${'s' | 'm' | 'h'}`
  /** Finestra fallback in-memory in millisecondi */
  windowMs: number
}

/**
 * Controlla il rate limit per un'azione auth.
 *
 * Priorità:
 *  1. Upstash Redis (se configurato) — durevole, multi-istanza, sopravvive ai deploy
 *  2. In-memory checkRateLimit — fallback se Redis non è configurato
 *
 * Fail-open: se Redis risponde con un errore imprevisto la request passa,
 * per non bloccare utenti legittimi a causa di un'interruzione del servizio.
 *
 * @returns true se il request deve essere bloccato
 */
export async function isAuthRateLimited(cfg: AuthLimitConfig): Promise<boolean> {
  const ip  = await getClientIp()
  const key = `auth:${cfg.action}:${ip}`

  const redis = getRedis()

  if (redis) {
    try {
      const limiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(cfg.requests, cfg.window),
        prefix: 'cc',
      })
      const { success } = await limiter.limit(key)
      return !success
    } catch {
      // Redis down / rete irraggiungibile → fail-open
      return false
    }
  }

  // Fallback in-memory (si azzera ad ogni cold start — meglio di niente)
  const result = checkRateLimit(key, { limit: cfg.requests, windowMs: cfg.windowMs })
  return !result.success
}
