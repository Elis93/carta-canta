'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { VoceItem } from './PreventivoForm'
import { CatalogPicker } from './CatalogPicker'
import { VoiceInput } from '@/components/shared/VoiceInput'

// ── NumericInput ──────────────────────────────────────────────────────────────
// Input numerico con comportamento FIX-25:
// - Click: posiziona cursore normalmente (no select-all)
// - Digitare sostituisce "0" se il valore corrente è esattamente 0
// - Blur: resetta a "0" se il campo è vuoto o non parseable
interface NumericInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number
  onChange: (n: number) => void
}

function NumericInput({ value, onChange, ...rest }: NumericInputProps) {
  const [display, setDisplay] = useState(String(value))

  // Sincronizza con aggiornamenti esterni (es. reset form, caricamento dati)
  useEffect(() => {
    setDisplay(String(value))
  }, [value])

  return (
    <Input
      {...rest}
      type="text"
      inputMode="decimal"
      value={display}
      onChange={(e) => {
        let raw = e.target.value
        // Se il valore mostrato era "0" e l'utente ha aggiunto un carattere,
        // rimuovi lo "0" iniziale (es. "05" → "5", "0." → "0." tenuto)
        if (display === '0' && raw.length > 1 && raw.startsWith('0') && !raw.startsWith('0.')) {
          raw = raw.slice(1)
        }
        setDisplay(raw)
        const num = parseFloat(raw.replace(',', '.'))
        if (!isNaN(num)) onChange(num)
        else if (raw.trim() === '') onChange(0)
      }}
      onBlur={() => {
        const num = parseFloat(display.replace(',', '.'))
        if (isNaN(num) || display.trim() === '') {
          setDisplay('0')
          onChange(0)
        } else {
          setDisplay(String(num))
          onChange(num)
        }
      }}
    />
  )
}

interface VociTableProps {
  voci: VoceItem[]
  onChange: (voci: VoceItem[]) => void
  fiscalRegime: 'forfettario' | 'ordinario' | 'minimi'
  defaultVatRate?: number | null
  vatRates: number[]
  units: string[]
  bonusEdilizio?: string
}

function newVoce(sortOrder: number): VoceItem {
  return {
    _key: `${Date.now()}-${Math.random()}`,
    sort_order: sortOrder,
    description: '',
    unit: 'pz',
    quantity: 0,    // FIX-2: default 0 (non 1)
    unit_price: 0,
    discount_pct: null,
    vat_rate: null,
  }
}

