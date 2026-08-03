// "Apri la scheda lavoro" quando il LAVORO ESISTE GIÀ (richiesta Eli 3 ago:
// dal preventivo e dalla fattura si arriva dentro al lavoro con un tocco).
// È un semplice Link (server component ok) con lo stesso vestito di
// ApriLavoroButton — quello resta per il caso "lavoro ancora da creare".

import Link from 'next/link'
import { Hammer } from 'lucide-react'

export function LavoroLinkButton({
  lavoroId,
  fullWidth = false,
}: {
  lavoroId: string
  fullWidth?: boolean
}) {
  return (
    <Link
      href={`/lavori/${lavoroId}`}
      style={{
        width: fullWidth ? '100%' : undefined,
        minHeight: 54, borderRadius: 12, border: '1px solid #e7e7ea', background: '#fff', color: '#1a1a2e',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        textDecoration: 'none', boxSizing: 'border-box',
        boxShadow: '0 1px 2px rgba(20,20,40,.05)',
        padding: fullWidth ? '8px 12px' : '8px 16px',
      }}
    >
      <Hammer size={18} style={{ flexShrink: 0 }} />
      <span style={{ textAlign: 'left' }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 600, lineHeight: 1.25 }}>Apri la scheda lavoro</span>
        <span style={{ display: 'block', fontSize: 12, fontWeight: 400, color: 'var(--cc-muted)', lineHeight: 1.3, marginTop: 1 }}>
          Ore in cantiere, foto e rapportino di fine lavoro
        </span>
      </span>
    </Link>
  )
}
