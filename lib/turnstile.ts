import { headers } from 'next/headers'
import { clientIpFrom } from '@/lib/client-ip'

// ============================================================
// Cloudflare Turnstile — verifica lato server del token captcha.
// Gated: se TURNSTILE_SECRET_KEY non è impostata, la verifica è
// disattivata (ritorna true) → la registrazione funziona come prima.
// Quando la chiave c'è, un token mancante o non valido blocca.
// ============================================================

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/**
 * @returns true se la registrazione può proseguire (captcha ok o non configurato),
 *          false se il captcha è configurato ma il token manca / non è valido.
 */
export async function verifyTurnstile(formData: FormData): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return true // captcha non configurato → non bloccare

  const token = String(formData.get('cf-turnstile-response') ?? '').trim()
  if (!token) return false

  try {
    const h = await headers()
    // x-real-ip primario (non spoofabile su Vercel) — vedi lib/client-ip.ts
    const ip = clientIpFrom(h) ?? undefined

    const body = new URLSearchParams({ secret, response: token })
    if (ip) body.set('remoteip', ip)

    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    const data = (await res.json()) as { success?: boolean }
    return data.success === true
  } catch {
    // Se Cloudflare non è raggiungibile, fail-open: meglio non perdere una
    // registrazione legittima per un problema di rete temporaneo.
    return true
  }
}
