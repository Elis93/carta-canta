'use client'

// La pagina cestino è Client Component perché usa le Server Actions
// per restore e purge con feedback ottimistico.

import { useEffect, useState, useTransition } from 'react'
import { runAction } from '@/lib/run-action'
import { createClient } from '@/lib/supabase/client'
import { Trash2, RotateCcw, FileText, FileCheck2, Loader2, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { BackButton } from '@/components/shared/BackButton'

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
  /** true = fattura trasmessa allo SdI: avviso extra al purge (il cron non la
   * purga mai da solo; l'eliminazione manuale resta possibile, con avviso) */
  sdi_transmitted: boolean
}

export default function CestinoPage() {
  const [docs, setDocs] = useState<DeletedDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [actionId, setActionId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      // Trova il workspace dell'utente
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

      if (!workspaceId) { setLoading(false); return }

      // sdi_status con retry tollerante pre-044 (pattern del repo)
      const baseCols = 'id, doc_number, title, doc_type, status, total, deleted_at, signer_name, accepted_ip, clients(name)'
      const runLoad = (cols: string) => supabase
        .from('documents')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonna 044 opzionale
        .select(cols as any)
        .eq('workspace_id', workspaceId)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })
        .limit(100)
      let { data } = await runLoad(`${baseCols}, sdi_status`)
      if (!data) ({ data } = await runLoad(baseCols))

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
  }, [])

  function daysLeft(deletedAt: string): number {
    const elapsed = Date.now() - new Date(deletedAt).getTime()
    return Math.max(0, Math.ceil((FIFTEEN_DAYS_MS - elapsed) / (1000 * 60 * 60 * 24)))
  }

  // Dialog di conferma per l'eliminazione DEFINITIVA (irreversibile)
  const [confirmPurgeId, setConfirmPurgeId] = useState<string | null>(null)

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

  return (
    <div className="max-w-3xl mx-auto">

      {/* ── MOBILE LAYOUT ── */}
      <div className="lg:hidden pb-8">
        {/* Header mobile */}
        <div
          className="flex items-center gap-2.5"
          style={{ background: '#fff', borderBottom: '2px solid #c9a44c', padding: '12px 15px' }}
        >
          <BackButton fallback="/altro" />
          <span style={{ flex: 1, fontSize: 18, fontWeight: 600, fontFamily: "Georgia, 'Times New Roman', serif", color: '#1a1a2e' }}>Cestino</span>
          <span style={{ width: 24 }} />
        </div>

        {/* Banner informativo "15 giorni" */}
        <div
          style={{ margin: '14px 15px 0', background: '#fff', borderRadius: 12, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)', padding: '11px 14px', display: 'flex', gap: 9, alignItems: 'flex-start' }}
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
            style={{ margin: '14px 15px 0', background: '#fff', borderRadius: 14, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)', padding: '15px 15px' }}
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
                  {/* Titolo del lavoro: qui non si può aprire il documento, quindi
                      va mostrato per riconoscerlo */}
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
      </div>

      {/* ── DESKTOP LAYOUT (invariato) ── */}
      <div className="hidden lg:block p-4 md:p-6 space-y-5">
        {/* Indietro — coerente col mobile: torna da dove si è arrivati
            (prima il breadcrumb dichiarava "← Preventivi" come genitore fisso) */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BackButton fallback="/altro" />
          <span className="text-foreground font-medium flex items-center gap-1.5">
            <Trash2 className="size-3.5" /> Cestino
          </span>
        </div>

        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trash2 className="size-6 text-muted-foreground" />
            Cestino
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            I documenti eliminati vengono conservati per 15 giorni, poi cancellati definitivamente.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : docs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <Trash2 className="size-10 text-muted-foreground/30" />
              <p className="font-medium text-muted-foreground">Il cestino è vuoto</p>
              <p className="text-sm text-muted-foreground/70">
                I documenti eliminati appariranno qui per 15 giorni.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {docs.map((doc) => {
              const left = daysLeft(doc.deleted_at)
              const rowBusy = isPending && (actionId === `${doc.id}:restore` || actionId === `${doc.id}:purge`)
              const restoring = isPending && actionId === `${doc.id}:restore`
              const purging = isPending && actionId === `${doc.id}:purge`

              return (
                <Card key={doc.id} className={left <= 2 ? 'border-red-200' : ''}>
                  <CardContent className="flex items-center gap-3 py-3 px-4">
                    {doc.doc_type === 'preventivo'
                      ? <FileText className="size-4 text-muted-foreground shrink-0" />
                      : <FileCheck2 className="size-4 text-muted-foreground shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-sm">
                          {formatDocNumber(doc.doc_number, doc.doc_type)}
                        </span>
                        {doc.title && (
                          <span className="text-xs text-muted-foreground truncate">{doc.title}</span>
                        )}
                        {/* ⚠️ docTypeLabel, NON l'enum grezzo: una nota di
                            credito si leggeva «Nota_credito», underscore
                            compreso (revisione 10 ago). */}
                        <Badge variant="outline" className="text-xs shrink-0">
                          {docTypeLabel(doc.doc_type)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        {doc.client_name && <span>{doc.client_name}</span>}
                        {doc.client_name && <span>·</span>}
                        <span className={left <= 2 ? 'text-red-600 font-medium' : ''}>
                          {left === 0
                            ? 'Scade oggi'
                            : left === 1
                            ? 'Scade domani'
                            : `${left} giorni rimanenti`}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={rowBusy}
                        onClick={() => handleRestore(doc.id)}
                        title="Ripristina"
                      >
                        {restoring ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                        <span className="hidden sm:inline">Ripristina</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={rowBusy}
                        onClick={() => setConfirmPurgeId(doc.id)}
                        className="text-destructive hover:text-destructive"
                        title="Elimina definitivamente"
                      >
                        {purging ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Conferma eliminazione DEFINITIVA: irreversibile, niente one-tap */}
      <Dialog open={confirmPurgeId !== null} onOpenChange={(v) => { if (!v) setConfirmPurgeId(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontSize: 17, fontWeight: 600 }}>
              {docs.find((d) => d.id === confirmPurgeId)?.sdi_transmitted
                ? 'Fattura non eliminabile'
                : 'Elimina definitivamente'}
            </DialogTitle>
            {!docs.find((d) => d.id === confirmPurgeId)?.sdi_transmitted && (
              <DialogDescription style={{ fontSize: 14 }}>
                Il documento verrà eliminato per sempre: non potrà più essere recuperato, nemmeno dal cestino.
              </DialogDescription>
            )}
          </DialogHeader>
          {docs.find((d) => d.id === confirmPurgeId)?.signed_proof && !docs.find((d) => d.id === confirmPurgeId)?.sdi_transmitted && (
            <div style={{ borderRadius: 10, border: '1px solid #e8c98a', background: '#fdf6e7', padding: '10px 12px', fontSize: 13, color: '#7a5a1e', lineHeight: 1.5 }}>
              <b>Attenzione:</b>{' '}
              questo documento è firmato dal cliente: è la tua prova
              dell&apos;accordo. Eliminandolo, la prova va persa per sempre.
            </div>
          )}
          {/* ⚖️ Trasmessa allo SdI: l'eliminazione è VIETATA dal server (8 ago),
              quindi qui non si offre — prima c'era un avviso «parlane col
              commercialista prima di procedere» col tasto rosso sotto: il
              tasto falliva DOPO la conferma, e l'avviso lasciava credere che
              procedere si potesse. Spento e spiegato, come da regola. */}
          {docs.find((d) => d.id === confirmPurgeId)?.sdi_transmitted ? (
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
