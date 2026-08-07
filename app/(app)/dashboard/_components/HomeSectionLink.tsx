import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

// ============================================================
// Il collegamento "vedi tutto" delle sezioni della Home.
//
// Vive in UN posto solo perché ce ne sono tre (agenda, preventivi in
// scadenza, fatture da incassare) e devono restare identici: tre copie
// diventerebbero tre stili diversi al primo ritocco.
//
// ⚠️ Grigio, MAI oro: l'oro nella Home segnala urgenza o azione (la
// scadenza, il bordo di «Sollecita»). Un collegamento di navigazione in
// oro competerebbe con la scadenza che sta lì accanto — è la ragione per
// cui «Agenda →», che era oro, è passato di qui (Eli, 7 ago).
// ============================================================

export function HomeSectionLink({ href, label, count }: {
  href: string
  label: string
  count?: number
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontSize: 13, fontWeight: 600, color: '#55534b', textDecoration: 'none',
      }}
    >
      {label}
      {count && count > 0 ? (
        <span style={{ background: '#f0efe9', color: '#55534b', borderRadius: 999, padding: '0 7px', fontSize: 11, fontWeight: 700, lineHeight: 1.7, flexShrink: 0 }}>
          {count}
        </span>
      ) : null}
      <ArrowRight size={14} style={{ color: 'var(--cc-muted)' }} aria-hidden />
    </Link>
  )
}

/**
 * Piede DENTRO la card, separato da un filetto.
 *
 * ⚠️ Il collegamento sta dentro la card, non sotto: fuori galleggiava fra una
 * card e l'altra e allontanava documenti della stessa sezione (Eli 7 ago).
 *
 * ⚠️ `pad` DEVE essere il padding orizzontale della card che lo contiene: serve
 * a portare il filetto fino ai bordi con un margine negativo. Sbagliarlo si
 * vede subito — il filetto resta corto o sborda.
 */
export function HomeCardFootLink({ pad = 16, ...props }: React.ComponentProps<typeof HomeSectionLink> & { pad?: number }) {
  return (
    <div style={{ borderTop: '0.5px solid #efeee9', margin: `12px ${-pad}px 0`, padding: `11px ${pad}px 0`, display: 'flex', justifyContent: 'flex-end' }}>
      <HomeSectionLink {...props} />
    </div>
  )
}
