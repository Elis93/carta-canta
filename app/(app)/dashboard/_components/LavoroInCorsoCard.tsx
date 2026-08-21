import Link from 'next/link'
import { Camera, PenLine, Timer } from 'lucide-react'

// ── «Lavoro in corso» (Home mobile, redesign 19-20 ago) ─────────────────────
// Il lavoro attivo, raggiungibile in un tocco (Eli: «se c'è un lavoro in
// corso, come lo modifica velocemente un artigiano?»). Titolo su MASSIMO due
// righe (scelta Eli) + tre tasti quadrati: Timer (le ore), Foto (documenta il
// cantiere), Matita (la scheda). Timer e Foto atterrano sulla scheda con
// l'ancora della card giusta (#ore / #foto). La sezione esiste solo se un
// lavoro è davvero in corso.

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

const sqStyle: React.CSSProperties = {
  width: 40, height: 40, flexShrink: 0, borderRadius: 10,
  border: '1px solid #d9d7d0', background: '#fff',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: '#1a1a2e', textDecoration: 'none',
}

export function LavoroInCorsoCard({ id, title, style }: { id: string; title: string | null; style?: React.CSSProperties }) {
  return (
    <div style={style}>
      <div className="cc-section-label" style={{ margin: '0 2px 8px' }}>Lavoro in corso</div>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, background: '#fff', borderRadius: 13, boxShadow: SH, padding: '7px 8px 7px 12px' }}>
        <span aria-hidden style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 2, borderRadius: 2, background: '#2f8a63' }} />
        <Link
          href={`/lavori/${id}`}
          style={{
            flex: 1, minWidth: 0, padding: '6px 0 6px 6px', textDecoration: 'none',
            fontSize: 14.5, fontWeight: 600, color: '#161616', lineHeight: 1.3,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}
        >
          {title?.trim() || 'Lavoro in corso'}
        </Link>
        <Link href={`/lavori/${id}#ore`} aria-label="Ore e timer del lavoro" style={sqStyle}>
          <Timer size={17} aria-hidden />
        </Link>
        <Link href={`/lavori/${id}#foto`} aria-label="Foto del lavoro" style={sqStyle}>
          <Camera size={17} aria-hidden />
        </Link>
        <Link href={`/lavori/${id}`} aria-label="Apri la scheda del lavoro" style={sqStyle}>
          <PenLine size={17} aria-hidden />
        </Link>
      </div>
    </div>
  )
}
