'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'

const SORT_OPTIONS = [
  { value: 'recent',      label: 'Ultima modifica' },
  { value: 'oldest',      label: 'Meno recenti' },
  { value: 'expiry',      label: 'Scadenza vicina' },
  { value: 'amount_desc', label: 'Importo ↓' },
  { value: 'amount_asc',  label: 'Importo ↑' },
]

// Default = 'oldest' ("Meno recenti"). La preferenza è salvata in sessionStorage:
// vale solo per la sessione corrente (si azzera chiudendo il browser/tab).
// Chiave v2: ignora di proposito eventuali vecchi valori in localStorage v1.
const STORAGE_KEY = 'preventivi_sort_v2'
const DEFAULT_SORT = 'oldest'

export function SortSelect({ currentSort }: { currentSort?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  // Stato locale per aggiornamento ottimistico dell'etichetta (senza attendere router)
  const [displaySort, setDisplaySort] = useState(currentSort ?? DEFAULT_SORT)

  useEffect(() => {
    setDisplaySort(currentSort ?? DEFAULT_SORT)
  }, [currentSort])

  // Al mount: se non c'è un sort nell'URL, ripristina la preferenza di sessione
  useEffect(() => {
    if (searchParams.has('sort')) return
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY)
      if (saved && saved !== DEFAULT_SORT && SORT_OPTIONS.some((o) => o.value === saved)) {
        const params = new URLSearchParams(searchParams.toString())
        params.set('sort', saved)
        router.replace(`${pathname}?${params.toString()}`)
      }
    } catch { /* sessionStorage non disponibile (SSR, private mode, ecc.) */ }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleChange(value: string) {
    setDisplaySort(value) // aggiornamento ottimistico
    try {
      if (value === DEFAULT_SORT) {
        sessionStorage.removeItem(STORAGE_KEY)
      } else {
        sessionStorage.setItem(STORAGE_KEY, value)
      }
    } catch { /* sessionStorage non disponibile */ }

    const params = new URLSearchParams(searchParams.toString())
    if (value === DEFAULT_SORT) {
      params.delete('sort')
    } else {
      params.set('sort', value)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  const displayLabel = SORT_OPTIONS.find((o) => o.value === displaySort)?.label ?? 'Ordina'

  return (
    <Select value={displaySort} onValueChange={handleChange}>
      <SelectTrigger className="border-0 bg-transparent shadow-none h-auto px-1 gap-1 text-[13px] focus:ring-0 focus-visible:ring-0 w-auto" style={{ color: 'var(--cc-text-2)' }}>
        {/* Etichetta esplicita: Radix SelectValue può non mostrare il testo su mobile */}
        <span className="truncate">{displayLabel}</span>
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
