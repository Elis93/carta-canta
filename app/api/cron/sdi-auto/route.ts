// ============================================================
// GET /api/cron/sdi-auto — IL PILOTA AUTOMATICO DELLA TRASMISSIONE SdI
// (decisione Eli, 11 ago 2026: «automatico deve essere default e sia
//  chiaro all'artigiano»).
//
// Gira OGNI ORA (vercel.json). Trova le fatture con una trasmissione
// PROGRAMMATA (documents.sdi_auto_at ≤ adesso, scritta alla conferma della
// bozza: «verrà trasmessa tra 24 ore») e le trasmette con la STESSA
// funzione della trasmissione manuale — tutte le guardie comprese (quota,
// coerenza 00421, claim anti doppio-invio, tetto delle note).
//
// SE UNA TRASMISSIONE NON RIESCE (dato mancante, quota, scarto della
// guardia): il pilota MOLLA LA PRESA su quel documento (sdi_auto_at →
// null) e il caso torna al giro manuale — dove il conto alla rovescia dei
// 12 giorni e la campanella lo tengono in vista. MAI riprovare in loop la
// stessa fattura: una guardia che dice no oggi dirà no anche tra un'ora,
// e trasmissioni ripetute su documenti fiscali sono il rischio peggiore.
//
// Protetto da CRON_SECRET (Authorization: Bearer — come gli altri cron:
// il ?secret= in query era il bug del 5 ago sul cron orfani).
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { trasmettiDocumentoSdi, type WorkspaceTrasmissione } from '@/lib/sdi/trasmetti'

const SDI_ENABLED = process.env.NEXT_PUBLIC_SDI_ENABLED === 'true'

// Ogni giro al massimo 25 trasmissioni: il cron è orario, la coda si
// smaltisce comunque, e una lambda che tenta 200 invii in un colpo è
// esattamente il tipo di corsa che non vogliamo su documenti fiscali.
const MAX_PER_GIRO = 25

export const maxDuration = 300

export async function GET(request: NextRequest) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '')
  // Fail-CLOSED: se CRON_SECRET manca, l'endpoint resta chiuso.
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }
  if (!SDI_ENABLED) {
    return NextResponse.json({ ok: true, skipped: 'SDI disattivato' })
  }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 044/080 non nei tipi
  const db = admin as any

  // Le programmate scadute. Solo FATTURE (il pilota non tocca le note di
  // credito: uno storno è raro e delicato, resta un gesto manuale) e solo
  // non ancora trasmesse — il claim dentro trasmettiDocumentoSdi copre
  // comunque le corse residue.
  const { data: due, error: dueErr } = await db
    .from('documents')
    .select('id, workspace_id, sdi_auto_at')
    .eq('doc_type', 'fattura')
    .is('deleted_at', null)
    .is('sdi_status', null)
    .not('sdi_auto_at', 'is', null)
    .lte('sdi_auto_at', new Date().toISOString())
    .not('status', 'in', '(draft,rejected)')
    .order('sdi_auto_at', { ascending: true })
    .limit(MAX_PER_GIRO)
  if (dueErr) {
    console.error('[cron/sdi-auto] lettura coda fallita:', dueErr)
    return NextResponse.json({ error: 'Lettura coda fallita' }, { status: 500 })
  }

  let trasmesse = 0
  let rimandateAlManuale = 0

  for (const doc of (due ?? []) as Array<{ id: string; workspace_id: string }>) {
    try {
      // Workspace + interruttore del pilota (ri-verificato QUI: se l'artigiano
      // l'ha spento dopo la programmazione, non si trasmette).
      const { data: ws } = await db
        .from('workspaces')
        .select('id, plan, name, ragione_sociale, piva, indirizzo, cap, citta, provincia, fiscal_regime, owner_id, sdi_auto_enabled')
        .eq('id', doc.workspace_id)
        .maybeSingle()
      if (!ws) {
        await db.from('documents').update({ sdi_auto_at: null }).eq('id', doc.id)
        continue
      }
      if (ws.sdi_auto_enabled === false) {
        await db.from('documents').update({ sdi_auto_at: null }).eq('id', doc.id)
        rimandateAlManuale++
        continue
      }

      // Email dell'owner per il contatto cedente nell'XML (best-effort)
      const ownerEmail: string | null = await admin.auth.admin
        .getUserById(ws.owner_id)
        .then((r) => r.data.user?.email ?? null, () => null)

      const esito = await trasmettiDocumentoSdi({
        supabase: admin,
        workspace: ws as WorkspaceTrasmissione,
        docId: doc.id,
        userId: ws.owner_id,
        userEmail: ownerEmail,
        bodyDest: null,
        bodyPec: null,
      })

      if (esito.status === 200) {
        trasmesse++
        // sdi_auto_at l'ha già azzerato la trasmissione
      } else {
        // Una guardia ha detto no (dato mancante, quota, tetto…): il pilota
        // molla — sdi_auto_at a null, il documento torna al giro manuale
        // dove countdown e campanella lo tengono in vista.
        await db.from('documents').update({ sdi_auto_at: null }).eq('id', doc.id)
        rimandateAlManuale++
        console.error('[cron/sdi-auto] trasmissione rimandata al manuale', doc.id, esito.status, esito.body?.error)
      }
    } catch (e) {
      // Errore imprevisto: stessa politica — mai un loop di retry su una
      // trasmissione fiscale. Manuale + reti di sicurezza.
      await db.from('documents').update({ sdi_auto_at: null }).eq('id', doc.id).then(() => {}, () => {})
      rimandateAlManuale++
      console.error('[cron/sdi-auto] errore imprevisto su', doc.id, e)
    }
  }

  console.log(`[cron/sdi-auto] trasmesse: ${trasmesse} · rimandate al manuale: ${rimandateAlManuale} · in coda: ${(due ?? []).length}`)
  return NextResponse.json({ ok: true, trasmesse, rimandateAlManuale })
}
