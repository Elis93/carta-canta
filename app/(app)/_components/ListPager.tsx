// Pager server-side per le liste (preventivi, fatture): naviga per pagina
// preservando ricerca, filtri e ordinamento correnti. Solo <Link> → nessun
// client component, funziona con prefetch. Compare solo con più di una pagina.

import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function ListPager({
  basePath,
  params,
  page,
  totalPages,
}: {
  basePath: string
  /** searchParams correnti (senza `page`): vengono riportati in ogni link. */
  params: Record<string, string | undefined>
  page: number
  totalPages: number
}) {
  if (totalPages <= 1) return null

  const hrefFor = (p: number) => {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v != null && v !== '' && k !== 'page') sp.set(k, v)
    }
    if (p > 1) sp.set('page', String(p))
    const qs = sp.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }

  // Tutto su UNA riga a qualsiasi larghezza (Eli 4 ago): frecce quadrate
  // 44px (tap target pieno) + testo centrale che non va mai a capo.
  const btn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 44, height: 44, flexShrink: 0,
    borderRadius: 12, border: '1px solid #dcdbd7', background: '#fff', color: '#1a1a2e',
    textDecoration: 'none', fontFamily: 'inherit',
  }
  const disabled: React.CSSProperties = { ...btn, color: '#c9c7c0', background: '#f6f5f2', borderColor: '#eceae5', pointerEvents: 'none' }

  return (
    <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 18, flexWrap: 'nowrap' }} aria-label="Paginazione">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} style={btn} prefetch aria-label="Pagina precedente">
          <ChevronLeft size={19} />
        </Link>
      ) : (
        <span style={disabled} aria-hidden><ChevronLeft size={19} /></span>
      )}

      <span style={{ fontSize: 13, color: 'var(--cc-text-2, #55534b)', fontWeight: 600, whiteSpace: 'nowrap' }}>
        Pagina {page} di {totalPages}
      </span>

      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} style={btn} prefetch aria-label="Pagina successiva">
          <ChevronRight size={19} />
        </Link>
      ) : (
        <span style={disabled} aria-hidden><ChevronRight size={19} /></span>
      )}
    </nav>
  )
}
