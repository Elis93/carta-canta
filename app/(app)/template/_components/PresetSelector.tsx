'use client'

import { useTransition, useState } from 'react'
import { cn } from '@/lib/utils'
import { Check, Loader2 } from 'lucide-react'
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

interface PresetSelectorProps {
  activePreset: string
  workspaceName: string
  logoUrl?: string | null
}

export function PresetSelector({ activePreset, workspaceName, logoUrl }: PresetSelectorProps) {
  const [pending, startTransition] = useTransition()
  const [localActive, setLocalActive] = useState(activePreset)
  const [loadingKey, setLoadingKey] = useState<string | null>(null)

  function handleSelect(key: string) {
    if (key === localActive || pending) return
    setLoadingKey(key)
    setLocalActive(key)  // ottimistico
    startTransition(async () => {
      await selectPresetAction(key)
      setLoadingKey(null)
    })
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {PRESET_LIST.map((preset) => {
        const isActive = localActive === preset.key
        const isLoading = loadingKey === preset.key

        return (
          <button
            key={preset.key}
            type="button"
            onClick={() => handleSelect(preset.key)}
            disabled={pending}
            className={cn(
              'group relative flex flex-col gap-2 rounded-xl border-2 p-3 text-left transition-all',
              'hover:border-primary/40 hover:shadow-sm',
              'disabled:cursor-not-allowed disabled:opacity-70',
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

            {/* Mini anteprima */}
            <div className="overflow-hidden rounded-lg pointer-events-none select-none" style={{ height: 110 }}>
              <div style={{
                width: '250%',
                height: '250%',
                transform: 'scale(0.4)',
                transformOrigin: 'top left',
              }}>
                <TemplatePreview
                  presetKey={preset.key}
                  color={preset.defaultColor}
                  font={preset.defaultFont}
                  showLogo={true}
                  showWatermark={false}
                  legalNotice=""
                  workspaceName={workspaceName}
                  logoUrl={logoUrl}
                />
              </div>
            </div>

            {/* Label + descrizione */}
            <div>
              <p className={cn(
                'text-sm font-semibold leading-tight',
                isActive ? 'text-primary' : 'text-foreground',
              )}>
                {preset.label}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                {preset.description}
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
