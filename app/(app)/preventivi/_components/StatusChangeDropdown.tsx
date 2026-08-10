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
import { TIER_LABEL, type TierKey } from '@/lib/documents/proposte'
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
function successMessage(status: DocStatus, docType: string): string {
  // ⚠️ Mai per esclusione: la nota di credito ha le SUE parole (una nota non
  // si «paga» e non si «rifiuta»: si annulla).
  if (docType === 'nota_credito') {
    switch (status) {
      case 'rejected': return 'Nota di credito annullata.'
      case 'draft':    return 'Nota di credito riportata in bozza.'
      default:         return 'Stato aggiornato.'
    }
  }
  const isFatt = docType === 'fattura'
  switch (status) {
    case 'accepted': return isFatt ? 'Fattura segnata come pagata.' : 'Preventivo segnato come accettato.'
    case 'rejected': return isFatt ? 'Fattura annullata.' : 'Preventivo segnato come rifiutato.'
    case 'expired':  return isFatt ? 'Fattura segnata come scaduta.' : 'Preventivo segnato come scaduto.'
    case 'sent':     return isFatt ? 'Fattura segnata come non pagata: l’incasso registrato è stato azzerato.' : 'Preventivo riaperto.'
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
  /** 'preventivo' | 'fattura' | 'nota_credito' — accetta la stringa grezza */
  docType?: string
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
  // 422 con l'elenco delle proposte = «dimmi quale ha accettato il cliente».
  // Il gestore esisteva SOLO su mobile (MobileStatusChips): qui il toast
  // ordinava di «scegliere quale» ma il selettore non c'era — vicolo cieco
  // desktop (revisione 10 ago).
  const [sceltaTiers, setSceltaTiers] = useState<string[] | null>(null)

  const transitionMap = transitionsOverride ?? DEFAULT_TRANSITIONS
  const transitions = transitionMap[currentStatus as DocStatus]
  if (!transitions?.length) return null

  const endpoint = apiPath ?? `/api/preventivi/${documentId}/status`

  async function changeStatus(newStatus: DocStatus, tier?: string) {
    setLoading(true)
    try {
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tier ? { status: newStatus, tier } : { status: newStatus }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (res.status === 422 && Array.isArray(data?.tiers) && data.tiers.length > 1) {
          setSceltaTiers(data.tiers as string[])
          return
        }
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

  function scegliTier(t: string) {
    setSceltaTiers(null)
    changeStatus('accepted', t)
  }

  function handleSelect(t: { status: DocStatus; label: string }) {
    // "Segna non pagata" (fattura, accepted→sent) azzera l'incasso registrato:
    // merita conferma quanto l'annullamento (review 25 lug A4 — su mobile il
    // bottone dedicato la chiede già).
    const needsConfirm =
      CONFIRM_STATUSES.has(t.status) || (docType === 'fattura' && t.status === 'sent')
    if (needsConfirm) {
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
              {pendingStatus?.status === 'sent' && docType === 'fattura'
                ? 'Segnare la fattura come NON pagata? L’incasso registrato (acconti inclusi) viene azzerato e la fattura torna "da incassare".'
                : pendingStatus?.status === 'rejected'
                  ? docType === 'nota_credito'
                    ? 'Vuoi davvero annullare questa nota di credito? Non verrà trasmessa e sparirà dai registri.'
                    : docType === 'fattura'
                      ? 'Vuoi davvero annullare questa fattura? Gli eventuali incassi registrati (acconti inclusi) vengono azzerati.'
                      : 'Vuoi davvero segnare questo preventivo come rifiutato?'
                  : `Vuoi davvero segnare questo ${docType === 'nota_credito' ? 'documento' : docType} come scaduto? Potrai comunque riaprirlo in seguito.`}
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

      {/* Quale proposta ha accettato il cliente? (specchio di MobileStatusChips) */}
      <Dialog open={!!sceltaTiers} onOpenChange={(o) => !o && setSceltaTiers(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Quale proposta ha accettato?</DialogTitle>
            <DialogDescription>
              Questo preventivo ha più proposte: il totale del documento e la
              fattura useranno quella scelta.
            </DialogDescription>
          </DialogHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(sceltaTiers ?? []).map((t) => (
              <Button key={t} variant="outline" disabled={loading} onClick={() => scegliTier(t)}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                Proposta {TIER_LABEL[t as TierKey] ?? t}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
