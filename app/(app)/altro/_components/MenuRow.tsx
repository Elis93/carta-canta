import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

// ── Riga di menu condivisa (Altro + pagine-hub) ────────────────────────────
// Estratta da altro/page.tsx (14 ago) perché le pagine-contenitore
// («Clienti e appuntamenti», «Catalogo e strumenti», …) usano la stessa riga.
export function MenuRow({
  href,
  icon: Icon,
  label,
  desc,
  descAlways = false,
  hint,
  hintBelow,
  iconColor,
  last = false,
}: {
  href: string
  icon: React.ElementType
  label: string
  /** Breve spiegazione sotto l'etichetta. Di default compare SOLO in modalità
      "Testo grande e leggibile" (classe cc-desc); con descAlways è sempre visibile. */
  desc?: string
  descAlways?: boolean
  /** Badge/pillola a DESTRA (stato: conteggi, PRO). */
  hint?: React.ReactNode
  /** CTA/pillola SOTTO la descrizione (Eli 16 ago: «Passa a Pro» non a destra). */
  hintBelow?: React.ReactNode
  iconColor?: string
  last?: boolean
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        padding: '13px 0',
        borderBottom: last ? 'none' : '0.5px solid #eee',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <Icon
        size={20}
        strokeWidth={1.75}
        style={{ flexShrink: 0, color: iconColor ?? '#1a1a2e' }}
        aria-hidden
      />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15, color: '#161616' }}>{label}</span>
        {desc && (
          <span
            className={descAlways ? undefined : 'cc-desc'}
            style={{ fontSize: 13, color: 'var(--cc-muted)', marginTop: 2, lineHeight: 1.45 }}
          >
            {desc}
          </span>
        )}
        {hintBelow && <span style={{ display: 'block', marginTop: 7 }}>{hintBelow}</span>}
      </span>
      {hint && <span style={{ flexShrink: 0, marginRight: 8 }}>{hint}</span>}
      <ChevronRight
        size={18}
        strokeWidth={1.5}
        style={{ flexShrink: 0, color: 'var(--cc-muted)' }}
        aria-hidden
      />
    </Link>
  )
}
