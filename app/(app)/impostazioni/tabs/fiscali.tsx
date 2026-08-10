'use client'

import { useActionState, useEffect, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { updateWorkspaceFiscal } from '@/lib/actions/workspace'
import { isValidPivaFormat } from '@/lib/fiscal/piva'
import { AtecoMultiSelect } from '@/components/shared/AtecoMultiSelect'
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
  color: 'var(--cc-muted)',
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
  'w-full justify-between border border-[#e3e3e6] rounded-[10px] px-3 py-[11px] h-auto text-[14px] text-[#161616] bg-white shadow-none [&>svg]:text-[var(--cc-muted)] [&>svg]:opacity-100'

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

  // Toast in basso (l'Alert inline in cima restava fuori schermo premendo
  // Salva in fondo — feedback Eli 5 lug)
  useEffect(() => {
    if (state?.success) {
      toast.success('Impostazioni salvate', { description: 'Le modifiche sono attive.', closeButton: true })
    }
  }, [state])

  const [fiscalRegime, setFiscalRegime] = useState(workspace.fiscal_regime)
  const [piva, setPiva] = useState(workspace.piva ?? '')
  // Costo orario manodopera (052) — usato dall'Economia del lavoro
  const [hourlyCost, setHourlyCost] = useState(
    (workspace as { hourly_cost?: number | null }).hourly_cost != null
      ? String((workspace as { hourly_cost?: number | null }).hourly_cost).replace('.', ',')
      : ''
  )
  // Toggle "Automazioni fiscali" nascosti (vedi commento più sotto): i valori
  // salvati restano e vengono rimandati invariati dagli hidden input.
  const [bolloAuto] = useState(workspace.bollo_auto)
  const [ritenuteAuto] = useState(workspace.ritenuta_auto)
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
          {/* Controllo matematico immediato (decisione Eli 29 lug): un typo
              nella P.IVA scoperto QUI costa zero; scoperto dallo SdI costa
              uno scarto. Solo avviso: il salvataggio non viene mai bloccato.
              La regex CF ammette l'omocodia (lettere al posto di cifre). */}
          {(() => {
            const cleaned = piva.trim().toUpperCase().replace(/[\s.]/g, '').replace(/^IT/, '')
            if (!cleaned) return null
            const warnStyle: React.CSSProperties = {
              fontSize: 12, color: '#8a6c33', background: '#faf7f0',
              border: '1px solid #eee3cc', borderRadius: 9,
              padding: '7px 10px', margin: '6px 0 0', lineHeight: 1.45,
            }
            if (/^\d{11}$/.test(cleaned) && !isValidPivaFormat(cleaned)) {
              return <p style={warnStyle}>Questa P.IVA non sembra corretta (la cifra di controllo non torna): ricontrollala. Puoi salvare comunque.</p>
            }
            const CF_PERSONA = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/
            if (cleaned.length === 16 && !CF_PERSONA.test(cleaned)) {
              return <p style={warnStyle}>Questo Codice Fiscale non sembra corretto: ricontrollalo. Puoi salvare comunque.</p>
            }
            return null
          })()}

          <div style={{ height: 14 }} />

          <div style={fieldLabelStyle}>Costo orario manodopera (€/ora)</div>
          <input
            name="hourly_cost"
            value={hourlyCost}
            onChange={(e) => setHourlyCost(e.target.value.replace(/[^\d.,]/g, ''))}
            inputMode="decimal"
            placeholder="es. 35"
            maxLength={8}
            style={fieldStyle}
          />
          <p style={{ fontSize: 12, color: '#767676', margin: '6px 0 0', lineHeight: 1.5 }}>
            Serve al margine dei Lavori: le ore registrate col timer vengono
            contate come costo di manodopera. Lascia vuoto per non usarlo.
          </p>

          <div style={{ height: 14 }} />

          <div style={fieldLabelStyle}>Regime fiscale</div>
          <Select value={fiscalRegime} onValueChange={(v: string) => setFiscalRegime(v as typeof fiscalRegime)}>
            <SelectTrigger className={selectTriggerClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="forfettario">Regime Forfettario</SelectItem>
              <SelectItem value="ordinario">Regime Ordinario</SelectItem>
              {/* ⚠️ Il Regime dei Minimi NON si offre più (decisione Eli, 10
                  ago — N6): l'app lo trattava da ordinario (IVA addebitata,
                  niente bollo né dicitura), cioè lo gestiva male. La voce
                  resta visibile SOLO a chi la avesse già selezionata, così la
                  tendina non mostra il vuoto — ma non si può più scegliere. */}
              {fiscalRegime === 'minimi' && (
                <SelectItem value="minimi">Regime dei Minimi</SelectItem>
              )}
            </SelectContent>
          </Select>
          {fiscalRegime === 'forfettario' && (
            <div style={{ background: '#fafafa', borderRadius: 10, padding: '10px 12px', fontSize: 12, color: '#767676', lineHeight: 1.45, marginTop: 8 }}>
              I documenti riporteranno la dicitura di legge del regime forfettario (operazione non soggetta a IVA, L. 190/2014).
            </div>
          )}

          <div style={{ height: 14 }} />

          <div data-tour="ateco-field">
            <div id="ateco" style={{ ...fieldLabelStyle, scrollMarginTop: 90 }}>Codici ATECO</div>
            <AtecoMultiSelect initialCodes={initialAtecoCodes} />
          </div>
        </div>

        {/* ── Automazioni fiscali ── */}
        {/* ⚠️ Card "Automazioni fiscali" NASCOSTA (review 25 lug #4/#5):
            ENTRAMBI gli interruttori erano scollegati dal motore fiscale —
            · "Ritenuta d'acconto automatica": il flag veniva salvato ma nessun
              calcolo lo leggeva (fiscalOpts senza ritenuta_pct) → prometteva
              una ritenuta mai applicata = fattura sbagliata per chi si fidava;
            · "Marca da bollo automatica" su OFF veniva ignorato (calcoli.ts
              applica il bollo solo in base a regime+soglia): spegnerlo non
              faceva nulla. Il comportamento REALE (bollo sempre automatico per
            i forfettari oltre 77,47 €) resta invariato e corretto per legge.
            Le card tornano quando il wiring completo (form + server + PDF +
            test fiscali) sarà implementato — decisione con Eli. I valori in
            DB restano e vengono ancora inviati dagli hidden input. */}

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
