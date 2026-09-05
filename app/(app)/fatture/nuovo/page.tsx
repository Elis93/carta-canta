import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { ArrowLeft, X, Banknote } from 'lucide-react'
import { FatturaForm } from '../_components/FatturaForm'
import { CreateFromPreventivoButton } from '../_components/CreateFromPreventivoButton'
import type { PreventivoOption } from '../_components/CreateFromPreventivoButton'
import { peekNextInvoiceNumber } from '@/lib/actions/documents'
import { Avviso } from '@/components/shared/Avviso'

interface Props {
  searchParams: Promise<{ from?: string }>
}

export default async function NuovaFatturaPage({ searchParams }: Props) {
  const { from } = await searchParams
  const { supabase, user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/login')

  const { data: templates } = await supabase
    .from('templates')
    .select('id, name, is_default')
    .eq('workspace_id', workspace.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })

  // defaultTemplateId: template personalizzato con is_default=true (esclude "Template predefinito").
  const defaultTemplateId = templates?.find(
    (t) => t.is_default && t.name !== 'Template predefinito'
  )?.id ?? null
  const nextInvoiceNumber = await peekNextInvoiceNumber(workspace.id)

  // Tutti i preventivi non ancora convertiti — usati dal secondo entry point.
  // Mostriamo anche quelli non-accepted; il componente gestisce la conferma.
  const [{ data: allPrev }, { data: alreadyConverted }] = await Promise.all([
    supabase
      .from('documents')
      .select('id, doc_number, title, total, status, clients(name)')
      .eq('workspace_id', workspace.id)
      .eq('doc_type', 'preventivo')
      .not('status', 'in', '("draft","expired")')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('documents')
      .select('origin_document_id')
      .is('deleted_at', null)
      .eq('workspace_id', workspace.id)
      .eq('doc_type', 'fattura')
      .not('origin_document_id', 'is', null),
  ])

  const convertedIds = new Set(
    (alreadyConverted ?? []).map((r) => r.origin_document_id).filter(Boolean)
  )

  const preventiviDisponibili: PreventivoOption[] = (allPrev ?? [])
    .filter((p) => !convertedIds.has(p.id))
    .map((p) => ({
      id: p.id,
      doc_number: p.doc_number,
      title: p.title,
      total: p.total,
      status: p.status,
      client_name: (p.clients as { name: string } | null)?.name ?? null,
    }))

  return (
    <div className="max-w-4xl mx-auto">
      {/* ── Header mobile compatto ── */}
      <div
        className="lg:hidden flex items-center"
        style={{ background: '#fff', borderBottom: '2px solid #c9a44c', padding: '12px 15px' }}
      >
        <Link
          href="/fatture"
          style={{ width: 34, height: 34, borderRadius: '50%', background: '#f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#55534b' }}
          aria-label="Chiudi"
        >
          <X size={19} />
        </Link>
        {/* Simbolo tipo documento (A2, 5 lug): banconota ORO = fattura */}
        <span style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 18, fontWeight: 600, fontFamily: "Georgia, 'Times New Roman', serif", color: '#1a1a2e' }}>
          <Banknote size={19} style={{ color: '#b08d3e', flexShrink: 0 }} aria-hidden />
          Nuova fattura
        </span>
        <span style={{ width: 34, flexShrink: 0 }} />
      </div>

      <div className="p-4 md:p-6 space-y-5">
        {/* Breadcrumb — desktop only */}
        <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/fatture" className="flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="size-3.5" /> Fatture
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">Nuova fattura</span>
        </div>

        <div className="hidden lg:flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Nuova fattura</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Compila le voci e salva — il totale viene calcolato automaticamente.
            </p>
          </div>
          {preventiviDisponibili.length > 0 && (
            <CreateFromPreventivoButton
              preventivi={preventiviDisponibili}
              autoOpen={from === 'preventivo'}
            />
          )}
        </div>

        {/* MOBILE: il trigger deve esistere anche qui — se l'utente chiude il
            dialog aperto da "Da preventivo" non aveva più modo di riaprirlo.
            F12: a tutta larghezza e centrato, senza doppio rientro (il
            contenitore ha già il suo padding) e staccato dalla card Cliente. */}
        {preventiviDisponibili.length > 0 && (
          <div className="lg:hidden" style={{ marginBottom: 4 }}>
            <CreateFromPreventivoButton
              preventivi={preventiviDisponibili}
              autoOpen={from === 'preventivo'}
              fullWidth
            />
          </div>
        )}
        {/* ?from=preventivo ma nessun preventivo convertibile: dillo, non ignorare */}
        {from === 'preventivo' && preventiviDisponibili.length === 0 && (
          <div style={{ margin: '12px 15px 0' }}>
            <Avviso gravita="info">Non ci sono preventivi da convertire: crea la fattura da zero qui sotto.</Avviso>
          </div>
        )}

      <FatturaForm
        templates={(templates ?? []) as Array<{ id: string; name: string; is_default: boolean | null }>}
        defaultTemplateId={defaultTemplateId}
        fiscalRegime={workspace.fiscal_regime}
        isProPlan={workspace.plan !== 'free'}
        nextInvoiceNumber={nextInvoiceNumber}
      />
      </div>
    </div>
  )
}
