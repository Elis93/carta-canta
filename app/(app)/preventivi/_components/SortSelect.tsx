'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const SORT_OPTIONS = [
  { value: 'recent',      label: 'Ultima modifica' },
  { value: 'oldest',      label: 'Meno recenti' },
  { value: 'expiry',      label: 'Scadenza vicina' },
  { value: 'number_desc', label: 'Numero ↓' },
  { value: 'number_asc',  label: 'Numero ↑' },
  { value: 'amount_desc', label: 'Importo ↓' },
  { value: 'amount_asc',  label: 'Importo ↑' },
]

// Default = 'oldest' ("Meno recenti"). La preferenza è salvata in un COOKIE di
// sessione (niente Max-Age → si azzera chiudendo il browser) letto SERVER-SIDE
// dalle pagine /preventivi e /fatture: la lista arriva già nell'ordine scelto
// al primo paint, senza il router.replace post-mount che causava il "salto"
// visibile dei documenti ~1s dopo l'apertura della pagina.
// Cookie PER-PAGINA: la scelta fatta sui Preventivi non si applica alle Fatture.
const DEFAULT_SORT = 'oldest'

export function SortSelect({ currentSort }: { currentSort?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const COOKIE_KEY = pathname.startsWith('/fatture') ? 'cc_sort_fatture' : 'cc_sort_preventivi'

  // Stato locale per aggiornamento ottimistico dell'etichetta (senza attendere router)
  const [displaySort, setDisplaySort] = useState(currentSort ?? DEFAULT_SORT)

  useEffect(() => {
    setDisplaySort(currentSort ?? DEFAULT_SORT)
  }, [currentSort])

  function handleChange(value: string) {
    setDisplaySort(value) // aggiornamento ottimistico
    try {
      if (value === DEFAULT_SORT) {
        document.cookie = `${COOKIE_KEY}=; path=/; max-age=0; samesite=lax`
      } else {
        document.cookie = `${COOKIE_KEY}=${value}; path=/; samesite=lax`
      }
    } catch { /* cookie non disponibili */ }

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
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        className="flex items-center gap-1 border-0 bg-transparent shadow-none px-1 text-[13px] focus:outline-none focus-visible:outline-none"
        style={{ color: 'var(--cc-text-2)' }}
      >
        <span>{displayLabel}</span>
        <ChevronDown size={14} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="min-w-[190px]">
        <DropdownMenuRadioGroup value={displaySort} onValueChange={handleChange}>
          {SORT_OPTIONS.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value}>
              {o.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
