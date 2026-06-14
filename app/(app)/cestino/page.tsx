'use client'

// La pagina cestino è Client Component perché usa le Server Actions
// per restore e purge con feedback ottimistico.

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, ChevronLeft, Trash2, RotateCcw, FileText, FileCheck2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { restoreDocumentAction, purgeDeletedDocumentAction } from '@/lib/actions/documents'
import { formatDocNumber } from '@/lib/utils'

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
      if (!user) return

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

      if (!workspaceId) return

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
      <div className="lg:hidden">
        {/* Header mobile */}
        <div className="flex items-center gap-2 px-4 pt-4 pb-3">
          <Link href="/altro" style={{ color: 'var(--cc-navy)', display: 'flex', alignItems: 'center' }}>
            <ChevronLeft size={22} />
          </Link>
          <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--cc-text)' }}>Cestino</span>
        </div>

        {/* Banner informativo cream */}
        <div className="mx-4 mb-3" style={{ background: '#f0efe9', borderRadius: 9, padding: '9px 11px', fontSize: 13, color: 'var(--cc-text-2)' }}>
          I documenti eliminati vengono conservati per 15 giorni, poi cancellati definitivamente.
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
          <div className="px-4 space-y-2 pb-6">
            {docs.map((doc) => {
              const left = daysLeft(doc.deleted_at)
              const isLoading = actionId === doc.id && isPending
              const urgent = left <= 2

              return (
                <div
                  key={doc.id}
                  className="cc-card-md flex items-center gap-3"
                  style={{ padding: '11px 13px' }}
                >
                  <div className="flex-1 min-w-0">
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--cc-text)' }}>
                      {formatDocNumber(doc.doc_number, doc.doc_type)}
                      {doc.title && (
                        <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--cc-text-2)', marginLeft: 6 }}>
                          {doc.title}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: urgent ? '#a32d2d' : 'var(--cc-text-3)', marginTop: 2 }}>
                      {doc.client_name && <span style={{ color: 'var(--cc-text-2)' }}>{doc.client_name} · </span>}
                      {left === 0 ? 'Scade oggi' : left === 1 ? 'Scade domani' : `${left} g rimasti`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      disabled={isLoading}
                      onClick={() => handleRestore(doc.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-[7px] px-3 py-1.5 text-sm disabled:opacity-50"
                      style={{ border: '1px solid var(--cc-border-color)', background: '#fff', color: 'var(--cc-text)', fontSize: 13 }}
                    >
                      {isLoading ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                      Ripristina
                    </button>
                    <button
                      disabled={isLoading}
                      onClick={() => handlePurge(doc.id)}
                      className="flex items-center justify-center rounded-[7px] p-1.5 disabled:opacity-50"
                      style={{ border: '1px solid #fceaea', background: '#fceaea', color: '#a32d2d' }}
                    >
                      {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
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
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/preventivi" className="flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="size-3.5" /> Preventivi
          </Link>
          <span>/</span>
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
