'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { updateWorkspaceFiscal } from '@/lib/actions/workspace'
import { isValidPivaFormat } from '@/lib/fiscal/piva'
import { AtecoMultiSelect } from '@/components/shared/AtecoMultiSelect'
import { SpiegaCampo } from '@/components/shared/SpiegaCampo'
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
  // Pilota automatico SdI (080) — «automatico deve essere default» (Eli):
  // acceso se la colonna manca o è true, spento solo su false esplicito.
  const [sdiAuto, setSdiAuto] = useState(
    (workspace as { sdi_auto_enabled?: boolean | null }).sdi_auto_enabled !== false
  )
  // Conta la manodopera nel margine dei lavori (085) — default ON (comportamento
  // storico). I forfettari possono spegnerlo: le loro ore non sono soldi usciti
  // dal conto. Colonna assente pre-085 → undefined → true. Dichiarato QUI (prima
  // del ref block sotto) perché countLaborCorrente lo referenzia.
  const [countLabor, setCountLabor] = useState(
    (workspace as { count_labor_in_margin?: boolean | null }).count_labor_in_margin !== false
  )
  // ⚠️ React 19 chiama form.reset() DOPO ogni submit: su una casella
  // governata dallo stato il reset riporta il DOM al valore iniziale senza
  // cambiare nessuno stato — la spunta si riaccendeva da sola pur avendo
  // salvato «spenta» (Eli, 11 ago: «non mi salva il deflaggamento»). È lo
  // stesso inciampo della tendina dell'acconto del 9 ago, stesso rimedio.
  const sdiAutoRef = useRef<HTMLInputElement>(null)
  const sdiAutoCorrente = useRef(sdiAuto)
  sdiAutoCorrente.current = sdiAuto
  const countLaborRef = useRef<HTMLInputElement>(null)
  const countLaborCorrente = useRef(countLabor)
  countLaborCorrente.current = countLabor
  useEffect(() => {
    const form = sdiAutoRef.current?.form ?? countLaborRef.current?.form
    if (!form) return
    const onReset = () => {
      // Il reset agisce DOPO l'evento: si rimette a posto al giro successivo.
      requestAnimationFrame(() => {
        if (sdiAutoRef.current) sdiAutoRef.current.checked = sdiAutoCorrente.current
        if (countLaborRef.current) countLaborRef.current.checked = countLaborCorrente.current
      })
    }
    form.addEventListener('reset', onReset)
    return () => form.removeEventListener('reset', onReset)
  }, [])
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

  // ⚠️ Arrivando da «Configura il codice ATECO» (link nel pop-up del catalogo)
  // l'ancora `#ateco` porta la pagina nel punto giusto, ma il cursore resta
  // dov'era: l'artigiano vede la sezione e deve comunque toccarla (feedback
  // Eli, 12 ago). Qui il fuoco va sul primo campo del blocco, così può
  // scrivere subito. Il ritardo serve perché il pannello si monta dopo il
  // primo disegno; il tocco manuale resta sempre possibile.
  useEffect(() => {
    if (typeof window === 'undefined' || window.location.hash !== '#ateco') return
    const t = window.setTimeout(() => {
      const blocco = document.getElementById('ateco')?.parentElement
      blocco?.scrollIntoView({ block: 'start', behavior: 'smooth' })
      blocco?.querySelector('input')?.focus()
    }, 300)
    return () => window.clearTimeout(t)
  }, [])
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
            placeholder="esempio: 12345678901"
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

          {/* Spiegazione nel punto ⓘ (Eli, 11 ago: le note vanno dentro il
              tasto ⓘ, tranne quelle fiscali/legali che restano visibili). */}
          <SpiegaCampo etichetta="Costo orario manodopera (€/ora)" style={fieldLabelStyle}>
            Serve al margine dei Lavori: le ore registrate col timer vengono
            contate come costo di manodopera. Lascia vuoto per non usarlo.
          </SpiegaCampo>
          <input
            name="hourly_cost"
            value={hourlyCost}
            onChange={(e) => setHourlyCost(e.target.value.replace(/[^\d.,]/g, ''))}
            inputMode="decimal"
            placeholder="esempio: 35"
            maxLength={8}
            style={fieldStyle}
          />

          {/* Conta la manodopera nel margine dei lavori (085). Sentinella per
              non azzerarlo dall'onboarding (stessa action senza il campo). */}
          <input type="hidden" name="count_labor_presente" value="1" />
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: '#fafafa', borderRadius: 10, padding: '11px 12px', marginTop: 10 }}>
            <input
              ref={countLaborRef}
              id="count-labor"
              type="checkbox"
              name="count_labor_in_margin"
              checked={countLabor}
              onChange={(e) => setCountLabor(e.target.checked)}
              style={{ width: 18, height: 18, marginTop: 1, accentColor: '#1a1a2e', flexShrink: 0 }}
            />
            <label htmlFor="count-labor" style={{ fontSize: 13, color: '#161616', lineHeight: 1.45, cursor: 'pointer' }}>
              <b>Conta la manodopera nel margine</b>
              <span style={{ display: 'block', fontSize: 12, color: '#767676', marginTop: 2 }}>
                Nella scheda di un Lavoro c&rsquo;è il margine: quanto ti resta tra il
                preventivato e quello che spendi davvero (materiali e, se attivi questa
                spunta, le tue ore). Con la spunta attiva, il costo orario &times; le ore
                conteggiate col timer viene tolto dal margine. Se lavori in{' '}
                <b>forfettario</b>{' '}puoi disattivarla: le tue ore non sono soldi usciti
                dal conto, così il margine mostra quanto ti resta davvero in cassa. Le ore
                restano comunque visibili nella scheda del Lavoro, nel riquadro «Ore di lavoro».
              </span>
            </label>
          </div>

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

          {process.env.NEXT_PUBLIC_SDI_ENABLED === 'true' && (
            <>
              <div style={{ height: 14 }} />
              {/* Il campo-sentinella dice all'action che l'interruttore era nel
                  form: senza, salvare il tab con SdI spento lo azzererebbe. */}
              <input type="hidden" name="sdi_auto_presente" value="1" />
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: '#fafafa', borderRadius: 10, padding: '11px 12px' }}>
                <input
                  ref={sdiAutoRef}
                  id="sdi-auto"
                  type="checkbox"
                  name="sdi_auto_enabled"
                  checked={sdiAuto}
                  onChange={(e) => setSdiAuto(e.target.checked)}
                  style={{ width: 18, height: 18, marginTop: 1, accentColor: '#1a1a2e', flexShrink: 0 }}
                />
                <label htmlFor="sdi-auto" style={{ fontSize: 13, color: '#161616', lineHeight: 1.45, cursor: 'pointer' }}>
                  <b>Trasmissione automatica allo SdI</b>
                  <span style={{ display: 'block', fontSize: 12, color: '#767676', marginTop: 2 }}>
                    La fattura elettronica, oltre che al cliente, va mandata
                    all&rsquo;<b>Agenzia delle Entrate</b> tramite il <b>Sistema di
                    Interscambio (SdI)</b>: è questo passaggio che la rende ufficialmente
                    emessa.
                    <span style={{ display: 'block', marginTop: 6 }}>
                      {/* «(o la segni come pagata)»: la conferma fiscale scatta a
                          OGNI primo passaggio fuori bozza (conferma-fiscale.ts), non
                          solo all'invio al cliente — senza l'inciso, chi incassa in
                          contanti senza mai inviarla non saprebbe del pilota. */}
                      <b>Spunta accesa (consigliato):</b>{' '}quando invii la fattura al
                      cliente (o la segni come pagata), il giorno dopo l&rsquo;app la
                      trasmette in automatico all&rsquo;Agenzia. Hai 24 ore per ripensarci:
                      fino a quel momento puoi fermare la trasmissione con un tocco dentro
                      alla fattura stessa.
                    </span>
                    <span style={{ display: 'block', marginTop: 6 }}>
                      <b>Spunta spenta:</b>{' '}la trasmissione all&rsquo;Agenzia delle
                      Entrate va fatta a mano, con il tasto dentro alla fattura. L&rsquo;app
                      ti ricorda la scadenza (12 giorni) con un conto alla rovescia.
                    </span>
                  </span>
                </label>
              </div>
            </>
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
