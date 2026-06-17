'use client'

// T-18 (FIX-15 + FIX-16): tendina autonoma senza Radix Popover — niente
// dismiss/focus-layer della libreria che chiudeva i suggerimenti appena
// comparivano. FIX-16: la lista è renderizzata via React Portal su
// document.body (position: fixed, coordinate da getBoundingClientRect)
// perché altrimenti viene tagliata dall'overflow-hidden/overflow-y-auto
// del DialogContent (popup invio). Vedi anche SendEmailDialog.tsx
// (ClientSearchInput, stesso pattern).

import { useRef, useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Search, UserPlus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { preloadClientsAction } from '@/lib/actions/clients'
import { useAnchorRect, useCloseOnOutsideMouseDown } from '@/components/shared/dropdown-portal'

type ClientHit = {
  id: string
  name: string
  surname?: string | null
  email: string | null
  phone: string | null
  piva: string | null
}

/** Restituisce il nome completo: "Nome Cognome" oppure "Nome" se cognome assente */
function fullName(c: ClientHit): string {
  return c.surname ? `${c.name} ${c.surname}` : c.name
}

// Filtro in-memory sulla lista precaricata — istantaneo, niente round-trip
// server per-tasto (FIX-18). Stesso pattern di SendEmailDialog/filterClients.
function filterClients(query: string, clients: ClientHit[]): ClientHit[] {
  if (query.trim().length < 1) return []
  const q = query.toLowerCase()
  return clients
    .filter((c) => {
      const full = [c.name, c.surname].filter(Boolean).join(' ').toLowerCase()
      if (full.includes(q)) return true
      return c.email ? c.email.toLowerCase().includes(q) : false
    })
    .slice(0, 8)
}

interface ClientAutocompleteProps {
  value: ClientHit | null
  onChange: (client: ClientHit | null) => void
  onCreateNew?: () => void   // apre modal / naviga a /clienti/nuovo
  placeholder?: string
  disabled?: boolean
}

export function ClientAutocomplete({
  value,
  onChange,
  onCreateNew,
  placeholder = 'Cerca o crea cliente…',
  disabled = false,
}: ClientAutocompleteProps) {
  const [query, setQuery] = useState('')
  const [allClients, setAllClients] = useState<ClientHit[]>([])
  const [isFocused, setIsFocused] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Precarica i clienti del workspace una sola volta — i suggerimenti
  // vengono poi filtrati in memoria, senza ritardo (FIX-18).
  useEffect(() => {
    preloadClientsAction().then((data) => setAllClients(data as ClientHit[]))
  }, [])

  const results = useMemo(() => filterClients(query, allClients), [query, allClients])

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
  }

  function handleFocus() {
    setIsFocused(true)
  }

  // Chiude la tendina solo se il focus esce davvero da wrapper+lista (portale)
  function handleBlur(e: React.FocusEvent<HTMLDivElement>) {
    const related = e.relatedTarget as Node | null
    if (wrapperRef.current?.contains(related) || listRef.current?.contains(related)) return
    setTimeout(() => {
      if (
        !wrapperRef.current?.contains(document.activeElement) &&
        !listRef.current?.contains(document.activeElement)
      ) {
        setIsFocused(false)
      }
    }, 120)
  }

  function handleSelect(c: ClientHit) {
    onChange(c)
    setQuery('')
    setIsFocused(false)
  }

  function handleClear() {
    onChange(null)
    setQuery('')
  }

  const open = isFocused && query.trim().length > 0

  const rect = useAnchorRect(wrapperRef, open)
  useCloseOnOutsideMouseDown(open, () => setIsFocused(false), [wrapperRef, listRef])

  // Cliente già selezionato
  if (value) {
    return (
      <div style={{ background: '#f7f7f8', border: '0.5px solid #e6e6e6', borderRadius: 11, padding: '11px 13px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{fullName(value)}</p>
          {(value.email || value.phone) && (
            <p className="text-xs text-muted-foreground truncate">
              {value.email ?? value.phone}
            </p>
          )}
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div
      ref={wrapperRef}
      onBlur={handleBlur}
      onKeyDown={(e) => { if (e.key === 'Escape') setIsFocused(false) }}
      style={{ background: '#f7f7f8', border: '0.5px solid #e6e6e6', borderRadius: 11, padding: '11px 13px', display: 'flex', alignItems: 'center', gap: 8 }}
    >
      <Search size={18} style={{ color: '#8a887f', flexShrink: 0 }} className="pointer-events-none" />
      <Input
        value={query}
        onChange={handleInput}
        onFocus={handleFocus}
        placeholder={placeholder}
        className="border-0 bg-transparent shadow-none focus-visible:ring-0 flex-1 placeholder:text-[#8a887f]"
        style={{ fontSize: 14, fontFamily: 'inherit', height: 20, lineHeight: '20px', padding: 0 }}
        disabled={disabled}
        autoComplete="off"
      />
      {open && rect && createPortal(
        <ul
          ref={listRef}
          data-dropdown-portal
          style={{ position: 'fixed', left: rect.left, top: rect.bottom + 4, width: rect.width, zIndex: 9999, pointerEvents: 'auto' }}
          className="max-h-64 overflow-y-auto rounded-md border bg-popover shadow-md"
        >
          {results.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              Nessun cliente trovato.
            </li>
          )}

          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="w-full text-left px-3 py-2.5 hover:bg-muted flex flex-col gap-0.5 border-b last:border-0"
                onMouseDown={(e) => { e.preventDefault(); handleSelect(c) }}
              >
                <span className="text-sm font-medium">{fullName(c)}</span>
                {(c.email || c.phone) && (
                  <span className="text-xs text-muted-foreground">
                    {c.email ?? c.phone}
                  </span>
                )}
              </button>
            </li>
          ))}

          {onCreateNew && (
            <li>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full rounded-none justify-start gap-2 border-t text-primary"
                onMouseDown={(e) => { e.preventDefault(); onCreateNew() }}
              >
                <UserPlus className="size-4" />
                Aggiungi nuovo cliente
              </Button>
            </li>
          )}
        </ul>,
        document.body,
      )}
    </div>
  )
}