export function VociTable({
  voci,
  onChange,
  fiscalRegime,
  defaultVatRate,
  vatRates,
  units,
  bonusEdilizio,
}: VociTableProps) {
  const showVat = fiscalRegime !== 'forfettario'
  const showBonus = !!bonusEdilizio

  function updateVoce(key: string, updates: Partial<VoceItem>) {
    onChange(voci.map((v) => v._key === key ? { ...v, ...updates } : v))
  }

  function removeVoce(key: string) {
    const filtered = voci.filter((v) => v._key !== key)
    // Se era l'ultima voce, reinizializza con una riga vuota pronta da compilare
    if (filtered.length === 0) {
      onChange([newVoce(0)])
      return
    }
    onChange(filtered.map((v, i) => ({ ...v, sort_order: i })))
  }

  function addVoce() {
    onChange([...voci, newVoce(voci.length)])
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-4 md:px-5 py-3 border-b flex items-center justify-between gap-2">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          Voci preventivo
        </h2>
        {/* FIX-3: rimosso il pulsante "+ Aggiungi voce" duplicato dall'header
            (rimane solo quello nel footer qui sotto) */}
        <CatalogPicker
          onSelect={(item) => {
            // Controlla se l'ultima riga è vuota (default non toccato dall'utente)
            const last = voci[voci.length - 1]
            const lastIsEmpty = !!last &&
              last.description === '' &&
              last.unit_price === 0 &&
              last.quantity === 0

            if (lastIsEmpty) {
              // Sostituisce la riga vuota invece di accodarsi dopo di essa
              const updated = voci.slice(0, -1)
              onChange([
                ...updated,
                {
                  _key: `${Date.now()}-${Math.random()}`,
                  sort_order: updated.length,
                  description: item.description,
                  unit: item.unit,
                  quantity: 0,
                  unit_price: item.unit_price,
                  discount_pct: null,
                  vat_rate: item.vat_rate,
                },
              ])
            } else {
              onChange([
                ...voci,
                {
                  _key: `${Date.now()}-${Math.random()}`,
                  sort_order: voci.length,
                  description: item.description,
                  unit: item.unit,
                  quantity: 0,
                  unit_price: item.unit_price,
                  discount_pct: null,
                  vat_rate: item.vat_rate,
                },
              ])
            }
          }}
        />
      </div>

      {/* Header colonne — desktop md+ */}
      <div className="hidden md:grid px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b"
        style={{ gridTemplateColumns:
          showBonus && showVat ? '2fr 100px 80px 90px 100px 80px 90px 32px' :
          showBonus            ? '2fr 100px 80px 90px 100px 80px 32px' :
          showVat              ? '2fr 80px 90px 100px 80px 90px 32px' :
                                 '2fr 80px 90px 100px 80px 32px'
        }}
      >
        <span>Descrizione</span>
        {showBonus && <span>Tipo voce</span>}
        <span>Unità</span>
        <span>Quantità</span>
        <span>Prezzo unit.</span>
        <span>Sconto %</span>
        {showVat && <span>IVA %</span>}
        <span />
      </div>

      {/* Righe voci */}
      <div className="divide-y divide-border">
        {voci.map((voce, idx) => {
          const lineTotal = voce.quantity * voce.unit_price * (1 - (voce.discount_pct ?? 0) / 100)
          return (
            <div key={voce._key} className="px-4 py-3 space-y-2 lg:space-y-0">
              {/* Desktop md+: griglia */}
              <div
                className="hidden md:grid items-center gap-2"
                style={{ gridTemplateColumns:
                  showBonus && showVat ? '2fr 100px 80px 90px 100px 80px 90px 32px' :
                  showBonus            ? '2fr 100px 80px 90px 100px 80px 32px' :
                  showVat              ? '2fr 80px 90px 100px 80px 90px 32px' :
                                         '2fr 80px 90px 100px 80px 32px'
                }}
              >
                {/* Descrizione + mic */}
                <div className="flex items-center gap-1 min-w-0">
                  <Input
                    placeholder="Descrizione voce…"
                    value={voce.description}
                    onChange={(e) => updateVoce(voce._key, { description: e.target.value })}
                    required
                    className="flex-1 min-w-0"
                  />
                  <VoiceInput
                    onTranscript={(t) =>
                      updateVoce(voce._key, {
                        description: voce.description ? `${voce.description} ${t}` : t,
                      })
                    }
                    className="shrink-0"
                  />
                </div>

                {/* Tipo voce bonus (solo quando bonus attivo) */}
                {showBonus && (
                  <Select
                    value={voce.bonus_tipo ?? '__std__'}
                    onValueChange={(v) => {
                      const tipo = v === '__std__' ? null : v
                      updateVoce(voce._key, {
                        bonus_tipo: tipo,
                        vat_rate: tipo ? 10 : null,
                      })
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__std__">Standard</SelectItem>
                      <SelectItem value="trainante">Trainante</SelectItem>
                      <SelectItem value="trainato">Trainato</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                {/* Unità */}
                <Select
                  value={voce.unit}
                  onValueChange={(v) => updateVoce(voce._key, { unit: v })}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Quantità */}
                <NumericInput
                  value={voce.quantity}
                  onChange={(n) => updateVoce(voce._key, { quantity: n })}
                />

                {/* Prezzo unitario */}
                <div className="relative">
                  <NumericInput
                    value={voce.unit_price}
                    onChange={(n) => updateVoce(voce._key, { unit_price: n })}
                    className="pr-5"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">€</span>
                </div>

                {/* Sconto % */}
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="—"
                    value={voce.discount_pct ?? ''}
                    onChange={(e) => updateVoce(voce._key, {
                      discount_pct: e.target.value ? parseFloat(e.target.value) : null
                    })}
                    className="pr-5"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">%</span>
                </div>

                {/* IVA (solo non-forfettari) */}
                {showVat && (
                  <Select
                    value={voce.vat_rate !== null ? String(voce.vat_rate) : '__default__'}
                    onValueChange={(v) => updateVoce(voce._key, {
                      vat_rate: v === '__default__' ? null : parseFloat(v)
                    })}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__default__">
                        {defaultVatRate != null ? `${defaultVatRate}%` : '22%'}
                      </SelectItem>
                      {vatRates.filter((r) => r !== (defaultVatRate ?? 22)).map((r) => (
                        <SelectItem key={r} value={String(r)}>{r}%</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Elimina */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="size-8 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeVoce(voce._key)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>

              {/* Mobile: stacked */}
              <div className="md:hidden space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-4">{idx + 1}.</span>
                  <Input
                    placeholder="Descrizione voce…"
                    value={voce.description}
                    onChange={(e) => updateVoce(voce._key, { description: e.target.value })}
                    className="flex-1 min-w-0"
                  />
                  <VoiceInput
                    onTranscript={(t) =>
                      updateVoce(voce._key, {
                        description: voce.description ? `${voce.description} ${t}` : t,
                      })
                    }
                    className="shrink-0"
                  />
                  {showBonus && (
                    <Select
                      value={voce.bonus_tipo ?? '__std__'}
                      onValueChange={(v) => {
                        const tipo = v === '__std__' ? null : v
                        updateVoce(voce._key, {
                          bonus_tipo: tipo,
                          vat_rate: tipo ? 10 : null,
                        })
                      }}
                    >
                      <SelectTrigger className="h-9 w-28 text-xs shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__std__">Standard</SelectItem>
                        <SelectItem value="trainante">Trainante</SelectItem>
                        <SelectItem value="trainato">Trainato</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="size-8 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeVoce(voce._key)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-5 gap-1.5 pl-6">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Unità</span>
                    <Select
                      value={voce.unit}
                      onValueChange={(v) => updateVoce(voce._key, { unit: v })}
                    >
                      <SelectTrigger className="h-9 text-xs px-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map((u) => (
                          <SelectItem key={u} value={u}>{u}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Qtà</span>
                    <NumericInput
                      value={voce.quantity}
                      onChange={(n) => updateVoce(voce._key, { quantity: n })}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Prezzo €</span>
                    <NumericInput
                      value={voce.unit_price}
                      onChange={(n) => updateVoce(voce._key, { unit_price: n })}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Sconto %</span>
                    <div className="relative">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        placeholder="—"
                        value={voce.discount_pct ?? ''}
                        onChange={(e) => updateVoce(voce._key, {
                          discount_pct: e.target.value ? parseFloat(e.target.value) : null,
                        })}
                        className="pr-4 text-sm"
                      />
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">%</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Totale</span>
                    <div className="h-9 flex items-center text-sm font-medium">
                      €{lineTotal.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Totale riga — desktop md+, allineato a destra */}
              <div className="hidden md:flex justify-end">
                <span className="text-sm font-medium text-muted-foreground">
                  = <span className="text-foreground font-semibold">€{lineTotal.toFixed(2)}</span>
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer aggiungi */}
      <div className="px-4 py-3 border-t">
        <Button type="button" variant="ghost" size="sm" onClick={addVoce} className="w-full">
          <Plus className="size-4" /> Aggiungi voce
        </Button>
      </div>
    </div>
  )
}
