'use client'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export type DocStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired'

const STATUS_CONFIG: Record<DocStatus, { label: string; bg: string; description: string }> = {
  draft: {
    label: 'Bozza',
    bg: '#e8e8e8',
    description: 'Preventivo in bozza, non ancora inviato al cliente.',
  },
  sent: {
    label: 'Inviato',
    bg: '#d8e8fb',
    description: 'Preventivo inviato al cliente, in attesa di risposta.',
  },
  viewed: {
    label: 'Visto',
    bg: '#fbe1ee',
    description: 'Il cliente ha aperto il link ma non ha ancora risposto.',
  },
  accepted: {
    label: 'Accettato',
    bg: '#d4efe2',
    description: 'Il cliente ha accettato il preventivo.',
  },
  rejected: {
    label: 'Rifiutato',
    bg: '#f5dede',
    description: 'Il cliente ha rifiutato il preventivo.',
  },
  expired: {
    label: 'Scaduto',
    bg: '#f5e9d0',
    description: 'Il preventivo ha superato la data di scadenza.',
  },
}

interface StatusBadgeProps {
  status: string
  showTooltip?: boolean
  className?: string
  docType?: 'preventivo' | 'fattura'
}

export function StatusBadge({ status, showTooltip = true, className, docType }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status as DocStatus] ?? {
    label: status,
    bg: '#e8e8e8',
    description: '',
  }

  // Override label/description per le fatture
  let overrideLabel: string | undefined
  let overrideDescription: string | undefined
  if (docType === 'fattura') {
    if (status === 'draft')    { overrideDescription = 'Fattura in bozza, non ancora inviata al cliente.' }
    if (status === 'sent')     { overrideLabel = 'Inviata'; overrideDescription = 'Fattura inviata al cliente, in attesa di pagamento.' }
    if (status === 'viewed')   { overrideLabel = 'Inviata'; overrideDescription = 'Il cliente ha aperto la fattura ma non ha ancora risposto.' }
    if (status === 'accepted') { overrideLabel = 'Pagata'; overrideDescription = 'La fattura è stata pagata.' }
    if (status === 'rejected') { overrideLabel = 'Annullata'; overrideDescription = 'La fattura è stata annullata.' }
    if (status === 'expired')  { overrideLabel = 'Scaduta'; overrideDescription = 'La fattura ha superato la data di scadenza.' }
  }

  const label = overrideLabel ?? config.label
  const description = overrideDescription ?? config.description

  const badge = (
    <span
      className={className}
      style={{
        display: 'inline-flex', alignItems: 'center',
        borderRadius: 999, padding: '3px 11px',
        fontSize: 12, fontWeight: 600, color: '#2b2b2b',
        background: config.bg, whiteSpace: 'nowrap', flexShrink: 0,
      }}
    >
      {label}
    </span>
  )

  if (!showTooltip || !description) return badge

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {description}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
