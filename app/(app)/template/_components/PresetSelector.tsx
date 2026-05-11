'use client'

import { useTransition, useState } from 'react'
import { cn } from '@/lib/utils'
import { Check, Loader2, Maximize2, X } from 'lucide-react'
import { TemplatePreview } from './TemplatePreview'
import { selectPresetAction } from '@/lib/actions/templates'

export interface PresetInfo {
  key: string
  label: string
  description: string
  defaultColor: string
  defaultFont: string
}

export const PRESET_LIST: PresetInfo[] = [
  {
    key:          'classico',
    label:        'Classico',
    description:  'Pulito e professionale, adatto a ogni settore.',
    defaultColor: '#1a1a2e',
    defaultFont:  'Inter',
  },
  {
    key:          'bold',
    label:        'Bold',
    description:  'Header imponente con striscia info, forte impatto visivo.',
    defaultColor: '#0f172a',
    defaultFont:  'Helvetica',
  },
  {
    key:          'tecnico',
    label:        'Tecnico',
    description:  'Compatto e preciso, ideale per lavori tecnici.',
    defaultColor: '#0369a1',
    defaultFont:  'GeistSans',
  },
  {
    key:          'elegante',
    label:        'Elegante',
    description:  'Intestazione centrata, atmosfera editoriale e raffinata.',
    defaultColor: '#7c3aed',
    defaultFont:  'Georgia',
  },
]

interface ActiveTemplateSnapshot {
  color_primary?: string | null
  font_family?:   string | null
  logo_position?: string | null
  show_watermark?: boolean | null
  show_logo?:     boolean | null
}

interface PresetSelectorProps {
  activePreset: string
  workspaceName: string
  logoUrl?: string | null
  /** Dati del template salvato — usati per la card del preset attivo */
  activeTemplateData?: ActiveTemplateSnapshot | null
}

