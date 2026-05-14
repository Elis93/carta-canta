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
  /** true se il PDF è già stato scaricato ma il documento è ancora in bozza */
  pdfDownloaded?: boolean
  showTooltip?: boolean
  className?: string
  docType?: 'preventivo' | 'fattura'
}

export function StatusBadge({ status, pdfDownloaded, showTooltip = true, className, docType }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status as DocStatus] ?? {
    label: status,
    className: 'bg-gray-100 text-gray-600 border border-gray-200',
    description: '',
  }

  // Override label/description per le fatture
  let overrideLabel: string | undefined
  let overrideDescription: string | undefined
  if (docType === 'fattura') {
    if (status === 'draft')    { overrideDescription = 'Fattura in bozza, non ancora inviata al cliente.' }
    if (status === 'sent')     { overrideLabel = 'Inviata'; overrideDescription = 'Fattura inviata al cliente, in attesa di pagamento.' }
    if (status === 'viewed')   { overrideDescription = 'Il cliente ha aperto la fattura ma non ha ancora risposto.' }
    if (status === 'accepted') { overrideLabel = 'Pagata'; overrideDescription = 'La fattura è stata pagata.' }
    if (status === 'rejected') { overrideLabel = 'Annullata'; overrideDescription = 'La fattura è stata annullata.' }
    if (status === 'expired')  { overrideDescription = 'La fattura ha superato la data di scadenza.' }
  }

  // Bozza con PDF già scaricato → label estesa
  const label = (status === 'draft' && pdfDownloaded)
    ? 'Bozza · PDF scaricato'
    : (overrideLabel ?? config.label)

  const description = (status === 'draft' && pdfDownloaded)
    ? 'Il PDF è stato scaricato ma il preventivo non è ancora stato inviato ufficialmente.'
    : (overrideDescription ?? config.description)

  const badge = (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className} ${className ?? ''}`}
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
