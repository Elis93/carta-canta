'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { VoceItem } from './PreventivoForm'
import { CatalogPicker } from './CatalogPicker'

interface VociTableProps {
  voci: VoceItem[]
  onChange: (voci: VoceItem[]) => void
  fiscalRegime: 'forfettario' | 'ordinario' | 'minimi'
  defaultVatRate?: number | null
  vatRates: number[]
  units: string[]
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

export function VociTable({
  voci,
  onChange,
  fiscalRegime,
  defaultVatRate,
  vatRates,
  units,
}: VociTableProps) {
  const showVat = fiscalRegime !== 'forfettario'

  function updateVoce(key: string, updates: Partial<VoceItem>) {
    onChange(voci.map((v) => v._key === key ? { ...v, ...updates } : v))
  }

  function removeVoce(key: string) {
    if (voci.length <= 1) return
    onChange(voci.filter((v) => v._key !== key).map((v, i) => ({ ...v, sort_order: i })))
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
        <div className="flex items-center gap-1">
          <CatalogPicker
            onSelect={(item) => {
              const newVoce: VoceItem = {
                _key: `${Date.now()}-${Math.random()}`,
                sort_order: voci.length,
                description: item.description,
                unit: item.unit,
                quantity: 1,
                unit_price: item.unit_price,
                discount_pct: null,
                vat_rate: item.vat_rate,
              }
              onChange([...voci, newVoce])
            }}
          />
          <Button type="button" variant="ghost" size="sm" onClick={addVoce}>
            <Plus className="size-4" /> Aggiungi voce
          </Button>
        </div>
      </div>

      {/* Header colonne — solo desktop */}
      <div className="hidden md:grid px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b"
        style={{ gridTemplateColumns: showVat
          ? '2fr 80px 90px 100px 80px 90px 32px'
          : '2fr 80px 90px 100px 80px 32px' }}
      >
        <span>Descrizione</span>
        <span>UM</span>
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
            <div key={voce._key} className="px-4 md:px-4 py-3 space-y-2 md:space-y-0">
              {/* Desktop: griglia */}
              <div
                className="hidden md:grid items-center gap-2"
                style={{ gridTemplateColumns: showVat
                  ? '2fr 80px 90px 100px 80px 90px 32px'
                  : '2fr 80px 90px 100px 80px 32px' }}
              >
                {/* Descrizione */}
                <Input
                  placeholder="Descrizione voce…"
                  value={voce.description}
                  onChange={(e) => updateVoce(voce._key, { description: e.target.value })}
                  required
                />

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
                <Input
                  type="number"
                  min="0"
                  step="0.001"
                  value={voce.quantity}
                  onChange={(e) => updateVoce(voce._key, { quantity: parseFloat(e.target.value) || 0 })}
                />

                {/* Prezzo unitario */}
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={voce.unit_price}
                    onChange={(e) => updateVoce(voce._key, { unit_price: parseFloat(e.target.value) || 0 })}
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
                        {defaultVatRate != null ? `${defaultVatRate}% (def.)` : '22% (def.)'}
                      </SelectItem>
                      {vatRates.map((r) => (
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
                  disabled={voci.length <= 1}
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
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="size-8 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeVoce(voce._key)}
                    disabled={voci.length <= 1}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2 pl-6">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Qtà</span>
                    <Input
                      type="number" min="0" step="0.001"
                      value={voce.quantity}
                      onChange={(e) => updateVoce(voce._key, { quantity: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Prezzo €</span>
                    <Input
                      type="number" min="0" step="0.01"
                      value={voce.unit_price}
                      onChange={(e) => updateVoce(voce._key, { unit_price: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Totale</span>
                    <div className="h-9 flex items-center text-sm font-medium text-right">
                      €{lineTotal.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Totale riga — desktop, allineato a destra */}
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
