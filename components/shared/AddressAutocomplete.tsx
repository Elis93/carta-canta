'use client'

// Suggerimenti dell'indirizzo del cantiere — INTERNI (decisione Eli 20 ago:
// niente Google Places, che manderebbe l'indirizzo a terzi ed è a pagamento).
// Mentre l'artigiano scrive, compaiono gli indirizzi che ha GIÀ usato nei
// sopralluoghi e nei lavori; un tocco lo conferma. Stesso schema di
// ClientAutocomplete: lista caricata una volta al primo focus, filtro in
// memoria, tendina in portale su document.body (mai tagliata dai contenitori).

import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MapPin } from 'lucide-react'
import { preloadCantiereAddressesAction } from '@/lib/actions/sopralluoghi'
import { useAnchorRect, useCloseOnOutsideMouseDown } from '@/components/shared/dropdown-portal'

function filtraIndirizzi(query: string, tutti: string[]): string[] {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  return tutti
    .filter((a) => {
      const low = a.toLowerCase()
      // L'indirizzo identico a quello già scritto non è un suggerimento utile.
      return low !== q && low.includes(q)
    })
    .slice(0, 8)
}

interface AddressAutocompleteProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  maxLength?: number
  /** Stile del campo <input> (riusa il fieldStyle del form). */
  style?: React.CSSProperties
}

export function AddressAutocomplete({
  value,
  onChange,
  placeholder = 'Indirizzo del cantiere',
  maxLength = 200,
  style,
}: AddressAutocompleteProps) {
  const [tutti, setTutti] = useState<string[]>([])
  const [isFocused, setIsFocused] = useState(false)
  // Dopo un tocco su un suggerimento non si riapre la tendina con lo stesso
  // valore: si riapre solo quando l'artigiano ricomincia a scrivere.
  const [chiusaPer, setChiusaPer] = useState<string | null>(null)
  const loadedRef = useRef(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  function handleFocus() {
    setIsFocused(true)
    if (loadedRef.current) return
    loadedRef.current = true
    preloadCantiereAddressesAction()
      .then((data) => setTutti(data))
      .catch(() => setTutti([]))
  }

  const results = useMemo(() => filtraIndirizzi(value, tutti), [value, tutti])
  const open = isFocused && value !== chiusaPer && results.length > 0
  const rect = useAnchorRect(wrapperRef, open)
  useCloseOnOutsideMouseDown(open, () => setIsFocused(false), [wrapperRef, listRef])

  function scegli(addr: string) {
    onChange(addr)
    setChiusaPer(addr)
    setIsFocused(false)
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setChiusaPer(null) }}
        onFocus={handleFocus}
        onBlur={() => setTimeout(() => setIsFocused(false), 120)}
        onKeyDown={(e) => { if (e.key === 'Escape') setIsFocused(false) }}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete="off"
        style={style}
      />
      {open && rect && createPortal(
        <ul
          ref={listRef}
          data-dropdown-portal
          style={{ position: 'fixed', left: rect.left, top: rect.bottom + 4, width: rect.width, zIndex: 9999, pointerEvents: 'auto' }}
          className="cc-portal-float max-h-64 overflow-y-auto rounded-md border bg-popover shadow-md"
        >
          {results.map((a) => (
            <li key={a}>
              <button
                type="button"
                className="w-full text-left px-3 py-2.5 hover:bg-muted flex items-center gap-2 border-b last:border-0"
                onMouseDown={(e) => { e.preventDefault(); scegli(a) }}
              >
                <MapPin size={14} className="shrink-0 text-muted-foreground" />
                <span className="text-sm">{a}</span>
              </button>
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  )
}
