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
  hintTitle,
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
  /** Badge/pillola a DESTRA (stato: conteggi, PRO). Occupa tutta l'altezza della
      riga: comprime titolo E descrizione — va bene solo per pillole corte. */
  hint?: React.ReactNode
  /** Pillola sulla RIGA DEL TITOLO (Eli 17 ago: «Passa a Pro» deve schiacciare
      al massimo il titolo, mai la descrizione, che resta a tutta larghezza). */
  hintTitle?: React.ReactNode
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
        {hintTitle ? (
          // Il titolo può andare A CAPO quando lo spazio manca (Testo grande):
          // troncarlo con i puntini nasconderebbe informazione proprio nella
          // modalità pensata per leggere meglio. La pillola non si restringe mai.
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 15, color: '#161616', minWidth: 0 }}>{label}</span>
            <span style={{ flexShrink: 0 }}>{hintTitle}</span>
          </span>
        ) : (
          <span style={{ display: 'block', fontSize: 15, color: '#161616' }}>{label}</span>
        )}
        {desc && (
          <span
            className={descAlways ? undefined : 'cc-desc'}
            // ⚠️ Niente `display` inline: sovrascriverebbe `.cc-desc { display:none }`
            // (le descrizioni facoltative comparirebbero sempre).
            style={{ fontSize: 13, color: 'var(--cc-muted)', marginTop: 2, lineHeight: 1.45 }}
          >
            {desc}
          </span>
        )}
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
