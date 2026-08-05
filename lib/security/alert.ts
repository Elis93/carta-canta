// ============================================================
// Avvisi di sicurezza all'utente — invio "best effort".
//
// Regola: un cambiamento che tocca i SOLDI o l'ACCESSO non deve mai avvenire
// in silenzio. Se un account viene compromesso, questa email è l'unico modo
// che il titolare ha di accorgersene prima che un bonifico finisca altrove
// (frode BEC — vedi SICUREZZA.md §1-bis).
//
// Non blocca mai l'operazione: se l'email non parte, il salvataggio resta
// valido. Meglio un avviso mancato che un utente che non riesce a salvare.
// ============================================================

import { createElement } from 'react'
import { sendEmail } from '@/lib/email/send'
import { SecurityAlertEmail } from '@/lib/email/templates/security_alert'
import { checkPublicRateLimit } from '@/lib/public-rate-limit'

export async function sendSecurityAlert(opts: {
  to: string | null | undefined
  title: string
  what: string
  /** path relativo, es. '/impostazioni?tab=pagamenti' */
  actionPath: string
  actionLabel: string
}): Promise<void> {
  if (!opts.to) return

  // ⚠️ Un avviso non si può spegnere, ma si può SEPPELLIRE: chi entra
  // nell'account può salvare cento volte di seguito alternando due IBAN e
  // annegare quello vero in cento email identiche (e nel frattempo farci
  // marcare come spam). Sei avvisi all'ora per destinatario bastano
  // ampiamente all'uso legittimo e tolgono il trucco.
  const { blocked } = await checkPublicRateLimit({
    key: `secalert:${opts.to.toLowerCase()}`,
    limit: 6,
    window: '1 h',
    windowMs: 60 * 60 * 1000,
  })
  if (blocked) {
    console.warn('[security-alert] troppi avvisi in un\'ora per questo indirizzo: non inviato')
    return
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cartacanta.app'
  const when = new Date().toLocaleString('it-IT', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome',
  })
  // sendEmail non lancia mai: ritorna { success, error }. Leggerlo è l'unico
  // modo di sapere che un avviso di SICUREZZA non è partito — un try/catch
  // qui sarebbe codice morto.
  const res = await sendEmail({
    to: opts.to,
    subject: `Carta Canta — ${opts.title}`,
    react: createElement(SecurityAlertEmail, {
      title: opts.title,
      what: opts.what,
      when,
      actionUrl: `${appUrl}${opts.actionPath}`,
      actionLabel: opts.actionLabel,
    }),
  })
  if (!res.success) {
    console.error('[security-alert] AVVISO NON RECAPITATO:', opts.title, res.error)
  }
}
