import Link from 'next/link'
import { Send, CheckCircle2, XCircle, Timer, ChevronRight } from 'lucide-react'

// ── Blocchi SdI della Home (Eli, 11 ago 2026) ───────────────────────────────
// «In home compaiono sia sdi da mandare che quelli rifiutati affianco.»
// Due card AFFIANCATE (stessa griglia delle KPI): a sinistra le fatture/note
// non ancora trasmesse col conto alla rovescia dei 12 giorni, a destra le
// SCARTATE da correggere. Compare solo con lo SdI acceso (NEXT_PUBLIC_SDI_ENABLED),
// e quando c'è compare SEMPRE: il vuoto è un'informazione («tutto trasmesso»),
// non un motivo per sparire — regola dell'8 agosto sulla card In scadenza.

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

export interface SdiHomeDaTrasmettere {
  id: string
  /** Numero già formattato (es. «Fatt. 014/2026», «NC 001/2026») */
  numberLabel: string
  /** Etichetta del termine: «entro il 23 agosto», «entro OGGI», «oltre il termine» */
  termineLabel: string | null
  /** Colore dell'urgenza: neutro >3gg · ambra ≤3 · rosso fuori termine */
  urgenza: 'neutro' | 'ambra' | 'rosso'
  /** Trasmissione automatica programmata: parte da sola, nessuna azione richiesta */
  autoProgrammata: boolean
}

export interface SdiHomeScartata {
  id: string
  numberLabel: string
}

const URGENZA_COLOR: Record<SdiHomeDaTrasmettere['urgenza'], string> = {
  neutro: 'var(--cc-muted)',
  ambra: '#b0863e',
  rosso: '#b05656',
}

export function SdiHomeCard({
  daTrasmettere,
  daTrasmettereCount,
  scartate,
  scartateCount,
  style,
}: {
  daTrasmettere: SdiHomeDaTrasmettere[]
  daTrasmettereCount: number
  scartate: SdiHomeScartata[]
  scartateCount: number
  style?: React.CSSProperties
}) {
  return (
    <div style={style}>
      <div className="cc-section-label" style={{ margin: '0 2px 8px' }}>
        Fattura elettronica
      </div>
      {/* Due card affiancate anche a 390px: righe compatte, numeri corti */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        {/* ── Da trasmettere ─────────────────────────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: SH, padding: '12px 12px 10px', minWidth: 0 }}>
          {/* Il titolo APRE la pagina dedicata (Eli, 11 ago: «mi si deve
              aprire una pagina dedicata con la lista di tutte le fatture da
              trasmettere, tipo la pagina in scadenza») — le righe qui sotto
              restano scorciatoie al singolo documento. */}
          <Link
            href="/fatture/da-trasmettere"
            style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, textDecoration: 'none', color: 'inherit' }}
          >
            <Timer size={14} style={{ color: '#55534b', flexShrink: 0 }} aria-hidden="true" />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#55534b', flex: 1, minWidth: 0 }}>Da trasmettere</span>
            {daTrasmettereCount > 0 && (
              <span style={{ minWidth: 18, height: 18, borderRadius: 999, background: '#eceae4', color: '#55534b', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>
                {daTrasmettereCount}
              </span>
            )}
            <ChevronRight size={14} style={{ color: '#a5a39b', flexShrink: 0 }} aria-hidden="true" />
          </Link>
          {daTrasmettere.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#2f8a63', padding: '2px 0 4px' }}>
              <CheckCircle2 size={14} style={{ flexShrink: 0 }} aria-hidden="true" />
              Tutto trasmesso
            </div>
          ) : (
            <>
              {daTrasmettere.map((d) => (
                <Link
                  key={d.id}
                  href={`/fatture/${d.id}`}
                  style={{ display: 'block', padding: '5px 0', textDecoration: 'none', color: 'inherit', minWidth: 0 }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {d.numberLabel}
                  </div>
                  {d.autoProgrammata ? (
                    <div style={{ fontSize: 11, color: '#3f6fb0', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <Send size={11} style={{ flexShrink: 0 }} aria-hidden="true" />
                      parte da sola
                    </div>
                  ) : d.termineLabel ? (
                    <div style={{ fontSize: 11, fontWeight: d.urgenza === 'neutro' ? 400 : 600, color: URGENZA_COLOR[d.urgenza], whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {d.termineLabel}
                    </div>
                  ) : null}
                </Link>
              ))}
              {daTrasmettereCount > daTrasmettere.length && (
                <Link href="/fatture/da-trasmettere" style={{ display: 'block', fontSize: 11, color: 'var(--cc-muted)', padding: '4px 0 0', textDecoration: 'none' }}>
                  e {daTrasmettereCount - daTrasmettere.length} {daTrasmettereCount - daTrasmettere.length === 1 ? 'altra' : 'altre'} →
                </Link>
              )}
            </>
          )}
        </div>

        {/* ── Scartate ───────────────────────────────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: SH, padding: '12px 12px 10px', minWidth: 0, borderLeft: scartateCount > 0 ? '3px solid #b05656' : undefined }}>
          {/* Anche qui il titolo apre l'elenco (la ricerca «sdi scartate»
              filtra la lista Fatture per esito): stessa simmetria del
              riquadro accanto. */}
          <Link
            href={`/fatture?q=${encodeURIComponent('sdi scartate')}`}
            style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, textDecoration: 'none', color: 'inherit' }}
          >
            <XCircle size={14} style={{ color: scartateCount > 0 ? '#b05656' : '#55534b', flexShrink: 0 }} aria-hidden="true" />
            <span style={{ fontSize: 12, fontWeight: 600, color: scartateCount > 0 ? '#b05656' : '#55534b', flex: 1, minWidth: 0 }}>Scartate</span>
            {scartateCount > 0 && (
              <span style={{ minWidth: 18, height: 18, borderRadius: 999, background: '#f5dede', color: '#b05656', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>
                {scartateCount}
              </span>
            )}
            <ChevronRight size={14} style={{ color: '#a5a39b', flexShrink: 0 }} aria-hidden="true" />
          </Link>
          {scartate.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#2f8a63', padding: '2px 0 4px' }}>
              <CheckCircle2 size={14} style={{ flexShrink: 0 }} aria-hidden="true" />
              Nessuno scarto
            </div>
          ) : (
            <>
              {scartate.map((d) => (
                <Link
                  key={d.id}
                  href={`/fatture/${d.id}`}
                  style={{ display: 'block', padding: '5px 0', textDecoration: 'none', color: 'inherit', minWidth: 0 }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {d.numberLabel}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#b05656' }}>
                    da correggere
                  </div>
                </Link>
              ))}
              {scartateCount > scartate.length && (
                <Link href={`/fatture?q=${encodeURIComponent('sdi scartate')}`} style={{ display: 'block', fontSize: 11, color: 'var(--cc-muted)', padding: '4px 0 0', textDecoration: 'none' }}>
                  e {scartateCount - scartate.length} {scartateCount - scartate.length === 1 ? 'altra' : 'altre'} →
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
