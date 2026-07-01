'use client'

import { useActionState, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { updateWorkspaceFiscal } from '@/lib/actions/workspace'
import { AtecoMultiSelect } from '@/components/shared/AtecoMultiSelect'
import { FORFETTARIO_LEGAL_NOTICE } from '@/lib/fiscal/calcoli'
import type { Database } from '@/types/database'

type Workspace = Database['public']['Tables']['workspaces']['Row']

// ── Stili condivisi (mockup) ────────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  boxShadow: '0 1px 2px rgba(20,20,40,.05), 0 8px 24px -10px rgba(20,20,40,.15)',
  padding: '15px 15px',
}
const sectionLabelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: '.07em',
  textTransform: 'uppercase',
  color: '#6f6d64',
  marginBottom: 12,
}
const fieldLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '.05em',
  textTransform: 'uppercase',
  color: '#8a887f',
  marginBottom: 7,
}
const fieldStyle: React.CSSProperties = {
  border: '1px solid #e3e3e6',
  borderRadius: 10,
  padding: '11px 12px',
  fontSize: 14,
  color: '#161616',
  width: '100%',
  background: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
}

// Trigger select stile mockup (border #e3e3e6, radius 10, 14px, chevron #8a887f)
const selectTriggerClass =
  'w-full justify-between border border-[#e3e3e6] rounded-[10px] px-3 py-[11px] h-auto text-[14px] text-[#161616] bg-white shadow-none [&>svg]:text-[#8a887f] [&>svg]:opacity-100'

// ── Toggle switch (mockup: 42×24, navy=on, grigio=off) ──────────────────────
function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 42,
        height: 24,
        borderRadius: 999,
        background: checked ? '#1a1a2e' : '#e3e3e6',
        position: 'relative',
        flex: '0 0 auto',
        border: 'none',
        padding: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background .15s',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 20 : 2,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: checked ? 'none' : '0 1px 2px rgba(0,0,0,.2)',
          transition: 'left .15s',
        }}
      />
    </button>
  )
}

export function ImpostazioniFiscali({ workspace }: { workspace: Workspace }) {
  const [state, formAction, isPending] = useActionState(updateWorkspaceFiscal, null)
  const [fiscalRegime, setFiscalRegime] = useState(workspace.fiscal_regime)
  const [piva, setPiva] = useState(workspace.piva ?? '')
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
    <div>
      <form action={formAction}>
        {/* Hidden fields per i valori controllati da state React */}
        <input type="hidden" name="fiscal_regime" value={fiscalRegime} />
        <input type="hidden" name="piva" value={piva} />
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

        {/* ── Dati fiscali ── */}
        <div style={cardStyle}>
          <div style={sectionLabelStyle}>Dati fiscali</div>

          <div style={fieldLabelStyle}>P.IVA / Codice Fiscale</div>
          <input
            id="piva_input"
            value={piva}
            onChange={(e) => setPiva(e.target.value)}
            placeholder="12345678901"
            maxLength={16}
            style={fieldStyle}
          />

          <div style={{ height: 14 }} />

          <div style={fieldLabelStyle}>Regime fiscale</div>
          <Select value={fiscalRegime} onValueChange={(v: string) => setFiscalRegime(v as typeof fiscalRegime)}>
            <SelectTrigger className={selectTriggerClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="forfettario">Regime Forfettario</SelectItem>
              <SelectItem value="ordinario">Regime Ordinario</SelectItem>
              <SelectItem value="minimi">Regime dei Minimi</SelectItem>
            </SelectContent>
          </Select>
          {fiscalRegime === 'forfettario' && (
            <div style={{ background: '#fafafa', borderRadius: 10, padding: '10px 12px', fontSize: 12, color: '#767676', lineHeight: 1.45, marginTop: 8 }}>
              {FORFETTARIO_LEGAL_NOTICE}
            </div>
          )}

          <div style={{ height: 14 }} />

          <div style={fieldLabelStyle}>Codici ATECO</div>
          <AtecoMultiSelect initialCodes={initialAtecoCodes} />
        </div>

        {/* ── Automazioni fiscali ── */}
        <div style={{ ...cardStyle, marginTop: 14 }}>
          <div style={sectionLabelStyle}>Automazioni fiscali</div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#161616' }}>Marca da bollo automatica</div>
              <div style={{ fontSize: 12, color: '#8a887f', marginTop: 2, lineHeight: 1.4 }}>
                Aggiunge € 2,00 ai documenti &gt; € 77,47 (forfettari)
              </div>
            </div>
            <ToggleSwitch
              checked={bolloAuto}
              onChange={setBolloAuto}
              disabled={fiscalRegime !== 'forfettario'}
            />
          </div>

          <div style={{ height: '0.5px', background: '#eee', margin: '13px -15px' }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#161616' }}>Ritenuta d&rsquo;acconto automatica</div>
              <div style={{ fontSize: 12, color: '#8a887f', marginTop: 2, lineHeight: 1.4 }}>
                Applica ritenuta 20% ai documenti (professionisti)
              </div>
            </div>
            <ToggleSwitch checked={ritenuteAuto} onChange={setRitenuteAuto} />
          </div>
        </div>

        {/* ── Valuta ── */}
        <div style={{ ...cardStyle, marginTop: 14 }}>
          <div style={sectionLabelStyle}>Valuta predefinita</div>
          <Select value={currency} onValueChange={(v: string) => setCurrency(v as typeof currency)}>
            <SelectTrigger className={selectTriggerClass}>
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
        </div>

        {/* ── Salva ── */}
        <div style={{ marginTop: 16 }}>
          <button
            type="submit"
            disabled={isPending}
            style={{
              width: '100%',
              background: '#1a1a2e',
              color: '#fff',
              borderRadius: 12,
              height: 50,
              boxSizing: 'border-box',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)',
            }}
          >
            {isPending ? (
              <><Loader2 className="size-4 animate-spin" /> Salvataggio…</>
            ) : (
              <><Save size={18} /> Salva impostazioni fiscali</>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
