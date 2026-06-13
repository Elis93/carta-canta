import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate, formatDocNumber } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ClientForm } from '../_components/ClientForm'
import { DeleteClientButton } from '../_components/DeleteClientButton'
import { StatusBadge } from '@/app/(app)/preventivi/_components/StatusBadge'
import type { DocStatus } from '@/app/(app)/preventivi/_components/StatusBadge'
import {
  Mail, Phone, MapPin, Building2, FileText,
  ArrowLeft, Plus, Hash,
} from 'lucide-react'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ClienteDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!workspace) {
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .not('accepted_at', 'is', null)
      .limit(1)
      .maybeSingle()
    if (membership) {
      const { data: mw } = await supabase
        .from('workspaces').select('id')
        .eq('id', membership.workspace_id)
        .maybeSingle()
      workspace = mw
    }
  }
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
      <div className="lg:hidden flex items-center gap-2.5 px-4 pt-4 pb-3 border-b mb-1">
        <Link
          href="/clienti"
          style={{ color: 'var(--cc-text-2)', flexShrink: 0, display: 'flex', alignItems: 'center' }}
        >
          <ArrowLeft size={22} />
        </Link>
        <div style={{ flex: 1, fontSize: 16, fontWeight: 500, color: 'var(--cc-text)' }}>
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
            <h1 className="text-xl lg:text-2xl font-semibold">{clientFullName}</h1>
            <p className="text-xs" style={{ color: 'var(--cc-text-3)' }}>
              Cliente dal {formatDate(client.created_at!)}
            </p>
          </div>
          {/* Desktop: "Nuovo preventivo" button in header */}
          <div className="hidden lg:flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/preventivi/nuovo?client=${id}`}>
                <Plus className="size-4" /> Nuovo preventivo
              </Link>
            </Button>
          </div>
        </div>

        {/* ── MOBILE: Quick action chips (lg:hidden) ── */}
        <div className="flex gap-2 lg:hidden">
          {client.phone && (
            <a
              href={`tel:${client.phone}`}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-[9px] py-2.5"
              style={{ fontSize: 13, fontWeight: 500, border: '0.5px solid var(--cc-border-color)', background: 'white', color: 'var(--cc-navy)' }}
            >
              <Phone size={15} /> Chiama
            </a>
          )}
          <a
            href="#edit-form"
            className="flex-1 flex items-center justify-center gap-1.5 rounded-[9px] py-2.5"
            style={{ fontSize: 13, fontWeight: 500, border: '0.5px solid var(--cc-border-color)', background: 'white', color: 'var(--cc-navy)' }}
          >
            <Plus size={15} /> Modifica
          </a>
          <Link
            href={`/preventivi/nuovo?client=${id}`}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-[9px] py-2.5 text-white"
            style={{ fontSize: 13, fontWeight: 500, background: 'var(--cc-navy)', boxShadow: '0 4px 12px rgba(26,26,46,.2)' }}
          >
            <Plus size={15} /> Preventivo
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
                  padding: '10px 0',
                  borderBottom: idx < infoItems.length - 1 ? '0.5px solid var(--cc-border-color)' : 'none',
                }}
              >
                <Icon size={16} style={{ color: 'var(--cc-text-3)', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--cc-text)' }}>{value}</span>
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
            <span className="text-sm font-medium" style={{ color: 'var(--cc-text)' }}>
              Documenti {documents && documents.length > 0 && <span style={{ color: 'var(--cc-text-3)' }}>({documents.length})</span>}
            </span>
            <Link
              href={`/preventivi/nuovo?client=${id}`}
              className="flex items-center gap-1"
              style={{ fontSize: 13, fontWeight: 500, color: 'var(--cc-navy)' }}
            >
              <Plus size={14} /> Nuovo
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
                      padding: '10px 0',
                      borderBottom: idx < documents.length - 1 ? '0.5px solid var(--cc-border-color)' : 'none',
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0, fontSize: 14 }}>
                      <span style={{ fontWeight: 500 }}>{docLabel}</span>
                      {doc.total != null && (
                        <span style={{ color: 'var(--cc-text-2)' }}> · {formatCurrency(doc.total)}</span>
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

        <Separator />

        {/* ── Modifica dati ── */}
        <div id="edit-form">
          <h2 className="text-base font-semibold mb-4">Modifica dati</h2>
          <ClientForm mode="edit" clientId={id} defaultValues={client} />
        </div>

        <Separator />

        {/* ── Zona pericolosa ── */}
        <div className="flex items-center justify-between gap-4 py-2">
          <div>
            <p className="text-sm font-medium">Elimina cliente</p>
            <p className="text-xs text-muted-foreground">
              I preventivi esistenti non vengono eliminati.
            </p>
          </div>
          <DeleteClientButton clientId={id} clientName={client.name} />
        </div>

      </div>
    </div>
  )
}
