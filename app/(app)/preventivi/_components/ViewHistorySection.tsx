'use client'

import { Eye, Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface DocumentView {
  id: string
  viewed_at: string
  ip_address: unknown // PostgreSQL INET → unknown nei tipi Supabase generati
  country: string | null
}

interface ViewHistorySectionProps {
  views: DocumentView[]
}

export function ViewHistorySection({ views }: ViewHistorySectionProps) {
  if (views.length === 0) return null

  return (
    <div className="space-y-3">
      {/* Titolo con tooltip */}
      <div className="flex items-center gap-2">
        <Eye className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Storico aperture</span>
        <span className="text-xs text-muted-foreground">({views.length})</span>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="size-3.5 text-muted-foreground/60 cursor-help" />
            </TooltipTrigger>
            {/* side top: a destra su mobile (360px) il tooltip da 320px finiva a filo del bordo */}
            <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
              Ogni apertura del <strong>link online</strong> inviato via email viene registrata con data, ora e IP.
              Utile come prova di lettura e per capire quando ricontattare il cliente.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Tabella aperture */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50 border-b text-muted-foreground">
              <th className="text-left px-3 py-2 font-medium">Data e ora</th>
              <th className="text-left px-3 py-2 font-medium">IP</th>
              <th className="text-left px-3 py-2 font-medium">Paese</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {views.map((v) => (
              <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-3 py-2 tabular-nums">
                  {new Date(v.viewed_at).toLocaleDateString('it-IT', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  } as Intl.DateTimeFormatOptions)}
                </td>
                <td className="px-3 py-2 font-mono text-muted-foreground">
                  {v.ip_address != null ? String(v.ip_address) : '—'}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {v.country ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
