'use client'

import { useActionState, useRef, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Loader2, Lock, Check, AlignLeft, AlignRight, ImageIcon, ChevronRight, ChevronDown, Plus, Star, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { LegalNoticeField } from './LegalNoticeField'
import { Switch } from '@/components/ui/switch'
// Font: DropdownMenu modal={false} al posto di Select — il Select Radix blocca lo
// scroll della pagina (react-remove-scroll) e fa SPARIRE la scrollbar laterale
// mentre il menu è aperto. Stesso pattern già usato per SortSelect ("Ordina").
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { TemplatePreview } from './TemplatePreview'
import { PreviewScaler } from './PreviewScaler'
import { PRESET_LIST } from './PresetSelector'
import { createTemplateAction, updateTemplateAction } from '@/lib/actions/templates'
import type { Database } from '@/types/database'

type TemplateRow = Database['public']['Tables']['templates']['Row']

// ⚠️ I `value` sono le chiavi STORICHE salvate nel DB (enum Zod in
// lib/actions/templates.ts) — NON cambiarle. Il 17-18 lug (feedback Eli
// "i font sono troppo simili") sono cambiati SOLO aspetto e nome:
// 'Helvetica' rende Atkinson Hyperlegible (SELF-HOSTED — sul telefono
// Trebuchet/Verdana non esistono e cadevano su Roboto, identico a Inter),
// 'Georgia' ha Lora self-hosted come fallback (Android non ha Georgia),
// 'GeistSans' il monospazio. Stessi stack in TemplatePreview e
// lib/pdf/template.ts; @font-face in globals.css.
// 18 lug (Eli: "Georgia per essere elegante deve essere corsivo"): il nome
// nel bottoncino/menu si mostra in CORSIVO (italic: true); nel template
// Elegante il nome dell'azienda è in corsivo (numero e totale lo erano già).
const FONTS = [
  { value: 'Inter',      name: 'Inter',    desc: 'Moderno',         label: 'Inter — moderno',                 css: "'Inter', system-ui, sans-serif",                     italic: false },
  { value: 'Helvetica',  name: 'Atkinson', desc: 'Grande e chiaro', label: 'Atkinson — grande e chiaro',      css: "'Atkinson Hyperlegible', 'Trebuchet MS', sans-serif", italic: false },
  { value: 'GeistSans',  name: 'Macchina', desc: 'Tecnico',         label: 'Macchina da scrivere — tecnico',  css: "'Courier New', Courier, monospace",                  italic: false },
  { value: 'Georgia',    name: 'Georgia',  desc: 'Elegante',        label: 'Georgia — elegante',              css: "Georgia, 'Lora', 'Times New Roman', serif",          italic: true },
]

// Palette swatch "Colore accento" (mockup)
const SWATCHES = ['#1a1a2e', '#2f5aa8', '#2f8a63', '#b0563e', '#c9a44c']

const CARD_SHADOW = '0 1px 2px rgba(20,20,40,.05), 0 8px 24px -10px rgba(20,20,40,.15)'
// Titoletto campo (12/600/.05em/uppercase/#8a887f)
const FIELD_LABEL: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, letterSpacing: '0.05em',
  textTransform: 'uppercase', color: 'var(--cc-muted)', marginBottom: 8,
}
const ROW_LABEL: React.CSSProperties = { fontSize: 14, color: '#161616' }

interface TemplateEditorProps {
  mode: 'create' | 'edit'
  isPro: boolean
  templateId?: string
  defaultValues?: Partial<TemplateRow>
  workspaceName: string
  logoUrl?: string | null
}

