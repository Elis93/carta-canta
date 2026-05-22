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

const STORAGE_KEY = 'preventivi_sort_v1'

export function SortSelect({ currentSort }: { currentSort?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  // Al mount: se non c'è un sort nell'URL, ripristina la preferenza salvata
  useEffect(() => {
    if (searchParams.has('sort')) return
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved && saved !== 'recent' && SORT_OPTIONS.some((o) => o.value === saved)) {
        const params = new URLSearchParams(searchParams.toString())
        params.set('sort', saved)
        router.replace(`${pathname}?${params.toString()}`)
      }
    } catch { /* localStorage non disponibile (SSR, private mode, ecc.) */ }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleChange(value: string) {
    // Salva la preferenza in localStorage
    try {
      if (value === 'recent') {
        localStorage.removeItem(STORAGE_KEY)
      } else {
        localStorage.setItem(STORAGE_KEY, value)
      }
    } catch { /* localStorage non disponibile */ }

    // Aggiorna URL (preserva gli altri parametri, es. status)
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'recent') {
      params.delete('sort')
    } else {
      params.set('sort', value)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <Select value={currentSort ?? 'recent'} onValueChange={handleChange}>
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
