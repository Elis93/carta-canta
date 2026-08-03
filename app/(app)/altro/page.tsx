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
  ClipboardList,
  BarChart3,
  HardHat,
  CalendarDays,
  HelpCircle,
  Sparkles,
  Hammer,
  Store,
  UserRound,
  Calculator,
} from 'lucide-react'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { userInitials } from '@/lib/utils/user-initials'
import { WorkspaceLogo } from '@/app/(app)/_components/WorkspaceLogo'
import { logoutAction } from '@/app/(auth)/actions'
import { InstallAppButton } from '@/components/shared/InstallAppButton'
import { TextSizeToggle } from '@/components/shared/TextSizeToggle'

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
  desc,
  descAlways = false,
  hint,
  iconColor,
  last = false,
}: {
  href: string
  icon: React.ElementType
  label: string
  /** Breve spiegazione sotto l'etichetta. Di default compare SOLO in modalità
      "Testo grande e leggibile" (classe cc-desc); con descAlways è sempre visibile. */
  desc?: string
  descAlways?: boolean
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
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15, color: '#161616' }}>{label}</span>
        {desc && (
          <span
            className={descAlways ? undefined : 'cc-desc'}
            style={{ fontSize: 13, color: 'var(--cc-muted)', marginTop: 2, lineHeight: 1.45 }}
          >
            {desc}
          </span>
        )}
      </span>
      {hint && <span style={{ flexShrink: 0, marginRight: 8 }}>{hint}</span>}
      <ChevronRight
        size={18}
        strokeWidth={1.5}
        style={{ flexShrink: 0, color: 'var(--cc-muted)' }}
        aria-hidden
      />
    </Link>
  )
}

