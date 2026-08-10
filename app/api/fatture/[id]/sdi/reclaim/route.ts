// ============================================================
// POST /api/fatture/[id]/sdi/reclaim — sblocca una fattura "orfana"
// (scelta Eli 25 lug 2026).
// Caso: un crash tecnico tra il claim ('inviata') e l'invio effettivo lascia
// la fattura bloccata su 'Inviata' SENZA che nulla sia stato trasmesso
// (sdi_sent_at e sdi_provider_id restano NULL). Senza questa via l'utente
// non potrebbe più né trasmettere né correggere.
//
// SICUREZZA anti doppia-trasmissione: lo sblocco è consentito SOLO se non
// c'è NESSUNA traccia di invio riuscito (sia sdi_sent_at sia sdi_provider_id
// devono essere NULL). Se uno dei due è valorizzato, la fattura È stata
// trasmessa → NON si sblocca (si usa "Controlla l'esito ora").
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveWorkspaceForUser } from '@/lib/actions/resolve-workspace'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { SDI_SEND_ATTEMPT_MARKER } from '@/lib/sdi/types'

const SDI_ENABLED = process.env.NEXT_PUBLIC_SDI_ENABLED === 'true'

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!SDI_ENABLED) {
    return NextResponse.json({ error: 'La fatturazione elettronica non è ancora attiva.' }, { status: 403 })
  }

  const { id } = await ctx.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const rl = checkRateLimit(`sdi-reclaim:${user.id}`, { limit: 10, windowMs: 60_000 })
  if (!rl.success) return rateLimitResponse(rl.resetAt, 'Troppi tentativi ravvicinati. Attendi un momento.')

  const ws = await resolveWorkspaceForUser<{ id: string }>(supabase, user.id, 'id')
  if (!ws) return NextResponse.json({ error: 'Workspace non trovato' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 044 non ancora in types/database.ts
  const { data: doc } = await (supabase as any)
    .from('documents')
    .select('id, sdi_status, sdi_sent_at, sdi_provider_id, sdi_updated_at, sdi_error')
    .eq('id', id)
    .eq('workspace_id', ws.id)
    // Anche le note di credito: la trasmissione le accetta (TD04), quindi
    // anche il recupero dell'esito deve conoscerle — col filtro 'fattura'
    // una NC trasmessa restava «inviata» per sempre (revisione 10 ago).
    .in('doc_type', ['fattura', 'nota_credito'])
    .is('deleted_at', null)
    .maybeSingle()
  if (!doc) return NextResponse.json({ error: 'Fattura non trovata' }, { status: 404 })

  if (doc.sdi_status !== 'inviata') {
    return NextResponse.json({ error: 'Questa fattura non è bloccata: non serve sbloccarla.' }, { status: 409 })
  }
  // Traccia di invio riuscito → NON sbloccare (eviterebbe una doppia trasmissione).
  if (doc.sdi_sent_at || doc.sdi_provider_id) {
    return NextResponse.json(
      { error: 'La fattura risulta trasmessa allo SdI e non va sbloccata. Aggiorna la pagina: troverai il pulsante per controllare l’esito.' },
      { status: 409 }
    )
  }
  // Marker "tentativo avviato" (finding ALTA review 25 lug): il provider è
  // stato chiamato ma la conferma non è mai stata salvata (lambda morta sulla
  // risposta). La fattura POTREBBE essere stata trasmessa → sbloccare qui
  // aprirebbe alla doppia trasmissione fiscale. Solo verifica manuale.
  if (doc.sdi_error === SDI_SEND_ATTEMPT_MARKER) {
    return NextResponse.json(
      { error: 'Non riesco a escludere che la trasmissione sia partita: per sicurezza questa fattura non si può sbloccare da sola. Scrivici da Aiuto e la verifichiamo noi.' },
      { status: 409 }
    )
  }
  // Guardia temporale anti-race: tra il claim e la risposta del provider passano
  // secondi in cui sent_at/provider_id sono ancora null — un reclaim in quella
  // finestra sbloccherebbe una trasmissione IN CORSO (→ possibile doppio invio).
  // Un crash vero lascia la fattura ferma: 10 minuti di attesa sono un costo
  // accettabile per escludere la finestra di gara.
  const updatedAt = doc.sdi_updated_at ? Date.parse(doc.sdi_updated_at) : NaN
  if (!Number.isFinite(updatedAt) || Date.now() - updatedAt < 10 * 60_000) {
    return NextResponse.json(
      { error: 'La trasmissione potrebbe essere ancora in corso: riprova tra 10 minuti.' },
      { status: 409 }
    )
  }

  // Reset condizionato (anti-race): solo se è ancora 'inviata', senza provider_id
  // né sent_at, e con sdi_updated_at ANCORA vecchio (un invio concorrente appena
  // partito ha rifatto il claim → updated_at fresco → 0 righe, niente reset).
  // NB: niente filtro su sdi_error = marker qui — con sdi_error NULL il
  // `not eq` SQL non matcherebbe (three-valued logic); la condizione temporale
  // copre la stessa gara senza ambiguità.
  const cutoff = new Date(Date.now() - 10 * 60_000).toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 044 non ancora in types/database.ts
  const { data: updated, error } = await (supabase as any)
    .from('documents')
    .update({ sdi_status: null, sdi_error: null, sdi_updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('sdi_status', 'inviata')
    .is('sdi_provider_id', null)
    .is('sdi_sent_at', null)
    .lt('sdi_updated_at', cutoff)
    .select('id')
  if (error || !updated || updated.length === 0) {
    return NextResponse.json({ error: 'Sblocco non riuscito: la fattura risulta di nuovo in trasmissione. Aggiorna la pagina.' }, { status: 409 })
  }

  return NextResponse.json({ success: true })
}
