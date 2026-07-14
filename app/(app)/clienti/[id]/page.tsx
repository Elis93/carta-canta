import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { formatCurrency, formatDate, formatDocNumber } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ClientForm } from '../_components/ClientForm'
import { DeleteClientButton } from '../_components/DeleteClientButton'
import { StatusBadge } from '@/app/(app)/preventivi/_components/StatusBadge'
import type { DocStatus } from '@/app/(app)/preventivi/_components/StatusBadge'
import { BackButton } from '@/components/shared/BackButton'
import {
  Mail, Phone, MapPin, Building2,
  ArrowLeft, ChevronLeft, Plus, Hash, Pencil,
} from 'lucide-react'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ edit?: string }>
}

export default async function ClienteDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { edit } = await searchParams
  const { supabase, user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/login')

  // Cliente e documenti collegati — query indipendenti in parallelo
  const [{ data: client }, { data: documents }] = await Promise.all([
    supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .eq('workspace_id', workspace.id)
      .maybeSingle(),
    supabase
      .from('documents')
      .select('id, title, status, total, currency, doc_number, doc_type, created_at')
      .eq('client_id', id)
      .eq('workspace_id', workspace.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  if (!client) notFound()

  const cfDistinct = client.codice_fiscale && client.codice_fiscale !== client.piva
    ? client.codice_fiscale
    : null

  const infoItems = [
    { icon: Mail,      label: 'Email',            value: client.email },
    { icon: Phone,     label: 'Telefono',          value: client.phone },
    { icon: Building2, label: 'Partita IVA / CF',  value: client.piva },
    { icon: Hash,      label: 'Codice fiscale',    value: cfDistinct },
    {
      icon: MapPin,
      label: 'Indirizzo',
      value: [client.indirizzo, client.cap, client.citta, client.provincia]
        .filter(Boolean)
        .join(', ') || null,
    },
  ].filter((i) => i.value)

  const clientFullName = [client.name, client.surname].filter(Boolean).join(' ')

  return (
    <div className="max-w-3xl mx-auto">

      {/* ── MOBILE HEADER (lg:hidden) ── */}
      <div
        className="lg:hidden flex items-center gap-2.5"
        style={{ background: '#fff', borderBottom: '2px solid #c9a44c', padding: '12px 15px' }}
      >
        <BackButton fallback="/clienti" />
        <div style={{ flex: 1, fontSize: 18, fontWeight: 600, fontFamily: "Georgia, 'Times New Roman', serif", color: '#1a1a2e' }}>
          Scheda cliente
        </div>
      </div>

      <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">

        {/* ── DESKTOP BREADCRUMB (hidden on mobile) ── */}
        <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/clienti" className="flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="size-3.5" /> Clienti
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">{clientFullName}</span>
        </div>

        {/* ── Avatar + nome + data (entrambi mobile e desktop) ── */}
        <div className="flex items-center gap-3 lg:gap-4">
          <div
            className="shrink-0 rounded-full flex items-center justify-center text-xl font-medium"
            style={{ width: 52, height: 52, background: '#f0efe9', color: 'var(--cc-navy)' }}
          >
            {client.name[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl lg:text-2xl font-semibold" style={{ color: '#161616' }}>{clientFullName}</h1>
            <p style={{ fontSize: 12, color: '#8a887f', marginTop: 2 }}>
              Cliente dal {formatDate(client.created_at!)}
            </p>
          </div>
          {/* "Nuovo preventivo" sta SOLO nella sezione Documenti (niente doppioni
              nella stessa schermata — decisione Eli 5 lug) */}
        </div>

        {/* ── MOBILE: Quick action chips (lg:hidden) ── */}
        <div className="flex lg:hidden" style={{ gap: 11 }}>
          {client.phone && (
            <a
              href={`tel:${client.phone}`}
              className="flex-1 flex items-center justify-center"
              style={{ gap: 7, borderRadius: 11, padding: 11, fontSize: 13, fontWeight: 500, border: '1px solid #e7e7ea', background: '#fff', color: '#1a1a2e', boxShadow: '0 1px 2px rgba(20,20,40,.05), 0 8px 24px -10px rgba(20,20,40,.15)' }}
            >
              <Phone size={16} /> Chiama
            </a>
          )}
          <Link
            href="?edit=1#edit-form"
            className="flex-1 flex items-center justify-center"
            style={{ gap: 7, borderRadius: 11, padding: 11, fontSize: 13, fontWeight: 500, border: '1px solid #e7e7ea', background: '#fff', color: '#1a1a2e', boxShadow: '0 1px 2px rgba(20,20,40,.05), 0 8px 24px -10px rgba(20,20,40,.15)' }}
          >
            <Pencil size={16} /> Modifica
          </Link>
        </div>

        {/* ── Info card (sempre visibile, stile mobile-first) ── */}
        {infoItems.length > 0 && (
          <div
            className="cc-card-md"
            style={{ padding: '4px 15px' }}
          >
            {infoItems.map(({ icon: Icon, label, value }, idx) => (
              <div
                key={label}
                className="flex items-center gap-3"
                style={{
                  padding: '11px 0',
                  borderBottom: idx < infoItems.length - 1 ? '0.5px solid #eee' : 'none',
                }}
              >
                <Icon size={17} style={{ color: '#8a887f', flexShrink: 0 }} />
                <span style={{ fontSize: 14, color: '#161616' }}>{value}</span>
              </div>
            ))}
          </div>
        )}

        {client.notes && (
          <div className="cc-card-md" style={{ padding: '12px 15px' }}>
            <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--cc-text-3)' }}>
              Note
            </p>
            <p className="text-sm whitespace-pre-line" style={{ color: 'var(--cc-text-2)' }}>
              {client.notes}
            </p>
          </div>
        )}

        {/* ── Documenti ── */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <span style={{ fontSize: 13, fontWeight: 600, color: '#161616' }}>
              Documenti {documents && documents.length > 0 && <span style={{ color: '#8a887f', fontWeight: 400 }}>({documents.length})</span>}
            </span>
            <Link
              href={`/preventivi/nuovo?client_id=${id}`}
              className="flex items-center gap-1"
              style={{ fontSize: 13, fontWeight: 500, color: '#1a1a2e' }}
            >
              <Plus size={15} /> Nuovo preventivo
            </Link>
          </div>

          {documents && documents.length > 0 ? (
            <div className="cc-card-md" style={{ padding: '4px 15px' }}>
              {documents.map((doc, idx) => {
                const isFattura = doc.doc_type === 'fattura'
                const href = isFattura ? `/fatture/${doc.id}` : `/preventivi/${doc.id}`
                const docLabel = doc.doc_number
                  ? formatDocNumber(doc.doc_number, doc.doc_type)
                  : (doc.title ?? (isFattura ? 'Fattura' : 'Preventivo'))
                return (
                  <Link
                    key={doc.id}
                    href={href}
                    className="flex items-center justify-between gap-3 hover:bg-muted/30 rounded transition-colors"
                    style={{
                      padding: '11px 0',
                      borderBottom: idx < documents.length - 1 ? '0.5px solid #eee' : 'none',
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: '#161616' }}>
                      <span style={{ fontWeight: 600 }}>{docLabel}</span>
                      {doc.total != null && (
                        <span style={{ color: '#8a887f' }}> · {formatCurrency(doc.total)}</span>
                      )}
                    </span>
                    <StatusBadge status={doc.status as DocStatus} docType={isFattura ? 'fattura' : 'preventivo'} />
                  </Link>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-center py-6" style={{ color: 'var(--cc-text-2)' }}>
              Nessun documento per questo cliente.
            </p>
          )}
        </div>

        {/* ── Modifica dati (mobile: solo se ?edit=1; desktop: sempre) ── */}
        <div className={edit !== '1' ? 'hidden lg:block' : undefined}>
          <Separator className="mb-4" />
          {/* scrollMarginTop: il chip "Modifica" arriva con l'ancora #edit-form */}
          <div id="edit-form" style={{ scrollMarginTop: 90 }}>
            <h2 className="text-base font-semibold mb-4">Modifica dati</h2>
            <ClientForm mode="edit" clientId={id} defaultValues={client} />
          </div>
        </div>

        {/* ── Zona pericolosa ── */}
        <div className="flex items-center justify-between gap-3" style={{ paddingTop: 4 }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#161616' }}>Elimina cliente</p>
            <p style={{ fontSize: 12, color: '#8a887f', marginTop: 1 }}>
              I preventivi esistenti non vengono eliminati.
            </p>
          </div>
          <DeleteClientButton clientId={id} clientName={client.name} />
        </div>

      </div>
    </div>
  )
}
