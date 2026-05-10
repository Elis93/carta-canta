'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Loader2, Lock, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { TemplatePreview } from './TemplatePreview'
import { PRESET_LIST } from './PresetSelector'
import { createTemplateAction, updateTemplateAction } from '@/lib/actions/templates'
import type { Database } from '@/types/database'

type TemplateRow = Database['public']['Tables']['templates']['Row']
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TemplateRowWithPreset = TemplateRow & { preset_key?: string | null }

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
  defaultValues?: Partial<TemplateRowWithPreset>
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

  // Valori live per la preview
  const [name,          setName]          = useState(defaultValues?.name ?? 'Template senza nome')
  const [color,         setColor]         = useState(defaultValues?.color_primary ?? '#1a1a2e')
  const [font,          setFont]          = useState(defaultValues?.font_family ?? 'Inter')
  const [showLogo,      setShowLogo]      = useState(defaultValues?.show_logo ?? true)
  const [showWatermark, setShowWatermark] = useState(defaultValues?.show_watermark ?? false)
  const [legalNotice,   setLegalNotice]   = useState(defaultValues?.legal_notice ?? '')
  const [isDefault,     setIsDefault]     = useState(defaultValues?.is_default ?? false)
  const [mobileTab,     setMobileTab]     = useState<'form' | 'preview'>('form')

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
        <input type="hidden" name="preset_key"    value={presetKey} />
        <input type="hidden" name="color_primary" value={color} />
        <input type="hidden" name="font_family"   value={font} />
        <input type="hidden" name="show_logo"     value={String(showLogo)} />
        <input type="hidden" name="show_watermark" value={String(showWatermark)} />
        <input type="hidden" name="legal_notice"  value={legalNotice} />
        <input type="hidden" name="is_default"    value={String(isDefault)} />

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

        {/* ── Personalizzazione avanzata (Pro) ── */}
        {!isPro ? (
          // Blocco upsell per Free
          <div className="rounded-xl border bg-muted/30 px-4 py-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Lock className="size-4" />
              Personalizzazione avanzata — Solo Pro
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Con Pro puoi scegliere il tuo colore brand, il font, abilitare il logo
              e aggiungere una nota legale personalizzata.
            </p>
            <Button asChild size="sm" variant="outline" className="mt-1">
              <Link href="/abbonamento">Passa a Pro</Link>
            </Button>
          </div>
        ) : (
          <>
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
                  Usato per intestazione e accenti
                </span>
              </div>
            </div>

            {/* Font */}
            <div className="space-y-1.5">
              <Label>Font</Label>
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

            {/* Toggle logo */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Mostra logo</p>
                <p className="text-xs text-muted-foreground">Appare nell&apos;intestazione del PDF</p>
              </div>
              <Switch checked={showLogo} onCheckedChange={setShowLogo} />
            </div>

            {/* Toggle watermark */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Watermark &quot;Carta Canta&quot;</p>
                <p className="text-xs text-muted-foreground">
                  Aggiunto automaticamente nel piano Free
                </p>
              </div>
              <Switch checked={showWatermark} onCheckedChange={setShowWatermark} />
            </div>

            <Separator />

            {/* Note legali */}
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

            {/* Header / Footer HTML */}
            <details className="space-y-3">
              <summary className="text-sm font-medium cursor-pointer text-muted-foreground hover:text-foreground">
                HTML avanzato (header / footer)
              </summary>
              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="header_html">HTML header</Label>
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
                  <Label htmlFor="footer_html">HTML footer</Label>
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
          color={isPro ? color : (PRESET_LIST.find(p => p.key === presetKey)?.defaultColor ?? '#1a1a2e')}
          font={isPro ? font : undefined}
          showLogo={isPro ? showLogo : true}
          showWatermark={isPro ? showWatermark : false}
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
