'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Loader2, Lock, Check, AlignLeft, AlignRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { TemplatePreview } from './TemplatePreview'
import { PRESET_LIST } from './PresetSelector'
import { createTemplateAction, updateTemplateAction } from '@/lib/actions/templates'
import type { Database } from '@/types/database'

type TemplateRow = Database['public']['Tables']['templates']['Row']

const FONTS = [
  { value: 'Inter',      label: 'Inter — moderno',      css: "'Inter', system-ui, sans-serif" },
  { value: 'GeistSans',  label: 'Geist Sans — tecnico', css: 'var(--font-geist-sans), system-ui, sans-serif' },
  { value: 'Helvetica',  label: 'Helvetica — classico', css: "Helvetica, 'Helvetica Neue', Arial, sans-serif" },
  { value: 'Georgia',    label: 'Georgia — elegante',   css: "Georgia, 'Times New Roman', serif" },
]

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

  // Preset selezionato
  const [presetKey, setPresetKey] = useState(
    defaultValues?.preset_key ?? 'classico'
  )

  // ── Valori live per la preview ──────────────────────────────────────────
  const [name,          setName]          = useState(defaultValues?.name ?? 'Template senza nome')
  const [color,         setColor]         = useState(defaultValues?.color_primary ?? '#1a1a2e')
  const [font,          setFont]          = useState(defaultValues?.font_family ?? 'Inter')
  const [showLogo,      setShowLogo]      = useState(defaultValues?.show_logo ?? true)
  const [showWatermark, setShowWatermark] = useState(defaultValues?.show_watermark ?? true)
  const [logoPosition,  setLogoPosition]  = useState<'left' | 'right'>(
    (defaultValues?.logo_position as 'left' | 'right') ?? 'left'
  )
  const [legalNotice,   setLegalNotice]   = useState(defaultValues?.legal_notice ?? '')
  const [isDefault,     setIsDefault]     = useState(defaultValues?.is_default ?? false)
  const [mobileTab,     setMobileTab]     = useState<'form' | 'preview'>('form')

  // ── Colore preview: Free usa colore default del preset ──────────────────
  const previewColor = isPro ? color : (PRESET_LIST.find(p => p.key === presetKey)?.defaultColor ?? '#1a1a2e')

  return (
    <div className="space-y-4">
      {/* Tab switcher — visibile solo su mobile */}
      <div className="flex lg:hidden bg-muted rounded-lg p-1 gap-1">
        {(['form', 'preview'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setMobileTab(tab)}
            className={cn(
              'flex-1 rounded-md py-1.5 text-sm font-medium transition-colors',
              mobileTab === tab
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab === 'form' ? 'Modifica' : 'Anteprima'}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
      {/* ── FORM ── */}
      <form action={formAction} className={cn('space-y-5', mobileTab === 'preview' && 'hidden lg:block')}>
        {/* Hidden fields per valori controllati */}
        <input type="hidden" name="preset_key"     value={presetKey} />
        <input type="hidden" name="color_primary"  value={color} />
        <input type="hidden" name="font_family"    value={font} />
        <input type="hidden" name="show_logo"      value={String(showLogo)} />
        <input type="hidden" name="show_watermark" value={String(showWatermark)} />
        <input type="hidden" name="logo_position"  value={logoPosition} />
        <input type="hidden" name="legal_notice"   value={legalNotice} />
        <input type="hidden" name="is_default"     value={String(isDefault)} />

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
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
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
              return (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => setPresetKey(preset.key)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                    isActive
                      ? 'border-primary bg-primary/5 text-primary font-medium'
                      : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
                  )}
                >
                  <div className={cn(
                    'size-4 rounded-full border-2 flex items-center justify-center shrink-0',
                    isActive ? 'border-primary bg-primary' : 'border-muted-foreground',
                  )}>
                    {isActive && <Check className="size-2.5 text-primary-foreground" strokeWidth={3} />}
                  </div>
                  <span>{preset.label}</span>
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
            <p className="text-xs text-muted-foreground mt-0.5">
              Colore brand e logo disponibili su tutti i piani.
            </p>
          </div>

          {/* Colore brand */}
          <div className="space-y-1.5">
            <Label htmlFor="color_input">Colore brand</Label>
            <div className="flex items-center gap-3">
              <input
                id="color_input"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="size-10 rounded-lg border cursor-pointer p-0.5"
              />
              <Input
                value={color}
                onChange={(e) => {
                  const v = e.target.value
                  if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setColor(v)
                }}
                className="font-mono w-32 uppercase"
                maxLength={7}
              />
              <span className="text-xs text-muted-foreground">
                Intestazione e accenti
              </span>
            </div>
          </div>

          {/* Toggle logo */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Mostra logo</p>
              <p className="text-xs text-muted-foreground">Appare nell&apos;intestazione del documento</p>
            </div>
            <Switch checked={showLogo} onCheckedChange={setShowLogo} />
          </div>
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
                Con <strong>Pro</strong> puoi personalizzare: posizione del logo, font del documento,
                rimozione del branding &quot;Generato con Carta Canta&quot;, testo intestazione personalizzato,
                nota legale in calce e template multipli salvati.
              </p>
              <Button asChild size="sm" variant="outline" className="mt-1">
                <Link href="/abbonamento">Passa a Pro</Link>
              </Button>
            </div>
          ) : (
            <>
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
                <Select value={font} onValueChange={(v: string) => setFont(v)}>
                  <SelectTrigger className="w-52">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONTS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        <span style={{ fontFamily: f.css }}>{f.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Toggle branding */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Branding &quot;Generato con Carta Canta&quot;</p>
                  <p className="text-xs text-muted-foreground">
                    Appare nel piè di pagina del documento
                  </p>
                </div>
                <Switch checked={showWatermark} onCheckedChange={setShowWatermark} />
              </div>

              <Separator />

              {/* Nota legale */}
              <div className="space-y-1.5">
                <Label htmlFor="legal_notice">Nota legale in calce</Label>
                <Textarea
                  id="legal_notice"
                  value={legalNotice}
                  onChange={(e) => setLegalNotice(e.target.value)}
                  placeholder="Es. Operazione effettuata ai sensi dell'art…"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Per i forfettari viene aggiunta automaticamente la stringa obbligatoria.
                </p>
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

              <Separator />

              {/* Default */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Template predefinito</p>
                  <p className="text-xs text-muted-foreground">
                    Usato automaticamente per i nuovi preventivi
                  </p>
                </div>
                <Switch checked={isDefault} onCheckedChange={setIsDefault} />
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <><Loader2 className="size-4 animate-spin" />
                {mode === 'create' ? 'Creazione…' : 'Salvataggio…'}
              </>
            ) : (
              mode === 'create' ? 'Crea template' : 'Salva modifiche'
            )}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/template">Annulla</Link>
          </Button>
        </div>
      </form>

      {/* ── PREVIEW LIVE ── */}
      <div className={cn('lg:sticky lg:top-6', mobileTab === 'form' && 'hidden lg:block')}>
        <p className="text-xs font-medium text-muted-foreground mb-2">
          Anteprima live
          <span className="ml-1.5 font-normal text-muted-foreground/60">(dati di esempio)</span>
        </p>
        <TemplatePreview
          presetKey={presetKey}
          color={previewColor}
          font={isPro ? font : undefined}
          showLogo={showLogo}
          showWatermark={isPro ? showWatermark : true}
          logoPosition={isPro ? logoPosition : 'left'}
          legalNotice={isPro ? legalNotice : ''}
          workspaceName={workspaceName}
          logoUrl={logoUrl}
          templateName={name}
        />
      </div>
      </div>
    </div>
  )
}
