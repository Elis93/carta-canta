import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronRight,
  LogOut,
  ClipboardList,
  Hammer,
  Users,
  BookOpen,
  BarChart3,
  Store,
  Settings,
  UserRound,
  HelpCircle,
} from 'lucide-react'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { userInitials } from '@/lib/utils/user-initials'
import { WorkspaceLogo } from '@/app/(app)/_components/WorkspaceLogo'
import { logoutAction } from '@/app/(auth)/actions'
import { InstallAppButton } from '@/components/shared/InstallAppButton'
import { TextSizeToggle } from '@/components/shared/TextSizeToggle'
import { CercaFunzione } from './_components/CercaFunzione'
import { MenuRow } from './_components/MenuRow'

const PLAN_LABELS: Record<string, string> = {
  free:     'Piano Free',
  pro:      'Piano Pro',
  team:     'Piano Team',
  lifetime: 'Piano Lifetime',
}

const cardStyle: React.CSSProperties = {
  borderRadius: 13,
  background: '#fff',
  boxShadow: '0 1px 2px rgba(20,20,40,.05), 0 8px 24px -10px rgba(20,20,40,.15)',
  padding: '2px 14px',
}
const sectionLabelStyle: React.CSSProperties = { margin: '0 2px 8px' }

// ── Pagina ─────────────────────────────────────────────────────────────────
// Riorganizzata (Eli 14 ago): meno voci a vista. Ricerca UX (Miller ~7±2,
// Hick) → max ~5 voci per gruppo, il resto dietro voci-contenitore
// («Clienti e appuntamenti», «Catalogo e strumenti», «Abbonamento e inviti»,
// «Aiuto e novità»), con un mini-suggerimento sempre visibile sotto ognuna.
export default async function AltroPage() {
  const { supabase, user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/onboarding')

  const [
    { count: catalogCount },
    newRequestsCount,
  ] = await Promise.all([
    supabase
      .from('catalog_items')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspace.id),
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 043 non ancora in types/database.ts
        const { count } = await (supabase as any)
          .from('marketplace_requests')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspace.id)
          .eq('status', 'new')
        return count ?? 0
      } catch { return 0 }
    })(),
  ])

  const displayName = workspace.ragione_sociale ?? workspace.name
  const planLabel = PLAN_LABELS[workspace.plan] ?? `Piano ${workspace.plan}`
  const isFree = workspace.plan === 'free'

  const richiesteBadge = newRequestsCount > 0 ? (
    <span style={{ background: '#3f6fb0', color: '#fff', borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 600, lineHeight: 1.6 }}>
      {newRequestsCount}
    </span>
  ) : null

  const profileItems = [
    { key: 'dati',    label: 'Dati attività (ragione sociale)', done: !!workspace.ragione_sociale,              href: '/impostazioni/generale' },
    { key: 'phone',   label: 'Telefono (per farti contattare)', done: !!workspace.phone,                        href: '/impostazioni/generale#telefono' },
    { key: 'logo',    label: 'Carica il tuo logo',              done: !!workspace.logo_url,                     href: '/impostazioni/generale#logo' },
    { key: 'ateco',   label: 'Codice ATECO (voci suggerite)',   done: (workspace.ateco_codes?.length ?? 0) > 0, href: '/impostazioni/fiscale#ateco' },
    { key: 'listino', label: 'Carica il listino nel catalogo',  done: (catalogCount ?? 0) > 0,                  href: '/catalogo' },
  ]
  const profileDoneCount = profileItems.filter((i) => i.done).length
  const profileIncomplete = profileDoneCount < profileItems.length

  return (
    <div>

      {/* Titolo — fascia bianca */}
      <div style={{ background: '#fff', borderBottom: '2px solid #c9a44c', padding: '15px 15px 13px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, fontFamily: "Georgia, 'Times New Roman', serif", color: '#1a1a2e' }}>
          Altro
        </h1>
      </div>

      <div style={{ padding: '0 15px' }}>

      {/* ── Scheda profilo — tap: Impostazioni, tab Generale ── */}
      <Link href="/impostazioni/generale" style={{ textDecoration: 'none', display: 'block', margin: '16px 0 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, background: '#fff', borderRadius: 13, boxShadow: '0 1px 2px rgba(20,20,40,.05), 0 8px 24px -10px rgba(20,20,40,.15)', padding: '13px 14px' }}>
          <WorkspaceLogo
            logoUrl={workspace.logo_url}
            displayName={displayName}
            size={46}
            round
            fallbackInitials={userInitials(user.user_metadata, displayName)}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#161616', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName}
            </div>
            <div style={{ fontSize: 13, color: 'var(--cc-muted)' }}>{planLabel}</div>
          </div>
          <ChevronRight size={18} strokeWidth={1.5} style={{ flexShrink: 0, color: 'var(--cc-muted)' }} aria-hidden />
        </div>
      </Link>

      {/* ── Completa il profilo (solo se manca qualcosa) ── */}
      {profileIncomplete && (
        <div style={{ margin: '12px 0 0', background: '#fff', borderRadius: 13, boxShadow: '0 1px 2px rgba(20,20,40,.05), 0 8px 24px -10px rgba(20,20,40,.15)', borderLeft: '3px solid #c9a44c', padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <ClipboardList size={20} strokeWidth={1.75} style={{ flexShrink: 0, color: '#b08d3e' }} aria-hidden />
            <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: '#161616' }}>Completa il profilo</span>
            <span style={{ background: '#c9a44c', color: '#fff', borderRadius: 999, padding: '1px 8px', fontSize: 11, fontWeight: 600, lineHeight: 1.6, flexShrink: 0 }}>
              {profileDoneCount}/{profileItems.length}
            </span>
          </div>
          <div style={{ marginTop: 4 }}>
            {profileItems.filter((item) => !item.done).map((item) => (
              <Link key={item.key} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 0 8px 33px', fontSize: 14, fontWeight: 500, color: '#161616', textDecoration: 'none' }}>
                <span style={{ width: 16, height: 16, borderRadius: '50%', border: '1.5px solid #d7d4cb', flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{item.label}</span>
                <ChevronRight size={16} strokeWidth={1.5} style={{ color: 'var(--cc-muted)', flexShrink: 0 }} />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Cerca una funzione ── */}
      <div data-tour="altro-cerca" style={{ marginTop: 16 }}>
        <CercaFunzione />
      </div>

      {/* ── Ogni giorno ── */}
      <div style={{ marginTop: 16 }}>
        <div className="cc-section-label" style={sectionLabelStyle}>Ogni giorno</div>
        <div data-tour="altro-lavoro" style={cardStyle}>
          <MenuRow href="/lavori" icon={Hammer} label="Lavori" desc="Da fare, in corso, finito" descAlways />
          <MenuRow href="/altro/clienti-appuntamenti" icon={Users} label="Clienti e appuntamenti" desc="Rubrica, agenda e sopralluoghi" descAlways />
          <MenuRow href="/altro/strumenti" icon={BookOpen} label="Catalogo e strumenti" desc="Voci, listini, calcoli e template" descAlways last />
        </div>
      </div>

      {/* ── Andamento ── */}
      <div style={{ marginTop: 16 }}>
        <div className="cc-section-label" style={sectionLabelStyle}>Andamento</div>
        <div data-tour="altro-strumenti" style={cardStyle}>
          <MenuRow
            href="/bilancio"
            icon={BarChart3}
            label="Bilancio"
            desc="Entrate e uscite, mese per mese"
            descAlways
            hint={isFree ? (
              <span style={{ border: '1px solid #e8d6ad', color: '#b0863e', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, letterSpacing: '.03em' }}>PRO</span>
            ) : undefined}
          />
          <MenuRow href="/farti-trovare" icon={Store} label="Vetrina" desc="Fatti trovare dai clienti · richieste e recensioni" descAlways hint={richiesteBadge} last />
        </div>
      </div>

      {/* ── Account e aiuto ── */}
      <div style={{ marginTop: 16 }}>
        <div className="cc-section-label" style={sectionLabelStyle}>Account e aiuto</div>
        <div data-tour="altro-account" style={cardStyle}>
          <MenuRow href="/impostazioni" icon={Settings} label="Impostazioni" desc="Dati attività, fiscale, pagamenti, notifiche" descAlways />
          <MenuRow
            href="/account"
            icon={UserRound}
            label="Account e abbonamento"
            desc="Accesso, sicurezza, i tuoi dati, commercialista, piano e inviti"
            descAlways
            hint={isFree ? (
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--cc-navy)' }}>Passa a Pro</span>
            ) : undefined}
          />
          <MenuRow href="/altro/aiuto-novita" icon={HelpCircle} label="Aiuto e novità" desc="Domande frequenti e novità" descAlways last />
        </div>
      </div>

      {/* ── Utilità del telefono ──
          Il Cestino NON è più qui (#11, 14 ago): ora vive DENTRO Preventivi e
          Fatture, accanto all'Archivio — come l'Archivio, che nemmeno lui sta
          in «Altro». È il posto giusto: sono documenti, si recuperano dalla
          loro lista. Resta raggiungibile anche dalla ricerca e dalle FAQ. */}
      <div style={{ marginTop: 16 }}>
        <div style={cardStyle}>
          <div style={{ padding: '9px 0' }}>
            <TextSizeToggle />
          </div>
          <div style={{ borderTop: '0.5px solid #eee' }}>
            <InstallAppButton />
          </div>
        </div>
      </div>

      {/* ── Esci ── */}
      <form action={logoutAction} style={{ marginTop: 16 }}>
        <button
          type="submit"
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: '0.5px solid #d7d4cb', borderRadius: 9, padding: '12px 0', background: '#fff', boxShadow: '0 1px 2px rgba(20,20,40,.05)', cursor: 'pointer' }}
        >
          <LogOut size={18} strokeWidth={1.75} style={{ color: '#b05656' }} aria-hidden />
          <span style={{ fontSize: 14, fontWeight: 500, color: '#b05656' }}>Esci</span>
        </button>
      </form>

      <div style={{ height: 16 }} />
      </div>
    </div>
  )
}
