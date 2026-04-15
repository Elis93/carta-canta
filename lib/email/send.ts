// ============================================================
// CARTA CANTA — Email sending via Resend
// Lazy singleton: non lancia errori a build-time se la chiave manca.
// Chiamare sendEmail solo server-side (Server Actions / API Routes).
// ============================================================

import { Resend } from 'resend'
import type { ReactElement } from 'react'

let _resend: Resend | null = null

function getResend(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) throw new Error('RESEND_API_KEY non configurata')
    _resend = new Resend(apiKey)
  }
  return _resend
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'noreply@cartacanta.it'
const FROM_NAME  = process.env.RESEND_FROM_NAME  ?? 'Carta Canta'

export interface SendEmailOptions {
  to: string
  subject: string
  react: ReactElement
  replyTo?: string
}

export interface SendEmailResult {
  success: boolean
  error?: string
}

/**
 * Invia una email tramite Resend.
 * Non rilancia mai: in caso di errore restituisce { success: false, error }.
 * Usare questo pattern per non bloccare flussi critici (es. accettazione preventivo).
 */
export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  try {
    const resend = getResend()
    const { error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: opts.to,
      subject: opts.subject,
      react: opts.react,
      ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
    })
    if (error) {
      console.error('[email] Resend error:', error)
      return { success: false, error: (error as { message?: string }).message ?? String(error) }
    }
    return { success: true }
  } catch (err) {
    console.error('[email] sendEmail failed:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Errore sconosciuto',
    }
  }
}
