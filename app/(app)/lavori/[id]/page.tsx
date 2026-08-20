import { redirect, notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { signPhotoPaths } from '@/lib/photos/signed-url'
import Link from 'next/link'
import { FileText } from 'lucide-react'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { BackButton } from '@/components/shared/BackButton'
import { formatDocNumber, formatCurrency } from '@/lib/utils'
import { WorkPhotosCard, type WorkPhoto } from '@/app/(app)/preventivi/_components/WorkPhotosCard'
import { AddExpenseDialog } from '@/app/(app)/bilancio/_components/AddExpenseDialog'
import { LavoroForm, type LavoroDefaults } from '../_components/LavoroForm'
import { DeleteLavoroButton } from '../_components/DeleteLavoroButton'
import { RapportinoCard, type RapportinoData } from '../_components/RapportinoCard'
import { RichiamoCard } from '../_components/RichiamoCard'
import { ContextHint } from '@/components/shared/ContextHint'
import { OreLavoroCard } from '../_components/OreLavoroCard'

export const metadata = { title: 'Lavoro' }

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

export default async function LavoroDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase, user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/onboarding')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 048 non ancora in types/database.ts
  const db = supabase as any
  let defaults: LavoroDefaults | null = null
  let documentId: string | null = null
  let docInfo: { doc_number: string | null; doc_type: string } | null = null
  let fattura: { id: string; doc_number: string | null } | null = null
  let workPhotos: WorkPhoto[] = []
  let preventivato: number | null = null
  let spese: Array<{ id: string; description: string; amount: number; date: string }> = []
  let rapportino: RapportinoData | null = null
  // Colonne 052 (richiamo + ore): query separata e tollerante — se la
  // migration non è applicata le card semplicemente non compaiono.
  let recall: { at: string | null; note: string | null } | null = null
  let ore: { minutes: number; startedAt: string | null } | null = null
  // PERF: colonne 052, riga principale e spese collegate sono query
  // indipendenti (tutte keyate su id+workspace) → un solo round trip
  // invece di tre in serie. Ogni ramo resta tollerante pre-migration.
  const [extraRes, lavRes, expRes, showLaborFlag] = await Promise.all([
    db
      .from('lavori')
      .select('recall_at, recall_note, labor_minutes, timer_started_at')
      .eq('id', id)
      .eq('workspace_id', workspace.id)
      .maybeSingle()
      .then((r: { data: Record<string, unknown> | null; error: unknown }) => r, () => ({ data: null, error: true })),
    // Prima con le colonne 049 (scheduled_at + report_*); se mancano, retry senza (sotto).
    db
      .from('lavori')
      .select('id, title, address, notes, status, scheduled_at, document_id, report_token, report_text, report_signed_at, report_signer_name, clients ( id, name, surname, email, phone, piva )')
      .eq('id', id)
      .eq('workspace_id', workspace.id)
      .is('deleted_at', null)
      .maybeSingle()
      .then((r: { data: Record<string, unknown> | null }) => r, () => ({ data: null })),
    // Spese collegate (margine, 049) — tollerante
    db
      .from('expenses')
      .select('id, description, amount, date')
      .eq('lavoro_id', id)
      .eq('workspace_id', workspace.id)
      .is('deleted_at', null)
      .order('date', { ascending: false })
      .then((r: { data: unknown[] | null }) => r.data, () => null),
    // «Mostra le ore al cliente» (086) — query a sé e tollerante: se la aggiungessi
    // al select condiviso sopra, pre-086 fallirebbe l'intera query (perdendo ore
    // e recall). Colonna assente → false (comportamento voluto: ore nascoste).
    db
      .from('lavori')
      .select('show_labor_to_client')
      .eq('id', id)
      .eq('workspace_id', workspace.id)
      .maybeSingle()
      .then(
        (r: { data: { show_labor_to_client?: boolean } | null }) => r.data?.show_labor_to_client === true,
        () => false,
      ),
  ])
  if (!extraRes.error && extraRes.data) {
    const extra = extraRes.data
    recall = { at: extra.recall_at ?? null, note: extra.recall_note ?? null }
    ore = { minutes: Number(extra.labor_minutes ?? 0), startedAt: extra.timer_started_at ?? null }
  }
  spese = (expRes ?? []) as typeof spese
  try {
    let lav = lavRes.data
    if (!lav) {
      ;({ data: lav } = await db
        .from('lavori')
        .select('id, title, address, notes, status, document_id, clients ( id, name, surname, email, phone, piva )')
        .eq('id', id)
        .eq('workspace_id', workspace.id)
        .is('deleted_at', null)
        .maybeSingle())
    }
    if (!lav) notFound()

    const scheduledLocal = lav.scheduled_at
      ? new Date(lav.scheduled_at).toLocaleString('sv-SE', { timeZone: 'Europe/Rome' }).slice(0, 16).replace(' ', 'T')
      : null

    defaults = {
      id: lav.id,
      title: lav.title ?? '',
      address: lav.address,
      notes: lav.notes,
      status: lav.status,
      scheduledAt: scheduledLocal,
      client: lav.clients
        ? {
            id: lav.clients.id,
            name: lav.clients.name ?? '',
            surname: lav.clients.surname ?? null,
            email: lav.clients.email ?? null,
            phone: lav.clients.phone ?? null,
            piva: lav.clients.piva ?? null,
          }
        : null,
    }
    documentId = lav.document_id

    // Rapportino di fine lavoro (049) — la card compare quando il lavoro è
    // finito/fatturato oppure se un rapportino esiste già.
    if ('report_token' in lav && (lav.status === 'finito' || lav.status === 'fatturato' || lav.report_token)) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cartacanta.app'
      rapportino = {
        lavoroId: lav.id,
        text: lav.report_text ?? null,
        url: lav.report_token ? `${appUrl}/r/${lav.report_token}` : null,
        signedAt: lav.report_signed_at ?? null,
        signerName: lav.report_signer_name ?? null,
        clientPhone: lav.clients?.phone ?? null,
        clientEmail: lav.clients?.email ?? null,
        showLabor: showLaborFlag,
        // La spunta serve solo se ci sono ore GIÀ SALVATE da mostrare: il cliente
        // vede `labor_minutes` salvati (non il timer in corso), quindi con 0 minuti
        // salvati la spunta non avrebbe effetto → non la mostriamo.
        hasLaborHours: (ore?.minutes ?? 0) > 0,
      }
    }

    if (documentId) {
      const [{ data: doc }, { data: fatt }, { data: wp }] = await Promise.all([
        supabase
          .from('documents')
          .select('doc_number, doc_type, total')
          .eq('id', documentId)
          .maybeSingle(),
        supabase
          .from('documents')
          .select('id, doc_number')
          .eq('origin_document_id', documentId)
          .eq('doc_type', 'fattura')
          .is('deleted_at', null)
          .limit(1)
          .maybeSingle(),
        db
          .from('work_photos')
          .select('id, storage_path, label, visible_to_client, sopralluogo_id')
          .eq('document_id', documentId)
          .eq('workspace_id', workspace.id)
          .order('created_at', { ascending: true }),
      ])
      docInfo = doc ?? null
      preventivato = doc?.total != null ? Number(doc.total) : null
      fattura = fatt ?? null
      workPhotos = (wp ?? []) as WorkPhoto[]
    }
  } catch {
    notFound()
  }

  // Firma delle foto già presenti con l'admin: in un team le foto stanno nella
  // cartella di chi le ha caricate, e il client di un collaboratore non
  // potrebbe firmarle (archivio privato, migration 068). Le foto caricate DOPO,
  // nella stessa sessione, le firma il client (propria cartella).
  const workPhotoSignedUrls = Object.fromEntries(
    await signPhotoPaths(createAdminClient(), workPhotos.map((p) => p.storage_path)),
  )

  // Manodopera (052): ore × costo orario del workspace — entra nello "Speso".
  // 085: l'interruttore «conta la manodopera nel margine» (default ON) permette
  // di ESCLUDERLA (forfettari: le loro ore non sono soldi usciti dal conto).
  const hourlyCost = Number((workspace as { hourly_cost?: number | null }).hourly_cost ?? 0) || null
  const countLabor = (workspace as { count_labor_in_margin?: boolean | null }).count_labor_in_margin !== false
  const oreTotaliMin = ore
    ? ore.minutes + (ore.startedAt ? Math.max(0, Math.floor((Date.now() - new Date(ore.startedAt).getTime()) / 60000)) : 0)
    : 0
  const laborCost = countLabor && hourlyCost != null && oreTotaliMin > 0 ? (oreTotaliMin / 60) * hourlyCost : 0
  // Ore lavorate senza costo contato: si mostrano come informazione SOLO se un
  // costo orario esiste (altrimenti la manodopera non sarebbe stata contata
  // comunque, e «non contate nel margine» sarebbe fuorviante — il toggle non ha
  // avuto alcun effetto).
  const oreEscluse = !countLabor && oreTotaliMin > 0 && hourlyCost != null

  const speseMateriali = spese.length > 0 ? spese.reduce((s, e) => s + Number(e.amount), 0) : (spese.length === 0 && preventivato != null ? 0 : null)
  const speseTotale = speseMateriali != null ? speseMateriali + laborCost : (laborCost > 0 ? laborCost : null)
  const margine = preventivato != null && speseTotale != null ? preventivato - speseTotale : null

  return (
    <div className="max-w-3xl mx-auto">
      <div style={{ background: '#fff', borderBottom: '2px solid #c9a44c', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px' }}>
        <BackButton fallback="/lavori" />
        <span style={{ flex: 1, fontSize: 18, fontWeight: 600, fontFamily: "Georgia, 'Times New Roman', serif", color: '#1a1a2e' }}>Lavoro</span>
        <DeleteLavoroButton lavoroId={id} />
      </div>

      {/* Documenti collegati */}
      {documentId && (
        <div style={{ margin: '14px 15px 0', background: '#fff', borderRadius: 14, boxShadow: SH, padding: '12px 15px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Link href={`/preventivi/${documentId}`} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, fontWeight: 600, color: '#1a1a2e', textDecoration: 'none' }}>
            <FileText size={15} /> Preventivo {docInfo?.doc_number ? formatDocNumber(docInfo.doc_number) : ''} →
          </Link>
          {fattura && (
            <Link href={`/fatture/${fattura.id}`} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, fontWeight: 600, color: '#1a1a2e', textDecoration: 'none' }}>
              {/* Niente marcatore 'fattura': il testo dice già "Fattura" (regola B.3) */}
              <FileText size={15} /> Fattura {fattura.doc_number ? formatDocNumber(fattura.doc_number) : ''} →
            </Link>
          )}
          {/* Lavoro finito, non ancora fatturato: guida a trasformare il
              preventivo in fattura (feedback Eli 22 lug #17). */}
          {!fattura && (defaults?.status === 'finito' || defaults?.status === 'fatturato') && (
            <p style={{ fontSize: 12.5, color: '#8a6c33', margin: 0, lineHeight: 1.45 }}>
              Lavoro finito: tocca il preventivo qui sopra per aprirlo e trasformarlo in fattura.
            </p>
          )}
        </div>
      )}

      {/* Rapportino IN ALTO quando il lavoro è finito (feedback Eli 22 lug #12):
          a lavoro concluso è l'azione principale, non deve stare in fondo. */}
      {rapportino && (
        <div style={{ padding: '14px 15px 0' }}>
          <RapportinoCard data={rapportino} />
        </div>
      )}

      <LavoroForm defaults={defaults} />

      {/* Economia del lavoro: preventivato vs speso (margine) */}
      <div style={{ padding: '0 15px 13px' }}>
        <div style={{ background: '#fff', borderRadius: 14, boxShadow: SH, padding: '14px 15px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: 10 }}>
            Economia del lavoro
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { label: 'Preventivato', value: preventivato, color: '#161616' },
              { label: 'Speso', value: speseTotale, color: '#b05656' },
              { label: 'Margine', value: margine, color: margine != null && margine < 0 ? '#b05656' : '#2f8a63' },
            ].map((kpi) => (
              <div key={kpi.label} style={{ flex: 1, background: '#fafafa', borderRadius: 11, padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--cc-muted)' }}>{kpi.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 3, color: kpi.color, whiteSpace: 'nowrap' }}>
                  {kpi.value != null ? formatCurrency(kpi.value) : '—'}
                </div>
              </div>
            ))}
          </div>
          {laborCost > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', marginTop: 8, borderTop: '0.5px solid #eee', fontSize: 13 }}>
              <span style={{ color: '#161616' }}>Manodopera ({Math.floor(oreTotaliMin / 60)} h {String(oreTotaliMin % 60).padStart(2, '0')} min)</span>
              <span style={{ color: '#55534b', fontWeight: 600, flexShrink: 0 }}>{formatCurrency(laborCost)}</span>
            </div>
          )}
          {/* 085: manodopera esclusa dal margine → ore mostrate come sola
              informazione (senza costo), così il dato non si perde. */}
          {oreEscluse && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', marginTop: 8, borderTop: '0.5px solid #eee', fontSize: 13 }}>
              <span style={{ color: '#161616' }}>Ore lavorate ({Math.floor(oreTotaliMin / 60)} h {String(oreTotaliMin % 60).padStart(2, '0')} min)</span>
              <span style={{ color: 'var(--cc-muted)', fontSize: 12, flexShrink: 0 }}>non contate nel margine</span>
            </div>
          )}
          {spese.length > 0 && (
            <div style={{ marginTop: 10 }}>
              {spese.map((e, i) => (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderTop: i === 0 ? '0.5px solid #eee' : 'none', borderBottom: i < spese.length - 1 ? '0.5px solid #eee' : 'none', fontSize: 13 }}>
                  <span style={{ color: '#161616', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description}</span>
                  <span style={{ color: '#55534b', fontWeight: 600, flexShrink: 0 }}>{formatCurrency(Number(e.amount))}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            {workspace.plan === 'free' ? (
              /* Il salvataggio spese è Pro (come il Bilancio): niente form
                 che si rifiuta solo ALLA FINE — lock chiaro subito. */
              <Link
                href="/abbonamento"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: '1px solid #e8d6ad', borderRadius: 11, background: '#fdf9ef', color: '#b0863e', fontSize: 13, fontWeight: 600, padding: '11px 0', textDecoration: 'none' }}
              >
                Le spese del lavoro sono una funzione Pro — Scopri Pro
              </Link>
            ) : (
              <AddExpenseDialog lavori={defaults ? [{ id: defaults.id, title: defaults.title || 'Questo lavoro' }] : []} defaultLavoroId={defaults?.id} />
            )}
          </div>
          {preventivato == null && (
            <p style={{ fontSize: 12, color: 'var(--cc-muted)', marginTop: 8, lineHeight: 1.45 }}>
              Il &laquo;preventivato&raquo; compare quando il lavoro nasce da un preventivo.
            </p>
          )}
        </div>
      </div>

      {/* Ore di lavoro — timer + manuale (052; compare solo a migration applicata) */}
      {ore && (
        <div id="ore" style={{ padding: '0 15px 13px', scrollMarginTop: 80 }}>
          <OreLavoroCard lavoroId={id} minutes={ore.minutes} timerStartedAt={ore.startedAt} hourlyCost={hourlyCost} />
        </div>
      )}

      {/* Richiama il cliente — promemoria manutenzione (052) */}
      {recall !== null && (
        <div style={{ padding: '0 15px 13px', display: 'flex', flexDirection: 'column', gap: 11 }}>
          {/* Hint una-tantum (progressive disclosure, 2 ago): al primo lavoro
              finito senza richiamo, suggerisce la manutenzione programmata */}
          {(defaults?.status === 'finito' || defaults?.status === 'fatturato') && !recall.at && (
            <ContextHint id="richiamo-lavoro">
              Lavoro finito: imposta qui sotto il richiamo e l&rsquo;app ti ricorda di ricontattare il cliente tra 6 o 12 mesi (manutenzioni = lavori che tornano).
            </ContextHint>
          )}
          <RichiamoCard lavoroId={id} recallAt={recall.at} recallNote={recall.note} documentId={documentId} />
        </div>
      )}

      {/* Foto del lavoro (vivono sul preventivo di origine) */}
      {documentId && (
        <div id="foto" style={{ padding: '0 15px 16px', scrollMarginTop: 80 }}>
          <WorkPhotosCard documentId={documentId} initialPhotos={workPhotos} initialSignedUrls={workPhotoSignedUrls} />
        </div>
      )}
    </div>
  )
}
