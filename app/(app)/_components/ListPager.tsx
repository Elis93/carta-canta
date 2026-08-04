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

  const btn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5, height: 44, padding: '0 14px',
    borderRadius: 10, border: '1px solid #e3e3e6', background: '#fff', color: '#1a1a2e',
    fontSize: 14, fontWeight: 600, textDecoration: 'none', fontFamily: 'inherit',
  }
  const disabled: React.CSSProperties = { ...btn, color: '#bcbbb5', background: '#f6f5f2', pointerEvents: 'none' }

  return (
    <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 18 }} aria-label="Paginazione">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} style={btn} prefetch>
          <ChevronLeft size={16} /> Precedente
        </Link>
      ) : (
        <span style={disabled}><ChevronLeft size={16} /> Precedente</span>
      )}

      <span style={{ fontSize: 13, color: 'var(--cc-muted)', fontWeight: 600 }}>
        Pagina {page} di {totalPages}
      </span>

      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} style={btn} prefetch>
          Successiva <ChevronRight size={16} />
        </Link>
      ) : (
        <span style={disabled}>Successiva <ChevronRight size={16} /></span>
      )}
    </nav>
  )
}
