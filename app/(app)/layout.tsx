import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { Suspense } from 'react'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { BootScreen } from '@/components/shared/BootScreen'
import { AppShell } from './_components/AppShell'
import { TourLoader } from '@/components/tour/TourLoader'
import { MiniTourLoader } from '@/components/tour/MiniTourLoader'
import { AppLock } from '@/components/security/AppLock'
import { LockVeil } from '@/components/security/LockVeil'
import { BiometricPrompt } from '@/components/security/BiometricPrompt'
import { NavTracker } from '@/components/shared/NavTracker'

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
  // BootScreen (condivisa con /avvio): marchio CC nello stesso punto
  // dell'icona di sistema + nome, motto e spinner. Nessuna durata fissa.
  return (
    <>
      {/* PRIMA di qualsiasi disegno: se l'app va bloccata, copre tutto con il
          fondo navy del lucchetto — senza, si vedeva la Home per un istante
          (Eli 4 ago). Vedi components/security/LockVeil.tsx. */}
      <LockVeil />
      <Suspense fallback={<BootScreen />}>
        <AppLayoutInner>{children}</AppLayoutInner>
      </Suspense>
    </>
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
      {/* Schermata di blocco dell'app (password o impronta): si mostra da sola
          solo se l'utente ha attivato "Blocca l'app quando esco" sul dispositivo. */}
      <AppLock userEmail={user.email ?? ''} />
      {/* Richiesta post-login "vuoi attivare lo sblocco con impronta?" — una
          volta per dispositivo, così non va cercata nelle Impostazioni. */}
      <BiometricPrompt />
      {/* Memoria dell'ultima pagina in-app: la freccia "indietro" (BackButton)
          decide con questa se restare nella cronologia o andare al fallback. */}
      <NavTracker />
    </AppShell>
  )
}
