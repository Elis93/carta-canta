import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { Settings } from 'lucide-react'
import { ImpostazioniGenerali } from './tabs/generali'
import { ImpostazioniFiscali } from './tabs/fiscali'
import { ImpostazioniPagamenti } from './tabs/pagamenti'
import { ImpostazioniNotifiche } from './tabs/notifiche'
import type { NotificationPrefs } from '@/lib/actions/workspace'
import { BackButton } from '@/components/shared/BackButton'

// NB: tab "Team" temporaneamente nascosto (piano Team non disponibile).
// Il componente ImpostazioniTeam e getWorkspaceMembers restano nel codice per
// quando il piano Team verrà riattivato.
// NB: la tab "Dati" è diventata la pagina /account ("Account e dati" in
// Altro) — 6 tab schiacciavano la barra su mobile (richiesta Eli 14 lug).
// ⚠️ La tab "Piano" NON c'è più (Eli, 7 ago): duplicava la voce
// "Abbonamento" di Altro, che è la pagina vera. `?tab=piano` reindirizza lì,
// così i vecchi collegamenti continuano a funzionare.
const NAV_ITEMS = [
  { value: 'generale',  label: 'Generale'  },
  { value: 'fiscale',   label: 'Fiscale'   },
  { value: 'pagamenti', label: 'Pagamenti' },
  { value: 'notifiche', label: 'Notifiche' },
] as const

type TabValue = (typeof NAV_ITEMS)[number]['value']

export default async function ImpostazioniPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  // La vecchia tab "Dati" vive ora in /account: eventuali link salvati continuano a funzionare
  if (tab === 'dati') redirect('/account')
  if (tab === 'piano') redirect('/abbonamento')
  const activeTab: TabValue = (NAV_ITEMS.find((t) => t.value === tab)?.value ?? 'generale')
  const { user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/login')

  // Estrai e valida le preferenze notifiche dal workspace
  const rawPrefs = workspace.notification_prefs as Record<string, unknown> | null
  const notifPrefs: NotificationPrefs | null = rawPrefs
    ? {
        preventivo_accettato: rawPrefs.preventivo_accettato !== false,
        preventivo_rifiutato: rawPrefs.preventivo_rifiutato !== false,
        preventivo_scaduto:   rawPrefs.preventivo_scaduto   !== false,
        reminder_cliente:     rawPrefs.reminder_cliente     !== false,
        followup_auto:        rawPrefs.followup_auto        === true,
        inapp_visto:          rawPrefs.inapp_visto          !== false,
        inapp_acconto:        rawPrefs.inapp_acconto        !== false,
        inapp_richiamo:       rawPrefs.inapp_richiamo       !== false,
        inapp_richiesta:      rawPrefs.inapp_richiesta      !== false,
        inapp_preventivo_fermo: rawPrefs.inapp_preventivo_fermo !== false,
        inapp_messaggio:      rawPrefs.inapp_messaggio      !== false,
        inapp_sdi_scarto:       rawPrefs.inapp_sdi_scarto       !== false,
        inapp_sdi_trasmissione: rawPrefs.inapp_sdi_trasmissione !== false,
      }
    : null

  return (
    <div className="max-w-4xl mx-auto">

      {/* ── Header mobile ── */}
      <div
        className="lg:hidden flex items-center"
        style={{ background: '#fff', borderBottom: '2px solid #c9a44c', gap: 10, padding: '12px 15px' }}
      >
        <BackButton fallback="/altro" />
        <span style={{ flex: 1, fontSize: 18, fontWeight: 600, fontFamily: "Georgia, 'Times New Roman', serif", color: '#1a1a2e' }}>Impostazioni</span>
        <span style={{ width: 24 }} />
      </div>

      {/* Intestazione desktop */}
      <div className="hidden lg:flex items-center gap-3 min-w-0 p-4 md:p-8 pb-0 md:pb-0">
        <Settings className="size-6 text-primary shrink-0" />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Impostazioni</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Dati dell’attività, impostazioni fiscali, coordinate di pagamento e notifiche.
          </p>
        </div>
      </div>

      {/* ── Barra delle sezioni — PILLOLE, come i filtri di stato dei
          preventivi (Eli, 7 ago: "vorrei che questi titoli siano gestiti come
          le sezioni dentro a preventivi, come fossero tipo pillole").
          Sono collegamenti veri (`?tab=`), non stato del browser: la sezione
          scelta finisce nell'indirizzo, quindi si può condividere, mettere nei
          preferiti e il tasto Indietro fa quello che ci si aspetta. Rende
          anche la pagina più leggera, perché si carica solo la sezione
          aperta invece di tutte e quattro. */}
      <div className="px-[15px] lg:px-8">
        <div className="cc-tabs cc-filter-scroll cc-tabs-equal" style={{ marginTop: 14 }}>
          {NAV_ITEMS.map(({ value, label }) => (
              // ⚠️ `replace`: cambiare sezione NON deve impilare una voce nella
              // cronologia, altrimenti dopo aver girato fra le sezioni il tasto
              // Indietro le ripercorre tutte invece di riportare in Altro
              // (Eli, 7 ago). Sostituendo la voce corrente, Indietro torna
              // sempre da dove si è entrati.
            <Link
              key={value}
              replace
              href={value === 'generale' ? '/impostazioni' : `/impostazioni?tab=${value}`}
              className={activeTab === value ? 'cc-tab-active' : 'cc-tab'}
              style={{ textDecoration: 'none', display: 'block' }}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* ── Contenuto ──
          pb-12 su mobile: aria in fondo a OGNI sezione — senza, l'ultimo
          bottone finisce sotto il "+" della barra in basso (Eli 2 ago sera) */}
      <div className="px-[15px] pb-12 lg:px-8 lg:pb-8">
        {activeTab === 'generale'  && <ImpostazioniGenerali workspace={workspace} />}
        {activeTab === 'fiscale'   && <ImpostazioniFiscali workspace={workspace} />}
        {activeTab === 'pagamenti' && <ImpostazioniPagamenti workspace={workspace} />}
        {activeTab === 'notifiche' && <ImpostazioniNotifiche initialPrefs={notifPrefs} />}
      </div>

    </div>
  )
}
