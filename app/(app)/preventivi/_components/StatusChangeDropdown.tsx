'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import type { DocStatus } from './StatusBadge'

// Transizioni manuali consentite per ogni stato
const DEFAULT_TRANSITIONS: Partial<Record<DocStatus, { status: DocStatus; label: string }[]>> = {
  sent: [
    { status: 'rejected', label: 'Segna come Rifiutato' },
    { status: 'expired',  label: 'Segna come Scaduto' },
  ],
  viewed: [
    { status: 'rejected', label: 'Segna come Rifiutato' },
    { status: 'expired',  label: 'Segna come Scaduto' },
  ],
  rejected: [
    { status: 'sent', label: 'Riapri (torna a Inviato)' },
  ],
}

interface StatusChangeDropdownProps {
  documentId: string
  currentStatus: string
  /** Sovrascrive le transizioni di default (es. per fatture) */
  transitions?: Partial<Record<DocStatus, { status: DocStatus; label: string }[]>>
  /** Sovrascrive l'endpoint API (default: /api/preventivi/[id]/status) */
  apiPath?: string
}

export function StatusChangeDropdown({
  documentId,
  currentStatus,
  transitions: transitionsOverride,
  apiPath,
}: StatusChangeDropdownProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const transitionMap = transitionsOverride ?? DEFAULT_TRANSITIONS
  const transitions = transitionMap[currentStatus as DocStatus]
  if (!transitions?.length) return null

  const endpoint = apiPath ?? `/api/preventivi/${documentId}/status`

  async function changeStatus(newStatus: DocStatus) {
    setLoading(true)
    try {
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? 'Errore nel cambio stato')
        return
      }
      router.refresh()
    } catch {
      toast.error('Errore di rete — riprova')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={loading}>
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <ChevronDown className="size-3.5" />}
          Cambia stato
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Cambia stato manualmente
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {transitions.map((t) => (
          <DropdownMenuItem key={t.status} onClick={() => changeStatus(t.status)}>
            {t.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
