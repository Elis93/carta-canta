import { redirect, notFound } from 'next/navigation'
import { ScrollToHash } from '@/components/shared/ScrollToHash'
import { createAdminClient } from '@/lib/supabase/admin'
import { signPhotoPaths } from '@/lib/photos/signed-url'
import Link from 'next/link'
import { FileText, FileCheck2, ChevronRight, Hammer } from 'lucide-react'
import { CardTendina } from '@/components/shared/CardTendina'
import { MenuAltro, RigaMenu } from '@/app/(app)/_components/documento/MenuAltro'
import { btnNavyPieno, btnBianco } from '@/app/(app)/_components/documento/stili'
import { LAVORO_STATUS_META } from '../_components/lavoro-status'
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
import { ConvertiFatturaButton } from '@/app/(app)/preventivi/_components/ConvertiFatturaButton'

export const metadata = { title: 'Lavoro' }


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
  let docInfo: { doc_number: string | null; doc_type: string; status: string | null } | null = null
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
          .select('doc_number, doc_type, total, status')
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

  // ── Scheda B (Eli 5 set): testata navy, poi UN riquadro per le ore e tendine ──
  const clientObj = defaults?.client as { name?: string | null; surname?: string | null } | null | undefined
  const clientName = clientObj ? [clientObj.name, clientObj.surname].filter(Boolean).join(' ') : ''
  const sottotitolo = [clientName || null, defaults?.address?.trim() || null].filter(Boolean).join(' · ')
  const statoLavoro = defaults?.status ?? 'da_iniziare'
  const finito = statoLavoro === 'finito' || statoLavoro === 'fatturato'
  const puoConvertire = !!documentId && !fattura && finito && docInfo?.status === 'accepted'
  const fmtGiorno = (iso: string) => new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', timeZone: 'Europe/Rome' }).replace('.', '')
  const rapportinoRiepilogo = rapportino
    ? (rapportino.signedAt ? `Firmato il ${fmtGiorno(rapportino.signedAt)}` : rapportino.url ? 'da firmare' : 'da creare')
    : null
  const speseRiepilogo = spese.length > 0
    ? `${formatCurrency(spese.reduce((a, e) => a + Number(e.amount), 0))} · ${spese.length} ${spese.length === 1 ? 'voce' : 'voci'}`
    : 'nessuna'
  const richiamoRiepilogo = recall?.at
    ? `il ${new Date(recall.at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Rome' }).replace('.', '')}`
    : 'non impostato'
  const tile: React.CSSProperties = { flex: 1, minWidth: 0, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 11, padding: '9px 8px' }

  return (
    <div className="max-w-3xl mx-auto">
      <ScrollToHash />

      {/* ── TESTATA NAVY (come la Home): titolo, cliente · cantiere, stato e i tre
          numeri dell'economia. Il bagliore d'oro è quello della Home. ── */}
      <div style={{ background: '#1a1a2e', color: '#f2ecdd', padding: '12px 15px 16px', position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden style={{ position: 'absolute', right: -60, top: -70, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,164,76,.35), transparent 65%)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
          <BackButton fallback="/lavori" color="#e6cf94" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 20, color: '#f7f1e4', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {defaults?.title?.trim() || 'Lavoro'}
            </div>
            {sottotitolo && (
              <div style={{ fontSize: 12.5, color: 'rgba(228,226,232,.75)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {sottotitolo}
              </div>
            )}
          </div>
          <MenuAltro style={{ background: 'transparent', border: '1px solid rgba(255,255,255,.25)', color: '#e6cf94', boxShadow: 'none', width: 40, height: 40, flex: '0 0 40px', borderRadius: 999 }}>
            {documentId && (
              <RigaMenu icon={<FileText size={18} />} href={`/preventivi/${documentId}`}>
                Apri il preventivo{docInfo?.doc_number ? ` ${formatDocNumber(docInfo.doc_number)}` : ''}
              </RigaMenu>
            )}
            {fattura && (
              <RigaMenu icon={<FileCheck2 size={18} />} href={`/fatture/${fattura.id}`}>
                Apri la fattura{fattura.doc_number ? ` ${formatDocNumber(fattura.doc_number)}` : ''}
              </RigaMenu>
            )}
            <RigaMenu icon={<Hammer size={18} />} href="#dettagli">Stato e dettagli</RigaMenu>
            <div data-keep-open>
              <DeleteLavoroButton lavoroId={id} variant="menu" />
            </div>
          </MenuAltro>
        </div>
        <div style={{ marginTop: 10, position: 'relative' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 999, background: finito ? 'rgba(47,138,99,.35)' : 'rgba(255,255,255,.14)', border: `1px solid ${finito ? 'rgba(120,210,160,.5)' : 'rgba(255,255,255,.25)'}`, color: '#fff', fontSize: 11.5, fontWeight: 600, padding: '3px 10px' }}>
            {finito ? '✓' : '●'} {LAVORO_STATUS_META[statoLavoro].label}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 12, position: 'relative' }}>
          {[
            { label: 'Preventivato', value: preventivato, white: false },
            { label: 'Speso', value: speseTotale, white: true },
            { label: 'Margine', value: margine, white: false, negativo: margine != null && margine < 0 },
          ].map((k) => (
            <div key={k.label} style={tile}>
              <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 17, color: k.negativo ? '#f0a6a6' : k.white ? '#f2ecdd' : '#e6cf94', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {k.value != null ? formatCurrency(k.value) : '—'}
              </div>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: 'rgba(228,226,232,.62)', marginTop: 4 }}>{k.label}</div>
            </div>
          ))}
        </div>
        {preventivato == null && (
          <p style={{ fontSize: 11.5, color: 'rgba(228,226,232,.62)', margin: '8px 0 0', position: 'relative' }}>
            Il «preventivato» compare quando il lavoro nasce da un preventivo.
          </p>
        )}
      </div>

      <div style={{ padding: '12px 15px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ── Il passo successivo, a lavoro FINITO: il navy sotto la testata. ──
            Converti in fattura (solo col preventivo ACCETTATO e senza fattura
            già fatta — segnato come non accettato, la conversione verrebbe rifiutata),
            altrimenti il rapportino di fine lavoro (apre la sua tendina). */}
        {puoConvertire && documentId && (
          <div>
            <ConvertiFatturaButton documentId={documentId} fullWidth />
            <p style={{ fontSize: 12, color: 'var(--cc-muted)', margin: '8px 0 0', lineHeight: 1.45 }}>
              La fattura riprende le voci del preventivo (il prezzo pattuito). Ore e spese
              del lavoro restano il tuo margine; gli extra concordati li aggiungi sulla
              fattura prima di inviarla.
            </p>
          </div>
        )}
        {!puoConvertire && finito && rapportino && !rapportino.signedAt && (
          <a href="#rapportino" style={btnNavyPieno}>
            <FileText size={18} /> Rapportino di fine lavoro
          </a>
        )}

        {/* ── Ore di lavoro — UN riquadro solo (052; compare a migration applicata) ── */}
        {ore && (
          <div id="ore" style={{ scrollMarginTop: 80 }}>
            <OreLavoroCard lavoroId={id} minutes={ore.minutes} timerStartedAt={ore.startedAt} hourlyCost={hourlyCost} countLabor={countLabor} />
          </div>
        )}

        {/* ── Rapportino: tendina, in alto a lavoro finito (Eli 22 lug #12) ── */}
        {rapportino && (
          <CardTendina
            label="Rapportino"
            anchorId="rapportino"
            summary={<span style={{ color: rapportino.signedAt ? '#2f8a63' : undefined }}>{rapportinoRiepilogo}</span>}
            defaultOpen={finito && !rapportino.signedAt && !rapportino.url}
          >
            <RapportinoCard data={rapportino} bare />
          </CardTendina>
        )}

        {/* ── Spese: le voci e il tasto per aggiungerne (Pro) ── */}
        <CardTendina label="Spese" summary={speseRiepilogo}>
          {spese.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              {spese.map((e, i) => (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderTop: i === 0 ? 'none' : '0.5px solid #eee', fontSize: 13 }}>
                  <span style={{ color: '#161616', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description}</span>
                  <span style={{ color: '#55534b', fontWeight: 600, flexShrink: 0 }}>{formatCurrency(Number(e.amount))}</span>
                </div>
              ))}
              {laborCost > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderTop: '0.5px solid #eee', fontSize: 13 }}>
                  <span style={{ color: '#161616' }}>Manodopera ({Math.floor(oreTotaliMin / 60)} h {String(oreTotaliMin % 60).padStart(2, '0')} min)</span>
                  <span style={{ color: '#55534b', fontWeight: 600, flexShrink: 0 }}>{formatCurrency(laborCost)}</span>
                </div>
              )}
            </div>
          )}
          {spese.length === 0 && laborCost > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '0 0 10px', fontSize: 13 }}>
              <span style={{ color: '#161616' }}>Manodopera ({Math.floor(oreTotaliMin / 60)} h {String(oreTotaliMin % 60).padStart(2, '0')} min)</span>
              <span style={{ color: '#55534b', fontWeight: 600, flexShrink: 0 }}>{formatCurrency(laborCost)}</span>
            </div>
          )}
          {oreEscluse && (
            <p style={{ fontSize: 12, color: 'var(--cc-muted)', margin: '0 0 10px', lineHeight: 1.45 }}>
              Le {Math.floor(oreTotaliMin / 60)} h {String(oreTotaliMin % 60).padStart(2, '0')} min lavorate non sono contate nel margine (Impostazioni › Fiscale).
            </p>
          )}
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
            <AddExpenseDialog
              lavori={defaults ? [{ id: defaults.id, title: defaults.title || 'Questo lavoro' }] : []}
              defaultLavoroId={defaults?.id}
              triggerStyle={{ ...btnBianco, width: '100%', flex: 'none' }}
            />
          )}
        </CardTendina>

        {/* ── Foto del lavoro (vivono sul preventivo di origine) ── */}
        {documentId && (
          <div id="foto" style={{ scrollMarginTop: 80 }}>
            <WorkPhotosCard documentId={documentId} initialPhotos={workPhotos} initialSignedUrls={workPhotoSignedUrls} collapsible anchorId="foto" />
          </div>
        )}

        {/* ── Collegati: preventivo e fattura ── */}
        {documentId && (
          <CardTendina
            label="Collegati"
            summary={[
              docInfo?.doc_number ? `Prev. ${formatDocNumber(docInfo.doc_number)}` : 'Preventivo',
              fattura ? `Fatt. ${fattura.doc_number ? formatDocNumber(fattura.doc_number) : 'bozza'}` : null,
            ].filter(Boolean).join(' · ')}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link href={`/preventivi/${documentId}`} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
                <FileText size={18} style={{ color: '#1a1a2e', flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--cc-muted)' }}>Preventivo</span>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: '#161616' }}>{docInfo?.doc_number ? formatDocNumber(docInfo.doc_number) : 'Bozza'}</span>
                </span>
                <ChevronRight size={15} style={{ flexShrink: 0, color: '#1a1a2e' }} aria-hidden />
              </Link>
              {fattura && (
                <Link href={`/fatture/${fattura.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', borderTop: '1px solid #ededea', paddingTop: 10 }}>
                  <FileCheck2 size={18} style={{ color: '#1a1a2e', flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--cc-muted)' }}>Fattura</span>
                    {/* Niente marcatore 'fattura': l'etichetta dice già «Fattura» (regola B.3) */}
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: '#161616' }}>{fattura.doc_number ? formatDocNumber(fattura.doc_number) : 'Bozza di fattura'}</span>
                  </span>
                  <ChevronRight size={15} style={{ flexShrink: 0, color: '#1a1a2e' }} aria-hidden />
                </Link>
              )}
            </div>
          </CardTendina>
        )}

        {/* ── Richiama il cliente — promemoria manutenzione (052) ── */}
        {recall !== null && (
          <>
            {/* Hint una-tantum (progressive disclosure, 2 ago): al primo lavoro
                finito senza richiamo, suggerisce la manutenzione programmata */}
            {finito && !recall.at && (
              <ContextHint id="richiamo-lavoro">
                Lavoro finito: imposta qui sotto il richiamo e l&rsquo;app ti ricorda di ricontattare il cliente tra 6 o 12 mesi (manutenzioni = lavori che tornano).
              </ContextHint>
            )}
            <CardTendina label="Richiama il cliente" summary={richiamoRiepilogo} defaultOpen={!!recall.at}>
              <RichiamoCard lavoroId={id} recallAt={recall.at} recallNote={recall.note} documentId={documentId} bare />
            </CardTendina>
          </>
        )}

        {/* ── Stato e dettagli: le pillole dello stato e i campi del vecchio
            modulo, con salvataggio automatico (via «Salva modifiche») ── */}
        <LavoroForm defaults={defaults} />

        {/* ── Elimina in fondo, sotto un filetto ── */}
        <div style={{ marginTop: 6, paddingTop: 12, borderTop: '1px solid #e4e2dc' }}>
          <DeleteLavoroButton lavoroId={id} variant="danger" />
        </div>
      </div>
    </div>
  )
}
