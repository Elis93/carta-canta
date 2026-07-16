import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Inbox, Star, Globe, Store, ChevronRight } from 'lucide-react'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { BackButton } from '@/components/shared/BackButton'

// ============================================================
// "Fatti trovare dai clienti" — raccoglie le 4 pagine del marketplace
// (richieste, recensioni, profilo pubblico, vetrina) che prima erano
// 4 voci separate in Altro. Decisione Eli 16 lug: struttura più
// leggera per tutti — una voce sola in Altro, il dettaglio qui.
// ============================================================

export const metadata = { title: 'Fatti trovare dai clienti' }

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

export default async function FartiTrovarePage() {
  const { supabase, user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/onboarding')

  // Richieste marketplace NUOVE (tabella 043 — tollerante pre-migration)
  let newRequestsCount = 0
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 043 non ancora in types/database.ts
    const { count } = await (supabase as any)
      .from('marketplace_requests')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspace.id)
      .eq('status', 'new')
    newRequestsCount = count ?? 0
  } catch { /* tabella assente */ }

  const richiesteBadge = newRequestsCount > 0 ? (
    <span style={{ background: '#3f6fb0', color: '#fff', borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 600, lineHeight: 1.6 }}>
      {newRequestsCount}
    </span>
  ) : null

  return (
    <div className="max-w-2xl mx-auto">
      {/* Testata */}
      <div style={{ background: '#fff', borderBottom: '2px solid #c9a44c', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px' }}>
        <BackButton fallback="/altro" />
        <span style={{ flex: 1, fontSize: 18, fontWeight: 600, fontFamily: "Georgia, 'Times New Roman', serif", color: '#1a1a2e' }}>
          Fatti trovare dai clienti
        </span>
        <span style={{ width: 24 }} />
      </div>

      <div style={{ padding: '15px' }}>
        <p style={{ fontSize: 13, color: 'var(--cc-muted)', margin: '0 0 12px', lineHeight: 1.5 }}>
          Il tuo biglietto da visita su Carta Canta: chi ti cerca ti trova, ti chiede
          un preventivo e legge le recensioni dei tuoi clienti.
        </p>

        <div className="cc-card" style={{ borderRadius: 13, boxShadow: SH, padding: '2px 14px' }}>
          <Row
            href="/richieste"
            icon={Inbox}
            label="Richieste"
            desc="I clienti che ti hanno chiesto un preventivo"
            hint={richiesteBadge}
          />
          <Row
            href="/recensioni"
            icon={Star}
            label="Recensioni"
            desc="I giudizi lasciati dai tuoi clienti"
          />
          <Row
            href="/marketplace"
            icon={Globe}
            label="Il tuo profilo pubblico"
            desc="Come ti presenti: mestiere, zona, presentazione"
          />
          <Row
            href="/professionisti"
            icon={Store}
            label="Vetrina dei professionisti"
            desc="La pagina pubblica dove i clienti cercano"
            last
          />
        </div>
      </div>

      <div style={{ height: 40 }} />
    </div>
  )
}