export function PresetSelector({ activePreset, workspaceName, logoUrl, activeTemplateData }: PresetSelectorProps) {
  const [pending, startTransition] = useTransition()
  const [localActive, setLocalActive] = useState(activePreset)
  const [loadingKey, setLoadingKey] = useState<string | null>(null)
  const [modalPreset, setModalPreset] = useState<PresetInfo | null>(null)

  function handleSelect(key: string) {
    if (key === localActive || pending) return
    setLoadingKey(key)
    setLocalActive(key)  // ottimistico
    startTransition(async () => {
      await selectPresetAction(key)
      setLoadingKey(null)
    })
  }

  function openModal(preset: PresetInfo, e: React.MouseEvent) {
    e.stopPropagation()
    setModalPreset(preset)
  }

  function closeModal() {
    setModalPreset(null)
  }

  function selectFromModal(key: string) {
    handleSelect(key)
    closeModal()
  }

  return (
    <>
      {/* ── Griglia 4 card ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {PRESET_LIST.map((preset) => {
          const isActive  = localActive === preset.key
          const isLoading = loadingKey === preset.key

          // Per il preset attivo usa i dati del template salvato (se disponibili)
          const cardColor       = isActive && activeTemplateData?.color_primary ? activeTemplateData.color_primary : preset.defaultColor
          const cardFont        = isActive && activeTemplateData?.font_family    ? activeTemplateData.font_family    : preset.defaultFont
          const cardLogoPos     = isActive && activeTemplateData?.logo_position  ? activeTemplateData.logo_position as 'left' | 'right' : 'left'
          const cardShowLogo    = isActive ? (activeTemplateData?.show_logo    ?? true)  : true
          const cardShowWm      = isActive ? (activeTemplateData?.show_watermark ?? false) : false

          return (
            <div
              key={preset.key}
              className={cn(
                'group relative flex flex-col gap-2 rounded-xl border-2 p-3 transition-all',
                'hover:border-primary/40 hover:shadow-sm',
                isActive
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border bg-card',
              )}
            >
              {/* Badge attivo */}
              {isActive && (
                <div className="absolute top-2.5 right-2.5 z-10">
                  <div className="size-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="size-3 text-primary-foreground" strokeWidth={3} />
                  </div>
                </div>
              )}

              {/* Spinner caricamento */}
              {isLoading && (
                <div className="absolute top-2.5 right-2.5 z-10">
                  <Loader2 className="size-4 text-primary animate-spin" />
                </div>
              )}

              {/* Mini anteprima — clicca per ingrandire */}
              <button
                type="button"
                onClick={(e) => openModal(preset, e)}
                title="Anteprima ingrandita"
                className={cn(
                  'relative overflow-hidden rounded-lg select-none',
                  'ring-0 hover:ring-2 hover:ring-primary/30 transition-all',
                )}
                style={{ height: 110 }}
              >
                <div style={{
                  width: '250%',
                  height: '250%',
                  transform: 'scale(0.4)',
                  transformOrigin: 'top left',
                  pointerEvents: 'none',
                }}>
                  <TemplatePreview
                    presetKey={preset.key}
                    color={cardColor}
                    font={cardFont}
                    showLogo={cardShowLogo}
                    showWatermark={cardShowWm}
                    logoPosition={cardLogoPos}
                    legalNotice=""
                    workspaceName={workspaceName}
                    logoUrl={logoUrl}
                  />
                </div>
                {/* Overlay icona zoom */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 rounded-lg">
                  <div className="bg-white/90 rounded-full p-1">
                    <Maximize2 className="size-3.5 text-foreground" />
                  </div>
                </div>
              </button>

              {/* Label + descrizione + pulsante selezione */}
              <div className="flex-1 flex flex-col gap-1">
                <p className={cn(
                  'text-sm font-semibold leading-tight',
                  isActive ? 'text-primary' : 'text-foreground',
                )}>
                  {preset.label}
                </p>
                <p className="text-xs text-muted-foreground leading-snug flex-1">
                  {preset.description}
                </p>
                <button
                  type="button"
                  onClick={() => handleSelect(preset.key)}
                  disabled={pending || isActive}
                  className={cn(
                    'mt-1 w-full rounded-md py-1 text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary cursor-default'
                      : 'bg-muted hover:bg-primary/10 hover:text-primary text-muted-foreground',
                    'disabled:opacity-60 disabled:cursor-not-allowed',
                  )}
                >
                  {isActive ? '✓ Selezionato' : 'Usa questo'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Modale anteprima ingrandita ── */}
      {modalPreset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Pannello */}
          <div
            className="relative z-10 bg-background rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header modale */}
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div>
                <h2 className="text-base font-semibold">{modalPreset.label}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{modalPreset.description}</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-1.5 hover:bg-muted transition-colors"
                aria-label="Chiudi anteprima"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Anteprima scrollabile */}
            <div className="flex-1 overflow-y-auto p-5 bg-muted/20">
              {(() => {
                const isModalActive = modalPreset.key === localActive
                const mc = isModalActive && activeTemplateData?.color_primary ? activeTemplateData.color_primary : modalPreset.defaultColor
                const mf = isModalActive && activeTemplateData?.font_family    ? activeTemplateData.font_family    : modalPreset.defaultFont
                const mlp = isModalActive && activeTemplateData?.logo_position ? activeTemplateData.logo_position as 'left' | 'right' : 'left'
                return (
                  <TemplatePreview
                    presetKey={modalPreset.key}
                    color={mc}
                    font={mf}
                    showLogo={isModalActive ? (activeTemplateData?.show_logo ?? true) : true}
                    showWatermark={isModalActive ? (activeTemplateData?.show_watermark ?? false) : false}
                    logoPosition={mlp}
                    legalNotice=""
                    workspaceName={workspaceName}
                    logoUrl={logoUrl}
                  />
                )
              })()}
            </div>

            {/* Footer modale */}
            <div className="flex items-center gap-3 px-5 py-4 border-t bg-background">
              <button
                type="button"
                onClick={() => selectFromModal(modalPreset.key)}
                disabled={pending || localActive === modalPreset.key}
                className={cn(
                  'flex-1 rounded-lg py-2 text-sm font-semibold transition-colors',
                  localActive === modalPreset.key
                    ? 'bg-primary/10 text-primary cursor-default'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90',
                  'disabled:opacity-60 disabled:cursor-not-allowed',
                )}
              >
                {localActive === modalPreset.key ? '✓ Già selezionato' : 'Usa questo layout'}
              </button>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg px-4 py-2 text-sm font-medium border hover:bg-muted transition-colors"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
