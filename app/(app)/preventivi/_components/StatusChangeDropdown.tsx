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
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { DocStatus } from './StatusBadge'

// Transizioni manuali consentite per ogni stato
const DEFAULT_TRANSITIONS: Partial<Record<DocStatus, { status: DocStatus; label: string }[]>> = {
  sent: [
    { status: 'accepted', label: 'Segna come Accettato' },
    { status: 'rejected', label: 'Segna come Rifiutato' },
    { status: 'expired',  label: 'Segna come Scaduto' },
  ],
  viewed: [
    { status: 'accepted', label: 'Segna come Accettato' },
    { status: 'rejected', label: 'Segna come Rifiutato' },
    { status: 'expired',  label: 'Segna come Scaduto' },
  ],
  rejected: [
    { status: 'sent', label: 'Riapri (torna a Inviato)' },
  ],
  // Permette di riaprire un documento scaduto riportandolo a Inviato
  expired: [
    { status: 'sent', label: 'Riapri (torna a Inviato)' },
  ],
}

// Stati che richiedono conferma esplicita (azioni difficilmente reversibili)
const CONFIRM_STATUSES = new Set<DocStatus>(['rejected', 'expired'])

// Messaggio di successo per ogni transizione
function successMessage(status: DocStatus, docType: 'preventivo' | 'fattura'): string {
  const isFatt = docType === 'fattura'
  switch (status) {
    case 'accepted': return isFatt ? 'Fattura segnata come pagata.' : 'Preventivo segnato come accettato.'
    case 'rejected': return isFatt ? 'Fattura annullata.' : 'Preventivo segnato come rifiutato.'
    case 'expired':  return isFatt ? 'Fattura segnata come scaduta.' : 'Preventivo segnato come scaduto.'
    case 'sent':     return isFatt ? 'Fattura riaperta.' : 'Preventivo riaperto.'
    default:         return 'Stato aggiornato.'
  }
}

interface StatusChangeDropdownProps {
  documentId: string
  currentStatus: string
  /** Sovrascrive le transizioni di default (es. per fatture) */
  transitions?: Partial<Record<DocStatus, { status: DocStatus; label: string }[]>>
  /** Sovrascrive l'endpoint API (default: /api/preventivi/[id]/status) */
  apiPath?: string
  docType?: 'preventivo' | 'fattura'
}

export function StatusChangeDropdown({
  documentId,
  currentStatus,
  transitions: transitionsOverride,
  apiPath,
  docType = 'preventivo',
}: StatusChangeDropdownProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  // Conferma per azioni semi-irreversibili
  const [pendingStatus, setPendingStatus] = useState<{ status: DocStatus; label: string } | null>(null)

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
        toast.error(data.error ?? 'Impossibile aggiornare lo stato. Riprova.')
        return
      }
      toast.success(successMessage(newStatus, docType))
      router.refresh()
    } catch {
      toast.error('Errore di rete. Controlla la connessione e riprova.')
    } finally {
      setLoading(false)
      setPendingStatus(null)
    }
  }

  function handleSelect(t: { status: DocStatus; label: string }) {
    if (CONFIRM_STATUSES.has(t.status)) {
      setPendingStatus(t)
    } else {
      changeStatus(t.status)
    }
  }

  return (
    <>
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
            <DropdownMenuItem key={t.status} onClick={() => handleSelect(t)}>
              {t.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialog di conferma per azioni semi-irreversibili */}
      <Dialog open={!!pendingStatus} onOpenChange={(o) => !o && setPendingStatus(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma cambio stato</DialogTitle>
            <DialogDescription>
              {pendingStatus?.status === 'rejected'
                ? `Vuoi davvero segnare questo ${docType} come ${docType === 'fattura' ? 'annullato' : 'rifiutato'}?`
                : `Vuoi davvero segnare questo ${docType} come scaduto? Potrai comunque riaprirlo in seguito.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingStatus(null)} disabled={loading}>
              Annulla
            </Button>
            <Button
              onClick={() => pendingStatus && changeStatus(pendingStatus.status)}
              disabled={loading}
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              Conferma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
