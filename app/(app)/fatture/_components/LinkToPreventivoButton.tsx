'use client'

import { useState, useTransition } from 'react'
import { Link2, Loader2, Search, Unlink, ArrowLeftRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { linkDocumentAction } from '@/lib/actions/documents'
import { useRouter } from 'next/navigation'
import { formatDocNumber } from '@/lib/utils'

interface Preventivo {
  id: string
  doc_number: string | null
  title: string | null
  status: string
  clients: { name: string } | null
}

interface LinkToPreventivoButtonProps {
  fatturaId: string
  workspaceId: string
  /** Preventivo già collegato (per mostrare "Scollega") */
  currentPreventivoId?: string | null
  /** Trigger compatto (bottone "Cambia"/"Collega") per la card in cima al dettaglio */
  compact?: boolean
  /** Stile inline del trigger compatto */
  triggerStyle?: React.CSSProperties
}

export function LinkToPreventivoButton({
  fatturaId,
  workspaceId,
  currentPreventivoId,
  compact,
  triggerStyle,
}: LinkToPreventivoButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [preventivi, setPreventivi] = useState<Preventivo[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  async function loadPreventivi(q: string) {
    setLoading(true)
    const supabase = createClient()
    let query = supabase
      .from('documents')
      .select('id, doc_number, title, status, clients(name)')
      .eq('workspace_id', workspaceId)
      .eq('doc_type', 'preventivo')
      .is('deleted_at', null)
      .limit(30)

    if (q.trim()) {
      query = query.ilike('doc_number', `%${q}%`)
    }

    const { data } = await query
    setPreventivi((data ?? []) as Preventivo[])
    setLoading(false)
  }

  function handleOpen() {
    setOpen(true)
    setSearch('')
    setSelected(null)
    setError(null)
    loadPreventivi('')
  }

  function handleSearchChange(v: string) {
    setSearch(v)
    loadPreventivi(v)
  }

  function handleConfirm() {
    if (!selected) return
    setError(null)
    startTransition(async () => {
      const result = await linkDocumentAction(fatturaId, selected)
      if (result.error) {
        setError(result.error)
      } else {
        setOpen(false)
        router.refresh()
      }
    })
  }

  async function handleUnlink() {
    setError(null)
    startTransition(async () => {
      const result = await linkDocumentAction(fatturaId, null)
      if (result.error) setError(result.error)
      else { setOpen(false); router.refresh() }
    })
  }

  const STATUS_LABEL: Record<string, string> = {
    draft: 'Bozza', sent: 'Inviato', viewed: 'Visto',
    accepted: 'Accettato', rejected: 'Rifiutato', expired: 'Scaduto',
  }

  return (
    <>
      {compact ? (
        <button type="button" onClick={handleOpen} style={triggerStyle}>
          <ArrowLeftRight size={15} />
          {currentPreventivoId ? 'Cambia' : 'Collega'}
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleOpen}>
            <Link2 className="size-4" />
            {currentPreventivoId ? 'Cambia preventivo collegato' : 'Collega a preventivo'}
          </Button>
          {currentPreventivoId && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              disabled={isPending}
              onClick={handleUnlink}
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Unlink className="size-4" />}
              <span className="sr-only">Scollega</span>
            </Button>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Collega a un preventivo</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Cerca per numero…"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : preventivi.length === 0 ? (
              <p className="text-sm text-center text-muted-foreground py-4">
                Nessun preventivo trovato
              </p>
            ) : (
              <ul className="max-h-60 overflow-y-auto divide-y rounded-md border">
                {preventivi.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(p.id)}
                      className={`w-full text-left px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors flex items-center justify-between gap-2 ${
                        selected === p.id ? 'bg-primary/5 border-l-2 border-primary' : ''
                      }`}
                    >
                      <div>
                        <span className="font-mono font-medium">
                          {formatDocNumber(p.doc_number)}
                        </span>
                        {p.title && (
                          <span className="ml-2 text-muted-foreground truncate">
                            {p.title}
                          </span>
                        )}
                        {p.clients?.name && (
                          <span className="block text-xs text-muted-foreground">
                            {p.clients.name}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {STATUS_LABEL[p.status] ?? p.status}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>

          <DialogFooter>
            {currentPreventivoId && (
              <Button
                variant="ghost"
                size="sm"
                className="mr-auto text-muted-foreground hover:text-destructive"
                disabled={isPending}
                onClick={handleUnlink}
              >
                {isPending ? <Loader2 className="size-4 animate-spin" /> : <Unlink className="size-4" />}
                Scollega
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button
              size="sm"
              disabled={!selected || isPending}
              onClick={handleConfirm}
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Collega preventivo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
