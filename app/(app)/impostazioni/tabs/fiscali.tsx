'use client'

import { useActionState, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { OnOffPill } from '@/components/ui/on-off-pill'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { updateWorkspaceFiscal } from '@/lib/actions/workspace'
import { AtecoMultiSelect } from '@/components/shared/AtecoMultiSelect'
import { FORFETTARIO_LEGAL_NOTICE } from '@/lib/fiscal/calcoli'
import type { Database } from '@/types/database'

type Workspace = Database['public']['Tables']['workspaces']['Row']

export function ImpostazioniFiscali({ workspace }: { workspace: Workspace }) {
  const [state, formAction, isPending] = useActionState(updateWorkspaceFiscal, null)
  const [fiscalRegime, setFiscalRegime] = useState(workspace.fiscal_regime)
  const [bolloAuto, setBolloAuto] = useState(workspace.bollo_auto)
  const [ritenuteAuto, setRitenuteAuto] = useState(workspace.ritenuta_auto)
  const [currency, setCurrency] = useState(workspace.default_currency)

  // Recupera i codici ATECO esistenti: preferisce il nuovo array, cade sul singolo legacy
  const initialAtecoCodes: string[] =
    (workspace as any).ateco_codes?.length
      ? (workspace as any).ateco_codes
      : workspace.ateco_code
      ? [workspace.ateco_code]
      : []

  return (
    <div className="space-y-6">
      <form action={formAction}>
        {/* Hidden fields per i valori controllati da state React */}
        <input type="hidden" name="fiscal_regime" value={fiscalRegime} />
        <input type="hidden" name="bollo_auto" value={bolloAuto ? 'on' : 'off'} />
        <input type="hidden" name="ritenuta_auto" value={ritenuteAuto ? 'on' : 'off'} />
        <input type="hidden" name="default_currency" value={currency} />
        {/* ateco_codes[] è emesso direttamente da AtecoMultiSelect */}

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

            {/* ATECO multipli */}
            <div className="space-y-1.5">
              <Label>Codici ATECO</Label>
              <AtecoMultiSelect initialCodes={initialAtecoCodes} />
            </div>
          </CardContent>
        </Card>

        <Separator className="my-6" />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Automazioni fiscali</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* FIX-5: OnOffPill al posto di Switch + span ON/OFF */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Marca da bollo automatica</p>
                <p className="text-xs text-muted-foreground">
                  Aggiunge €2,00 ai documenti &gt;€77,47 (forfettari)
                </p>
              </div>
              <OnOffPill
                checked={bolloAuto}
                onChange={setBolloAuto}
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
              <OnOffPill
                checked={ritenuteAuto}
                onChange={setRitenuteAuto}
              />
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
