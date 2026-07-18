import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Clock, Banknote, ChevronRight } from 'lucide-react'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { BackButton } from '@/components/shared/BackButton'

// ============================================================
// "Scadenze" — raccoglie le due pagine "Preventivi in scadenza" e
// "Fatture da incassare" (feedback Eli F4: compattare Altro come
// fatto con "Fatti trovare dai clienti"). I badge restano sulle righe.
// ============================================================

export const metadata = { title: 'Scadenze' }

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

function Row({ href, icon: Icon, label, desc, hint, last = false }: {
  href: string
  icon: React.ElementType
  label: string
  desc: string
  hint?: React.ReactNode
  last?: boolean
}) {
  return (
    <Link
      href={href}
      style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 0', borderBottom: last ? 'none' : '0.5px solid #eee', textDecoration: 'none', color: 'inherit' }}
    >
      <Icon size={20} strokeWidth={1.75} style={{ flexShrink: 0, color: '#1a1a2e' }} aria-hidden />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15, color: '#161616' }}>{label}</span>
        <span style={{ display: 'block', fontSize: 13, color: 'var(--cc-muted)', marginTop: 2, lineHeight: 1.45 }}>{desc}</span>
      </span>
      {hint && <span style={{ flexShrink: 0, marginRight: 8 }}>{hint}</span>}
      <ChevronRight size={18} strokeWidth={1.5} style={{ flexShrink: 0, color: 'var(--cc-muted)' }} aria-hidden />
    </Link>
  )
}

function Badge({ n }: { n: number }) {
  if (n <= 0) return null
  return (
    <span style={{ background: '#c9a44c', color: '#fff', borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 600, lineHeight: 1.6 }}>
      {n}
    </span>
  )
}

export default async function ScadenzePage() {
  const { supabase, user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/onboarding')

  // Stessa finestra "in scadenza" della pagina Altro: entro 7 giorni
  const scadenzaCutoff = new Date()
  scadenzaCutoff.setDate(scadenzaCutoff.getDate() + 7)

  const [{ count: prevCount }, { count: fattCount }] = await Promise.all([
    supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspace.id)
      .eq('doc_type', 'preventivo')
      .in('status', ['sent', 'viewed'])
      .is('deleted_at', null)
      .not('expires_at', 'is', null)
      .lte('expires_at', scadenzaCutoff.toISOString()),
    supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspace.id)
      .eq('doc_type', 'fattura')
      .in('status', ['sent', 'viewed', 'expired'])
      .is('deleted_at', null)
      .not('expires_at', 'is', null)
      .lte('expires_at', scadenzaCutoff.toISOString()),
  ])

  return (
    <div className="max-w-2xl mx-auto">
      {/* Testata */}
      <div style={{ background: '#fff', borderBottom: '2px solid #c9a44c', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px' }}>
        <BackButton fallback="/altro" />
        <span style={{ flex: 1, fontSize: 18, fontWeight: 600, fontFamily: "Georgia, 'Times New Roman', serif", color: '#1a1a2e' }}>
          Scadenze
        </span>
        <span style={{ width: 24 }} />
      </div>

      <div style={{ padding: '15px' }}>
        <p style={{ fontSize: 13, color: 'var(--cc-muted)', margin: '0 0 12px', lineHeight: 1.5 }}>
          Il quadro delle scadenze: preventivi in scadenza e fatture in attesa
          di incasso.
        </p>

        <div className="cc-card" style={{ borderRadius: 13, boxShadow: SH, padding: '2px 14px' }}>
          <Row
            href="/preventivi/scadenze"
            icon={Clock}
            label="Preventivi in scadenza"
            desc="In attesa di risposta, con scadenza vicina"
            hint={<Badge n={prevCount ?? 0} />}
          />
          <Row
            href="/fatture/scadenze"
            icon={Banknote}
            label="Fatture da incassare"
            desc="Emesse e in attesa di pagamento"
            hint={<Badge n={fattCount ?? 0} />}
            last
          />
        </div>
      </div>

      <div style={{ height: 40 }} />
    </div>
  )
}