// ── Pagina ─────────────────────────────────────────────────────────────────
export default async function AltroPage() {
  const { supabase, user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/onboarding')

  // Finestra "in scadenza": entro 7 giorni (o già oltre la scadenza, se non ancora aggiornato)
  const scadenzaCutoff = new Date()
  scadenzaCutoff.setDate(scadenzaCutoff.getDate() + 7)

  // Badge (4 count) in PARALLELO: una pagina-menu deve aprirsi all'istante,
  // non aspettare quattro round-trip in fila.
  const [
    { count: scadenzeCount },
    { count: fattureScaduteCount },
    { count: catalogCount },
    newRequestsCount,
  ] = await Promise.all([
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
      // 'expired' incluso: una fattura oltre scadenza resta da incassare
      .in('status', ['sent', 'viewed', 'expired'])
      .is('deleted_at', null)
      .not('expires_at', 'is', null)
      .lte('expires_at', scadenzaCutoff.toISOString()),
    supabase
      .from('catalog_items')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspace.id),
    // Richieste marketplace NUOVE (tabella 043 — tollerante pre-migration)
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

  // F4: badge unico sulla voce "Scadenze" = preventivi in scadenza + fatture da incassare
  const scadenzeTot = (scadenzeCount ?? 0) + (fattureScaduteCount ?? 0)
  const scadenzeTotBadge = scadenzeTot > 0 ? (
    <span style={{ background: '#c9a44c', color: '#fff', borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 600, lineHeight: 1.6 }}>
      {scadenzeTot}
    </span>
  ) : undefined

  const displayName = workspace.ragione_sociale ?? workspace.name
  // F22: le iniziali (fallback senza logo) le calcola WorkspaceLogo, come nell'header

  const planLabel = PLAN_LABELS[workspace.plan] ?? `Piano ${workspace.plan}`
  const isFree = workspace.plan === 'free'

  // Checklist profilo (stesse voci e deep-link della card in Home):
  // le voci mancanti sono elencate sotto la riga, ognuna apre il punto
  // esatto delle Impostazioni (tab + ancora).

  const richiesteBadge = newRequestsCount > 0 ? (
    <span style={{ background: '#3f6fb0', color: '#fff', borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 600, lineHeight: 1.6 }}>
      {newRequestsCount}
    </span>
  ) : null


  const profileItems = [
    { key: 'dati',  label: 'Dati attività (ragione sociale)', done: !!workspace.ragione_sociale,              href: '/impostazioni?tab=generale' },
    { key: 'phone', label: 'Telefono (per farti contattare)', done: !!workspace.phone,                        href: '/impostazioni?tab=generale#telefono' },
    { key: 'logo',  label: 'Carica il tuo logo',              done: !!workspace.logo_url,                     href: '/impostazioni?tab=generale#logo' },
    { key: 'ateco', label: 'Codice ATECO (voci suggerite)',   done: (workspace.ateco_codes?.length ?? 0) > 0, href: '/impostazioni?tab=fiscale#ateco' },
    { key: 'listino', label: 'Carica il listino nel catalogo', done: (catalogCount ?? 0) > 0,                 href: '/catalogo' },
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

      {/* ── Scheda profilo — tap: Impostazioni, tab Generale (dati attività) ── */}
      <Link
        href="/impostazioni?tab=generale"
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
          {/* Con il logo caricato si vede il LOGO; senza, il TONDO con le
              STESSE identiche iniziali della Home (persona, non azienda —
              richiesta Eli 17 lug) */}
          <WorkspaceLogo
            logoUrl={workspace.logo_url}
            displayName={displayName}
            size={46}
            round
            fallbackInitials={userInitials(user.user_metadata, displayName)}
          />

          {/* Nome + piano */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#161616', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName}
            </div>
            <div style={{ fontSize: 13, color: 'var(--cc-muted)' }}>{planLabel}</div>
          </div>

          <ChevronRight
            size={18}
            strokeWidth={1.5}
            style={{ flexShrink: 0, color: 'var(--cc-muted)' }}
            aria-hidden
          />
        </div>
      </Link>

      {/* ── Completa il profilo (solo se manca qualcosa) ─────
          Le voci MANCANTI sono elencate dentro la card: tap sulla voce =
          apre il punto esatto delle Impostazioni (tab + ancora). */}
      {profileIncomplete && (
        <div
          style={{ margin: '12px 0 0', background: '#fff', borderRadius: 13, boxShadow: '0 1px 2px rgba(20,20,40,.05), 0 8px 24px -10px rgba(20,20,40,.15)', borderLeft: '3px solid #c9a44c', padding: '12px 14px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <ClipboardList size={20} strokeWidth={1.75} style={{ flexShrink: 0, color: '#b08d3e' }} aria-hidden />
            <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: '#161616' }}>Completa il profilo</span>
            <span style={{ background: '#c9a44c', color: '#fff', borderRadius: 999, padding: '1px 8px', fontSize: 11, fontWeight: 600, lineHeight: 1.6, flexShrink: 0 }}>
              {profileDoneCount}/{profileItems.length}
            </span>
          </div>
          <div style={{ marginTop: 4 }}>
            {profileItems.filter((item) => !item.done).map((item) => (
              <Link
                key={item.key}
                href={item.href}
                style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 0 8px 33px', fontSize: 14, fontWeight: 500, color: '#161616', textDecoration: 'none' }}
              >
                <span style={{ width: 16, height: 16, borderRadius: '50%', border: '1.5px solid #d7d4cb', flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{item.label}</span>
                <ChevronRight size={16} strokeWidth={1.5} style={{ color: 'var(--cc-muted)', flexShrink: 0 }} />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Ogni giorno (operatività quotidiana) ── */}
      <div style={{ marginTop: 16 }}>
        <div className="cc-section-label" style={{ fontSize: 11, margin: '0 2px 8px' }}>
          Ogni giorno
        </div>
        <div className="cc-card" style={{ borderRadius: 13, boxShadow: '0 1px 2px rgba(20,20,40,.05), 0 8px 24px -10px rgba(20,20,40,.15)', padding: '2px 14px' }}>
          <MenuRow href="/lavori"       icon={Hammer}  label="Lavori" desc="Il cantiere: da fare, in corso, finito" />
          <MenuRow href="/calendario"   icon={CalendarDays} label="Agenda appuntamenti" desc="Sopralluoghi e lavori della settimana" />
          <MenuRow href="/sopralluoghi" icon={HardHat} label="Sopralluoghi" desc="Foto e appunti presi dal cliente" />
          <MenuRow href="/clienti"      icon={Users}   label="Clienti" last />
        </div>
      </div>

      {/* ── Soldi ──────────────────────────────────────────── */}
      <div style={{ marginTop: 16 }}>
        <div className="cc-section-label" style={{ fontSize: 11, margin: '0 2px 8px' }}>
          Soldi
        </div>
        <div className="cc-card" style={{ borderRadius: 13, boxShadow: '0 1px 2px rgba(20,20,40,.05), 0 8px 24px -10px rgba(20,20,40,.15)', padding: '2px 14px' }}>
          <MenuRow
            href="/bilancio"
            icon={BarChart3}
            label="Bilancio"
            desc="Entrate e uscite, mese per mese"
            hint={
              isFree ? (
                <span style={{ border: '1px solid #e8d6ad', color: '#b0863e', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, letterSpacing: '.03em' }}>
                  PRO
                </span>
              ) : undefined
            }
          />
          {/* F4: le due voci scadenze ACCORPATE in una (badge = somma) —
              il dettaglio vive nella sottopagina /scadenze */}
          <MenuRow
            href="/scadenze"
            icon={Clock}
            label="Scadenze"
            desc="Preventivi in scadenza e fatture da incassare"
            descAlways
            hint={scadenzeTotBadge}
            last
          />
        </div>
      </div>

      {/* ── Fatti trovare (marketplace ACCORPATO in una voce — decisione
             Eli 16 lug: struttura più leggera per tutti; le 4 pagine vivono
             nella sottopagina /farti-trovare, il badge richieste risale) ── */}
      <div style={{ marginTop: 16 }}>
        <div className="cc-card" style={{ borderRadius: 13, boxShadow: '0 1px 2px rgba(20,20,40,.05), 0 8px 24px -10px rgba(20,20,40,.15)', padding: '2px 14px' }}>
          <MenuRow
            href="/farti-trovare"
            icon={Store}
            label="Fatti trovare dai clienti"
            desc="Richieste, recensioni e vetrina"
            descAlways
            hint={richiesteBadge}
            last
          />
        </div>
      </div>

      {/* ── Strumenti ──────────────────────────────────────── */}
      <div style={{ marginTop: 16 }}>
        <div className="cc-section-label" style={{ fontSize: 11, margin: '0 2px 8px' }}>
          Strumenti
        </div>
        <div className="cc-card" style={{ borderRadius: 13, boxShadow: '0 1px 2px rgba(20,20,40,.05), 0 8px 24px -10px rgba(20,20,40,.15)', padding: '2px 14px' }}>
          <MenuRow href="/catalogo"   icon={BookOpen} label="Catalogo e listini" desc="Le tue voci e i listini dei fornitori" />
          <MenuRow href="/calcoli"    icon={Calculator} label="Calcoli (metri quadri, piastrelle…)" />
          <MenuRow href="/template"   icon={LayoutTemplate} label="Template documenti" desc="L'aspetto dei tuoi preventivi e fatture" />
          {/* F14: "Testo grande e leggibile" vive qui (impostazione del
              telefono, non dei dati attività) — ben visibile per chi ne ha bisogno */}
          <div style={{ borderTop: '0.5px solid #eee', padding: '9px 0' }}>
            <TextSizeToggle />
          </div>
          <div style={{ borderTop: '0.5px solid #eee' }}>
            <InstallAppButton />
          </div>
        </div>
      </div>

      {/* ── Account e aiuto ────────────────────────────────── */}
      <div style={{ marginTop: 16 }}>
        <div className="cc-section-label" style={{ fontSize: 11, margin: '0 2px 8px' }}>
          Account e aiuto
        </div>
        <div className="cc-card" style={{ borderRadius: 13, boxShadow: '0 1px 2px rgba(20,20,40,.05), 0 8px 24px -10px rgba(20,20,40,.15)', padding: '2px 14px' }}>
          <MenuRow href="/impostazioni" icon={Settings} label="Impostazioni" desc="Dati attività, fiscale, notifiche" />
          <MenuRow href="/account" icon={UserRound} label="Account e dati" desc="Scarica i tuoi dati, commercialista, elimina account" />
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
          <MenuRow href="/aiuto"   icon={HelpCircle} label="Aiuto e contatti" />
          <MenuRow href="/novita"  icon={Sparkles} label="Novità" />
          <MenuRow href="/cestino" icon={Trash2} label="Cestino" desc="Documenti eliminati, recuperabili per 15 giorni" last />
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
            background: '#fff',
            boxShadow: '0 1px 2px rgba(20,20,40,.05)',
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
