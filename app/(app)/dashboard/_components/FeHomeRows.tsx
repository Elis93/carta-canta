import Link from 'next/link'

// ── «Fatture elettroniche» (Home mobile, redesign 19-20 ago) ────────────────
// UNA card con due righe toccabili divise da un filetto (Eli 21 ago — lo
// stesso schema di «Attività recente», con un filo più d'aria). Riga 1 → la pagina «Fatture da trasmettere»
// (elenco col conto alla rovescia dei 12 giorni e il tasto di invio);
// riga 2 → la stessa pagina filtrata sulle scartate (motivo dello scarto +
// correzione). Niente «Vedi tutte» in testata: le righe SONO i collegamenti.
// A zero le righe restano (il vuoto è un'informazione): il conteggio «0» lo
// dice già, quindi la sottodicitura sparisce (Eli, 20 ago) invece di ripetere
// «Tutto trasmesso» / «Nessuno scarto».

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

function FeRow({ href, dotColor, label, sub, subColor, count }: {
  href: string
  dotColor: string
  label: string
  sub: string
  subColor?: string
  count: number
}) {
  return (
    <Link
      href={href}
      style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit' }}
    >
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: dotColor }} />
      <span style={{ fontSize: 14, fontWeight: 600, color: '#161616', flexShrink: 0 }}>{label}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: subColor ?? 'var(--cc-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {sub}
      </span>
      <span style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 17, fontWeight: 600, color: '#161616', flexShrink: 0 }}>{count}</span>
      <span aria-hidden style={{ color: '#c2c1bd', fontSize: 18, lineHeight: 1, flexShrink: 0 }}>›</span>
    </Link>
  )
}

export function FeHomeRows({ daTrasmettereCount, termineLabel, scartateCount, style }: {
  daTrasmettereCount: number
  /** Termine della più urgente («entro il 23 ago» / «entro OGGI» / «oltre il termine») */
  termineLabel: string | null
  scartateCount: number
  style?: React.CSSProperties
}) {
  return (
    <div style={style}>
      <div className="cc-section-label" style={{ margin: '0 2px 8px' }}>Fatture elettroniche</div>
      {/* UNA card sola con le due righe divise da un filetto (Eli 21 ago:
          come «Attività recente», ma col respiro un po' più marcato — 14px
          contro i 12 delle attività). */}
      <div style={{ background: '#fff', borderRadius: 13, boxShadow: SH, padding: '13px 14px' }}>
        <FeRow
          href="/fatture/da-trasmettere"
          dotColor={daTrasmettereCount > 0 ? '#3f6fb0' : '#c9c7c0'}
          label="Da trasmettere"
          sub={daTrasmettereCount > 0 ? (termineLabel ?? 'allo SdI') : ''}
          count={daTrasmettereCount}
        />
        <div aria-hidden style={{ height: 1, background: '#e4e2dc', margin: '14px 0' }} />
        <FeRow
          href="/fatture/da-trasmettere?solo=scartate"
          dotColor={scartateCount > 0 ? '#b05656' : '#c9c7c0'}
          label="Scartate"
          sub={scartateCount > 0 ? 'da correggere' : ''}
          subColor={scartateCount > 0 ? '#b05656' : undefined}
          count={scartateCount}
        />
      </div>
    </div>
  )
}
