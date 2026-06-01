'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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

  // Al mount: se non c'è un sort nell'URL, ripristina la preferenza di sessione
  // (solo se diversa dal default, per evitare router.replace inutili → niente flip).
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
    // Salva la preferenza nella sessione (default → rimuovi la chiave)
    try {
      if (value === DEFAULT_SORT) {
        sessionStorage.removeItem(STORAGE_KEY)
      } else {
        sessionStorage.setItem(STORAGE_KEY, value)
      }
    } catch { /* sessionStorage non disponibile */ }

    // Aggiorna URL (preserva gli altri parametri, es. status)
    const params = new URLSearchParams(searchParams.toString())
    if (value === DEFAULT_SORT) {
      params.delete('sort')
    } else {
      params.set('sort', value)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <Select value={currentSort ?? DEFAULT_SORT} onValueChange={handleChange}>
      <SelectTrigger className="h-9 w-full sm:w-40 text-sm">
        <SelectValue />
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
