'use client'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export type DocStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired'

const STATUS_CONFIG: Record<DocStatus, { label: string; className: string; description: string }> = {
  draft: {
    label: 'Bozza',
    className: 'bg-gray-100 text-gray-600 border border-gray-200',
    description: 'Preventivo in bozza, non ancora inviato al cliente.',
  },
  sent: {
    label: 'Inviato',
    className: 'bg-blue-100 text-blue-700 border border-blue-200',
    description: 'Preventivo inviato al cliente, in attesa di risposta.',
  },
  viewed: {
    label: 'Visto',
    className: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
    description: 'Il cliente ha aperto il link ma non ha ancora risposto.',
  },
  accepted: {
    label: 'Accettato',
    className: 'bg-green-100 text-green-700 border border-green-200',
    description: 'Il cliente ha accettato il preventivo.',
  },
  rejected: {
    label: 'Rifiutato',
    className: 'bg-red-100 text-red-700 border border-red-200',
    description: 'Il cliente ha rifiutato il preventivo.',
  },
  expired: {
    label: 'Scaduto',
    className: 'bg-orange-100 text-orange-700 border border-orange-200',
    description: 'Il preventivo ha superato la data di scadenza.',
  },
}

interface StatusBadgeProps {
  status: string
  showTooltip?: boolean
  className?: string
}

export function StatusBadge({ status, showTooltip = true, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status as DocStatus] ?? {
    label: status,
    className: 'bg-gray-100 text-gray-600 border border-gray-200',
    description: '',
  }

  const badge = (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className} ${className ?? ''}`}
    >
      {config.label}
    </span>
  )

  if (!showTooltip || !config.description) return badge

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {config.description}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
