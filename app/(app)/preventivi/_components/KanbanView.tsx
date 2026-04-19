'use client'

import Link from 'next/link'
import { FileText, Eye } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from './StatusBadge'

interface DocCard {
  id: string
  doc_number: string | null
  title: string
  status: string
  total: number | null
  created_at: string
  sent_at: string | null
  expires_at: string | null
  clients: { id: string; name: string } | null
  viewCount: number
  isExpired: boolean
}

interface KanbanViewProps {
  documents: DocCard[]
}

const COLUMNS = [
  { status: 'draft',    label: 'Bozze',     color: 'bg-gray-100' },
  { status: 'sent',     label: 'Inviati',   color: 'bg-blue-50' },
  { status: 'viewed',   label: 'Visti',     color: 'bg-purple-50' },
  { status: 'accepted', label: 'Accettati', color: 'bg-green-50' },
  { status: 'rejected', label: 'Rifiutati', color: 'bg-red-50' },
  { status: 'expired',  label: 'Scaduti',   color: 'bg-amber-50' },
]

export function KanbanView({ documents }: KanbanViewProps) {
  const grouped = COLUMNS.reduce<Record<string, DocCard[]>>((acc, col) => {
    acc[col.status] = documents.filter((d) => {
      if (col.status === 'expired') return d.isExpired || d.status === 'expired'
      if (col.status === 'sent') return d.status === 'sent' && !d.isExpired
      return d.status === col.status && !d.isExpired
    })
    return acc
  }, {})

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 md:-mx-6 md:px-6">
      {COLUMNS.map((col) => {
        const cards = grouped[col.status] ?? []
        return (
          <div key={col.status} className="flex-shrink-0 w-64">
            {/* Header colonna */}
            <div className={`rounded-t-lg px-3 py-2 ${col.color} border border-b-0`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {col.label}
                </span>
                <span className="text-xs font-bold text-muted-foreground bg-white/70 rounded-full px-1.5 py-0.5">
                  {cards.length}
                </span>
              </div>
            </div>

            {/* Cards */}
            <div className={`rounded-b-lg border min-h-32 p-2 space-y-2 ${col.color}`}>
              {cards.length === 0 && (
                <p className="text-xs text-muted-foreground/60 text-center py-4">
                  —
                </p>
              )}
              {cards.map((doc) => (
                <Link
                  key={doc.id}
                  href={`/preventivi/${doc.id}`}
                  className="block bg-white rounded-md border p-3 hover:shadow-sm hover:border-primary/30 transition-all text-sm group"
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="font-mono font-semibold text-xs group-hover:text-primary transition-colors">
                      {doc.doc_number ?? '—'}
                    </span>
                    {doc.viewCount > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                        <Eye className="size-3" />{doc.viewCount}
                      </span>
                    )}
                  </div>

                  {doc.title && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{doc.title}</p>
                  )}

                  {doc.clients && (
                    <p className="text-xs text-muted-foreground mt-1 truncate font-medium">
                      {doc.clients.name}
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-2">
                    <span className="font-semibold text-xs tabular-nums">
                      €{(doc.total ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 0 })}
                    </span>
                    {doc.expires_at && !doc.isExpired && (doc.status === 'sent' || doc.status === 'viewed') && (
                      <span className="text-[10px] text-amber-600">
                        Scade {new Date(doc.expires_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
