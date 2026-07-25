import { Ratelimit } from '@upstash/ratelimit'
import { headers } from 'next/headers'
import { getRedis } from './redis'
import { checkRateLimit } from './rate-limit'
import { clientIpFrom } from '@/lib/client-ip'

/** Estrae l'IP reale — x-real-ip primario (non spoofabile), vedi lib/client-ip.ts */
async function getClientIp(): Promise<string> {
  const h = await headers()
  return clientIpFrom(h) ?? 'anonymous'
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

// ============================================================
// Contatore LEGGIBILE dei fallimenti di login per IP.
// Lo sliding-window sopra dice solo "sopra/sotto soglia"; qui serve invece
// SAPERE quanti fallimenti ci sono stati, per decidere quando esigere il
// captcha (soglia soft — audit 25 lug). Finestra 15 min (TTL su Redis).
// Fallback in-memory per-istanza se Redis non è configurato.
// ============================================================

/** Dopo quanti fallimenti consecutivi il login richiede il captcha (best practice: 3). */
export const LOGIN_CAPTCHA_THRESHOLD = 3

const FAILCOUNT_WINDOW_S = 15 * 60
const failCountKey = (ip: string) => `cc:auth:login-failcount:${ip}`

const memFailCounts = new Map<string, { count: number; expires: number }>()
function memFailGet(key: string): number {
  const e = memFailCounts.get(key)
  if (!e || e.expires < Date.now()) { memFailCounts.delete(key); return 0 }
  return e.count
}
function memFailIncr(key: string): number {
  const now = Date.now()
  const e = memFailCounts.get(key)
  if (!e || e.expires < now) {
    memFailCounts.set(key, { count: 1, expires: now + FAILCOUNT_WINDOW_S * 1000 })
    return 1
  }
  e.count += 1
  return e.count
}

/** Legge il numero di fallimenti login nell'IP corrente SENZA incrementare. */
export async function getLoginFailureCount(): Promise<number> {
  const ip = await getClientIp()
  const key = failCountKey(ip)
  const redis = getRedis()
  if (redis) {
    try {
      const n = await redis.get<number>(key)
      return typeof n === 'number' ? n : Number(n ?? 0)
    } catch {
      return memFailGet(key)
    }
  }
  return memFailGet(key)
}

/** Incrementa il contatore (chiamare su login FALLITO). Ritorna il nuovo totale. */
export async function recordLoginFailure(): Promise<number> {
  const ip = await getClientIp()
  const key = failCountKey(ip)
  const redis = getRedis()
  if (redis) {
    try {
      const n = await redis.incr(key)
      if (n === 1) await redis.expire(key, FAILCOUNT_WINDOW_S)
      return n
    } catch {
      return memFailIncr(key)
    }
  }
  return memFailIncr(key)
}

/** Azzera il contatore (chiamare su login RIUSCITO). */
export async function clearLoginFailures(): Promise<void> {
  const ip = await getClientIp()
  const key = failCountKey(ip)
  const redis = getRedis()
  if (redis) {
    try { await redis.del(key) } catch { /* noop */ }
    return
  }
  memFailCounts.delete(key)
}
