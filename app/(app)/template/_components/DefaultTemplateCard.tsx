'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { clearDefaultTemplateAction } from '@/lib/actions/templates'
import { TemplatePreview } from './TemplatePreview'

interface DefaultTemplateCardProps {
  isActive: boolean
  workspaceName: string
  logoUrl?: string | null
}

export function DefaultTemplateCard({ isActive, workspaceName, logoUrl }: DefaultTemplateCardProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleSelect() {
    if (isActive || pending) return
    startTransition(async () => {
      await clearDefaultTemplateAction()
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
            presetKey="classico"
            color="#1a1a2e"
            font="Inter"
            showLogo={true}
            showWatermark={false}
            logoPosition="left"
            legalNotice=""
            workspaceName={workspaceName}
            logoUrl={logoUrl}
          />
        </div>
      </div>

      {/* Info + pulsante */}
      <div className="flex-1 flex flex-col gap-1">
        <p className={cn(
          'text-sm font-semibold leading-tight',
          isActive ? 'text-primary' : 'text-foreground',
        )}>
          Default (Classico)
        </p>
        <p className="text-xs text-muted-foreground leading-snug flex-1">
          Layout pulito, grigio scuro. Usato automaticamente se non hai personalizzazioni.
        </p>
        <button
          type="button"
          onClick={handleSelect}
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
}
