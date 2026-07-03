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
interface NumericInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number
  onChange: (n: number) => void
  /** Se true: formato italiano 2 decimali (es. "70,00"); select-all al focus */
  locale?: boolean
}

function NumericInput({ value, onChange, locale, ...rest }: NumericInputProps) {
  const formatVal = (v: number) => locale
    ? v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : String(v)

  const [display, setDisplay] = useState(() => formatVal(value))
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    if (!isFocused) setDisplay(formatVal(value))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, isFocused])

  return (
    <Input
      {...rest}
      type="text"
      inputMode="decimal"
      value={display}
      onFocus={(e) => {
        setIsFocused(true)
        if (locale) e.currentTarget.select()
      }}
      onChange={(e) => {
        let raw = e.target.value.replace(/[^\d.,]/g, '')
        if (display === '0' && raw.length > 1 && raw.startsWith('0') && !raw.startsWith('0.') && !raw.startsWith('0,')) {
          raw = raw.slice(1)
        }
        setDisplay(raw)
        const num = parseFloat(raw.replace(',', '.'))
        if (!isNaN(num)) onChange(num)
        else if (raw.trim() === '') onChange(0)
      }}
      onBlur={() => {
        setIsFocused(false)
        const num = parseFloat(display.replace(',', '.'))
        if (isNaN(num) || display.trim() === '') {
          setDisplay(formatVal(0))
          onChange(0)
        } else {
          setDisplay(formatVal(num))
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
  docType?: 'preventivo' | 'fattura'
  autoFocusFirst?: boolean
}

function newVoce(sortOrder: number): VoceItem {
  return {
    _key: `${Date.now()}-${Math.random()}`,
    sort_order: sortOrder,
    description: '',
    unit: 'pz',
    quantity: 1,
    unit_price: 0,
    discount_pct: null,
    vat_rate: null,
  }
}

const ORO = '#b08d3e'

export function VociTable({
  voci,
  onChange,
  fiscalRegime,
  defaultVatRate,
  vatRates,
  units,
  autoFocusFirst = false,
}: VociTableProps) {
  const showVat = fiscalRegime !== 'forfettario'

  function updateVoce(key: string, updates: Partial<VoceItem>) {
    onChange(voci.map((v) => v._key === key ? { ...v, ...updates } : v))
  }

  function removeVoce(key: string) {
    const filtered = voci.filter((v) => v._key !== key)
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
    <div>
      {/* Header colonne — desktop lg+ */}
      <div className="hidden lg:grid px-[15px] py-2 bg-muted/50 text-[13px] font-medium text-muted-foreground border-b"
        style={{ gridTemplateColumns: showVat ? '2fr 90px 90px 100px 80px 90px 32px' : '2fr 90px 90px 100px 80px 32px' }}
      >
        <span>Descrizione <span style={{ color: ORO }}>*</span></span>
        <span>Unità</span>
        <span>Quantità <span style={{ color: ORO }}>*</span></span>
        <span>Prezzo unit. <span style={{ color: ORO }}>*</span></span>
        <span>Sconto %</span>
        {showVat && <span>IVA %</span>}
        <span />
      </div>

      {/* Righe voci */}
      <div className="divide-y divide-border">
        {voci.map((voce, idx) => {
          const lineTotal = voce.quantity * voce.unit_price * (1 - (voce.discount_pct ?? 0) / 100)
          return (
            <div key={voce._key} className="px-[15px] py-3">
              {/* Desktop lg+: griglia a riga singola */}
              <div
                className="hidden lg:grid items-start gap-2"
                style={{ gridTemplateColumns: showVat ? '2fr 90px 90px 100px 80px 90px 32px' : '2fr 90px 90px 100px 80px 32px' }}
              >
                {/* Descrizione con mic dentro */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 12px', minWidth: 0 }}>
                  <textarea
                    placeholder="Descrizione voce…"
                    value={voce.description}
                    rows={1}
                    required
                    className="bg-transparent placeholder:text-muted-foreground focus-visible:outline-none resize-none overflow-hidden leading-normal"
                    style={{ flex: 1, minHeight: '36px', fontSize: 15, border: 'none', padding: 0, minWidth: 0 }}
                    ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }}
                    onChange={(e) => {
                      e.target.style.height = 'auto'
                      e.target.style.height = e.target.scrollHeight + 'px'
                      updateVoce(voce._key, { description: e.target.value })
                    }}
                    autoFocus={autoFocusFirst && idx === 0}
                  />
                  <VoiceInput
                    compact
                    onTranscript={(t) =>
                      updateVoce(voce._key, {
                        description: voce.description ? `${voce.description} ${t}` : t,
                      })
                    }
                    className="flex-none text-[#8a887f]"
                  />
                </div>

                {/* Unità */}
                <Select
                  value={voce.unit}
                  onValueChange={(v) => updateVoce(voce._key, { unit: v })}
                >
                  <SelectTrigger style={{ fontSize: 13, height: 44, boxSizing: 'border-box', padding: '0 10px' }}>
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
                  style={{ fontSize: 13, height: 44, boxSizing: 'border-box', padding: '0 10px' }}
                />

                {/* Prezzo unitario */}
                <div className="relative">
                  <NumericInput
                    locale
                    value={voce.unit_price}
                    onChange={(n) => updateVoce(voce._key, { unit_price: n })}
                    style={{ fontSize: 13, height: 44, boxSizing: 'border-box', padding: '0 20px 0 10px' }}
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
                    onChange={(e) => {
                      const n = e.target.value ? parseFloat(e.target.value) : null
                      updateVoce(voce._key, { discount_pct: n !== null && !isNaN(n) ? n : null })
                    }}
                    onKeyDown={(e) => { if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault() }}
                    style={{ fontSize: 13, height: 44, boxSizing: 'border-box', padding: '0 20px 0 10px' }}
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
                    <SelectTrigger className="w-full" style={{ fontSize: 13, height: 44, boxSizing: 'border-box', padding: '0 10px' }}>
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
                  className="size-8 p-0"
                  style={{ color: '#b3b1ab' }}
                  onClick={() => removeVoce(voce._key)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>

              {/* Totale riga — desktop lg+ */}
              <div className="hidden lg:flex justify-end" style={{ marginTop: 4, fontSize: 15, color: '#8a887f' }}>
                = <b style={{ color: '#161616', marginLeft: 4 }}>€ {lineTotal.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
              </div>

              {/* Mobile + tablet (< lg): stacked */}
              <div className="lg:hidden space-y-2">
                {/* Header: VOCE N + cestino */}
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#8a887f', letterSpacing: '0.05em' }}>
                    VOCE {idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeVoce(voce._key)}
                    style={{ color: '#b3b1ab', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px 0' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Descrizione con mic dentro */}
                <div className="space-y-1">
                  <span style={{ fontSize: 13, color: '#8a887f', display: 'block' }}>
                    Descrizione <span style={{ color: ORO }}>*</span>
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 12px' }}>
                    <textarea
                      placeholder="Descrizione voce…"
                      value={voce.description}
                      rows={1}
                      className="bg-transparent placeholder:text-muted-foreground focus-visible:outline-none resize-none overflow-hidden leading-normal"
                      style={{ flex: 1, minHeight: '36px', fontSize: 15, border: 'none', padding: 0 }}
                      ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }}
                      onChange={(e) => {
                        e.target.style.height = 'auto'
                        e.target.style.height = e.target.scrollHeight + 'px'
                        updateVoce(voce._key, { description: e.target.value })
                      }}
                      autoFocus={autoFocusFirst && idx === 0}
                    />
                    <VoiceInput
                      compact
                      onTranscript={(t) =>
                        updateVoce(voce._key, {
                          description: voce.description ? `${voce.description} ${t}` : t,
                        })
                      }
                      className="flex-none text-[#8a887f]"
                    />
                  </div>
                </div>

                {/* Campi numerici */}
                <div className={`grid gap-2 items-start ${showVat ? 'grid-cols-[90px_1fr_1.5fr_1fr] sm:grid-cols-5' : 'grid-cols-[90px_1fr_1.5fr_1fr]'}`}>
                  <div className="space-y-1">
                    <span style={{ fontSize: 13, color: '#8a887f', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Unità</span>
                    <Select
                      value={voce.unit}
                      onValueChange={(v) => updateVoce(voce._key, { unit: v })}
                    >
                      <SelectTrigger className="w-full truncate" style={{ border: '1px solid #e3e3e6', borderRadius: 10, padding: '0 10px', fontSize: 13, height: 44, boxSizing: 'border-box' }}>
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
                    <span style={{ fontSize: 13, color: '#8a887f', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Q.tà <span style={{ color: ORO }}>*</span>
                    </span>
                    <NumericInput
                      value={voce.quantity}
                      onChange={(n) => updateVoce(voce._key, { quantity: n })}
                      style={{ border: '1px solid #e3e3e6', borderRadius: 10, padding: '0 10px', fontSize: 13, height: 44, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div className="space-y-1">
                    <span style={{ fontSize: 13, color: '#8a887f', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Prezzo <span style={{ color: ORO }}>*</span>
                    </span>
                    <div className="relative">
                      <NumericInput
                        locale
                        value={voce.unit_price}
                        onChange={(n) => updateVoce(voce._key, { unit_price: n })}
                        style={{ border: '1px solid #e3e3e6', borderRadius: 10, padding: '0 20px 0 10px', fontSize: 13, height: 44, boxSizing: 'border-box' }}
                      />
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none">€</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span style={{ fontSize: 13, color: '#8a887f', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Sconto</span>
                    <div className="relative">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        placeholder="—"
                        value={voce.discount_pct ?? ''}
                        onChange={(e) => {
                          const n = e.target.value ? parseFloat(e.target.value) : null
                          updateVoce(voce._key, { discount_pct: n !== null && !isNaN(n) ? n : null })
                        }}
                        onKeyDown={(e) => { if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault() }}
                        style={{ border: '1px solid #e3e3e6', borderRadius: 10, padding: '0 20px 0 10px', fontSize: 13, height: 44, boxSizing: 'border-box' }}
                      />
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none">%</span>
                    </div>
                  </div>
                  {showVat && (
                    <div className="space-y-1">
                      <span style={{ fontSize: 13, color: '#8a887f', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>IVA</span>
                      <Select
                        value={voce.vat_rate !== null ? String(voce.vat_rate) : '__default__'}
                        onValueChange={(v) => updateVoce(voce._key, {
                          vat_rate: v === '__default__' ? null : parseFloat(v)
                        })}
                      >
                        <SelectTrigger className="w-full" style={{ border: '1px solid #e3e3e6', borderRadius: 10, padding: '0 10px', fontSize: 13, height: 44, boxSizing: 'border-box' }}>
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
                    </div>
                  )}
                </div>

                {/* Totale riga */}
                <div style={{ textAlign: 'right', marginTop: 13, fontSize: 15, color: '#8a887f' }}>
                  Totale: <b style={{ color: '#161616' }}>€ {lineTotal.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer aggiungi */}
      <div className="px-[15px] py-3 border-t" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button type="button" onClick={addVoce} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#1a1a2e', fontWeight: 500, fontSize: 14, padding: 0 }}>
          <Plus size={18} /> Aggiungi voce
        </button>
        <CatalogPicker
          onSelect={(item) => {
            const last = voci[voci.length - 1]
            const lastIsEmpty = !!last &&
              last.description.trim() === '' &&
              (last.unit_price ?? 0) === 0

            if (lastIsEmpty) {
              const updated = voci.slice(0, -1)
              onChange([
                ...updated,
                {
                  _key: `${Date.now()}-${Math.random()}`,
                  sort_order: updated.length,
                  description: item.description,
                  unit: item.unit,
                  quantity: 1,
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
                  quantity: 1,
                  unit_price: item.unit_price,
                  discount_pct: null,
                  vat_rate: item.vat_rate,
                },
              ])
            }
          }}
        />
      </div>
    </div>
  )
}
