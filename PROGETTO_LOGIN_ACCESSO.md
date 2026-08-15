# Login e accesso — analisi e piano (15 ago 2026)

> ✅ **IMPLEMENTATO il 15 ago** (dopo «piano login ok» di Eli): P1 (onboarding
> crea il workspace se manca + «Esci»), P2 (guardia sessione: account
> inesistente → login), P3 (copy coerente: account Google mai «usa la password»,
> ma «esci e rientra con Google» — verificato con Chromium sui due varianti),
> P4 (tutorial non parte sopra il blocco). Da **collaudare sul telefono vero**
> (i flussi auth si provano solo su device). Le decisioni §3 restano la memoria.


> Nato dal collaudo di Eli del 15 ago: dopo aver cancellato a mano l'account su
> Supabase e rifatto il login, è rimasta **bloccata** su «Configura la tua
> attività» con «Workspace non trovato», senza modo di tornare al login; il
> blocco con impronta è ricomparso anche se l'account non esisteva più, e il
> tutorial è spuntato sopra la schermata di accesso.
>
> **Decisione di Eli: prima pianifichiamo bene, poi (dopo il suo ok) si
> implementa.** Questo file è la memoria da rileggere quando si parte.
> Il **2FA** è cosa separata (giro successivo, `CLAUDE.md` §Backlog).

---

## 1. I quattro problemi (causa reale)

**P1 — Trappola «Workspace non trovato».**
Un utente autenticato ma **senza workspace** (cancellato a mano, o creazione mai
avvenuta) finisce su `/onboarding`. Ma il salvataggio dell'onboarding
(`updateWorkspaceData`) fa `UPDATE workspaces WHERE id = workspace.id`: se il
workspace non esiste, `getSessionWorkspace` torna `null` → «Workspace non
trovato». E la pagina onboarding **non ha un «Esci»** → l'utente è intrappolato.

**P2 — Blocco con impronta anche ad account inesistente.**
Il blocco app è un flag **locale al dispositivo** (localStorage: `cc_lock`,
`cc_biometric`…), mostrato PRIMA e a prescindere dalla validità della sessione.
Cancellato l'account, la sessione è morta ma il lucchetto compare lo stesso.
Manca una verifica: «l'account esiste ancora?» → se no, niente lucchetto, vai al
login.

**P3 — Due schermate di blocco diverse + copy sbagliata per Google.**
`AppLock` ha due varianti: con password (account email) e senza (account solo
Google). Sulla variante Google, dopo un'impronta fallita, l'errore dice **«Usa
la password»** — ma una password non c'è. Eli l'ha vista: le dice di usare una
cosa che non ha, senza via d'uscita se non «Esci».

**P4 — Tutorial sopra il blocco/login.**
Il `TourController` parte su `pathname === '/dashboard'`. Quando l'app è
**bloccata**, il lucchetto copre `/dashboard` ma la rotta sotto È `/dashboard`
→ il tour parte lo stesso e compare **sopra** la schermata di blocco. Va
impedito che il tour parta mentre l'app è bloccata (o sul login).

⚠️ **Distinzione da tenere a mente:** la **pagina di login** (`/login`, nessuna
sessione: email+password o «Accedi con Google») è una cosa; la **schermata di
blocco** (`AppLock` «App bloccata», sessione valida ma app bloccata da lucchetto
di cortesia) è un'altra. La richiesta di Eli («una sola pagina») riguarda le due
**varianti del BLOCCO**, non il login vero.

---

## 2. Il disegno proposto (da confermare con Eli)

**A. Schermata di blocco UNICA** (base = terza foto di Eli):
- Titolo «App bloccata», sottotitolo che si adatta.
- **«Sblocca con l'impronta»** — solo se l'impronta è registrata su QUESTO
  dispositivo.
- **Sezione password** (campo + «Entra») — **solo per gli account che hanno una
  password** (email/password).
- **Account Google** (senza password): al posto del campo password, una riga
  «Questo account accede con Google» + un bottone **«Esci e rientra con
  Google»** (esce → `/login` → Google). **Mai** «usa la password».
- **«Esci dall'account»** sempre presente (secondario).
- **Copy coerente**: impronta fallita su account Google → «Impronta non
  riuscita. Esci e rientra con Google» (mai «usa la password»).

**B. Guardia di validità della sessione** (chiude P2): prima di mostrare il
lucchetto, `AppLock` verifica che l'account esista ancora (`getUser`). Se la
sessione/account non c'è più → **niente blocco, vai a `/login`**.

**C. Onboarding a prova di trappola** (chiude P1):
- Se un utente autenticato non ha workspace, **crearne uno vuoto** (così
  l'onboarding può salvare). ⚠️ Da decidere: crearlo al primo accesso (auth
  callback / `getSessionWorkspace`) oppure alla prima `updateWorkspaceData`
  (upsert per `owner_id`). La prima è più pulita.
- Aggiungere **«Esci»** sulla pagina onboarding (via di fuga sempre presente).

**D. Tutorial mai su blocco/login** (chiude P4): il tour non parte se l'app è
bloccata (`cc_lock` attivo) e ricontrolla dopo lo sblocco; mai su `/login`.
(Già c'è `TourCleanup` nel layout auth; qui serve la guardia sul lock.)

---

## 3. Decisioni da confermare (Eli)

1. Schermata di blocco **unica** come sopra — ok?
2. Account **Google**: «Esci e rientra con Google» al posto del campo password — ok?
3. Onboarding: **creare in automatico** un workspace vuoto per l'utente
   autenticato che non ne ha — ok? (alternativa: solo via di fuga + ri-registrazione)
4. Va bene che il tutorial **non parta mai** finché l'app è bloccata?

---

## 4. Sblocco IMMEDIATO per Eli (mentre pianifichiamo)

Per uscire dalla trappola ORA, sul telefono:
1. **Cancella i dati del sito** per `cartacanta.app` (Chrome → impostazioni sito
   → cartacanta.app → «Cancella e reimposta»): esce e toglie il lucchetto locale.
2. Su Supabase, **Authentication → Users**, cancella anche l'**utente** (non
   solo la riga workspace) col tuo indirizzo.
3. Ora `/login` è pulita: registrati di nuovo. ⚠️ Finché il codice non è
   sistemato (punto C), cancellare a mano solo il workspace e NON l'utente
   ricrea la trappola.

---

## 5. File toccati quando si implementa (mappa)
- `components/security/AppLock.tsx` — schermata di blocco unica + guardia sessione.
- `app/onboarding/page.tsx` + `lib/actions/workspace.ts` (`updateWorkspaceData`) —
  creazione workspace se mancante + «Esci».
- il punto di creazione workspace al primo accesso (auth callback / trigger) —
  da individuare.
- `components/tour/TourController.tsx` — guardia «non partire se bloccata».
