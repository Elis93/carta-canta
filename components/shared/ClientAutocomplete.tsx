'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Search, UserPlus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { searchClientsAction } from '@/lib/actions/clients'

type ClientHit = {
  id: string
  name: string
  email: string | null
  phone: string | null
  piva: string | null
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
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Chiudi su click fuori
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const search = useCallback(async (q: string) => {
    setLoading(true)
    const data = await searchClientsAction(q)
    setResults(data as ClientHit[])
    setLoading(false)
  }, [])

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value
    setQuery(q)
    setOpen(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(q), 300)
  }

  function handleFocus() {
    setOpen(true)
    if (!results.length) search(query)
  }

  function handleSelect(c: ClientHit) {
    onChange(c)
    setQuery('')
    setOpen(false)
  }

  function handleClear() {
    onChange(null)
    setQuery('')
  }

  // Cliente già selezionato
  if (value) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 border rounded-lg bg-muted/30">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{value.name}</p>
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
    <div ref={containerRef} className="relative">
      <div className="relative">
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
      </div>

      {open && (
        <div className="absolute z-20 w-full mt-1 bg-popover border rounded-lg shadow-lg overflow-hidden">
          {loading && (
            <div className="px-3 py-2 text-sm text-muted-foreground">Ricerca…</div>
          )}

          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              {query ? 'Nessun cliente trovato.' : 'Inizia a digitare per cercare.'}
            </div>
          )}

          {!loading && results.map((c) => (
            <button
              key={c.id}
              type="button"
              className="w-full text-left px-3 py-2.5 hover:bg-muted flex flex-col gap-0.5 border-b last:border-0"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(c) }}
            >
              <span className="text-sm font-medium">{c.name}</span>
              {(c.email || c.phone) && (
                <span className="text-xs text-muted-foreground">
                  {c.email ?? c.phone}
                </span>
              )}
            </button>
          ))}

          {onCreateNew && (
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
          )}
        </div>
      )}
    </div>
  )
}
