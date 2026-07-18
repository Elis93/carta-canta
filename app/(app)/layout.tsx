import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { Suspense } from 'react'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { AppShell } from './_components/AppShell'
import { TourLoader } from '@/components/tour/TourLoader'
import { MiniTourLoader } from '@/components/tour/MiniTourLoader'

// ── Avvio in STREAMING (feedback Eli 17 lug: "6 secondi di splash, senza
// nemmeno lo spinner") ─────────────────────────────────────────────────
// Lo splash di sistema Android resta a schermo finché l'app non disegna il
// PRIMO frame. Prima, quel frame arrivava solo DOPO autenticazione + lettura
// workspace (più l'eventuale avvio a freddo del server): secondi di splash
// statico. Ora il layout manda subito un fallback navy con spinner oro —
// stessa tinta dello splash, quindi percepito come "lo splash che si muove" —
// mentre la parte autenticata arriva in streaming.
export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense fallback={<AppBoot />}>
      <AppLayoutInner>{children}</AppLayoutInner>
    </Suspense>
  )
}

/** Primo frame istantaneo (richiesta Eli 18 lug): marchio CC GRANDE nello
 *  stesso identico punto dell'icona dello splash di sistema Android, e sotto
 *  nome, motto e spinner — lo splash "si completa" mentre l'app carica.
 *  Nessuna durata fissa: sparisce appena la parte autenticata è pronta. */
function AppBoot() {
  return (
    <div
      aria-label="Caricamento"
      className="cc-zoom-neutral"
      style={{ position: 'fixed', inset: 0, background: '#1a1a2e' }}
    >
      {/* Marchio al centro esatto, taglia dell'icona di sistema */}
      <svg
        viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"
        style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 'min(50vw, 26vh, 230px)', height: 'min(50vw, 26vh, 230px)',
        }}
      >
        <path d="M342 133 A150 150 0 1 0 342 379" fill="none" stroke="#c9a44c" strokeWidth="38" strokeLinecap="round" />
        <path d="M307 175 A96 96 0 1 0 307 337" fill="none" stroke="#f3ede0" strokeWidth="30" strokeLinecap="round" />
      </svg>

      {/* Nome, motto e spinner sotto il marchio (il marchio non si sposta) */}
      <div
        style={{
          position: 'absolute', top: '50%', left: 0, right: 0,
          marginTop: 'calc(min(25vw, 13vh, 115px) + 26px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
        }}
      >
        <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 38, letterSpacing: '.01em' }}>
          <span style={{ color: '#f3ede0' }}>Carta </span>
          <span style={{ color: '#c9a44c' }}>Canta</span>
        </div>
        <div style={{ width: 140, height: 1, background: 'rgba(201,164,76,.5)', marginTop: -8 }} />
        <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: 'italic', fontSize: 19, color: '#c9a44c', marginTop: -6 }}>
          il tuo ufficio in tasca
        </div>
        <div className="cc-boot-spinner" style={{ marginTop: 6 }} />
      </div>
    </div>
  )
}

async function AppLayoutInner({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, workspace } = await getSessionWorkspace()

  // Il middleware garantisce che questa route group sia accessibile solo agli utenti
  // autenticati. Se user è null qui è un'anomalia (es. errore di rete verso Supabase
  // durante getUser(), o breve race condition nel refresh del token).
  //
  // NON redirezionare a /login: il middleware vede ancora l'utente come autenticato
  // (i cookie sono validi per lui) e reindirizzerebbe subito a /dashboard,
  // creando il loop  layout→/login→middleware→/dashboard→layout→/login.
  //
  // Propaghiamo invece un errore all'error boundary (app/(app)/error.tsx),
  // che mostra all'utente il pulsante "Riprova". Al secondo tentativo il token
  // è di solito già stato aggiornato correttamente.
  if (!user) {
    throw new Error(
      'Sessione non disponibile. Ricarica la pagina o rieffettua il login.'
    )
  }

  if (!workspace) redirect('/onboarding')

  // Onboarding incompleto → redirect, MA rispetta "Completa più tardi"
  // (cookie cc_onboarding_skip impostato dal bottone nell'onboarding).
  if (!workspace.ragione_sociale) {
    const skipped = (await cookies()).get('cc_onboarding_skip')?.value === '1'
    if (!skipped) redirect('/onboarding')
  }

  // Dati utente per header
  const fullName: string =
    user.user_metadata?.full_name ||
    `${user.user_metadata?.nome ?? ''} ${user.user_metadata?.cognome ?? ''}`.trim() ||
    user.email?.split('@')[0] ||
    'Utente'

  // Iniziali dall'azienda (coerenti con WorkspaceLogo) — NON dal nome account utente
  const displayName = workspace.ragione_sociale ?? workspace.name
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // Tutorial primo accesso: il flag arriva già col select('*') del workspace
  // condiviso (niente query extra). Tollerante: se la colonna 037 non esiste
  // ancora, il valore è undefined → tourDone=true (tour disattivato).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonna 037 non ancora in types/database.ts
  const tourDone = (workspace as any).onboarding_tour_done !== false

  return (
    <AppShell
      workspace={workspace}
      fullName={fullName}
      userEmail={user.email ?? ''}
      initials={initials}
    >
      {children}
      {/* AppSplash RIMOSSO (decisione Eli 17 lug): all'apertura resta solo lo
          splash di sistema Android (manifest: sfondo navy + icona CC grande).
          Il payoff "il tuo ufficio in tasca" NON è aggiungibile allo splash
          di sistema (accetta solo colore + icona): vive su landing e login. */}
      <Suspense fallback={null}>
        <TourLoader tourDone={tourDone} />
        <MiniTourLoader />
      </Suspense>
    </AppShell>
  )
}
