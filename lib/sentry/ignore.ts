// ── Errori NOTI e BENIGNI che NON devono generare un'email Sentry ───────────
//
// Questi due si auto-risolvono da soli: mandarne una notifica a ogni occorrenza
// allena solo a ignorare Sentry (e a perdere gli errori VERI in mezzo al rumore).
// Sono filtrati da un'UNICA fonte in tutte e tre le init (client, server, edge)
// così le tre copie non divergono.
//
// ⚠️ Non aggiungere qui un errore solo perché è fastidioso: ci vanno SOLO quelli
// che si risolvono da sé senza intervento e di cui conosciamo già la causa. Un
// errore reale nascosto qui sparisce dai radar.

export const SENTRY_IGNORED_ERRORS: (string | RegExp)[] = [
  // «Failed to find Server Action. This request might be from an older or newer
  // deployment.» — una pagina aperta ATTRAVERSO un deploy chiama una Server
  // Action il cui id è ruotato. Next.js la considera recuperabile: si risolve
  // ricaricando. Noi pubblichiamo su master a ogni commit → capita a chi tiene
  // la PWA aperta su una build vecchia. Nessun bug da correggere.
  'Failed to find Server Action',

  // «Sessione non disponibile. Ricarica la pagina o rieffettua il login.» —
  // anomalia TRANSITORIA del refresh del token (tipica al rientro dal background
  // su mobile): per un istante l'utente risulta null. Il layout (app) rilancia
  // con il pulsante «Riprova» e al secondo tentativo il token è già aggiornato.
  // Vedi app/(app)/layout.tsx. Un blocco PERSISTENTE dell'auth si vedrebbe
  // comunque (l'app diventa inutilizzabile e da decine di altri errori), quindi
  // silenziare questo non ci rende ciechi sul caso vero.
  'Sessione non disponibile',
]
