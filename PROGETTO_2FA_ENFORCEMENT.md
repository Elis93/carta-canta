# Chiusura del limite 2FA — enforcement AAL2 oltre le pagine

> Piano (15 ago 2026). **Non ancora implementato**: è un cambio SICUREZZA-critico
> al proxy, si fa dopo l'ok di Eli. Chiude il limite dichiarato nell'header di
> `lib/actions/mfa.ts`.

## Il problema (oggi)

Il 2FA è imposto SOLO a livello di **pagina**: il redirect a `/mfa` vive in
`app/(app)/layout.tsx`, che gira solo quando si RENDERIZZA una pagina. Ma:

- Le **server action** sono POST alla rotta della pagina: eseguono la mutazione
  **senza** ri-renderizzare il layout → il redirect non scatta.
- Le **API route** autenticate fanno il loro `getUser()` ma non guardano l'AAL.

Quindi un attaccante con la **sola password** di un account 2FA (sessione `aal1`)
è bloccato dall'interfaccia, ma potrebbe invocare direttamente action e route e
leggere/scrivere i dati senza mai passare da `/mfa`.

## L'idea: spostare il gate nel MIDDLEWARE (`proxy.ts`)

Il middleware gira su **ogni** richiesta, comprese le POST delle server action.
Mettendo lì il controllo AAL, un utente `aal1` che dovrebbe essere `aal2` viene
fermato PRIMA che l'azione esegua.

`proxy.ts` chiama già `supabase.auth.getUser()` (riga 104). Subito dopo, nel
ramo «utente autenticato», aggiungiamo:

```ts
// SOLO per le rotte dell'app (non pubbliche, non /login /signup /mfa):
// se la sessione è a un solo fattore ma l'account ne richiede due → /mfa.
if (isAppRoute(pathname)) {
  try {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aal && aal.currentLevel === 'aal1' && aal.nextLevel === 'aal2') {
      const url = request.nextUrl.clone(); url.pathname = '/mfa'; url.search = ''
      return makeRedirect(url, supabaseResponse)
    }
  } catch { /* FAIL-OPEN: un errore non deve chiudere fuori nessuno */ }
}
```

`isAppRoute` = autenticato, non pubblico, e diverso da `/mfa`, `/login`, `/signup`.

### Cosa copre e cosa no
- ✅ **Pagine** `(app)` — come oggi, ma ora ridondante col layout (cintura + bretelle).
- ✅ **Server action** — sono POST alla rotta della pagina → il middleware le vede.
- ⚠️ **API route**: nel middleware `/api/` è in `PUBLIC_PREFIXES` (ci sono endpoint
  pubblici: `/api/p/`, `/api/r/`, webhook, cron). Non si può bloccare in blocco.
  → Le API route che toccano dati utente vanno gate a parte (vedi Fase 2).

## Fasi

**Fase 1 — Middleware (il grosso del valore).**
1. `isAppRoute(pathname)` in `proxy.ts`.
2. Il blocco AAL qui sopra, **fail-open** in try/catch, redirect FUORI dal try.
3. Escludere esplicitamente `/mfa` (altrimenti loop) e le rotte auth.
4. Togliere/lasciare il gate del layout: lasciarlo come seconda cintura (innocuo).

**Fase 2 — API route autenticate.**
Un helper `requireAal2(supabase)` da chiamare nelle route che leggono/scrivono
dati utente (export CSV, bilancio, pdf documento, invio email, sdi, ecc.). Ritorna
403 se `aal1`+`aal2`-richiesto. Poche route sensibili → lista da enumerare.
(Alternativa: se la Fase 1 basta per il modello di minaccia di Eli, la Fase 2 può
restare un «nice to have».)

## Rischi e cautele (perché serve un giro dedicato)
- ⚠️ **Il proxy è sicurezza-critica**: un bug può chiudere fuori TUTTI o rompere il
  refresh dei cookie. Regola nota: niente codice che tocca i cookie tra
  `createServerClient` e `getUser()` — il blocco AAL va DOPO `getUser`, ok.
- ⚠️ **Latenza**: `getAuthenticatorAssuranceLevel()` legge i fattori. Da misurare;
  se pesa, si può leggere il claim `aal` direttamente dal JWT (senza giro DB) e
  interrogare i fattori solo quando serve. Idealmente il check parte solo se
  l'utente HA un fattore (altrimenti `nextLevel` è già `aal1`).
- ⚠️ **Fail-open obbligatorio**: come il layout, un errore di lettura AAL NON deve
  bloccare (al massimo non impone il 2FA). Nessuno resta chiuso fuori per un blip.
- ⚠️ **`/mfa` e le rotte auth escluse**: senza, loop di redirect.
- ⚠️ **Collaudo**: solo su device con un Authenticator vero. Casi:
  ① utente SENZA 2FA → naviga e usa le action normalmente (nessun redirect);
  ② utente con 2FA, sessione aal1 → OGNI pagina E ogni server action rimandano a
     `/mfa` finché non verifica; ③ dopo la verifica (aal2) → tutto normale;
  ④ un POST diretto a una server action a aal1 → bloccato dal middleware.

## Stato
- [ ] Fase 1 (middleware) — dopo ok Eli.
- [ ] Fase 2 (API route) — da decidere se serve.
