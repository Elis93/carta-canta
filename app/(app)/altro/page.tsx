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
        borderBottom: last ? 'none' : '0.5px solid var(--cc-border-color)',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <Icon
        size={20}
        strokeWidth={1.75}
        style={{ flexShrink: 0, color: iconColor ?? 'var(--cc-navy)' }}
        aria-hidden
      />
      <span style={{ flex: 1, fontSize: 15, color: 'var(--cc-text)' }}>{label}</span>
      {hint && <span style={{ flexShrink: 0, marginRight: 8 }}>{hint}</span>}
      <ChevronRight
        size={18}
        strokeWidth={1.5}
        style={{ flexShrink: 0, color: 'var(--cc-text-3)' }}
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

  // Badge scadenze: preventivi in scadenza entro 3 giorni
  const scadenzaCutoff = new Date()
  scadenzaCutoff.setDate(scadenzaCutoff.getDate() + 3)
  const { count: scadenzeCount } = await supabase
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspace.id)
    .in('status', ['sent', 'viewed'])
    .is('deleted_at', null)
    .not('expires_at', 'is', null)
    .lte('expires_at', scadenzaCutoff.toISOString())

  const scadenzeBadge = scadenzeCount && scadenzeCount > 0 ? (
    <span style={{ background: '#c9a44c', color: '#fff', borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 600, lineHeight: 1.6 }}>
      {scadenzeCount}
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
    <div style={{ padding: '16px 16px 0' }}>

      {/* Titolo */}
      <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 14, color: 'var(--cc-text)' }}>
        Altro
      </h1>

      {/* ── Scheda profilo ─────────────────────────────────── */}
      <Link
        href="/impostazioni"
        style={{ textDecoration: 'none', display: 'block', marginBottom: 16 }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 13,
            background: 'var(--cc-surface)',
            borderRadius: 13,
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
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--cc-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName}
            </div>
            <div style={{ fontSize: 13, color: 'var(--cc-text-3)' }}>{planLabel}</div>
          </div>

          <ChevronRight
            size={18}
            strokeWidth={1.5}
            style={{ flexShrink: 0, color: 'var(--cc-text-3)' }}
            aria-hidden
          />
        </div>
      </Link>

      {/* ── Strumenti ──────────────────────────────────────── */}
      <div style={{ marginBottom: 16 }}>
        <div className="cc-section-label" style={{ marginBottom: 8, paddingLeft: 2 }}>
          Strumenti
        </div>
        <div className="cc-card" style={{ padding: '2px 14px' }}>
          <MenuRow href="/clienti"    icon={Users}          label="Clienti" />
          <MenuRow href="/catalogo"   icon={BookOpen}       label="Catalogo" />
          <MenuRow href="/template"   icon={LayoutTemplate} label="Template documenti" />
          <MenuRow
            href="/preventivi/scadenze"
            icon={Clock}
            label="Scadenze e solleciti"
            hint={scadenzeBadge ?? undefined}
            last
          />
        </div>
      </div>

      {/* ── Account ────────────────────────────────────────── */}
      <div style={{ marginBottom: 16 }}>
        <div className="cc-section-label" style={{ marginBottom: 8, paddingLeft: 2 }}>
          Account
        </div>
        <div className="cc-card" style={{ padding: '2px 14px' }}>
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
      <form action={logoutAction}>
        <button
          type="submit"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            border: '0.5px solid var(--cc-border-strong)',
            borderRadius: 9,
            padding: '12px 0',
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          <LogOut
            size={18}
            strokeWidth={1.75}
            style={{ color: 'var(--cc-danger)' }}
            aria-hidden
          />
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--cc-danger)' }}>
            Esci
          </span>
        </button>
      </form>

    </div>
  )
}
