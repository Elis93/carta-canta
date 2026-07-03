import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Users,
  BookOpen,
  LayoutTemplate,
  Clock,
  Settings,
  Crown,
  Trash2,
  ChevronRight,
  LogOut,
  Banknote,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { logoutAction } from '@/app/(auth)/actions'

const PLAN_LABELS: Record<string, string> = {
  free:     'Piano Free',
  pro:      'Piano Pro',
  team:     'Piano Team',
  lifetime: 'Piano Lifetime',
}

// ── Riga menu ──────────────────────────────────────────────────────────────
function MenuRow({
  href,
  icon: Icon,
  label,
  hint,
  iconColor,
  last = false,
}: {
  href: string
  icon: React.ElementType
  label: string
  hint?: React.ReactNode
  iconColor?: string
  last?: boolean
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        padding: '13px 0',
        borderBottom: last ? 'none' : '0.5px solid #eee',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <Icon
        size={20}
        strokeWidth={1.75}
        style={{ flexShrink: 0, color: iconColor ?? '#1a1a2e' }}
        aria-hidden
      />
      <span style={{ flex: 1, fontSize: 15, color: '#161616' }}>{label}</span>
      {hint && <span style={{ flexShrink: 0, marginRight: 8 }}>{hint}</span>}
      <ChevronRight
        size={18}
        strokeWidth={1.5}
        style={{ flexShrink: 0, color: '#8a887f' }}
        aria-hidden
      />
    </Link>
  )
}

