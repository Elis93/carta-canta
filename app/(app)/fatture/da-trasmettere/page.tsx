import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { CheckCircle2, Send, Clock, AlertTriangle } from 'lucide-react'
import { formatCurrency, formatDocNumber, stripPrefissoLegacy } from '@/lib/utils'
import { BackButton } from '@/components/shared/BackButton'
import { riferimentoTrasmissione, termineTrasmissione, scadenzaLabel } from '@/lib/sdi/termini'

export const metadata = { title: 'Fatture da trasmettere' }

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'
const SDI_ENABLED = process.env.NEXT_PUBLIC_SDI_ENABLED === 'true'

interface Riga {
  id: string
  doc_number: string | null
  doc_type: string
  title: string | null
  total: number | null
  status: string
  created_at: string
  paid_at?: string | null
  doc_date?: string | null
  sdi_auto_at?: string | null
  sdi_status?: string | null
  clients: { name: string | null } | null
}

/**
 * «Fatture da trasmettere» (richiesta Eli, 11 ago: dalla Home il riquadro
 * deve aprire «una pagina dedicata con la lista di tutte le fatture da
 * trasmettere, tipo la pagina in scadenza»).
 *
 * Stessa forma della pagina «Fatture da incassare»: riepilogo in cima, poi
 * una card per documento, ordinate per URGENZA — chi ha meno giorni per
 * trasmettere sta in cima, le scartate (che vanno corrette e ritrasmesse
 * entro 5 giorni) prima di tutto.
 */
