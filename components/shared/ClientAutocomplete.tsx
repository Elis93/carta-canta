'use client'

// FIX dropdown clipping: il dropdown usa Radix PopoverContent (portal)
// invece di un div absolute, così sfugge a overflow:hidden dei Card.

import { useRef, useState, useCallback } from 'react'
import { Search, UserPlus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
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
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // T-18bis: l'anchor (input) non fa parte del layer "dismissable" del Popover —
  // un pointerdown sull'input mentre il popover è aperto viene visto da Radix
  // come "interazione fuori dal popover" e lo chiude subito (suggerimenti che
  // "spariscono" appena si tocca/digita). Escludiamo l'anchor da onInteractOutside.
  const anchorRef = useRef<HTMLDivElement>(null)

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
    <Popover open={open}>
      <PopoverAnchor asChild>
        <div className="relative" ref={anchorRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={handleInput}
            onFocus={handleFocus}
            onBlur={() => setTimeout(() => setOpen(false), 300)}
            placeholder={placeholder}
            className="pl-9"
            disabled={disabled}
            autoComplete="off"
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onEscapeKeyDown={() => setOpen(false)}
        onInteractOutside={(e) => {
          if (anchorRef.current?.contains(e.target as Node)) return
          setOpen(false)
        }}
        className="p-0"
        style={{ width: 'var(--radix-popover-anchor-width)' }}
      >
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
            onPointerDown={(e) => { e.preventDefault(); handleSelect(c) }}
          >
            <span className="text-sm font-medium">{fullName(c)}</span>
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
            onPointerDown={(e) => { e.preventDefault(); onCreateNew() }}
          >
            <UserPlus className="size-4" />
            Aggiungi nuovo cliente
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}
