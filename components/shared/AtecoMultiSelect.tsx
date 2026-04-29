'use client'

// ============================================================
// AtecoMultiSelect
// Selettore multiplo di codici ATECO con autocomplete.
// Emette <input type="hidden" name="ateco_codes[]"> per ogni
// codice selezionato, compatibile con formData.getAll().
//
// Props:
//   initialCodes  — array di codici già salvati (es. ['43.21.01'])
//   maxCodes      — limite morbido (default 5, mostra avviso)
// ============================================================

import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { searchAteco, ATECO_CODES, type AtecoCode } from '@/lib/data/ateco'

interface Props {
  initialCodes?: string[]
  maxCodes?: number
}

/** Risolve un codice stringa nel record AtecoCode completo (se presente nel dataset) */
function resolveCode(code: string): AtecoCode {
  return (
    ATECO_CODES.find((a) => a.code === code) ?? {
      code,
      label: code,
      category: '',
    }
  )
}

export function AtecoMultiSelect({ initialCodes = [], maxCodes = 5 }: Props) {
  const [selected, setSelected] = useState<AtecoCode[]>(
    initialCodes.map(resolveCode)
  )
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AtecoCode[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Codici già selezionati (per escluderli dai risultati)
  const selectedCodes = new Set(selected.map((a) => a.code))
  const atLimit = selected.length >= maxCodes

  function handleSearch(q: string) {
    setQuery(q)
    if (!q.trim()) {
      setResults([])
      setShowDropdown(false)
      return
    }
    const found = searchAteco(q).filter((a) => !selectedCodes.has(a.code))
    setResults(found)
    setShowDropdown(found.length > 0)
  }

  function addCode(code: AtecoCode) {
    if (selectedCodes.has(code.code)) return
    setSelected((prev) => [...prev, code])
    setQuery('')
    setResults([])
    setShowDropdown(false)
    inputRef.current?.focus()
  }

  function removeCode(code: string) {
    setSelected((prev) => prev.filter((a) => a.code !== code))
  }

  return (
    <div className="space-y-2">
      {/* Hidden inputs — uno per ogni codice selezionato */}
      {selected.map((a) => (
        <input key={a.code} type="hidden" name="ateco_codes[]" value={a.code} />
      ))}

      {/* Badge dei codici selezionati */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((a) => (
            <div
              key={a.code}
              className="flex items-center gap-1.5 bg-muted rounded-md pl-2 pr-1 py-1 text-sm"
            >
              <span className="font-mono text-xs text-muted-foreground">
                {a.code}
              </span>
              <span className="text-foreground max-w-[160px] truncate">{a.label}</span>
              <button
                type="button"
                aria-label={`Rimuovi ${a.code}`}
                onClick={() => removeCode(a.code)}
                className="text-muted-foreground hover:text-foreground ml-0.5 rounded"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Avviso limite morbido */}
      {atLimit && (
        <p className="text-xs text-amber-600">
          Hai raggiunto il limite di {maxCodes} codici ATECO.
        </p>
      )}

      {/* Input autocomplete — nascosto quando al limite */}
      {!atLimit && (
        <div className="relative">
          <Input
            ref={inputRef}
            placeholder={
              selected.length === 0
                ? 'Cerca per attività o codice…'
                : 'Aggiungi altro codice…'
            }
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => query.trim() && setShowDropdown(results.length > 0)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            autoComplete="off"
          />

          {showDropdown && (
            <div className="absolute z-10 w-full mt-1 bg-popover border rounded-lg shadow-lg overflow-hidden max-h-52 overflow-y-auto">
              {results.map((a) => (
                <button
                  key={a.code}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-start gap-2"
                  onMouseDown={(e) => {
                    e.preventDefault()  // evita blur prima del click
                    addCode(a)
                  }}
                >
                  <span className="font-mono text-xs text-muted-foreground shrink-0 mt-0.5">
                    {a.code}
                  </span>
                  <span className="flex-1">{a.label}</span>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {a.category}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {selected.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Puoi aggiungere fino a {maxCodes} codici ATECO.
        </p>
      )}
    </div>
  )
}