export default async function FattureDaTrasmetterePage({
  searchParams,
}: {
  searchParams: Promise<{ solo?: string }>
}) {
  // ?solo=scartate — la vista che apre il riquadro «Scartate» della Home
  // (Eli, 11 ago: «le scartate vorrei comparissero o nella pagina da
  // trasmettere o in una pagina dedicata»): stessa pagina, due linguette.
  const { solo } = await searchParams
  const soloScartate = solo === 'scartate'
  const { supabase, user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/onboarding')
  // Senza fatturazione elettronica attiva la pagina non ha senso: si torna
  // alla lista invece di mostrare un elenco che non si può usare.
  if (!SDI_ENABLED) redirect('/fatture')

  const now = new Date()

  // Query a CASCATA, come in Home: doc_date e sdi_auto_at arrivano con la 080.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 044/080 non nei types generati
  const db = supabase as any
  const base =
    'id, doc_number, doc_type, title, total, status, created_at, paid_at, sdi_status, clients(name)'
  const query = (extra: string) =>
    db
      .from('documents')
      .select(base + extra)
      .eq('workspace_id', workspace.id)
      .in('doc_type', ['fattura', 'nota_credito', 'nota_debito'])
      .is('deleted_at', null)
      .or('sdi_status.eq.scartata,and(sdi_status.is.null,status.in.(sent,viewed,accepted,expired))')
      .order('created_at', { ascending: true })
  const ricca = await query(', doc_date, sdi_auto_at')
  const righe: Riga[] = !ricca.error
    ? ((ricca.data ?? []) as Riga[])
    : await query('').then(
        (r: { data: unknown[] | null }) => (r.data ?? []) as Riga[],
        () => [] as Riga[],
      )

  // Termine dei 12 giorni per ciascuna (art. 21 c.4): il riferimento è la
  // data fiscale del documento, o il primo incasso se è arrivato prima.
  const conTermine = righe.map((d) => {
    const rif = riferimentoTrasmissione(d.doc_date ?? d.created_at, d.paid_at)
    const termine = rif ? termineTrasmissione(rif, now) : null
    return {
      doc: d,
      termine,
      scartata: d.sdi_status === 'scartata',
      autoProgrammata: !!d.sdi_auto_at && !d.sdi_status,
      giorni: termine ? termine.giorniRimasti : Number.POSITIVE_INFINITY,
    }
  })
  // Prima le scartate (5 giorni per correggere e ritrasmettere), poi le
  // altre per urgenza; chi non ha un termine calcolabile va in fondo.
  conTermine.sort((a, b) => {
    if (a.scartata !== b.scartata) return a.scartata ? -1 : 1
    return a.giorni - b.giorni
  })

  const scartate = conTermine.filter((r) => r.scartata).length
  const fuoriTermine = conTermine.filter((r) => !r.scartata && r.termine?.fuoriTermine).length
  // La lista MOSTRATA dipende dalla linguetta; i conteggi restano quelli
  // veri, perché servono alle linguette stesse.
  const mostrate = soloScartate ? conTermine.filter((r) => r.scartata) : conTermine
  const totale = mostrate.reduce((s, r) => s + (r.doc.total ?? 0), 0)

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header mobile — fascia bianca, come le altre pagine di lavoro */}
      <div className="lg:hidden" style={{ background: '#fff', borderBottom: '2px solid #c9a44c', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px' }}>
        <BackButton fallback="/fatture" />
        <span style={{ flex: 1, fontSize: 18, fontWeight: 600, fontFamily: "Georgia, 'Times New Roman', serif", color: '#1a1a2e' }}>{soloScartate ? 'Scartate' : 'Da trasmettere'}</span>
        <span style={{ width: 24 }} />
      </div>

      {/* Header desktop */}
      <div className="hidden lg:block p-6 pb-0">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Send className="size-6 text-[#3f6fb0]" />
          {soloScartate ? 'Fatture scartate' : 'Fatture da trasmettere'}
        </h1>
      </div>

      {/* Due linguette: tutte, oppure solo le scartate — che restano
          comunque in cima all'elenco completo. */}
      {scartate > 0 && (
        <div className="cc-tabs" style={{ margin: '12px 15px 0' }}>
          <Link href="/fatture/da-trasmettere" className={`cc-tab${!soloScartate ? ' cc-tab-active' : ''}`}>
            Tutte {conTermine.length}
          </Link>
          <Link href="/fatture/da-trasmettere?solo=scartate" className={`cc-tab${soloScartate ? ' cc-tab-active' : ''}`}>
            Scartate {scartate}
          </Link>
        </div>
      )}

      <div style={{ margin: '13px 15px 2px', fontSize: 12, color: '#a5a39b', lineHeight: 1.5 }}>
        {soloScartate ? (
          <>Fatture rifiutate dal Sistema di Interscambio: per l&rsquo;Agenzia non sono
            mai state emesse. Correggi il dato segnalato e reinviale entro{' '}
            <b>5 giorni</b>, con lo stesso numero e la stessa data.</>
        ) : (
          <>Documenti non ancora passati dal Sistema di Interscambio, in ordine di
            urgenza. Una fattura è emessa solo quando viene trasmessa: la legge dà{' '}
            <b>12 giorni</b> dalla data del documento.</>
        )}
      </div>

      {mostrate.length > 0 ? (
        <>
          {/* Riepilogo */}
          <div style={{ margin: '14px 15px 0', background: '#fff', borderRadius: 14, boxShadow: SH, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#a5a39b' }}>
                {soloScartate ? 'Scartate' : 'Da trasmettere'}
              </div>
              <div style={{ fontSize: 23, fontWeight: 700, color: '#161616', marginTop: 4, letterSpacing: '-.01em' }}>
                {mostrate.length}
              </div>
            </div>
            <div style={{ textAlign: 'right', minWidth: 0 }}>
              {scartate > 0 && !soloScartate && (
                <div style={{ fontSize: 12, fontWeight: 600, color: '#b05656' }}>
                  {scartate} scartat{scartate === 1 ? 'a' : 'e'} da correggere
                </div>
              )}
              {fuoriTermine > 0 && !soloScartate && (
                <div style={{ fontSize: 12, fontWeight: 600, color: '#b05656', marginTop: 3 }}>
                  {fuoriTermine} oltre i 12 giorni
                </div>
              )}
              <div style={{ fontSize: 12, color: '#a5a39b', marginTop: 3 }}>
                {formatCurrency(totale)} di documenti
              </div>
            </div>
          </div>

          {/* Una card per documento */}
          {mostrate.map(({ doc, termine, scartata, autoProgrammata }) => {
            const isNota = doc.doc_type === 'nota_credito'
            const numero = isNota
              ? stripPrefissoLegacy(doc.doc_number ?? '') || '—'
              : formatDocNumber(doc.doc_number, 'fattura')
            const cliente = doc.clients?.name ?? null
            const urgente = scartata || !!termine?.fuoriTermine || (termine != null && termine.giorniRimasti <= 3)
            return (
              <Link
                key={doc.id}
                href={`/fatture/${doc.id}`}
                style={{
                  display: 'block', margin: '12px 15px 0', background: '#fff', borderRadius: 14,
                  boxShadow: SH, padding: '13px 15px', textDecoration: 'none', color: 'inherit',
                  borderLeft: urgente ? '3px solid #b05656' : '3px solid #e4e2dc',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {numero}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, flexShrink: 0 }}>
                    {formatCurrency(doc.total ?? 0)}
                  </span>
                </div>
                {cliente && (
                  <div style={{ fontSize: 13, color: 'var(--cc-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {cliente}
                  </div>
                )}
                {/* Stato del termine: la riga per cui questa pagina esiste */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7, fontSize: 12.5 }}>
                  {scartata ? (
                    <>
                      <AlertTriangle size={14} style={{ color: '#b05656', flexShrink: 0 }} />
                      <span style={{ color: '#b05656', fontWeight: 600 }}>
                        Scartata dallo SdI — correggi e reinvia
                      </span>
                    </>
                  ) : autoProgrammata ? (
                    <>
                      <Send size={14} style={{ color: '#3f6fb0', flexShrink: 0 }} />
                      <span style={{ color: '#3f6fb0' }}>Parte da sola, non devi fare niente</span>
                    </>
                  ) : termine ? (
                    <>
                      <Clock size={14} style={{ color: termine.fuoriTermine ? '#b05656' : termine.giorniRimasti <= 3 ? '#b0863e' : '#6f6d64', flexShrink: 0 }} />
                      <span style={{ color: termine.fuoriTermine ? '#b05656' : termine.giorniRimasti <= 3 ? '#8a6a2f' : 'var(--cc-muted)', fontWeight: termine.fuoriTermine || termine.giorniRimasti <= 3 ? 600 : 400 }}>
                        {termine.fuoriTermine
                          ? `Termine superato da ${-termine.giorniRimasti === 1 ? 'un giorno' : `${-termine.giorniRimasti} giorni`}`
                          : termine.giorniRimasti === 0
                            ? 'Da trasmettere entro OGGI'
                            : `Entro il ${scadenzaLabel(termine.scadenza)} · ${termine.giorniRimasti === 1 ? 'manca 1 giorno' : `mancano ${termine.giorniRimasti} giorni`}`}
                      </span>
                    </>
                  ) : (
                    <span style={{ color: 'var(--cc-muted)' }}>Da trasmettere</span>
                  )}
                </div>
              </Link>
            )
          })}
        </>
      ) : (
        <div style={{ margin: '14px 15px 0', background: '#fff', borderRadius: 14, boxShadow: SH, padding: '32px 15px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
          <CheckCircle2 className="size-10" style={{ color: '#2f8a63' }} />
          <p style={{ fontWeight: 600, color: '#161616' }}>
            {soloScartate ? 'Nessuno scarto' : 'Tutto trasmesso'}
          </p>
          <p style={{ fontSize: 13, color: 'var(--cc-muted)' }}>
            {soloScartate
              ? 'Nessuna fattura è stata rifiutata dal Sistema di Interscambio.'
              : 'Nessuna fattura in attesa di passare dal Sistema di Interscambio.'}
          </p>
          <Link href="/fatture" style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', textDecoration: 'none', marginTop: 2 }}>
            Vedi tutte le fatture &rarr;
          </Link>
        </div>
      )}

      <div style={{ height: 16 }} />
    </div>
  )
}
