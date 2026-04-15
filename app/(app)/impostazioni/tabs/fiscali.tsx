'use client'

import { useActionState, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { updateWorkspaceFiscal } from '@/lib/actions/workspace'
import { searchAteco, type AtecoCode } from '@/lib/data/ateco'
import { FORFETTARIO_LEGAL_NOTICE } from '@/lib/fiscal/calcoli'
import type { Database } from '@/types/database'

type Workspace = Database['public']['Tables']['workspaces']['Row']

export function ImpostazioniFiscali({ workspace }: { workspace: Workspace }) {
  const [state, formAction, isPending] = useActionState(updateWorkspaceFiscal, null)
  const [fiscalRegime, setFiscalRegime] = useState(workspace.fiscal_regime)
  const [bolloAuto, setBolloAuto] = useState(workspace.bollo_auto)
  const [ritenuteAuto, setRitenuteAuto] = useState(workspace.ritenuta_auto)
  const [currency, setCurrency] = useState(workspace.default_currency)
  const [atecoQuery, setAtecoQuery] = useState('')
  const [atecoResults, setAtecoResults] = useState<AtecoCode[]>([])
  const [selectedAteco, setSelectedAteco] = useState<AtecoCode | null>(
    workspace.ateco_code
      ? { code: workspace.ateco_code, label: workspace.ateco_code, category: '' }
      : null
  )
  const [showDropdown, setShowDropdown] = useState(false)
  const atecoRef = useRef<HTMLDivElement>(null)

  function handleAtecoSearch(q: string) {
    setAtecoQuery(q)
    setAtecoResults(searchAteco(q))
    setShowDropdown(q.length > 0)
  }

  return (
    <div className="space-y-6">
      <form action={formAction}>
        {/* Hidden fields per i valori controllati */}
        <input type="hidden" name="fiscal_regime" value={fiscalRegime} />
        <input type="hidden" name="ateco_code" value={selectedAteco?.code ?? ''} />
        <input type="hidden" name="bollo_auto" value={bolloAuto ? 'on' : 'off'} />
        <input type="hidden" name="ritenuta_auto" value={ritenuteAuto ? 'on' : 'off'} />
        <input type="hidden" name="default_currency" value={currency} />

        {state?.error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}
        {state?.success && (
          <Alert className="mb-4">
            <AlertDescription>{state.success}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Regime fiscale</CardTitle>
            <CardDescription>
              Determina come vengono calcolati IVA, bollo e stringa legale sui documenti.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Regime fiscale</Label>
              <Select value={fiscalRegime} onValueChange={(v: string) => setFiscalRegime(v as typeof fiscalRegime)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="forfettario">Regime Forfettario</SelectItem>
                  <SelectItem value="ordinario">Regime Ordinario</SelectItem>
                  <SelectItem value="minimi">Regime dei Minimi</SelectItem>
                </SelectContent>
              </Select>
              {fiscalRegime === 'forfettario' && (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 mt-2 leading-relaxed">
                  {FORFETTARIO_LEGAL_NOTICE}
                </p>
              )}
            </div>

            {/* ATECO */}
            <div className="space-y-1.5" ref={atecoRef}>
              <Label>Codice ATECO</Label>
              {selectedAteco ? (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs py-1 px-2 font-mono">
                    {selectedAteco.code}
                  </Badge>
                  <span className="text-sm flex-1 truncate">{selectedAteco.label}</span>
                  <button
                    type="button"
                    onClick={() => { setSelectedAteco(null); setAtecoQuery('') }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    placeholder="Cerca per attività o codice…"
                    value={atecoQuery}
                    onChange={(e) => handleAtecoSearch(e.target.value)}
                    onFocus={() => atecoQuery && setShowDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                    autoComplete="off"
                  />
                  {showDropdown && atecoResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-popover border rounded-lg shadow-lg overflow-hidden">
                      {atecoResults.map((a) => (
                        <button
                          key={a.code}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-start gap-2"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            setSelectedAteco(a)
                            setAtecoQuery('')
                            setShowDropdown(false)
                          }}
                        >
                          <span className="font-mono text-xs text-muted-foreground shrink-0 mt-0.5">
                            {a.code}
                          </span>
                          <span>{a.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Separator className="my-6" />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Numerazione documenti</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="invoice_prefix">Prefisso numerazione</Label>
              <Input
                id="invoice_prefix"
                name="invoice_prefix"
                defaultValue={workspace.invoice_prefix ?? ''}
                placeholder="es. PRV-"
                maxLength={10}
              />
              <p className="text-xs text-muted-foreground">
                Es. &quot;PRV-&quot; produce numeri come PRV-2026/001
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="piva">Partita IVA</Label>
              <Input
                id="piva"
                name="piva"
                defaultValue={workspace.piva ?? ''}
                placeholder="12345678901"
                maxLength={11}
              />
            </div>
          </CardContent>
        </Card>

        <Separator className="my-6" />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Automazioni fiscali</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Marca da bollo automatica</p>
                <p className="text-xs text-muted-foreground">
                  Aggiunge €2,00 ai documenti &gt;€77,47 (forfettari)
                </p>
              </div>
              <Switch
                checked={bolloAuto}
                onCheckedChange={setBolloAuto}
                disabled={fiscalRegime !== 'forfettario'}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Ritenuta d&apos;acconto automatica</p>
                <p className="text-xs text-muted-foreground">
                  Applica ritenuta 20% ai documenti (professionisti)
                </p>
              </div>
              <Switch checked={ritenuteAuto} onCheckedChange={setRitenuteAuto} />
            </div>
          </CardContent>
        </Card>

        <Separator className="my-6" />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Valuta predefinita</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={currency} onValueChange={(v: string) => setCurrency(v as typeof currency)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EUR">EUR — Euro</SelectItem>
                <SelectItem value="GBP">GBP — Sterlina</SelectItem>
                <SelectItem value="CHF">CHF — Franco svizzero</SelectItem>
                <SelectItem value="PLN">PLN — Zloty</SelectItem>
                <SelectItem value="USD">USD — Dollaro USA</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <div className="mt-6">
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <><Loader2 className="size-4 animate-spin" /> Salvataggio…</>
            ) : (
              'Salva impostazioni fiscali'
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
