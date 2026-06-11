'use client'

// T-18 (FIX-15): tendina autonoma senza Radix Popover — niente
// dismiss/focus-layer della libreria che chiudeva i suggerimenti
// appena comparivano. Vedi anche SendEmailDialog.tsx (ClientSearchInput,
// stesso pattern).

import { useRef, useState, useCallback } from 'react'
import { Search, UserPlus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { searchClientsAction } from '@/lib/actions/clients'

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
  placeholder = 'Cerca cliente…',
  disabled = false,
}: ClientAutocompleteProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ClientHit[]>([])
  const [isFocused, setIsFocused] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const search = useCallback(async (q: string) => {
    setLoading(true)
    const data = await searchClientsAction(q)
    setResults(data as ClientHit[])
    setLoading(false)
  }, [])

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(q), 300)
  }

  function handleFocus() {
    setIsFocused(true)
    if (!results.length) search(query)
  }

  // Chiude la tendina solo se il focus esce davvero dal wrapper (input + lista)
  function handleBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (wrapperRef.current?.contains(e.relatedTarget as Node)) return
    setTimeout(() => {
      if (!wrapperRef.current?.contains(document.activeElement)) {
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

  const open = isFocused && (loading || results.length > 0 || query.trim().length > 0)

  // Cliente già selezionato
  if (value) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 border rounded-lg bg-muted/30">
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
      className="relative"
      ref={wrapperRef}
      onBlur={handleBlur}
      onKeyDown={(e) => { if (e.key === 'Escape') setIsFocused(false) }}
    >
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
      <Input
        value={query}
        onChange={handleInput}
        onFocus={handleFocus}
        placeholder={placeholder}
        className="pl-9"
        disabled={disabled}
        autoComplete="off"
      />
      {open && (
        <ul className="absolute left-0 right-0 top-full mt-1 z-50 max-h-64 overflow-y-auto rounded-md border bg-popover shadow-md">
          {loading && (
            <li className="px-3 py-2 text-sm text-muted-foreground">Ricerca…</li>
          )}

          {!loading && results.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              {query ? 'Nessun cliente trovato.' : 'Inizia a digitare per cercare.'}
            </li>
          )}

          {!loading && results.map((c) => (
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
        </ul>
      )}
    </div>
  )
}
