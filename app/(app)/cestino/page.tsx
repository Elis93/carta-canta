'use client'

// La pagina cestino è Client Component perché usa le Server Actions
// per restore e purge con feedback ottimistico.

import { useEffect, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Trash2, RotateCcw, FileText, FileCheck2, Loader2, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { restoreDocumentAction, purgeDeletedDocumentAction } from '@/lib/actions/documents'
import { formatDocNumber } from '@/lib/utils'
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

      const { data } = await supabase
        .from('documents')
        .select('id, doc_number, title, doc_type, status, total, deleted_at, clients(name)')
        .eq('workspace_id', workspaceId)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })
        .limit(100)

      setDocs((data ?? []).map((d) => ({
        id: d.id,
        doc_number: d.doc_number,
        title: d.title,
        doc_type: d.doc_type,
        status: d.status,
        total: d.total,
        deleted_at: d.deleted_at!,
        client_name: (d.clients as { name: string } | null)?.name ?? null,
      })))
      setLoading(false)
    }
    load()
  }, [])

  function daysLeft(deletedAt: string): number {
    const elapsed = Date.now() - new Date(deletedAt).getTime()
    return Math.max(0, Math.ceil((FIFTEEN_DAYS_MS - elapsed) / (1000 * 60 * 60 * 24)))
  }

  function handleRestore(docId: string) {
    setActionId(docId)
    startTransition(async () => {
      const result = await restoreDocumentAction(docId)
      if (result.error) {
        toast.error(result.error)
      } else if (result.numberConflict) {
        toast.success('Documento ripristinato come bozza — numero già occupato, verrà riassegnato al prossimo invio.', { duration: 5000 })
        setDocs((prev) => prev.filter((d) => d.id !== docId))
      } else {
        toast.success('Documento ripristinato')
        setDocs((prev) => prev.filter((d) => d.id !== docId))
      }
      setActionId(null)
    })
  }

  function handlePurge(docId: string) {
    setActionId(docId)
    startTransition(async () => {
      const result = await purgeDeletedDocumentAction(docId)
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
          style={{ background: '#fff', borderBottom: '0.5px solid #eeeeee', padding: '12px 15px' }}
        >
          <BackButton fallback="/altro" />
          <span style={{ flex: 1, fontSize: 17, fontWeight: 600, color: '#161616' }}>Cestino</span>
          <span style={{ width: 24 }} />
        </div>

        {/* Banner informativo "15 giorni" */}
        <div
          style={{ margin: '14px 15px 0', background: '#fff', borderRadius: 12, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)', padding: '11px 14px', display: 'flex', gap: 9, alignItems: 'flex-start' }}
        >
          <Info size={18} style={{ color: '#8a887f', flex: '0 0 auto', marginTop: 1 }} />
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
              const isLoading = actionId === doc.id && isPending
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
                  <div style={{ fontSize: 13, color: '#8a887f', marginTop: 2 }}>
                    {doc.doc_type === 'fattura' ? 'Fattura' : 'Preventivo'} ·{' '}
                    <span style={{ color: urgent ? '#b0863e' : '#8a887f', fontWeight: 600 }}>
                      {left === 0 ? 'Scade oggi' : left === 1 ? '1 giorno rimasto' : `${left} giorni rimasti`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 9 }}>
                    <button
                      disabled={isLoading}
                      onClick={() => handleRestore(doc.id)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #e7e7ea', borderRadius: 9, padding: '7px 12px', fontSize: 13, fontWeight: 500, color: '#1a1a2e', background: '#fff', opacity: isLoading ? 0.5 : 1 }}
                    >
                      {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                      Ripristina
                    </button>
                    <button
                      disabled={isLoading}
                      onClick={() => handlePurge(doc.id)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #f0dada', borderRadius: 9, padding: '7px 12px', fontSize: 13, fontWeight: 500, color: '#b05656', background: '#fff', opacity: isLoading ? 0.5 : 1 }}
                    >
                      {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
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
              const isLoading = actionId === doc.id && isPending

              return (
                <Card key={doc.id} className={left <= 2 ? 'border-red-200' : ''}>
                  <CardContent className="flex items-center gap-3 py-3 px-4">
                    {doc.doc_type === 'fattura'
                      ? <FileCheck2 className="size-4 text-muted-foreground shrink-0" />
                      : <FileText className="size-4 text-muted-foreground shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-sm">
                          {formatDocNumber(doc.doc_number, doc.doc_type)}
                        </span>
                        {doc.title && (
                          <span className="text-xs text-muted-foreground truncate">{doc.title}</span>
                        )}
                        <Badge variant="outline" className="text-xs capitalize shrink-0">
                          {doc.doc_type}
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
                        disabled={isLoading}
                        onClick={() => handleRestore(doc.id)}
                        title="Ripristina"
                      >
                        {isLoading ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                        <span className="hidden sm:inline">Ripristina</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isLoading}
                        onClick={() => handlePurge(doc.id)}
                        className="text-destructive hover:text-destructive"
                        title="Elimina definitivamente"
                      >
                        {isLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