export function TemplateEditor({
  mode,
  isPro,
  templateId,
  defaultValues,
  workspaceName,
  logoUrl,
}: TemplateEditorProps) {
  const action =
    mode === 'edit' && templateId
      ? updateTemplateAction.bind(null, templateId)
      : createTemplateAction

  const [state, formAction, isPending] = useActionState(action, null)
  // Quale bottone ha avviato il submit — la rotella gira solo su quello
  const [submitAs, setSubmitAs] = useState<'default' | 'save' | null>(null)

  // Preset selezionato
  const [presetKey, setPresetKey] = useState(
    defaultValues?.preset_key ?? 'classico'
  )

  // ── Valori live per la preview ──────────────────────────────────────────
  const [name,          setName]          = useState(defaultValues?.name ?? 'Template senza nome')
  const [color,         setColor]         = useState(defaultValues?.color_primary ?? '#374151')
  const [font,          setFont]          = useState(defaultValues?.font_family ?? 'Inter')
  const [showLogo,      setShowLogo]      = useState(defaultValues?.show_logo ?? true)
  const [showWatermark, setShowWatermark] = useState(defaultValues?.show_watermark ?? true)
  const [logoPosition,  setLogoPosition]  = useState<'left' | 'right'>(
    (defaultValues?.logo_position as 'left' | 'right') ?? 'left'
  )
  const [legalNotice,   setLegalNotice]   = useState(defaultValues?.legal_notice ?? '')
  // Mobile (feedback Eli 17 lug, aggiornato 28 lug): controlli in una FILA di
  // bottoncini sotto l'anteprima — toccandone uno si apre il pannello con le
  // sue opzioni. Il pannello RESTA aperto anche toccando altrove (richiesta
  // Eli 28 lug: "spariscono se clicco in un'altra parte della pagina"):
  // cambia solo toccando un'altra sezione, si chiude ri-toccando la stessa.
  type PanelKey = 'stile' | 'colore' | 'font' | 'logo' | 'filigrana' | 'note'
  const [openPanel, setOpenPanel] = useState<PanelKey | null>(null)
  const aspectRef = useRef<HTMLDivElement>(null)
  const customColorRef = useRef<HTMLInputElement>(null)

  const activePreset = PRESET_LIST.find((p) => p.key === presetKey)
  // Free: il colore accento è Pro → in anteprima (e al salvataggio) vale il default del preset
  const previewColor = isPro ? color : (activePreset?.defaultColor ?? '#374151')
  // Free: font sempre quello canonico del preset
  const fontShort = FONTS.find((f) => f.value === (isPro ? font : (activePreset?.defaultFont ?? 'Inter')))?.name ?? 'Inter'

  const preview = (badge: boolean) => (
    <TemplatePreview
      presetKey={presetKey}
      color={previewColor}
      font={isPro ? font : undefined}
      showLogo={showLogo}
      showWatermark={isPro ? showWatermark : true}
      logoPosition={isPro ? logoPosition : 'left'}
      legalNotice={legalNotice}
      workspaceName={workspaceName}
      logoUrl={logoUrl}
      templateName={name}
      showExampleBadge={badge}
    />
  )

  return (
    <form action={formAction}>
      {/* Hidden fields per valori controllati (condivisi mobile + desktop).
          is_default NON è un hidden: viaggia col bottone di submit premuto. */}
      <input type="hidden" name="preset_key"     value={presetKey} />
      <input type="hidden" name="color_primary"  value={color} />
      <input type="hidden" name="font_family"    value={font} />
      <input type="hidden" name="show_logo"      value={String(showLogo)} />
      <input type="hidden" name="show_watermark" value={String(showWatermark)} />
      <input type="hidden" name="logo_position"  value={logoPosition} />
      <input type="hidden" name="legal_notice"   value={legalNotice} />

      {/* ════════════════════════ MOBILE (mockup) ════════════════════════ */}
      <div className="lg:hidden pb-5">
        {(state?.error || state?.success) && (
          <div style={{ margin: '14px 15px 0' }}>
            {state?.error && (
              <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert>
            )}
            {state?.success && (
              <Alert><AlertDescription>{state.success}</AlertDescription></Alert>
            )}
          </div>
        )}

        {/* Anteprima IN CIMA (feedback Eli F3): renderizzata a misura fissa e
            scalata (PreviewScaler) — niente testi tagliati, identica anche in
            Testo grande. I controlli stanno SUBITO SOTTO in una fila di
            bottoncini: tocchi → si apre il pannello (e resta aperto finché
            non tocchi un'altra sezione). */}
        <div style={{ margin: '14px 15px 0' }}>
          <div style={FIELD_LABEL}>Anteprima</div>
          <PreviewScaler>{preview(false)}</PreviewScaler>
        </div>

        {/* Aspetto — fila di bottoncini + pannello dell'opzione toccata */}
        <div ref={aspectRef} style={{ margin: '10px 15px 0' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {([
              ['stile', 'Stile'],
              ['colore', 'Colore'],
              ['font', 'Font'],
              ['logo', 'Logo'],
              ['filigrana', 'Filigrana'],
              ['note', 'Note'],
            ] as [PanelKey, string][]).map(([key, label]) => {
              const open = openPanel === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setOpenPanel((p) => (p === key ? null : key))}
                  aria-expanded={open}
                  style={{
                    padding: '8px 13px', borderRadius: 999, fontSize: 13,
                    fontWeight: 600, cursor: 'pointer',
                    border: open ? '1.5px solid #1a1a2e' : '1px solid #e7e7ea',
                    background: open ? '#1a1a2e' : '#fff',
                    color: open ? '#fff' : '#55534b',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {openPanel && (
          <div style={{ marginTop: 8, background: '#fff', borderRadius: 14, boxShadow: CARD_SHADOW, padding: '13px 15px' }}>

          {/* Stile: 4 chip in una riga sola */}
          {openPanel === 'stile' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {PRESET_LIST.map((preset) => {
                const isActive = presetKey === preset.key
                // Free: solo "Classico"; Bold/Tecnico/Elegante sono bloccati (Pro)
                const locked = !isPro && preset.key !== 'classico'
                return (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => { if (!locked) setPresetKey(preset.key) }}
                    disabled={locked}
                    aria-disabled={locked}
                    title={locked ? 'Disponibile con il piano Pro' : undefined}
                    style={{
                      border: isActive && !locked ? '1.5px solid #1a1a2e' : '1px solid #e7e7ea',
                      background: '#fff',
                      color: isActive && !locked ? '#1a1a2e' : '#55534b',
                      fontWeight: isActive && !locked ? 600 : 500,
                      borderRadius: 9, padding: '8px 2px', fontSize: 12, textAlign: 'center',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
                      cursor: locked ? 'not-allowed' : 'pointer', minWidth: 0,
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preset.label}</span>
                    {locked && <Lock size={11} style={{ color: '#b08d3e', flexShrink: 0 }} />}
                  </button>
                )
              })}
            </div>
          </div>
          )}

          {/* Colore accento — Pro */}
          {openPanel === 'colore' && (
          <div>
            <div style={{ ...ROW_LABEL, marginBottom: 8 }}>Colore accento</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, flexWrap: 'wrap' }}>
              {SWATCHES.map((c) => {
                const selected = previewColor.toLowerCase() === c.toLowerCase()
                return (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Colore ${c}`}
                    onClick={() => { if (isPro) setColor(c) }}
                    disabled={!isPro}
                    style={{
                      width: 28, height: 28, borderRadius: '50%', background: c, border: 'none', padding: 0,
                      boxShadow: selected ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : undefined,
                      cursor: isPro ? 'pointer' : 'not-allowed', flexShrink: 0,
                    }}
                  />
                )
              })}
              {/* colore personalizzato */}
              <button
                type="button"
                aria-label="Colore personalizzato"
                onClick={() => { if (isPro) customColorRef.current?.click() }}
                disabled={!isPro}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  border: '1.5px dashed #c9c7bf',
                  background: isPro && !SWATCHES.some((c) => c.toLowerCase() === previewColor.toLowerCase()) ? previewColor : 'transparent',
                  boxShadow: isPro && !SWATCHES.some((c) => c.toLowerCase() === previewColor.toLowerCase()) ? `0 0 0 2px #fff, 0 0 0 4px ${previewColor}` : undefined,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--cc-muted)', cursor: isPro ? 'pointer' : 'not-allowed', flexShrink: 0, padding: 0,
                }}
              >
                {(!isPro || SWATCHES.some((c) => c.toLowerCase() === previewColor.toLowerCase())) && <Plus size={14} />}
              </button>
              <input
                ref={customColorRef}
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
                tabIndex={-1}
                aria-hidden="true"
              />
              {!isPro && (
                <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 700, color: '#b0863e', border: '1px solid #e8d6ad', background: '#fbf7ee', padding: '4px 11px', borderRadius: 999, letterSpacing: '.02em' }}>
                  <Lock size={13} /> Solo con Pro
                </span>
              )}
            </div>
          </div>
          )}

          {/* Font — Pro. Bottoncini come gli stili (feedback Eli 18 lug):
              nome nel SUO carattere + descrizione grigia sotto. Niente
              dropdown a portale: un tocco sul menu appeso a body verrebbe
              letto come "fuori" e chiuderebbe il pannello. */}
          {openPanel === 'font' && (
          <div>
            {isPro ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                {FONTS.map((f) => {
                  const selected = font === f.value
                  return (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setFont(f.value)}
                      aria-pressed={selected}
                      style={{
                        border: selected ? '1.5px solid #1a1a2e' : '1px solid #e7e7ea',
                        background: '#fff', borderRadius: 9, padding: '9px 6px',
                        textAlign: 'center', cursor: 'pointer', minWidth: 0,
                      }}
                    >
                      <span style={{ display: 'block', fontSize: 15, fontFamily: f.css, fontStyle: f.italic ? 'italic' : 'normal', color: selected ? '#1a1a2e' : '#3d3b35', fontWeight: selected ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.name}
                      </span>
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--cc-muted)', marginTop: 2 }}>
                        {f.desc}
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={ROW_LABEL}>Font: {fontShort}</span>
                {/* Stessa pillola della riga Colore (Eli, 16 ago: la dicitura
                    11px oro tenue «si legge poco») — un solo stile per il Pro. */}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 700, color: '#b0863e', border: '1px solid #e8d6ad', background: '#fbf7ee', padding: '4px 11px', borderRadius: 999, letterSpacing: '.02em' }}>
                  <Lock size={13} /> Solo con Pro
                </span>
              </div>
            )}
          </div>
          )}

          {/* Logo: mostra + posizione */}
          {openPanel === 'logo' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0 9px' }}>
              <span style={ROW_LABEL}>Mostra logo</span>
              <Switch checked={showLogo} onCheckedChange={setShowLogo} className="data-[state=checked]:bg-[#1a1a2e]" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0 2px', borderTop: '0.5px solid #eee' }}>
              <span style={ROW_LABEL}>Posizione logo</span>
              {isPro ? (
                <button
                  type="button"
                  onClick={() => setLogoPosition((p) => (p === 'left' ? 'right' : 'left'))}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--cc-muted)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                >
                  {logoPosition === 'left' ? 'Sinistra' : 'Destra'} <ChevronRight size={15} />
                </button>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 700, color: '#b0863e', border: '1px solid #e8d6ad', background: '#fbf7ee', padding: '4px 11px', borderRadius: 999, letterSpacing: '.02em' }}>
                  <Lock size={13} /> Solo con Pro
                </span>
              )}
            </div>
          </div>
          )}

          {/* Filigrana Carta Canta — Pro può toglierla */}
          {openPanel === 'filigrana' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={ROW_LABEL}>Filigrana Carta Canta</span>
            {isPro ? (
              <Switch checked={showWatermark} onCheckedChange={setShowWatermark} className="data-[state=checked]:bg-[#1a1a2e]" />
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--cc-muted)' }}>
                Sempre attiva <Lock size={14} />
              </span>
            )}
          </div>
          )}

          {/* Note legali in calce — Free + Pro */}
          {openPanel === 'note' && (
          <div>
            <div style={{ ...ROW_LABEL, marginBottom: 8 }}>Note legali in calce</div>
            <textarea
              value={legalNotice}
              onChange={(e) => setLegalNotice(e.target.value)}
              placeholder="Es. Operazione effettuata ai sensi dell'art. 1, commi 54-89, L. 190/2014…"
              rows={3}
              style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 12px', fontSize: 14, color: '#161616', resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>
          )}

          </div>
          )}
        </div>

        {/* Nome template — non cambia l'aspetto: sta DOPO i controlli (F3) */}
        <div style={{ margin: '14px 15px 0', background: '#fff', borderRadius: 14, boxShadow: CARD_SHADOW, padding: '15px 15px' }}>
          <div style={FIELD_LABEL}>Nome template</div>
          {/* NB: niente `required` — l'input è nascosto via CSS su desktop e un required
              non focusabile bloccherebbe il submit. La validazione è server-side (Zod). */}
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="es. Template professionale"
            style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 12px', fontSize: 14, color: '#161616', background: '#fff' }}
          />
        </div>

        {/* Micro-upsell Free (testo del mockup) */}
        {!isPro && (
          <div style={{ margin: '14px 15px 0', fontSize: 12, color: '#767676', lineHeight: 1.45, textAlign: 'center' }}>
            Con Free: stile Classico, logo e note legali in calce. Stili Bold/Tecnico/Elegante, colore, font e filigrana sono{' '}
            <Link href="/abbonamento" style={{ color: '#1a1a2e', fontWeight: 700, textDecoration: 'none' }}>Pro</Link>.
          </div>
        )}

        {/* Bottoni: primario "Salva e imposta come predefinito" + secondario "Salva" */}
        <div style={{ padding: '0 15px', marginTop: 16 }}>
          <button
            type="submit"
            name="is_default"
            value="true"
            disabled={isPending}
            onClick={() => setSubmitAs('default')}
            style={{ width: '100%', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 12, height: 50, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 600, boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)', cursor: isPending ? 'wait' : 'pointer' }}
          >
            {isPending && submitAs === 'default' ? <Loader2 size={18} className="animate-spin" /> : <Star size={18} />}
            Salva e imposta come predefinito
          </button>
          <button
            type="submit"
            name="is_default"
            value={String(defaultValues?.is_default ?? false)}
            disabled={isPending}
            onClick={() => setSubmitAs('save')}
            style={{ width: '100%', border: '1px solid #e7e7ea', color: '#1a1a2e', borderRadius: 12, height: 48, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 500, background: '#fff', marginTop: 10, cursor: isPending ? 'wait' : 'pointer' }}
          >
            {isPending && submitAs === 'save' ? <Loader2 size={18} className="animate-spin" style={{ color: '#55534b' }} /> : <Save size={18} style={{ color: '#55534b' }} />}
            Salva
          </button>
        </div>
        <div style={{ height: 20 }} />
      </div>

      {/* ════════════════════════ DESKTOP (invariato nel layout) ════════════════════════ */}
      <div className="hidden lg:grid lg:grid-cols-2 gap-6">
        <div className="space-y-5">
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          {state?.success && (
            <Alert>
              <AlertDescription>{state.success}</AlertDescription>
            </Alert>
          )}

          {/* ── Nome ── */}
          <div className="space-y-1.5">
            <Label htmlFor="name">
              Nome template <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="es. Template professionale"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Descrizione</Label>
            <Input
              id="description"
              name="description"
              defaultValue={defaultValues?.description ?? ''}
              placeholder="Uso interno per descrivere questo template"
            />
          </div>

          <Separator />

          {/* ── Selettore preset ── */}
          <div className="space-y-2">
            <Label>Layout</Label>
            <p className="text-xs text-muted-foreground -mt-1">
              Scegli il layout di base del documento.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_LIST.map((preset) => {
                const isActive = presetKey === preset.key
                // Free: solo "Classico"; Bold/Tecnico/Elegante sono bloccati (Pro)
                const locked = !isPro && preset.key !== 'classico'
                return (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => { if (!locked) setPresetKey(preset.key) }}
                    disabled={locked}
                    aria-disabled={locked}
                    title={locked ? 'Disponibile con il piano Pro' : undefined}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                      locked
                        ? 'border-border text-muted-foreground opacity-60 cursor-not-allowed'
                        : isActive
                          ? 'border-primary bg-primary/5 text-primary font-medium'
                          : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
                    )}
                  >
                    <div className={cn(
                      'size-4 rounded-full border-2 flex items-center justify-center shrink-0',
                      isActive && !locked ? 'border-primary bg-primary' : 'border-muted-foreground',
                    )}>
                      {isActive && !locked && <Check className="size-2.5 text-primary-foreground" strokeWidth={3} />}
                    </div>
                    <span className="flex items-center gap-1.5 min-w-0">
                      {preset.label}
                      {locked && (
                        <Badge variant="secondary" className="text-[10px] gap-0.5 px-1 py-0 shrink-0">
                          <Lock className="size-2" /> Pro
                        </Badge>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <Separator />

          {/* ══════════════════════════════════════════════════════════
              SEZIONE BASE — disponibile per tutti (Free + Pro)
              ══════════════════════════════════════════════════════════ */}
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium">Impostazioni base</p>
            </div>

            {/* Colore accento — Pro (Free: lucchetto + upsell) */}
            <div className="space-y-1.5">
              <Label htmlFor="color_input" className="flex items-center gap-2">
                Colore accento
                {!isPro && (
                  <Badge variant="secondary" className="text-[10px] gap-0.5 px-1 py-0 shrink-0">
                    <Lock className="size-2" /> Pro
                  </Badge>
                )}
              </Label>
              <div className="flex items-center gap-3">
                <input
                  id="color_input"
                  type="color"
                  value={previewColor}
                  onChange={(e) => { if (isPro) setColor(e.target.value) }}
                  disabled={!isPro}
                  className={cn('size-10 rounded-lg border p-0.5', isPro ? 'cursor-pointer' : 'cursor-not-allowed opacity-60')}
                />
                <Input
                  value={previewColor}
                  onChange={(e) => {
                    const v = e.target.value
                    if (isPro && /^#[0-9a-fA-F]{0,6}$/.test(v)) setColor(v)
                  }}
                  disabled={!isPro}
                  className="font-mono w-32 uppercase"
                  maxLength={7}
                />
                <span className="text-xs text-muted-foreground">
                  {isPro
                    ? 'Intestazione e accenti'
                    : <>Con <strong>Pro</strong> personalizzi il colore del documento.</>}
                </span>
              </div>
            </div>

            {/* Toggle logo */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                {/* Anteprima logo corrente */}
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="h-9 w-9 object-contain rounded border bg-white p-0.5 shrink-0"
                  />
                ) : (
                  <div className="h-9 w-9 rounded border bg-muted/50 flex items-center justify-center shrink-0">
                    <ImageIcon className="size-4 text-muted-foreground/60" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium">Mostra logo</p>
                  <p className="text-xs text-muted-foreground">
                    {logoUrl ? (
                      <>
                        Il logo appare nell&apos;intestazione.{' '}
                        <Link href="/impostazioni" className="underline underline-offset-2 hover:text-foreground">
                          Cambia logo
                        </Link>
                      </>
                    ) : (
                      <>
                        Nessun logo caricato.{' '}
                        <Link href="/impostazioni" className="underline underline-offset-2 hover:text-foreground">
                          Carica logo
                        </Link>
                        {' '}nelle impostazioni.
                      </>
                    )}
                  </p>
                </div>
              </div>
              <Switch checked={showLogo} onCheckedChange={setShowLogo} />
            </div>

            {/* Nota legale — disponibile anche al Free (allineato al mockup) */}
            <LegalNoticeField
              value={legalNotice}
              onChange={setLegalNotice}
              hint="Per i forfettari viene aggiunta automaticamente la stringa obbligatoria."
            />
          </div>

          <Separator />

          {/* ══════════════════════════════════════════════════════════
              SEZIONE PRO — personalizzazione avanzata
              ══════════════════════════════════════════════════════════ */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">Personalizzazione avanzata</p>
              {!isPro && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Lock className="size-2.5" /> Pro
                </Badge>
              )}
            </div>

            {!isPro ? (
              /* ── Blocco upsell per Free ── */
              <div className="rounded-xl border bg-muted/30 px-4 py-4 space-y-2">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Con <strong>Pro</strong>{' '}sblocchi: stili Bold/Tecnico/Elegante, colore accento,
                  font del documento, posizione del logo, rimozione della filigrana
                  &quot;Generato con Carta Canta&quot; e template illimitati.
                </p>
                <Button asChild size="sm" variant="outline" className="mt-1">
                  <Link href="/abbonamento">Passa a Pro</Link>
                </Button>
              </div>
            ) : (
              <>
                {/* Toggle branding — in cima alla sezione Pro */}
                <div className="rounded-xl border p-3">
                  <div className="flex items-start justify-between gap-6">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">Branding &quot;Generato con Carta Canta&quot;</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Riga nel piè di pagina del documento
                      </p>
                    </div>
                    <Switch checked={showWatermark} onCheckedChange={setShowWatermark} className="mt-0.5 shrink-0" />
                  </div>
                </div>

                <Separator />

                {/* Posizione logo */}
                <div className="space-y-1.5">
                  <Label>Posizione logo nell&apos;intestazione</Label>
                  <div className="flex gap-2">
                    {(['left', 'right'] as const).map((pos) => (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => setLogoPosition(pos)}
                        className={cn(
                          'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm flex-1 transition-colors',
                          logoPosition === pos
                            ? 'border-primary bg-primary/5 text-primary font-medium'
                            : 'border-border text-muted-foreground hover:border-primary/40',
                        )}
                      >
                        {pos === 'left' ? <AlignLeft className="size-4" /> : <AlignRight className="size-4" />}
                        {pos === 'left' ? 'Sinistra' : 'Destra'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font */}
                <div className="space-y-1.5">
                  <Label>Font documento</Label>
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger className="flex w-52 items-center justify-between rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm focus:outline-none focus-visible:border-ring">
                      <span>{FONTS.find((f) => f.value === font)?.label ?? font}</span>
                      <ChevronDown size={14} className="opacity-60" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" sideOffset={6} className="min-w-[210px]">
                      <DropdownMenuRadioGroup value={font} onValueChange={(v: string) => setFont(v)}>
                        {FONTS.map((f) => (
                          <DropdownMenuRadioItem key={f.value} value={f.value}>
                            <span style={{ fontFamily: f.css, fontStyle: f.italic ? 'italic' : 'normal' }}>{f.label}</span>
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Intestazione personalizzata (HTML avanzato) */}
                <details className="space-y-3">
                  <summary className="text-sm font-medium cursor-pointer text-muted-foreground hover:text-foreground">
                    HTML intestazione / piè di pagina (avanzato)
                  </summary>
                  <div className="space-y-3 pt-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="header_html">HTML intestazione</Label>
                      <Textarea
                        id="header_html"
                        name="header_html"
                        defaultValue={defaultValues?.header_html ?? ''}
                        placeholder="<p>Testo aggiuntivo in intestazione</p>"
                        rows={3}
                        className="font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="footer_html">HTML piè di pagina</Label>
                      <Textarea
                        id="footer_html"
                        name="footer_html"
                        defaultValue={defaultValues?.footer_html ?? ''}
                        placeholder="<p>Condizioni generali di vendita…</p>"
                        rows={3}
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>
                </details>

                {/* Formato numerazione — prossimamente */}
                <div className="space-y-1.5 opacity-60">
                  <Label htmlFor="number_format" className="flex items-center gap-2">
                    Formato numerazione
                    <span className="text-xs font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      prossimamente
                    </span>
                  </Label>
                  <Input
                    id="number_format"
                    name="number_format"
                    defaultValue={defaultValues?.number_format ?? ''}
                    placeholder="es. INV-{NUM}/{YEAR}"
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">
                    Sostituisce il formato predefinito 001/2026. Disponibile a breve.
                  </p>
                </div>

              </>
            )}
          </div>

          {/* Stessi bottoni e stessa gerarchia del mobile:
              primario = "Salva e imposta come predefinito", secondario = "Salva" */}
          <div className="flex flex-wrap gap-3 pt-2">
            <Button
              type="submit"
              name="is_default"
              value="true"
              disabled={isPending}
              onClick={() => setSubmitAs('default')}
            >
              {isPending && submitAs === 'default' ? <Loader2 className="size-4 animate-spin" /> : <Star className="size-4" />} Salva e imposta come predefinito
            </Button>
            <Button
              type="submit"
              name="is_default"
              value={String(defaultValues?.is_default ?? false)}
              variant="secondary"
              disabled={isPending}
              onClick={() => setSubmitAs('save')}
            >
              {isPending && submitAs === 'save' ? (
                <><Loader2 className="size-4 animate-spin" /> Salvataggio…</>
              ) : (
                'Salva'
              )}
            </Button>
            <Button variant="outline" asChild>
              <Link href="/template">Annulla</Link>
            </Button>
          </div>
        </div>

        {/* ── PREVIEW LIVE (desktop) ── */}
        <div className="lg:sticky lg:top-6 self-start">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Anteprima live
            <span className="ml-1.5 font-normal text-muted-foreground/60">(dati di esempio)</span>
          </p>
          {preview(true)}
        </div>
      </div>
    </form>
  )
}
