'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { setDefaultTemplateAction } from '@/lib/actions/templates'
import { TemplatePreview } from './TemplatePreview'

interface CustomTemplateCardProps {
  id: string
  name: string
  isActive: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  presetKey: string
  colorPrimary: string
  fontFamily: string
  showLogo: boolean
  showWatermark: boolean
  logoPosition: 'left' | 'right'
  legalNotice: string
  workspaceName: string
  logoUrl?: string | null
}

export function CustomTemplateCard({
  id,
  name,
  isActive,
  presetKey,
  colorPrimary,
  fontFamily,
  showLogo,
  showWatermark,
  logoPosition,
  legalNotice,
  workspaceName,
  logoUrl,
}: CustomTemplateCardProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleSelect() {
    if (isActive || pending) return
    startTransition(async () => {
      await setDefaultTemplateAction(id)
      router.refresh()
    })
  }

  return (
    <div
      className={cn(
        'group relative flex flex-col gap-2 rounded-xl border-2 p-3 transition-all',
        isActive
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border bg-card hover:border-primary/40 hover:shadow-sm',
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

      {/* Spinner */}
      {pending && (
        <div className="absolute top-2.5 right-2.5 z-10">
          <Loader2 className="size-4 text-primary animate-spin" />
        </div>
      )}

      {/* Mini preview */}
      <div
        className="relative overflow-hidden rounded-lg select-none"
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
            presetKey={presetKey}
            color={colorPrimary}
            font={fontFamily}
            showLogo={showLogo}
            showWatermark={showWatermark}
            logoPosition={logoPosition}
            legalNotice={legalNotice}
            workspaceName={workspaceName}
            logoUrl={logoUrl}
          />
        </div>
      </div>

      {/* Info + pulsanti */}
      <div className="flex-1 flex flex-col gap-1">
        <p className={cn(
          'text-sm font-semibold leading-tight truncate pr-6',
          isActive ? 'text-primary' : 'text-foreground',
        )}>
          {name}
        </p>
        <p className="text-xs text-muted-foreground leading-snug flex-1">
          Preset: {presetKey} · Colore: {colorPrimary}
        </p>

        {/* Riga pulsanti */}
        <div className="flex gap-2 mt-1">
          <Link
            href={`/template/${id}`}
            className="flex-1 rounded-md py-1 text-xs font-medium text-center border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            Modifica
          </Link>
          <button
            type="button"
            onClick={handleSelect}
            disabled={pending || isActive}
            className={cn(
              'flex-1 rounded-md py-1 text-xs font-medium transition-colors',
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
    </div>
  )
}
