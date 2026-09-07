'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Plus, Trash2, ChevronRight, ChevronUp, ChevronDown, PenLine, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { parseImportoIt } from '@/lib/utils'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { VoceItem } from './PreventivoForm'
import { SpiegaCampo } from '@/components/shared/SpiegaCampo'
import { CatalogPicker } from './CatalogPicker'
import { useFontiVoci, SuggerimentiVociDropdown } from './VoceSuggerimenti'
import { suggerisciVoci, normalizzaTesto, type FonteVoce } from '@/lib/documents/suggerimenti-voce'
import { VoiceInput } from '@/components/shared/VoiceInput'
import { toast } from 'sonner'
import { CalcQuantitaButton } from '@/components/calc/CalcQuantitaButton'

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
        // parseImportoIt gestisce il punto delle MIGLIAIA: con parseFloat
        // il display formattato "1.250,00" diventava 1.25 (prezzo /1000
        // al solo focus+blur del campo!)
        const num = parseImportoIt(raw)
        if (!isNaN(num)) onChange(num)
        else if (raw.trim() === '') onChange(0)
      }}
      onBlur={() => {
        setIsFocused(false)
        const num = parseImportoIt(display)
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

/** Una voce del menu «Aggiungi voce» che arriva dal form (foto/PDF/note
    con l'AI): il form ha i gestori, la tabella il posto dove mostrarli. */
export interface AddVoceAction {
  key: string
  label: string
  /** Riga grigia sotto l'etichetta («con l'AI»). */
  hint?: string
  icon?: React.ReactNode
  onClick?: () => void
  /** In alternativa a onClick: un link (es. «Passa a Pro»). */
  href?: string
  disabled?: boolean
  tourId?: string
}

interface VociTableProps {
  voci: VoceItem[]
  onChange: (voci: VoceItem[]) => void
  /** Voci in più nel menu «Aggiungi voce», dopo «Scrivi» e «Dal catalogo». */
  addActions?: AddVoceAction[]
  /** Nota in fondo al menu (es. «Prezzi solo dal tuo catalogo…»). */
  addNote?: string
  fiscalRegime: 'forfettario' | 'ordinario' | 'minimi'
  defaultVatRate?: number | null
  vatRates: number[]
  units: string[]
  bonusEdilizio?: string
  docType?: 'preventivo' | 'fattura' | 'nota_credito'
  autoFocusFirst?: boolean
}

function newVoce(sortOrder: number): VoceItem {
  return {
    _key: `${Date.now()}-${Math.random()}`,
    sort_order: sortOrder,
    description: '',
    unit: 'pz',
    // 0 come nel newVoce del form: con 1 una riga aggiunta e lasciata vuota
    // veniva considerata "compilata" e bloccava il salvataggio con un errore
    // incomprensibile (a schermo appariva identica a una riga ignorata).
    quantity: 0,
    unit_price: 0,
    discount_pct: null,
    vat_rate: null,
  }
}

const ORO = '#b08d3e'

// ── Il COSTO non vive più nella card della voce (Eli, 17 ago) ────────────────
// Era l'unico campo della voce che non riguarda il cliente, e chi compilava il
// primo preventivo lo trovava in mezzo a Prezzo e Sconto senza capirlo
// (feedback collaudatori #3). Ora si vede e si corregge SOLO nella card
// «Margine · solo tu lo vedi» (MargineBox), dove il concetto vive — stessa
// scelta del ricarico (12 ago). I costi continuano ad arrivare da soli da
// catalogo, listini e suggerimenti (`unit_cost` resta nei dati e nel
// salvataggio: nessun documento perde niente).

// ── Beni significativi (081) ────────────────────────────────────────────────
// Compare SOLO dove ha senso: regime non forfettario (un forfettario non
// addebita IVA) e voce al 10% (l'agevolazione vale lì). Fuori da quei due
// casi la spunta non esiste proprio: un interruttore che non fa niente è
// peggio di un interruttore assente.
function VoceBene({ voce, onUpdate }: { voce: VoceItem; onUpdate: (u: Partial<VoceItem>) => void }) {
  const attivo = voce.bene_significativo === true
  return (
    <div style={{ marginTop: 8 }}>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={attivo}
          onChange={(e) => onUpdate({ bene_significativo: e.target.checked })}
          style={{ width: 18, height: 18, marginTop: 1, flexShrink: 0, accentColor: '#1a1a2e' }}
        />
        <span style={{ fontSize: 12.5, color: attivo ? '#1a1a2e' : 'var(--cc-muted)', lineHeight: 1.35 }}>
          È un <b>bene significativo</b> (caldaia, infissi, sanitari…)
        </span>
      </label>
      {/* Il ⓘ sta IN LINEA sotto l'etichetta, non su una riga propria: la card
          della voce è già alta e ogni riga in più si paga (feedback Eli). */}
      <div style={{ marginLeft: 26, marginTop: 2 }}>
        <SpiegaCampo etichetta="Cosa vuol dire" style={{ fontSize: 11.5, color: 'var(--cc-muted)' }}>
          Sui lavori in casa con IVA al 10% esistono sette beni per cui l’aliquota
          agevolata vale <b>solo fino al valore del lavoro</b>: ascensori e
          montacarichi, infissi esterni e interni, caldaie, videocitofoni,
          condizionatori, sanitari e rubinetteria da bagno, impianti di sicurezza.
          {' '}Se il bene costa più del resto del lavoro, la parte che avanza va al 22%.
          {' '}Spuntando la casella lo calcola l’app e in fattura compaiono le due
          righe separate, come richiede la legge.
          <br /><br />
          Nel «resto del lavoro» ci va tutto ciò che non è quel bene: manodopera,
          materiali di consumo, e anche tapparelle, zanzariere e grate, che si
          contano a parte rispetto all’infisso.
        </SpiegaCampo>
      </div>
    </div>
  )
}

// Pillole di stato per le voci proposte dall'AI dalle foto: aiutano l'artigiano
// a vedere a colpo d'occhio cosa è già a posto e cosa deve completare.
// Etichette ESPLICITE sul campo a cui si riferiscono (feedback Eli 15 lug:
// "non capisco i badge, cosa significano messi così?"):
// - "prezzo dal tuo catalogo": il prezzo viene dal suo listino (verde)
// - "prezzo da inserire": nessun match a catalogo, prezzo ancora 0 (ambra)
// - "quantità da inserire": quantità non nelle note, ancora 0 (ambra)
// Le pillole "da fare" spariscono appena il valore viene inserito.
function VoceBadges({ voce }: { voce: VoceItem }) {
  const pills: Array<{ label: string; bg: string; fg: string }> = []
  if (voce.price_source === 'catalog') {
    pills.push({ label: 'prezzo dal tuo catalogo', bg: '#e2f0e8', fg: '#2f7d57' })
  } else if (voce.price_source === 'todo' && (voce.unit_price ?? 0) === 0) {
    pills.push({ label: 'prezzo da inserire', bg: '#faedd4', fg: ORO })
  }
  if (voce.qty_source === 'todo' && (voce.quantity ?? 0) === 0) {
    pills.push({ label: 'quantità da inserire', bg: '#faedd4', fg: ORO })
  }
  if (pills.length === 0) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
      {pills.map((p) => (
        <span key={p.label} style={{
          fontSize: 11, fontWeight: 600, color: p.fg, background: p.bg,
          borderRadius: 999, padding: '2px 9px', lineHeight: 1.6,
        }}>{p.label}</span>
      ))}
    </div>
  )
}

export function VociTable({
  voci,
  onChange,
  fiscalRegime,
  defaultVatRate,
  vatRates,
  units,
  autoFocusFirst = false,
  addActions,
  addNote,
}: VociTableProps) {
  const showVat = fiscalRegime !== 'forfettario'

  // Variante B (mockup approvato da Eli, 3 ago sera): su MOBILE le voci
  // compilate stanno CHIUSE in una riga sola (descrizione · dettaglio ·
  // totale) e si apre quella che tocchi. La voce nuova — o quella ancora
  // senza descrizione — nasce aperta. Solo presentazione: i dati e il
  // salvataggio non cambiano. Desktop invariato.
  const [openKey, setOpenKey] = useState<string | null>(
    () => voci.find((v) => !v.description.trim())?._key ?? null
  )

  function updateVoce(key: string, updates: Partial<VoceItem>) {
    onChange(voci.map((v) => v._key === key ? { ...v, ...updates } : v))
  }

  // ── Suggerimenti dal catalogo/listini mentre si scrive (11 ago, Eli) ────
  // Alla prima lettera compaiono fino a 10 voci; ogni lettera in più
  // restringe. Toccarne una riempie descrizione, prezzo, unità e IVA;
  // ignorarla e continuare a scrivere resta sempre possibile.
  const { fonti: fontiVoci, carica: caricaFontiVoci } = useFontiVoci()
  const [suggAncora, setSuggAncora] = useState<{ key: string; el: HTMLTextAreaElement } | null>(null)
  // Testo per cui la tendina è stata chiusa (scelta fatta o Esc): si riapre
  // solo quando il testo cambia di nuovo — senza, dopo una scelta la tendina
  // ricomparirebbe subito con la stessa voce appena inserita.
  const [suggChiusaPer, setSuggChiusaPer] = useState<string | null>(null)
  const [suggAttivo, setSuggAttivo] = useState(-1)
  const suggListRef = useRef<HTMLUListElement | null>(null)

  const voceAncora = suggAncora ? voci.find((v) => v._key === suggAncora.key) : undefined
  const suggQuery = voceAncora?.description ?? ''
  const suggerimenti = useMemo(() => {
    if (!suggAncora || !suggQuery.trim() || suggQuery === suggChiusaPer) return []
    const lista = suggerisciVoci(suggQuery, fontiVoci)
    // L'unico risultato IDENTICO al testo già scritto non aiuta nessuno
    // (succede riaprendo una voce appena scelta): meglio niente tendina.
    if (lista.length === 1 && normalizzaTesto(lista[0]!.descrizione) === normalizzaTesto(suggQuery)) return []
    return lista
  }, [suggAncora, suggQuery, suggChiusaPer, fontiVoci])

  // Cambiando testo l'evidenziazione da tastiera riparte da zero
  useEffect(() => { setSuggAttivo(-1) }, [suggQuery])

  function suggFocus(key: string, e: React.FocusEvent<HTMLTextAreaElement>) {
    caricaFontiVoci()
    setSuggAncora({ key, el: e.currentTarget })
    setSuggChiusaPer(null)
    setSuggAttivo(-1)
  }

  function suggBlur(e: React.FocusEvent<HTMLTextAreaElement>) {
    // Il tocco su un suggerimento NON fa perdere il fuoco (mousedown con
    // preventDefault): questo blur scatta solo uscendo davvero dal campo.
    // Il timeout lascia passare l'eventuale focus su un'ALTRA descrizione,
    // il cui onFocus rimpiazza l'ancora — e allora qui non si azzera nulla.
    const el = e.currentTarget
    setTimeout(() => {
      setSuggAncora((cur) => (cur && cur.el === el ? null : cur))
    }, 120)
  }

  function suggKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (suggerimenti.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSuggAttivo((i) => Math.min(i + 1, suggerimenti.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSuggAttivo((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' && suggAttivo >= 0 && suggAttivo < suggerimenti.length) {
      // Invio "ruba" la nuova riga SOLO se una voce è stata evidenziata
      // con le frecce: senza selezione attiva l'a-capo resta un a-capo.
      e.preventDefault()
      pickSuggerimento(suggerimenti[suggAttivo]!)
    } else if (e.key === 'Escape') {
      setSuggChiusaPer(suggQuery)
      setSuggAttivo(-1)
    }
  }

  function pickSuggerimento(f: FonteVoce) {
    if (!suggAncora) return
    const voce = voci.find((v) => v._key === suggAncora.key)
    updateVoce(suggAncora.key, {
      description: f.descrizione,
      unit: f.unit,
      unit_price: f.unit_price,
      vat_rate: f.vat_rate,
      unit_cost: f.unit_cost ?? null,
      supplier_list_id: f.supplier_list_id ?? null,
      // Una voce nuova ha quantità 0: la scelta la porta a 1, come dal
      // catalogo. Una quantità già scritta a mano non si tocca.
      ...(voce && (voce.quantity ?? 0) === 0 ? { quantity: 1 } : {}),
    })
    setSuggChiusaPer(f.descrizione)
    setSuggAttivo(-1)
    // La textarea auto-grow si ridimensiona nell'onChange, che qui non
    // scatta: l'altezza si sistema a mano dopo il re-render.
    const el = suggAncora.el
    requestAnimationFrame(() => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' })
  }

  // Ultima lista nota: la legge l'«Annulla» dell'eliminazione, che può
  // scattare qualche secondo dopo il tocco.
  const vociRef = useRef(voci)
  useEffect(() => { vociRef.current = voci }, [voci])

  function removeVoce(key: string) {
    const idx = voci.findIndex((v) => v._key === key)
    if (idx < 0) return
    const rimossa = voci[idx]
    const filtered = voci.filter((v) => v._key !== key)

    // Eliminando l'ULTIMA voce la lista non resta vuota: nasce una riga nuova
    // al suo posto (un documento senza righe non si compila).
    const sostituta = filtered.length === 0 ? newVoce(0) : null
    if (sostituta) {
      setOpenKey(sostituta._key)
      onChange([sostituta])
    } else {
      if (key === openKey) setOpenKey(null)
      onChange(filtered.map((v, i) => ({ ...v, sort_order: i })))
    }

    // Rete di sicurezza (Eli, 20 ago): un tocco per sbaglio non deve costare
    // la voce. Niente banner per una riga ancora VUOTA — lì non c'è nulla da
    // recuperare e sarebbe solo rumore a ogni «aggiungi e ripensaci».
    const haContenuto = rimossa.description.trim() !== '' || (rimossa.unit_price ?? 0) > 0
    if (!haContenuto) return
    toast('Voce eliminata', {
      action: {
        label: 'Annulla',
        onClick: () => {
          // ⚠️ Si ripristina sulla lista AGGIORNATA (vociRef), non su quella
          // catturata all'eliminazione: fra il tocco e l'annulla l'artigiano
          // può aver modificato altre voci, e rimetterle indietro le perderebbe.
          const corrente = sostituta
            ? vociRef.current.filter((v) => v._key !== sostituta._key)
            : vociRef.current
          const ripristinato = [...corrente]
          ripristinato.splice(Math.min(idx, ripristinato.length), 0, rimossa)
          onChange(ripristinato.map((v, i) => ({ ...v, sort_order: i })))
          setOpenKey(rimossa._key)
        },
      },
    })
  }

  function addVoce() {
    // Se l'ultima riga è ancora vuota non se ne aggiunge un'altra: si apre
    // quella (una riga vuota dimenticata bloccava il salvataggio, 2 ago).
    const last = voci[voci.length - 1]
    if (last && last.description.trim() === '' && (last.unit_price ?? 0) === 0 && (last.quantity ?? 0) === 0) {
      setOpenKey(last._key)
      return
    }
    const nv = newVoce(voci.length)
    setOpenKey(nv._key)
    onChange([...voci, nv])
  }

  // ── Menu «Aggiungi voce» (riordino 7 set): scrivi · catalogo/listini ·
  // le strade con l'AI che arrivano dal form. Prima l'AI stava in un blocco
  // crema dentro la card e il catalogo era un tasto a parte: due posti per
  // la stessa domanda («da dove prendo la voce?»).
  const [addOpen, setAddOpen] = useState(false)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const addMenuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!addOpen) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) setAddOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAddOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [addOpen])

  // ── «Sconto e altro» della voce aperta (mobile): chiusa di default, così
  // la voce chiede TRE campi (quantità con l'unità, prezzo, IVA). Si apre da
  // sola se la voce ha già uno sconto o la marcatura del bene significativo.
  const [extraState, setExtraState] = useState<Record<string, boolean>>({})

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
      <div className="divide-y divide-[#c7c4b9]">
        {voci.map((voce, idx) => {
          const lineTotal = voce.quantity * voce.unit_price * (1 - (voce.discount_pct ?? 0) / 100)
          return (
            <div key={voce._key} className="px-[15px] py-3">
              <div className="hidden lg:block">
                <VoceBadges voce={voce} />
              </div>
              {/* Opzione 1: calcola la quantità (m²/m³/piastrelle) → riempie il
                  campo Quantità di QUESTA voce. Su mobile il 📐 vive DENTRO il
                  campo Q.tà della voce aperta (variante B, 3 ago). */}
              <div className="hidden lg:flex" style={{ justifyContent: 'flex-end', marginBottom: 8 }}>
                {/* "Usa" imposta quantità E unità (mq/mc/lt/pz) — così un'area non
                    diventa "13,86 pz". L'unità si applica solo se è tra quelle valide. */}
                <CalcQuantitaButton onResult={(v, u) =>
                  updateVoce(voce._key, u && units.includes(u) ? { quantity: v, unit: u } : { quantity: v })
                } />
              </div>
              {/* Desktop lg+: griglia a riga singola */}
              <div
                className="hidden lg:grid items-start gap-2"
                style={{ gridTemplateColumns: showVat ? '2fr 90px 90px 100px 80px 90px 32px' : '2fr 90px 90px 100px 80px 32px' }}
              >
                {/* Descrizione con mic dentro — data-tour="voce-mic": il passo 3
                    del tutorial marca questo riquadro (F16) */}
                <div data-tour="voce-mic" style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 12px', minWidth: 0 }}>
                  <textarea
                    placeholder="esempio: rifacimento bagno"
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
                    onFocus={(e) => suggFocus(voce._key, e)}
                    onBlur={suggBlur}
                    onKeyDown={suggKeyDown}
                    autoFocus={autoFocusFirst && idx === 0}
                  />
                  <VoiceInput
                    compact
                    onTranscript={(t) =>
                      updateVoce(voce._key, {
                        description: voce.description ? `${voce.description} ${t}` : t,
                      })
                    }
                    className="flex-none text-[var(--cc-muted)]"
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
                    onValueChange={(v) => {
                      const rate = v === '__default__' ? null : parseFloat(v)
                      // Stessa pulizia del select mobile: fuori dal 10% la
                      // marcatura «bene significativo» si toglie (12 ago).
                      const effettiva = rate ?? defaultVatRate ?? 22
                      updateVoce(voce._key, effettiva === 10
                        ? { vat_rate: rate }
                        : { vat_rate: rate, bene_significativo: false })
                    }}
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
                  aria-label={`Elimina voce ${idx + 1}`}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>

              {/* Totale riga — desktop lg+ */}
              <div className="hidden lg:flex justify-end" style={{ marginTop: 4, fontSize: 15, color: 'var(--cc-muted)' }}>
                = <b style={{ color: '#161616', marginLeft: 4 }}>€ {lineTotal.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
              </div>

              {/* Mobile + tablet (< lg) — VARIANTE B (mockup approvato 3 ago):
                  la voce è CHIUSA in una riga sola; si apre quella toccata. */}
              {voce._key !== openKey && (
                <button
                  type="button"
                  onClick={() => setOpenKey(voce._key)}
                  aria-label={`Modifica voce ${idx + 1}`}
                  className="lg:hidden w-full"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', padding: '2px 0', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: voce.description.trim() ? '#161616' : 'var(--cc-muted)', fontStyle: voce.description.trim() ? undefined : 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {voce.description.trim() || 'Voce senza descrizione'}
                    </span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--cc-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {voce.quantity.toLocaleString('it-IT')} {voce.unit} × {voce.unit_price.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                      {voce.discount_pct ? ` − ${voce.discount_pct.toLocaleString('it-IT')}%` : ''}
                      {/* Ricarico/margine tolto dalla riga chiusa (Eli, 12 ago):
                          vive solo nella card Margine. Resta solo «da completare». */}
                      {(() => {
                        const todo = (voce.price_source === 'todo' && (voce.unit_price ?? 0) === 0)
                          || (voce.qty_source === 'todo' && (voce.quantity ?? 0) === 0)
                        return todo ? <span style={{ color: ORO }}> · da completare</span> : null
                      })()}
                    </span>
                  </span>
                  <b style={{ fontSize: 15, whiteSpace: 'nowrap', color: '#161616' }}>
                    € {lineTotal.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </b>
                  <ChevronRight size={16} style={{ color: '#c2c1bd', flexShrink: 0 }} />
                </button>
              )}

              {voce._key === openKey && (
              <div className="lg:hidden space-y-2">
                {/* Testata: VOCE N · Totale live · cestino (variante A: il
                    totale sale qui, niente riga dedicata) */}
                {/* La testata INTERA chiude la voce (Eli 20 ago: «se clicco
                    su voce o il prezzo, la voce deve chiudersi»): un solo
                    bottone con VOCE N a sinistra e il totale a destra.
                    ⚠️ Niente cestino qui (Eli, 20 ago): un tocco di striscio
                    sulla barra di chiusura cancellava la riga — il cestino
                    vive nella cella accanto all'IVA. */}
                <button
                  type="button"
                  onClick={() => setOpenKey(null)}
                  aria-label={`Chiudi voce ${idx + 1}`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%', background: 'none', border: 'none', padding: '2px 0', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--cc-muted)', letterSpacing: '0.05em' }}>
                    VOCE {idx + 1} <ChevronUp size={14} />
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--cc-muted)' }}>
                    Tot. <b style={{ color: '#161616', fontSize: 14 }}>€ {lineTotal.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
                  </span>
                </button>

                <VoceBadges voce={voce} />

                {/* Descrizione con mic dentro — senza etichetta (variante A:
                    il placeholder basta). data-tour="voce-mic": tutorial F16. */}
                <div data-tour="voce-mic" style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #e3e3e6', borderRadius: 10, padding: '9px 12px' }}>
                  <textarea
                    placeholder="esempio: rifacimento bagno"
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
                    onFocus={(e) => suggFocus(voce._key, e)}
                    onBlur={suggBlur}
                    onKeyDown={suggKeyDown}
                    autoFocus={autoFocusFirst && idx === 0}
                  />
                  <VoiceInput
                    compact
                    onTranscript={(t) =>
                      updateVoce(voce._key, {
                        description: voce.description ? `${voce.description} ${t}` : t,
                      })
                    }
                    className="flex-none text-[var(--cc-muted)]"
                  />
                </div>

                {/* ── TRE campi (riordino 7 set, mockup ok di Eli): Quantità
                    con l'UNITÀ dentro il campo, Prezzo, IVA. Sconto, calcolo
                    della quantità e bene significativo stanno sotto «Sconto e
                    altro ⌄». Prima erano sei campi su due righe (più la spunta).
                    ⚠️ La Quantità ha una riga TUTTA SUA: misurato in Chromium sul
                    componente vero, in una riga a tre colonne la pillola
                    dell'unità («a corpo», 79px) lasciava al numero 37px a 390
                    e 2px a 320 — «402,25» non ci stava. Sotto, Prezzo e IVA.
                    ⚠️ Su mobile gli input sono a 16px REALI (regola anti-zoom
                    iPhone in globals.css). */}
                {(() => {
                  const ivaEffettiva = voce.vat_rate ?? defaultVatRate ?? 22
                  const beneVisibile = fiscalRegime !== 'forfettario' && ivaEffettiva === 10
                  const extraOpen = extraState[voce._key] ?? (voce.discount_pct != null || voce.bene_significativo === true)
                  // Corto per stare su una riga con «Elimina» (misurato: con tre voci
                  // si troncava): il calcolo della quantità sta comunque dentro.
                  const extraLabel = beneVisibile ? 'Sconto · bene significativo' : 'Sconto · calcola quantità'
                  return (
                    <>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <span style={{ fontSize: 11, color: 'var(--cc-muted)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Quantità <span style={{ color: ORO }}>*</span>
                    </span>
                    <div className="relative">
                      <NumericInput
                        value={voce.quantity}
                        onChange={(n) => updateVoce(voce._key, { quantity: n })}
                        style={{ border: '1px solid #e3e3e6', borderRadius: 10, padding: '0 84px 0 8px', fontSize: 13, height: 44, boxSizing: 'border-box' }}
                      />
                      {/* L'unità come pillola DENTRO il campo (mockup 7 set):
                          «1 [a corpo ⌄]». Una Select vera, non testo. */}
                      <span className="absolute right-1 top-1/2 -translate-y-1/2" style={{ maxWidth: 80 }}>
                        <Select
                          value={voce.unit}
                          onValueChange={(v) => updateVoce(voce._key, { unit: v })}
                        >
                          <SelectTrigger
                            aria-label="Unità di misura"
                            className="[&>span]:truncate"
                            style={{ height: 30, minHeight: 30, borderRadius: 8, border: 'none', background: '#f2f0ea', padding: '0 6px 0 9px', fontSize: 12, color: '#6f6d64', gap: 3, boxShadow: 'none', maxWidth: 80 }}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {units.map((u) => (
                              <SelectItem key={u} value={u}>{u}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </span>
                    </div>
                  </div>
                  <div className="grid gap-1.5 items-start" style={{ gridTemplateColumns: showVat ? '1fr 88px' : '1fr' }}>
                  <div className="space-y-1">
                    <span style={{ fontSize: 11, color: 'var(--cc-muted)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Prezzo <span style={{ color: ORO }}>*</span>
                    </span>
                    <div className="relative">
                      <NumericInput
                        locale
                        value={voce.unit_price}
                        onChange={(n) => updateVoce(voce._key, { unit_price: n })}
                        style={{ border: '1px solid #e3e3e6', borderRadius: 10, padding: '0 18px 0 8px', fontSize: 13, height: 44, boxSizing: 'border-box' }}
                      />
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none">€</span>
                    </div>
                  </div>
                  {showVat && (
                    <div className="space-y-1">
                      <span style={{ fontSize: 11, color: 'var(--cc-muted)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>IVA</span>
                      <Select
                        value={voce.vat_rate !== null ? String(voce.vat_rate) : '__default__'}
                        onValueChange={(v) => {
                          const rate = v === '__default__' ? null : parseFloat(v)
                          // ⚠️ Fuori dal 10% la marcatura «bene significativo»
                          // si toglie: la casella sparisce dalla UI e un flag
                          // stantio nel dato riconvertirebbe pezzi di 22% in
                          // 10% (ricontrollo 12 ago). Il modulo puro ha la
                          // stessa difesa; qui si tiene pulito il dato.
                          const effettiva = rate ?? defaultVatRate ?? 22
                          updateVoce(voce._key, effettiva === 10
                            ? { vat_rate: rate }
                            : { vat_rate: rate, bene_significativo: false })
                        }}
                      >
                        <SelectTrigger className="w-full" style={{ border: '1px solid #e3e3e6', borderRadius: 10, padding: '0 8px', fontSize: 13, height: 44, boxSizing: 'border-box' }}>
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
                </div>

                {/* Riga di servizio: «Sconto e altro ⌄» a sinistra, «Elimina» a
                    destra (la parola al posto del cestino — 7 set). L'annulla
                    del toast resta come rete. */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => setExtraState((prev) => ({ ...prev, [voce._key]: !extraOpen }))}
                    aria-expanded={extraOpen}
                    className="cc-t-sub"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', minWidth: 0, textAlign: 'left' }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{extraLabel}</span>
                    <ChevronDown size={14} style={{ flexShrink: 0, transform: extraOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeVoce(voce._key)}
                    aria-label={`Elimina voce ${idx + 1}`}
                    className="cc-t-sub-strong"
                    style={{ color: '#b05656', background: 'none', border: 'none', padding: '4px 0 4px 8px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
                  >
                    Elimina
                  </button>
                </div>

                {extraOpen && (
                  <div style={{ marginTop: 8, paddingTop: 10, borderTop: '1px solid #f0efe9' }}>
                    <div className="grid gap-1.5 items-start grid-cols-[1fr_1fr]">
                      <div className="space-y-1">
                        <span style={{ fontSize: 11, color: 'var(--cc-muted)', display: 'block' }}>Sconto sulla voce</span>
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
                            style={{ border: '1px solid #e3e3e6', borderRadius: 10, padding: '0 18px 0 8px', fontSize: 13, height: 44, boxSizing: 'border-box' }}
                          />
                          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none">%</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span style={{ fontSize: 11, color: 'var(--cc-muted)', display: 'block' }}>Metri quadri, piastrelle…</span>
                        <div style={{ height: 44, display: 'flex', alignItems: 'center' }}>
                          {/* «Usa» imposta quantità E unità (mq/mc/lt/pz), così
                              un'area non diventa «13,86 pz». */}
                          <CalcQuantitaButton onResult={(v, u) =>
                            updateVoce(voce._key, u && units.includes(u) ? { quantity: v, unit: u } : { quantity: v })
                          } />
                        </div>
                      </div>
                    </div>
                    {beneVisibile && (
                      <div style={{ marginTop: 8 }}>
                        <VoceBene voce={voce} onUpdate={(u) => updateVoce(voce._key, u)} />
                      </div>
                    )}
                  </div>
                )}
                    </>
                  )
                })()}
                {/* ⚠️ Niente Costo e niente ricarico qui (Eli, 12 e 17 ago):
                    vivono solo nella card Margine più sotto (MargineBox). */}
              </div>
              )}

              {/* La spunta «bene significativo» su desktop; su mobile sta dentro
                  «Sconto e altro» della voce aperta (7 set). */}
              {fiscalRegime !== 'forfettario'
                && (voce.vat_rate ?? defaultVatRate ?? 22) === 10
                && (
                  <div className="hidden lg:block">
                    <VoceBene voce={voce} onUpdate={(u) => updateVoce(voce._key, u)} />
                  </div>
                )}

            </div>
          )
        })}
      </div>

      {/* ── «Aggiungi voce ⌄» (riordino 7 set): UN tasto con dentro tutte le
          strade — scrivi, catalogo/listini, foto/PDF/note con l'AI. Prima il
          catalogo era un tasto a parte e l'AI un blocco crema in cima alla
          card (dietro «Opzioni»). Il menu si apre sotto il tasto, dentro la
          card: niente portal, si chiude col tocco fuori o con Esc. */}
      <div className="px-[15px] py-3 border-t">
        <div ref={addMenuRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setAddOpen((o) => !o)}
            aria-expanded={addOpen}
            aria-haspopup="menu"
            style={{ width: '100%', height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: '1px solid #1a1a2e', borderRadius: 12, background: '#fff', color: '#1a1a2e', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <Plus size={18} /> Aggiungi voce
            <ChevronDown size={15} style={{ transform: addOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
          </button>
          {addOpen && (
            <div role="menu" style={{ marginTop: 8, background: '#fff', border: '1px solid #e6e1d5', borderRadius: 12, boxShadow: '0 8px 24px -10px rgba(20,20,40,.25)', padding: '4px 0' }}>
              {([
                { key: 'scrivi', label: 'Scrivi una voce', icon: <PenLine size={16} />, onClick: addVoce },
                { key: 'catalogo', label: 'Dal catalogo o dai listini', icon: <BookOpen size={16} />, onClick: () => setCatalogOpen(true) },
                ...(addActions ?? []),
              ] as AddVoceAction[]).map((a, i) => {
                const inner = (
                  <>
                    <span style={{ width: 20, display: 'inline-flex', justifyContent: 'center', color: '#1a1a2e', flexShrink: 0 }}>{a.icon}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="cc-t-main" style={{ display: 'block' }}>{a.label}</span>
                      {a.hint && <span className="cc-t-sub" style={{ display: 'block', marginTop: 1 }}>{a.hint}</span>}
                    </span>
                  </>
                )
                const rowStyle: React.CSSProperties = { width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', background: 'none', border: 'none', borderTop: i === 0 ? 'none' : '1px solid #f0f0f0', cursor: a.disabled ? 'default' : 'pointer', fontFamily: 'inherit', textAlign: 'left', textDecoration: 'none', opacity: a.disabled ? 0.55 : 1 }
                if (a.href) {
                  return <a key={a.key} href={a.href} role="menuitem" data-tour={a.tourId} style={rowStyle}>{inner}</a>
                }
                return (
                  <button
                    key={a.key}
                    type="button"
                    role="menuitem"
                    data-tour={a.tourId}
                    disabled={a.disabled}
                    onClick={() => { setAddOpen(false); a.onClick?.() }}
                    style={rowStyle}
                  >
                    {inner}
                  </button>
                )
              })}
              {addNote && (
                <p className="cc-t-sub" style={{ margin: 0, padding: '8px 13px 6px', borderTop: '1px solid #f0f0f0', lineHeight: 1.45 }}>{addNote}</p>
              )}
            </div>
          )}
        </div>
        <CatalogPicker
          open={catalogOpen}
          onOpenChange={setCatalogOpen}
          hideTrigger
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
                  unit_cost: item.unit_cost ?? null,
                  supplier_list_id: item.supplier_list_id ?? null,
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
                  unit_cost: item.unit_cost ?? null,
                  supplier_list_id: item.supplier_list_id ?? null,
                },
              ])
            }
          }}
        />
      </div>

      {/* Tendina dei suggerimenti — in portal su body (cc-portal-float),
          ancorata al riquadro della descrizione a fuoco. Compare solo
          quando c'è ALMENO un risultato: mai una lista vuota sotto le dita. */}
      <SuggerimentiVociDropdown
        anchorEl={suggerimenti.length > 0 && suggAncora ? (suggAncora.el.parentElement as HTMLElement) : null}
        risultati={suggerimenti}
        attivo={Math.min(suggAttivo, suggerimenti.length - 1)}
        onPick={pickSuggerimento}
        listRef={suggListRef}
      />
    </div>
  )
}
