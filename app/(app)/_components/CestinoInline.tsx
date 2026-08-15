'use client'

// ============================================================
// CestinoInline — la vista dei documenti eliminati, riusabile.
//
// PERCHÉ ESISTE (feedback #11 di Eli, 14 ago): il cestino ora vive DENTRO le
// liste Preventivi e Fatture, accanto all'Archivio, filtrato per tipo. Questo
// componente è la FONTE UNICA di quella vista: lo usano la pagina /cestino
// (tutti i tipi) e le due liste (un tipo per volta). Un'unica logica di
// caricamento/ripristino/eliminazione → le due superfici non possono divergere.
//
// È client perché usa le Server Action con feedback ottimistico (restore/purge)
// e legge lo stato via il client Supabase del browser (la pagina /cestino era
// già così). Non disegna intestazioni: il titolo lo mette il contenitore.
// ============================================================

import { useEffect, useState, useTransition } from 'react'
import { runAction } from '@/lib/run-action'
import { createClient } from '@/lib/supabase/client'
import { Trash2, RotateCcw, Loader2, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { restoreDocumentAction, purgeDeletedDocumentAction } from '@/lib/actions/documents'
import { formatDocNumber, docTypeLabel } from '@/lib/utils'

const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000

interface DeletedDoc {
  id: string
  doc_number: string | null
  title: string | null
  doc_type: string
  status: string
  total: number | null
  deleted_at: string
  client_name: string | null
  /** true = accettato e firmato dal cliente (prova FES): avviso extra al purge */
  signed_proof: boolean
  /** true = fattura trasmessa allo SdI: non eliminabile (conservazione 10 anni) */
  sdi_transmitted: boolean
}

export function CestinoInline({ docTypes }: {
  /** Se presente, mostra solo i documenti di questi tipi (es. ['preventivo'] o
   *  ['fattura','nota_credito','nota_debito']). Assente = tutti i tipi. */
  docTypes?: string[]
}) {
  const [docs, setDocs] = useState<DeletedDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [actionId, setActionId] = useState<string | null>(null)
  const [confirmPurgeId, setConfirmPurgeId] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { if (alive) setLoading(false); return }

      // Trova il workspace dell'utente (owner o collaboratore accettato)
      let workspaceId: string | null = null
      const { data: ws } = await supabase
        .from('workspaces')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle()
      workspaceId = ws?.id ?? null

      if (!workspaceId) {
        const { data: membership } = await supabase
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', user.id)
          .not('accepted_at', 'is', null)
          .limit(1)
          .maybeSingle()
        workspaceId = membership?.workspace_id ?? null
      }

      if (!workspaceId) { if (alive) setLoading(false); return }

      // sdi_status con retry tollerante pre-044 (pattern del repo)
      const baseCols = 'id, doc_number, title, doc_type, status, total, deleted_at, signer_name, accepted_ip, clients(name)'
      const runLoad = (cols: string) => {
        let qb = supabase
          .from('documents')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonna 044 opzionale
          .select(cols as any)
          .eq('workspace_id', workspaceId)
          .not('deleted_at', 'is', null)
        if (docTypes && docTypes.length > 0) qb = qb.in('doc_type', docTypes)
        return qb.order('deleted_at', { ascending: false }).limit(100)
      }
      let { data } = await runLoad(`${baseCols}, sdi_status`)
      if (!data) ({ data } = await runLoad(baseCols))

      if (!alive) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- select dinamico
      setDocs(((data ?? []) as any[]).map((d) => ({
        id: d.id,
        doc_number: d.doc_number,
        title: d.title,
        doc_type: d.doc_type,
        status: d.status,
        total: d.total,
        deleted_at: d.deleted_at!,
        client_name: (d.clients as { name: string } | null)?.name ?? null,
        signed_proof: !!(d.signer_name || d.accepted_ip),
        sdi_transmitted: !!d.sdi_status && d.sdi_status !== 'scartata',
      })))
      setLoading(false)
    }
    load()
    return () => { alive = false }
  }, [docTypes])

  function daysLeft(deletedAt: string): number {
    const elapsed = Date.now() - new Date(deletedAt).getTime()
    return Math.max(0, Math.ceil((FIFTEEN_DAYS_MS - elapsed) / (1000 * 60 * 60 * 24)))
  }

  function handleRestore(docId: string) {
    setActionId(`${docId}:restore`)
    startTransition(async () => {
      const result = await runAction(() => restoreDocumentAction(docId), 'ripristinare il documento')
      if (result.error) {
        toast.error(result.error)
      } else if (result.numberConflict) {
        toast.success('Documento ripristinato. Il suo numero era già stato preso da un altro documento: ne riceverà uno nuovo al prossimo invio.', { closeButton: true })
        setDocs((prev) => prev.filter((d) => d.id !== docId))
      } else {
        toast.success('Documento ripristinato')
        setDocs((prev) => prev.filter((d) => d.id !== docId))
      }
      setActionId(null)
    })
  }

  function handlePurge(docId: string) {
    setConfirmPurgeId(null)
    setActionId(`${docId}:purge`)
    startTransition(async () => {
      const result = await runAction(() => purgeDeletedDocumentAction(docId), 'eliminare definitivamente il documento')
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Documento eliminato definitivamente')
        setDocs((prev) => prev.filter((d) => d.id !== docId))
      }
      setActionId(null)
    })
  }

  const confirmDoc = docs.find((d) => d.id === confirmPurgeId)

  return (
    <div>
      {/* Banner "15 giorni" */}
      <div
        style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)', padding: '11px 14px', display: 'flex', gap: 9, alignItems: 'flex-start' }}
      >
        <Info size={18} style={{ color: 'var(--cc-muted)', flex: '0 0 auto', marginTop: 1 }} />
        <span style={{ fontSize: 13, color: '#55534b', lineHeight: 1.45 }}>
          Gli elementi nel cestino vengono eliminati definitivamente dopo <b>15 giorni</b>.
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={22} className="animate-spin" style={{ color: 'var(--cc-text-3)' }} />
        </div>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 gap-2 text-center px-4">
          <Trash2 size={36} style={{ color: 'var(--cc-text-3)', opacity: 0.35 }} />
          <p className="text-sm" style={{ color: 'var(--cc-text-2)' }}>Il cestino è vuoto</p>
        </div>
      ) : (
        <div
          style={{ marginTop: 14, background: '#fff', borderRadius: 14, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)', padding: '15px 15px' }}
        >
          {docs.map((doc, i) => {
            const left = daysLeft(doc.deleted_at)
            const rowBusy = isPending && (actionId === `${doc.id}:restore` || actionId === `${doc.id}:purge`)
            const restoring = isPending && actionId === `${doc.id}:restore`
            const purging = isPending && actionId === `${doc.id}:purge`
            const urgent = left <= 3
            const isLast = i === docs.length - 1

            return (
              <div
                key={doc.id}
                style={{ padding: '13px 0', borderBottom: isLast ? 'none' : '0.5px solid #eee' }}
              >
                <div style={{ fontSize: 15, fontWeight: 600, color: '#161616' }}>
                  {formatDocNumber(doc.doc_number, doc.doc_type)}
                  {doc.client_name && <> · {doc.client_name}</>}
                </div>
                {/* Titolo del lavoro: qui non si apre il documento, va mostrato
                    per riconoscerlo */}
                {doc.title && (
                  <div style={{ fontSize: 14, color: '#55534b', marginTop: 2 }}>{doc.title}</div>
                )}
                <div style={{ fontSize: 13, color: 'var(--cc-muted)', marginTop: 2 }}>
                  {docTypeLabel(doc.doc_type)} ·{' '}
                  <span style={{ color: urgent ? '#b0863e' : 'var(--cc-muted)', fontWeight: 600 }}>
                    {left === 0 ? 'Scade oggi' : left === 1 ? '1 giorno rimasto' : `${left} giorni rimasti`}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 9 }}>
                  <button
                    disabled={rowBusy}
                    onClick={() => handleRestore(doc.id)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #e7e7ea', borderRadius: 9, padding: '7px 12px', fontSize: 13, fontWeight: 500, color: '#1a1a2e', background: '#fff', opacity: rowBusy ? 0.5 : 1 }}
                  >
                    {restoring ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                    Ripristina
                  </button>
                  <button
                    disabled={rowBusy}
                    onClick={() => setConfirmPurgeId(doc.id)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #f0dada', borderRadius: 9, padding: '7px 12px', fontSize: 13, fontWeight: 500, color: '#b05656', background: '#fff', opacity: rowBusy ? 0.5 : 1 }}
                  >
                    {purging ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    Elimina
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Conferma eliminazione DEFINITIVA: irreversibile, niente one-tap */}
      <Dialog open={confirmPurgeId !== null} onOpenChange={(v) => { if (!v) setConfirmPurgeId(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontSize: 17, fontWeight: 600 }}>
              {confirmDoc?.sdi_transmitted ? 'Fattura non eliminabile' : 'Elimina definitivamente'}
            </DialogTitle>
            {!confirmDoc?.sdi_transmitted && (
              <DialogDescription style={{ fontSize: 14 }}>
                Il documento verrà eliminato per sempre: non potrà più essere recuperato, nemmeno dal cestino.
              </DialogDescription>
            )}
          </DialogHeader>
          {confirmDoc?.signed_proof && !confirmDoc?.sdi_transmitted && (
            <div style={{ borderRadius: 10, border: '1px solid #e8c98a', background: '#fdf6e7', padding: '10px 12px', fontSize: 13, color: '#7a5a1e', lineHeight: 1.5 }}>
              <b>Attenzione:</b>{' '}
              questo documento è firmato dal cliente: è la tua prova
              dell&apos;accordo. Eliminandolo, la prova va persa per sempre.
            </div>
          )}
          {/* ⚖️ Trasmessa allo SdI: l'eliminazione è VIETATA dal server (8 ago),
              quindi qui non si offre — spento e spiegato, come da regola. */}
          {confirmDoc?.sdi_transmitted ? (
            <>
              <div style={{ borderRadius: 10, border: '1px solid #e8c98a', background: '#fdf6e7', padding: '10px 12px', fontSize: 13, color: '#7a5a1e', lineHeight: 1.5 }}>
                La fattura è stata <b>trasmessa allo SdI</b>: per l&rsquo;Agenzia risulta emessa e
                va conservata dieci anni. Per annullarne gli effetti serve una <b>nota di
                credito</b>. In alternativa puoi <b>recuperarla</b>{' '}dal cestino e
                riportarla fra le tue fatture.
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <Button variant="outline" style={{ flex: 1, height: 44 }} onClick={() => setConfirmPurgeId(null)}>
                  Chiudi
                </Button>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <Button variant="outline" style={{ flex: 1, height: 44 }} onClick={() => setConfirmPurgeId(null)}>
                Annulla
              </Button>
              <Button variant="destructive" style={{ flex: 1, height: 44 }} onClick={() => { if (confirmPurgeId) handlePurge(confirmPurgeId) }}>
                Elimina per sempre
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
