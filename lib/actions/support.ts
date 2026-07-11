'use server'

// ============================================================
// Form di contatto in-app (pagina Aiuto). Invia il messaggio
// dell'utente a supporto@cartacanta.app via Resend, con replyTo
// sull'email dell'utente: si risponde direttamente dalla casella.
// Niente mailto: funziona anche senza client di posta configurato.
// ============================================================

import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/send'
import { SupportRequestEmail } from '@/lib/email/templates/support_request'
import { checkPublicRateLimit } from '@/lib/public-rate-limit'

type Result = { error?: string; success?: string } | null

export async function sendSupportMessageAction(messageRaw: string): Promise<Result> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { error: 'Devi essere autenticato per scriverci.' }

  const message = messageRaw.trim()
  if (message.length < 10) return { error: 'Scrivi qualche dettaglio in più (almeno 10 caratteri).' }
  if (message.length > 2000) return { error: 'Il messaggio è troppo lungo (max 2000 caratteri).' }

  // Rate limit: max 5 messaggi/ora per utente (anti-abuso)
  const rl = await checkPublicRateLimit({ key: `support-message:${user.id}`, limit: 5, window: '1 h', windowMs: 3_600_000 })
  if (rl.blocked) return { error: 'Hai già inviato diversi messaggi. Riprova tra un po’.' }

  // Contesto utile per rispondere (best-effort)
  const { data: ws } = await supabase
    .from('workspaces')
    .select('name, ragione_sociale, plan')
    .eq('owner_id', user.id)
    .maybeSingle()

  const nome = String(user.user_metadata?.full_name ?? '').slice(0, 100)

  const result = await sendEmail({
    to: 'supporto@cartacanta.app',
    subject: `Richiesta di aiuto — ${ws?.ragione_sociale ?? ws?.name ?? nome ?? user.email}`,
    replyTo: user.email,
    react: createElement(SupportRequestEmail, {
      message,
      userEmail: user.email,
      userName: nome || null,
      workspaceName: ws?.ragione_sociale ?? ws?.name ?? null,
      plan: ws?.plan ?? null,
    }),
  })
  if (!result.success) return { error: 'Invio non riuscito. Riprova, o scrivi a supporto@cartacanta.app.' }

  return { success: 'Messaggio inviato. Ti rispondiamo entro 1 giorno lavorativo.' }
}
