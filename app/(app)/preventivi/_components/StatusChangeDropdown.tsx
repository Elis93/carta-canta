'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Loader2 } from 'lucide-react'
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
const ALLOWED_TRANSITIONS: Partial<Record<DocStatus, { status: DocStatus; label: string }[]>> = {
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
}

export function StatusChangeDropdown({ documentId, currentStatus }: StatusChangeDropdownProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const transitions = ALLOWED_TRANSITIONS[currentStatus as DocStatus]
  if (!transitions?.length) return null

  async function changeStatus(newStatus: DocStatus) {
    setLoading(true)
    try {
      const res = await fetch(`/api/preventivi/${documentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error ?? 'Errore nel cambio stato')
        return
      }
      router.refresh()
    } catch {
      alert('Errore di rete')
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
