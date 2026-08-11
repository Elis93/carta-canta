// ============================================================
// POST /api/fatture/[id]/sdi
// Invia la fattura allo SdI. Il CUORE della trasmissione (guardie, claim,
// invio, salvataggi) vive in lib/sdi/trasmetti.ts — condiviso col cron del
// pilota automatico. Qui restano SOLO: gate del flag, autenticazione,
// rate limit e la validazione del body digitato nel dialog.
// Body opzionale: { codice_destinatario?, pec? } → salvati sul cliente.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { trasmettiDocumentoSdi } from '@/lib/sdi/trasmetti'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resolveWorkspaceForUser } from '@/lib/actions/resolve-workspace'

const SDI_ENABLED = process.env.NEXT_PUBLIC_SDI_ENABLED === 'true'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!SDI_ENABLED) {
    return NextResponse.json({ error: 'La fatturazione elettronica non è ancora attiva.' }, { status: 403 })
  }

  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const rl = checkRateLimit(`sdi:${user.id}`, { limit: 10, windowMs: 60_000 })
  if (!rl.success) return rateLimitResponse(rl.resetAt, 'Troppi invii ravvicinati. Attendi un momento.')

  // Body opzionale: canale telematico del cliente da salvare
  let bodyDest: string | null = null
  let bodyPec: string | null = null
  // Valori DIGITATI ma non validi: vanno segnalati, non ignorati in silenzio
  // (prima un "ABC12" digitato nel dialog spariva e si usava il valore vecchio
  // della rubrica, o '0000000' — l'utente credeva di averlo cambiato).
  let rawDestInvalid: string | null = null
  let rawPecInvalid: string | null = null
  try {
    const raw = await request.json()
    if (raw && typeof raw === 'object') {
      const d = String(raw.codice_destinatario ?? '').trim().toUpperCase()
      if (/^[A-Z0-9]{7}$/.test(d)) bodyDest = d
      else if (d) rawDestInvalid = d
      const p = String(raw.pec ?? '').trim()
      if (/^\S+@\S+\.\S+$/.test(p)) bodyPec = p
      else if (p) rawPecInvalid = p
    }
  } catch { /* body assente */ }

  if (rawDestInvalid) {
    return NextResponse.json(
      { error: `Il codice destinatario "${rawDestInvalid}" non è valido: deve essere di 7 caratteri tra lettere e numeri. Correggilo, oppure lascialo vuoto se il cliente è un privato.` },
      { status: 422 }
    )
  }
  if (rawPecInvalid) {
    return NextResponse.json(
      { error: `L'indirizzo PEC "${rawPecInvalid}" non sembra un indirizzo valido: controllalo e riprova.` },
      { status: 422 }
    )
  }

  // ── Workspace (owner) con dati fiscali ────────────────────
  // Prima come titolare, poi come collaboratore invitato (piano Team).
  const workspace = await resolveWorkspaceForUser(supabase, user.id,
    'id, plan, name, ragione_sociale, piva, indirizzo, cap, citta, provincia, fiscal_regime')
  if (!workspace) return NextResponse.json({ error: 'Workspace non trovato' }, { status: 404 })

  const esito = await trasmettiDocumentoSdi({
    supabase,
    workspace,
    docId: id,
    userId: user.id,
    userEmail: user.email ?? null,
    bodyDest,
    bodyPec,
  })
  return NextResponse.json(esito.body, { status: esito.status })
}