// ── Pagina ─────────────────────────────────────────────────────────────────
export default async function AltroPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Workspace — owner o membro
  let { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name, plan, ragione_sociale, logo_url')
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
      const { data: memberWorkspace } = await supabase
        .from('workspaces')
        .select('id, name, plan, ragione_sociale, logo_url')
        .eq('id', membership.workspace_id)
        .maybeSingle()
      workspace = memberWorkspace
    }
  }

  if (!workspace) redirect('/onboarding')

  // Finestra "in scadenza": entro 7 giorni (o già oltre la scadenza, se non ancora aggiornato)
  const scadenzaCutoff = new Date()
  scadenzaCutoff.setDate(scadenzaCutoff.getDate() + 7)

  // Badge preventivi in scadenza — inviati/visti con validità entro 7 giorni (o già scaduti)
  const { count: scadenzeCount } = await supabase
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspace.id)
    .eq('doc_type', 'preventivo')
    .in('status', ['sent', 'viewed'])
    .is('deleted_at', null)
    .not('expires_at', 'is', null)
    .lte('expires_at', scadenzaCutoff.toISOString())

  const scadenzeBadge = scadenzeCount && scadenzeCount > 0 ? (
    <span style={{ background: '#c9a44c', color: '#fff', borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 600, lineHeight: 1.6 }}>
      {scadenzeCount}
    </span>
  ) : null

  // Badge fatture da incassare — inviate/viste con pagamento entro 7 giorni (o già scadute)
  const { count: fattureScaduteCount } = await supabase
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspace.id)
    .eq('doc_type', 'fattura')
    .in('status', ['sent', 'viewed'])
    .is('deleted_at', null)
    .not('expires_at', 'is', null)
    .lte('expires_at', scadenzaCutoff.toISOString())

  const fattureBadge = fattureScaduteCount && fattureScaduteCount > 0 ? (
    <span style={{ background: '#c9a44c', color: '#fff', borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 600, lineHeight: 1.6 }}>
      {fattureScaduteCount}
    </span>
  ) : null

  const displayName = workspace.ragione_sociale ?? workspace.name
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((w: string) => w[0] ?? '')
    .join('')
    .toUpperCase() || 'CC'

  const planLabel = PLAN_LABELS[workspace.plan] ?? `Piano ${workspace.plan}`
  const isFree = workspace.plan === 'free'

  return (
    <div>

      {/* Titolo — fascia bianca */}
      <div style={{ background: '#fff', borderBottom: '0.5px solid #eeeeee', padding: '15px 15px 13px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: '#161616' }}>
          Altro
        </h1>
      </div>

      <div style={{ padding: '0 15px' }}>

      {/* ── Scheda profilo ─────────────────────────────────── */}
      <Link
        href="/impostazioni"
        style={{ textDecoration: 'none', display: 'block', margin: '16px 0 0' }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 13,
            background: '#fff',
            borderRadius: 13,
            boxShadow: '0 1px 2px rgba(20,20,40,.05), 0 8px 24px -10px rgba(20,20,40,.15)',
            padding: '13px 14px',
          }}
        >
          {/* Avatar iniziali */}
          <div
            style={{
              flexShrink: 0,
              width: 46,
              height: 46,
              borderRadius: '50%',
              background: 'var(--cc-navy)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 15,
              fontWeight: 500,
            }}
          >
            {initials}
          </div>

          {/* Nome + piano */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#161616', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName}
            </div>
            <div style={{ fontSize: 13, color: '#8a887f' }}>{planLabel}</div>
          </div>

          <ChevronRight
            size={18}
            strokeWidth={1.5}
            style={{ flexShrink: 0, color: '#8a887f' }}
            aria-hidden
          />
        </div>
      </Link>

      {/* ── Strumenti ──────────────────────────────────────── */}
      <div style={{ marginTop: 16 }}>
        <div className="cc-section-label" style={{ fontSize: 11, margin: '0 2px 8px' }}>
          Strumenti
        </div>
        <div className="cc-card" style={{ borderRadius: 13, boxShadow: '0 1px 2px rgba(20,20,40,.05), 0 8px 24px -10px rgba(20,20,40,.15)', padding: '2px 14px' }}>
          <MenuRow href="/clienti"    icon={Users}          label="Clienti" />
          <MenuRow href="/catalogo"   icon={BookOpen}       label="Catalogo" />
          <MenuRow href="/template"   icon={LayoutTemplate} label="Template documenti" />
          <MenuRow
            href="/preventivi/scadenze"
            icon={Clock}
            label="Preventivi in scadenza"
            hint={scadenzeBadge ?? undefined}
          />
          <MenuRow
            href="/fatture/scadenze"
            icon={Banknote}
            label="Fatture da incassare"
            hint={fattureBadge ?? undefined}
            last
          />
        </div>
      </div>

      {/* ── Account ────────────────────────────────────────── */}
      <div style={{ marginTop: 16 }}>
        <div className="cc-section-label" style={{ fontSize: 11, margin: '0 2px 8px' }}>
          Account
        </div>
        <div className="cc-card" style={{ borderRadius: 13, boxShadow: '0 1px 2px rgba(20,20,40,.05), 0 8px 24px -10px rgba(20,20,40,.15)', padding: '2px 14px' }}>
          <MenuRow href="/impostazioni" icon={Settings} label="Impostazioni" />
          <MenuRow
            href="/abbonamento"
            icon={Crown}
            label="Abbonamento"
            iconColor="var(--cc-gold)"
            hint={
              isFree ? (
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--cc-navy)' }}>
                  Passa a Pro
                </span>
              ) : undefined
            }
          />
          <MenuRow href="/cestino" icon={Trash2} label="Cestino" last />
        </div>
      </div>

      {/* ── Esci ───────────────────────────────────────────── */}
      <form action={logoutAction} style={{ marginTop: 16 }}>
        <button
          type="submit"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            border: '0.5px solid #d7d4cb',
            borderRadius: 9,
            padding: '12px 0',
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          <LogOut
            size={18}
            strokeWidth={1.75}
            style={{ color: '#b05656' }}
            aria-hidden
          />
          <span style={{ fontSize: 14, fontWeight: 500, color: '#b05656' }}>
            Esci
          </span>
        </button>
      </form>

      <div style={{ height: 16 }} />
      </div>
    </div>
  )
}
