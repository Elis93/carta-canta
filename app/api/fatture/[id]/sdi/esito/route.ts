// ============================================================
// POST /api/fatture/[id]/sdi/esito — "Controlla l'esito ora"
// PULL dell'esito SdI direttamente dal provider (23 lug 2026):
// complementare al webhook — recupera l'esito anche se i callback
// non sono configurati o non arrivano (com'è successo con la prima
// trasmissione sandbox: evento callback sbagliato, mai chiamati).
// Nessuna trasmissione: sola lettura dello stato presso il provider.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveWorkspaceForUser } from '@/lib/actions/resolve-workspace'
import { getSdiProvider } from '@/lib/sdi'
import { sendSdiScartataEmail } from '@/lib/sdi/scartata-email'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

const SDI_ENABLED = process.env.NEXT_PUBLIC_SDI_ENABLED === 'true'

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  // Gate + rate-limit come le route sorelle (review 25 lug #7): ogni chiamata
  // fa 1-2 richieste HTTP al provider — senza limite un tasto tenuto premuto
  // diventa una raffica verso OpenAPI.
  if (!SDI_ENABLED) {
    return NextResponse.json({ error: 'La fatturazione elettronica non è ancora attiva.' }, { status: 403 })
  }

  const { id } = await ctx.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const rl = checkRateLimit(`sdi-esito:${user.id}`, { limit: 10, windowMs: 60_000 })
  if (!rl.success) return rateLimitResponse(rl.resetAt, 'Troppi controlli ravvicinati. Attendi un momento.')

  const ws = await resolveWorkspaceForUser<{ id: string }>(supabase, user.id, 'id')
  if (!ws) return NextResponse.json({ error: 'Workspace non trovato' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 044 non ancora in types/database.ts
  const { data: doc } = await (supabase as any)
    .from('documents')
    .select('id, doc_number, sdi_status, sdi_provider_id, sdi_error')
    .eq('id', id)
    .eq('workspace_id', ws.id)
    // Anche le note di credito: la trasmissione le accetta (TD04), quindi
    // anche il recupero dell'esito deve conoscerle — col filtro 'fattura'
    // una NC trasmessa restava «inviata» per sempre (revisione 10 ago).
    .in('doc_type', ['fattura', 'nota_credito', 'nota_debito'])
    .is('deleted_at', null)
    .maybeSingle()
  if (!doc) return NextResponse.json({ error: 'Fattura non trovata' }, { status: 404 })

  // Esito già registrato (dal webhook o da un pull precedente) → riportalo.
  if (doc.sdi_status && doc.sdi_status !== 'inviata') {
    return NextResponse.json({ esito: doc.sdi_status, already: true })
  }
  if (doc.sdi_status !== 'inviata' || !doc.sdi_provider_id) {
    // Col marker "tentativo avviato" la trasmissione POTREBBE essere partita:
    // dire "non risulta trasmessa" sarebbe fuorviante (review 25 lug B2).
    const attempted = doc.sdi_status === 'inviata' && !!doc.sdi_error
    return NextResponse.json(
      { error: attempted
        ? 'Non riesco a confermare questa trasmissione: scrivici da Aiuto e la verifichiamo noi.'
        : 'Questa fattura non risulta trasmessa allo SdI.' },
      { status: 409 }
    )
  }

  // Coerenza provider↔id (audit 24 lug M4): un id 'mock-*' appartiene al
  // provider di prova; se la chiave OpenAPI sparisse (deploy errato) il
  // provider tornerebbe mock e marcherebbe "consegnata" una fattura REALE
  // senza interrogare nessuno. E viceversa. Blocca l'incrocio.
  const provider = getSdiProvider()
  const idIsMock = String(doc.sdi_provider_id).startsWith('mock-')
  if (idIsMock !== provider.isMock) {
    console.error('[sdi/esito] provider incoerente con id:', provider.name, doc.sdi_provider_id)
    return NextResponse.json({ error: 'Configurazione del provider incoerente con questa fattura: contatta il supporto.' }, { status: 409 })
  }

  const result = await provider.fetchEsito(String(doc.sdi_provider_id))
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 })
  if (!result.esito) return NextResponse.json({ esito: null, pending: true })

  // Stessa transizione del webhook: solo da 'inviata', mai regressioni.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 044
  const { data: changed, error } = await (supabase as any)
    .from('documents')
    .update({
      sdi_status: result.esito,
      sdi_updated_at: new Date().toISOString(),
      sdi_error: result.esito === 'scartata' ? (result.message ?? 'Scartata dallo SdI') : null,
    })
    .eq('id', id)
    .eq('sdi_status', 'inviata')
    .select('id')
  if (error) {
    console.error('[sdi/esito] update fallito:', error)
    return NextResponse.json({ error: 'Aggiornamento non riuscito. Riprova.' }, { status: 500 })
  }

  // Scartata → EMAIL anche dal percorso PULL (review 23 lug B3): la
  // campanella promette "Ti abbiamo mandato anche un'email" — vale per
  // entrambi i percorsi. SOLO se questo update ha davvero cambiato lo stato
  // (rowcount): se il webhook è arrivato primo, niente doppia email (24 lug).
  if (result.esito === 'scartata' && changed && changed.length > 0) {
    await sendSdiScartataEmail(createAdminClient(), ws.id, id, doc.doc_number ?? null, result.message)
  }

  return NextResponse.json({ esito: result.esito, message: result.message })
}
