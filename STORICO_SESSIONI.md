# STORICO SESSIONI — Carta Canta

> Archivio dei handoff e riepiloghi di sessione spostati da CLAUDE.md (consolidamento documentazione, 14 giugno 2026). Contenuto integrale, nessuna perdita.

---

## A. HANDOFF — SESSIONE ORDINE-INDIRIZZO (13 giugno 2026)

### Fix applicato (commit `fix(indirizzo): ordine campi Città → Provincia → CAP in clienti, impostazioni, onboarding`)

**Ordine campi indirizzo: Città → Provincia → CAP (decisione mobile, estesa a desktop)**
- Tutti e tre i form che usano `useComuneLookup` avevano l'ordine CAP → Città → Provincia. Riordinati a Città → Provincia → CAP come da `DECISIONI_REDESIGN_MOBILE.md` sezione F.
- `ClientForm.tsx`: griglia `grid-cols-3` — riordinate label e input div (CAP ha `space-y-1` con errore inline, Provincia ha `space-y-1` con errore inline — entrambi mantenuti intatti, solo spostati).
- `impostazioni/tabs/generali.tsx`: griglia `grid-cols-3` — riordinati i tre div `space-y-1.5`.
- `onboarding/page.tsx`: campi impilati verticalmente — riordinati i tre div `space-y-1.5`.
- Autofill invariato: `useComuneLookup` usa state indipendenti (`cap`, `citta`, `provincia`) collegati ai rispettivi handler — nessun coupling all'ordine DOM.

### File toccati (sessione ORDINE-INDIRIZZO)
```
app/(app)/clienti/_components/ClientForm.tsx        [Città→Provincia→CAP nei label e input]
app/(app)/impostazioni/tabs/generali.tsx            [Città→Provincia→CAP nei div col]
app/onboarding/page.tsx                             [Città→Provincia→CAP nei div]
DECISIONI_REDESIGN_MOBILE.md                        [sezione F: ordine applicato → ✅]
CLAUDE.md                                           [aggiornato]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi
- Verifica per ispezione codice: `useComuneLookup` è puramente state-based (hook verificato — 3 `useState` indipendenti, nessuna dipendenza dall'ordine DOM); i `name`/`id` dei campi invariati (submit non cambia).
- **Non testato in browser reale**: ordine visivo corretto; autofill CAP→città+prov e città→CAP+prov ancora funzionante.

### Esito finale
🟡 FIX APPLICATO — riordino visivo puro, logica invariata, tsc+build+test verdi. Da verificare in browser: i tre form mostrano Città, Provincia, CAP in quest'ordine; digitare un CAP riempie città+provincia; digitare una città riempie CAP+provincia.

---

## A. HANDOFF — SESSIONE FIX-POPUP-CLICK-2 (13 giugno 2026)

### Fix applicato (commit `fix(invio): tendina suggerimenti cliccabile dentro il dialog (pointer-events)`)

**BUG-MOB-1 / T-18 — 2° tentativo: causa reale `pointer-events: none` ereditato dal body**
- Contesto: il 1° fix (FIX-POPUP-CLICK) bloccava il dismiss di Radix Dialog al click sulla tendina (`onPointerDownOutside`+`preventDefault`), ma NON risolveva il click nel browser reale — "come se ci fosse uno strato protettivo davanti".
- Causa reale confermata: Radix Dialog con `modal={true}` (default) usa `@radix-ui/react-dismissable-layer` con `disableOutsidePointerEvents={true}` → chiama `disableBodyPointerEvents()` → imposta `document.body.style.pointerEvents = 'none'` sul body element. La tendina `<ul>` portata su `document.body` via `createPortal` eredita `pointer-events: none` dal body → è visibile (z-index 9999 > overlay z-50) ma non riceve NESSUN evento pointer/click. `onMouseDown` non scattava proprio perché l'elemento era non-interattivo, non per il dismiss.
- Fix (Opzione B — minimal): aggiunto `pointerEvents: 'auto'` all'inline style dell'`<ul>` portale. CSS `pointer-events` non "pierces through" un `none` sul parent — un elemento figlio può sovrascriverlo con `auto`. Il `data-dropdown-portal` + `onPointerDownOutside`→`preventDefault` del fix precedente rimangono: servono a bloccare il dismiss di Radix quando il click avviene sulla tendina (che ora riceve eventi).

### File toccati (sessione FIX-POPUP-CLICK-2)
```
app/(app)/preventivi/_components/SendEmailDialog.tsx   [pointerEvents: 'auto' sull'<ul> ClientSearchInput]
components/shared/ClientAutocomplete.tsx               [pointerEvents: 'auto' sull'<ul> portale]
DECISIONI_REDESIGN_MOBILE.md                           [BUG-MOB-1 → 🟡 fix 2°, da verificare]
DECISIONI_E_FEEDBACK.md                               [T-18 aggiornato con FIX-POPUP-CLICK-2]
CLAUDE.md                                             [aggiornato]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi
- Verifica per ispezione codice: `pointerEvents: 'auto'` come inline style ha specificità massima — sovrascrive l'ereditato `none` dal body; la proprietà CSS `pointer-events` non ha effetto "piercing" (un nodo figlio con `auto` è indipendente dal `none` sul padre); z-index 9999 della tendina è sopra l'overlay shadcn (z-50 = 50). I bottoni dentro la `<ul>` ereditano `pointer-events: auto` dalla `<ul>` stessa.
- **Non testato in browser reale**: clic su suggerimento nel popup → cliente selezionato; scroll tendina; dismiss via Esc e click fuori.

### Esito finale
🟡 FIX APPLICATO — causa reale confermata (`disableBodyPointerEvents()` di Radix DismissableLayer, non il dismiss), fix chirurgico (1 proprietà CSS per file), tsc+build+test verdi. Da verificare manualmente da Eli: nel popup "Invia al cliente" digitare una lettera → cliccare un suggerimento → cliente selezionato; scroll della tendina ok; dialog si chiude ancora con Esc e click fuori.

---

## A. HANDOFF — SESSIONE FIX-POPUP-CLICK (13 giugno 2026)

### Fix applicato (commit `fix(invio): suggerimenti cliente cliccabili e scorribili nel popup`)

**BUG-MOB-1 / T-18 — Popup invio: suggerimenti compaiono ma non si cliccano**
- Causa confermata: `DismissableLayer` interno a Radix `Dialog` intercetta tutti i `pointerdown` su elementi FUORI dal DOM del dialog. La tendina (`<ul>`) è renderizzata via `createPortal` su `document.body` (FIX-16, per evitare il clipping dall'`overflow-y-auto` del `DialogContent`) → Radix la vede come "pointerdown outside" → chiude il dialog PRIMA che `onMouseDown` sul bottone lista possa completare la selezione. Il cliente non veniva mai selezionato.
- Fix: due modifiche minimal e chirurgiche:
  1. `data-dropdown-portal` aggiunto all'attributo `<ul>` della tendina in `ClientSearchInput` (`SendEmailDialog.tsx`) — marcatore CSS che identifica la tendina come "parte logica del dialog anche se fuori dal DOM".
  2. `onPointerDownOutside` aggiunto al `<DialogContent>`:
     ```tsx
     onPointerDownOutside={(e) => {
       if ((e.target as HTMLElement).closest?.('[data-dropdown-portal]')) {
         e.preventDefault()
       }
     }}
     ```
     Quando il click è dentro la tendina, `e.preventDefault()` blocca il dismiss di Radix — l'`onMouseDown` del bottone lista scatta normalmente e il cliente viene selezionato.
  3. Stesso attributo `data-dropdown-portal` aggiunto alla `<ul>` di `ClientAutocomplete.tsx` per coerenza (il componente non è mai dentro un Dialog oggi, ma se in futuro lo fosse il fix funzionerà automaticamente).
- Scroll e nome intero: la `<ul>` aveva già `max-h-64 overflow-y-auto` (FIX-16) — lo scroll era già corretto strutturalmente, il problema era solo che il click chiudeva il dialog prima che l'utente potesse scrollare. Con il fix il dismiss bloccato, anche lo scroll ora funziona.

### File toccati (sessione FIX-POPUP-CLICK)
```
app/(app)/preventivi/_components/SendEmailDialog.tsx   [data-dropdown-portal su <ul> ClientSearchInput; onPointerDownOutside su DialogContent]
components/shared/ClientAutocomplete.tsx               [data-dropdown-portal su <ul> portale]
DECISIONI_REDESIGN_MOBILE.md                           [BUG-MOB-1 → 🟡 fix applicato, da verificare]
DECISIONI_E_FEEDBACK.md                               [T-18 aggiornato con FIX-POPUP-CLICK]
CLAUDE.md                                             [aggiornato]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi
- Verifica per ispezione codice: `closest('[data-dropdown-portal]')` non può dare falsi positivi perché l'attributo è specifico e non usato altrove; `e.preventDefault()` su `onPointerDownOutside` non blocca la chiusura via Esc o click fuori dalla tendina (quelli non passano per `onPointerDownOutside`); logica `useCloseOnOutsideMouseDown` in `dropdown-portal.ts` gestisce la chiusura corretta su click fuori.
- **Non testato in browser reale**: selezionare un suggerimento nel popup invio → cliente selezionato; scrollare la tendina; no regressione su dismiss dialog via Esc/click fuori.

### Esito finale
🟡 FIX APPLICATO — causa confermata (DismissableLayer di Radix intercetta pointerdown sul portale), fix chirurgico (2 attributi + 1 handler), tsc+build+test verdi. Da verificare manualmente in browser da Eli: clic su suggerimento nel popup → cliente selezionato; scroll tendina funzionante; dismiss dialog via Esc e click fuori ancora funzionante.

---

## A. HANDOFF — SESSIONE DATA_CONTESTUALE_GRAMMATICA (12 giugno 2026)

### Fix applicato (commit `fix(liste): grammatica femminile per le fatture nella data contestuale (bozza)`)

**Grammatica femminile nel branch `draft` di `getContextualDate`**
- `lib/utils/document-date.ts`: il branch finale (bozza/stato non previsto) ritornava sempre `"Modificato il {updated_at}"` al maschile fisso. Ora: fattura → `"Modificata il …"`, preventivo → `"Modificato il …"`, coerente con tutti gli altri stati già differenziati per genere.
- Verifica completa dell'helper: expired ("Scaduta/Scaduto"), accepted ("Pagata/Accettato"), rejected ("Annullata/Rifiutato"), sent/viewed ("Inviata/Inviato") — tutti già corretti, nessuna altra incongruenza trovata.

### File toccati (sessione DATA_CONTESTUALE_GRAMMATICA)
```
lib/utils/document-date.ts      [branch draft: "Modificata" per fattura, "Modificato" per preventivo]
DECISIONI_E_FEEDBACK.md         [voce DATA_CONTESTUALE aggiornata con nota grammatica]
CLAUDE.md                       [aggiornato]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde
- Verifica per ispezione codice: tutti gli stati in `getContextualDate` differenziati per `docType`; nessun cambio alla logica data/urgenza.
- **Non testato in browser reale**: fattura bozza → "Modificata il …"; preventivo bozza → "Modificato il …".

### Esito finale
🟡 FIX APPLICATO — fix a una riga, tsc+build verdi. Da verificare in browser: una fattura bozza deve mostrare "Modificata il …" nella lista.

---

## A. HANDOFF — SESSIONE FATTURE_FILTRI_STATO (12 giugno 2026)

### Feature implementata (commit `feat(fatture): tab di stato (Tutte/Bozze/Inviate/Pagate/Annullate) come in preventivi`)

**Tab di stato sulla lista Fatture**
- `app/(app)/fatture/page.tsx`: aggiunto `status?: string` ai searchParams; definito `STATUS_TABS` (Tutte/"" | Bozze/draft | Inviate/inviate | Pagate/accepted | Annullate/rejected); filtro applicato alla query Supabase in AND con q/filtri avanzati (`inviate` → `.in('status', ['sent','viewed'])`); tab bar con stesso markup/stile/classi di `preventivi/page.tsx`; `else if (!hasFilters && !status)` per il limit(100) (non limitare con tab attivo); empty state contestuale per ogni tab (`STATUS_EMPTY_LABELS`) senza CTA fuorviante; conteggio "N risultato/i" quando `status` è attivo.

### File toccati (sessione FATTURE_FILTRI_STATO)
```
app/(app)/fatture/page.tsx          [STATUS_TABS + filtro + tab bar JSX + empty state + count]
DECISIONI_E_FEEDBACK.md             [nuova voce ✅ "Filtri di stato anche su Fatture"]
CLAUDE.md                           [aggiornato]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- Verifica per ispezione codice: filtro `inviate` → `.in('status', ['sent','viewed'])`; limit(100) rimosso quando `status` presente; tab attivo evidenziato con `bg-primary text-primary-foreground`; link "Tutte" → `/fatture` (no querystring), altri → `/fatture?status=<value>`.
- **Non testato in browser reale**: clic sui tab → lista filtrata; ricerca testuale + tab in combinazione.

### Esito finale
🟡 FEATURE APPLICATA — tsc+build verdi. Da verificare manualmente in browser da Eli: tab Tutte/Bozze/Inviate/Pagate/Annullate filtrano la lista correttamente; ricerca e filtri avanzati funzionano in combinazione con i tab.

---

## A. HANDOFF — SESSIONE DATA_CONTESTUALE (12 giugno 2026)

### Feature implementata (commit `feat(liste): data contestuale allo stato in preventivi e fatture`)

**Data contestuale nelle liste preventivi e fatture**
- **Problema**: le liste mostravano sempre `created_at` (data di creazione) — ambigua e non informativa.
- **Fix**: la data accanto a ogni documento è ora contestuale allo stato, con etichetta.

**Logica (helper condiviso `lib/utils/document-date.ts`):**

| Stato | Preventivo | Fattura |
|---|---|---|
| `expired` / `expires_at` passata | "Scaduto il {expires_at}" | "Scaduta il {expires_at}" |
| `accepted` | "Accettato il {accepted_at ?? updated_at}" | "Pagata il {accepted_at ?? updated_at}" |
| `rejected` | "Rifiutato il {sent_at ?? updated_at}" | "Annullata il {updated_at}" |
| `sent`/`viewed` + `expires_at` ≤7gg | "Scade oggi" / "Scade tra N g" (rosso) | idem |
| `sent`/`viewed` + `expires_at` >7gg | "Scade il {data}" | idem |
| `sent`/`viewed` senza scadenza | "Inviato il {sent_at}" | "Inviata il {sent_at}" |
| `draft` | "Modificato il {updated_at}" | "Modificato il {updated_at}" |

- Formato data: `toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })` → "7 lug"
- Colore urgenza: `text-red-600` quando `urgent: true` (≤7 giorni alla scadenza)
- Badge "Modificato" (`updated_after_send_at`) invariato e separato
- Vecchio `"Scaduto"` inline (span ambra nella lista preventivi) rimosso: ora assorbito dalla data contestuale

**Select Supabase aggiornate:**
- `preventivi/page.tsx`: aggiunti `accepted_at, updated_at`
- `fatture/page.tsx`: aggiunti `sent_at, expires_at, accepted_at, updated_at`

### File toccati (sessione DATA_CONTESTUALE)
```
lib/utils/document-date.ts             [NUOVO — getContextualDate helper condiviso]
app/(app)/preventivi/page.tsx          [import, select +accepted_at+updated_at, dateInfo nel loop, rendering data]
app/(app)/fatture/page.tsx             [import, select +sent_at+expires_at+accepted_at+updated_at, dateInfo nel loop, rendering data]
DECISIONI_E_FEEDBACK.md               [nuova voce "Data contestuale"]
CLAUDE.md                              [aggiornato]
```

### Migration: No (tutti i campi esistono già nello schema `documents`)

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi
- Verifica per ispezione codice: `isExpired` in `preventivi/page.tsx` rimane per `StatusBadge`; vecchio span "Scaduto" rimosso; `dateInfo.urgent` è `true` solo per `sent`/`viewed` con `expires_at` ≤7 giorni futuri.
- **Non testato in browser reale**: verificare che ogni documento mostri la data corretta per il suo stato.

### Esito finale
🟡 FEATURE APPLICATA — helper condiviso, select aggiornate, logica contestuale, tsc+build+test verdi. Da verificare in browser: preventivo accettato → "Accettato il…"; inviato in scadenza → "Scade tra N g" (rosso); bozza → "Modificato il…"; fattura pagata → "Pagata il…".

---

## A. HANDOFF — SESSIONE PERF-01 (12 giugno 2026)

### Ottimizzazioni applicate (commit `perf: parallelizza query pagine dettaglio + diagnosi cold start`)

**T-9/T-22 — Lentezza caricamento pagine (diagnosi + fix)**

**Diagnosi eseguita:**
- Route bundle: nessuna route con first-load JS eccessivo. Pagine principali (preventivi, fatture, dashboard) non importano moduli pesanti.
- `@sparticuz/chromium` e `puppeteer-core`: presenti solo in `app/api/ai/extract/route.ts` e `lib/ai/pdf-to-image.ts` (dynamic import) — non impattano le pagine.
- `lib/data/comuni.ts`: usato solo da `hooks/useComuneLookup.ts` (client-side hook, non blocca SSR).
- Cold start ~20s su fatture: è un limite Vercel serverless (funzioni cold). Le pagine principali non importano Chromium → warm ping non implementato; documentato come limite da monitorare.

**Parallelizzazioni applicate con `Promise.all`:**

1. **`app/(app)/preventivi/page.tsx`**: ricerca (`matchingClients`+`matchingItems`) + post-lista (`convertedRows`+`viewRows`+`counts`) — da 5 await sequenziali a 2 batch paralleli
2. **`app/(app)/fatture/page.tsx`**: ricerca (`matchingClients`+`matchingItems`) — da 2 await sequenziali a 1 batch
3. **`app/(app)/clienti/[id]/page.tsx`**: `client`+`documents` — da 2 sequenziali a 1 batch; `notFound()` dopo `Promise.all`
4. **`app/p/[token]/page.tsx`**: `isOwner`+`getUserById` — da 2 chiamate auth sequenziali (con try/catch) a `Promise.all` con async IIFE; `workspace` spostato prima del blocco parallelo; vecchio blocco `getUserById` rimosso

**Già parallelizzate in FIX-14:** `preventivi/[id]`, `fatture/[id]`, `dashboard` — non ri-toccate.

### File toccati (sessione PERF-01)
```
app/(app)/preventivi/page.tsx          [Promise.all: ricerca + post-lista]
app/(app)/fatture/page.tsx             [Promise.all: ricerca]
app/(app)/clienti/[id]/page.tsx        [Promise.all: client+documents]
app/p/[token]/page.tsx                 [Promise.all: isOwner+getUserById]
DECISIONI_E_FEEDBACK.md               [T-9/T-22 → ✅]
CLAUDE.md                              [aggiornato]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi (nessuna regressione)
- Verifica per ispezione codice: tutte le parallelizzazioni tra query indipendenti; `Promise.resolve` come fallback per `viewRows` su lista vuota mantiene il tipo invariato.
- **Non testato in browser reale**: caricamento pagine, specialmente ricerca in preventivi/fatture e pagina pubblica.

### Esito finale
🟡 PERF APPLICATA — parallelizzazioni sicure, tsc+build+test verdi. Da verificare in produzione: tempi di caricamento migliorati.

---

## A. HANDOFF — SESSIONE FIX-20 (12 giugno 2026)

### Fix applicato (commit `fix(invio): suggerimenti popup allineati al form (stessi campi di ricerca)`)

**T-18 — Popup mostra meno suggerimenti del form per la stessa lettera**
- Causa confermata: `filterClients` in `SendEmailDialog.tsx`, branch `field === 'name'`, cercava solo `nome + cognome` — il form (`ClientAutocomplete.tsx`, FIX-18) invece cerca `nome + cognome + email` insieme. Un cliente trovabile dall'email nel form non compariva nel popup.
- Fix: nel branch `name` aggiunto fallback sull'email (same pattern del form):
  ```
  if (full.includes(q)) return true
  return c.email ? c.email.toLowerCase().includes(q) : false
  ```
  Campo `email` rimane specifico sull'email (input email, ricerca mirata — coerente). Limite max risultati: 8 per entrambi (invariato). `preloadClientsAction` restituisce fino a 200 clienti in entrambi — stesso dataset.

### File toccati (sessione FIX-20)
```
app/(app)/preventivi/_components/SendEmailDialog.tsx  [filterClients branch 'name': aggiunto fallback email]
DECISIONI_E_FEEDBACK.md                               [T-18 aggiornato con FIX-20]
CLAUDE.md                                             [aggiornato]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde
- `npm test -- --run` → 178/178 verdi

### Esito finale
🟡 FIX APPLICATO — causa confermata, fix a una riga, tsc+build+test verdi. T-18 resta 🟡 "da riconfermare nel browser" finché Eli verifica che popup e form mostrano gli stessi suggerimenti per la stessa lettera.

---

## A. HANDOFF — SESSIONE FIX-19 (12 giugno 2026)

### Fix applicato (commit `fix(invio): precarica clienti nel popup via useEffect (suggerimenti popup)`)

**T-18 — Suggerimenti nel popup invio assenti (allClients sempre vuoto)**
- Causa confermata: `preloadClientsAction()` era chiamata solo dentro `handleOpenChange` (righe ~333-334), che scatta per apertura manuale ma **non** per apertura automatica (`initialOpen=true`, `?send=1` via `SendEmailDialogController`). In quel caso `allClients` restava `[]` e `filterClients` non restituiva risultati.
- Fix: aggiunto `useEffect([open, hasClient])` in `SendEmailDialog.tsx` (dopo il `useEffect` T-19 per `?send`) che chiama `preloadClientsAction().then(setAllClients)` quando: dialog aperto + `!hasClient` + `allClients.length === 0`. Guard `allClients.length > 0` evita doppie fetch in aperture manuali successive (dove `handleOpenChange` ha già popolato la lista). Dipendenza da `allClients` esclusa dai deps con `eslint-disable` per evitare loop.
- La chiamata esistente in `handleOpenChange` è lasciata come fast-path per l'apertura manuale (carica prima del render del portale).

### File toccati (sessione FIX-19)
```
app/(app)/preventivi/_components/SendEmailDialog.tsx  [useEffect([open, hasClient]) per preloadClientsAction]
DECISIONI_E_FEEDBACK.md                               [T-18 aggiornato con FIX-19]
CLAUDE.md                                             [aggiornato]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde
- `npm test -- --run` → 178/178 verdi
- Verifica per ispezione codice: `useEffect` reagisce a `[open, hasClient]`; guard `allClients.length > 0` evita doppie fetch; `initialOpen=true` → dialog `open` al mount → `useEffect` scatta subito.
- **Non testato in browser reale**: aprire popup invio su documento senza cliente (sia manualmente sia via `?send=1`) → digitare 1 lettera → suggerimenti compaiono.

### Esito finale
🟡 FIX APPLICATO — causa confermata (handleOpenChange non scatta su initialOpen), fix coerente, tsc+build+test verdi. T-18 resta 🟡 "da riconfermare nel browser" finché Eli verifica il popup.

---

## A. HANDOFF — SESSIONE FIX-14 (12 giugno 2026)

### Fix applicato (commit `fix(ux): messaggio template non fuorviante + banner free discreto`)

**T-21a — "Nessun template disponibile" fuorviante (preventivi/[id]/page.tsx)**
- Causa confermata: il banner giallo con `AlertTriangle` compariva quando `!templates || templates.length === 0`, ma il form usa sempre il Classico come default — l'avviso era falso/allarmante.
- Fix: sostituito il box giallo con `<p className="text-xs text-muted-foreground">` che informa neutralmente dell'uso del Classico con link a `/template/nuovo`. Nessun `AlertTriangle`, nessun colore di allerta.
- `fatture/[id]/page.tsx`: non aveva questo avviso — nessuna modifica necessaria.

**T-21b — Banner quota Free non bloccante troppo prominente**
- Causa: box `border-blue-200 bg-blue-50 text-blue-800` con icona `Info` — visivamente simile ai banner di errore.
- Fix: sostituito con `<p className="text-xs text-muted-foreground">` — solo testo piccolo muted. Il banner bloccante (limite raggiunto) resta rosso con `AlertTriangle` (invariato).

**T-21c — Posizione "Invia al cliente" (valutazione)**
- Valutazione: il bottone "Invia" è in fondo al form in creazione e nella toolbar in dettaglio — struttura corretta per due schermate distinte. Nessun micro-fix necessario.

**Bonus: parallelizzazione query (pagine dettaglio)**
- `preventivi/[id]/page.tsx`: due `Promise.all` — (1) doc+templates in parallelo al caricamento workspace; (2) pdfClient+fatturaOrigin+views in parallelo dopo doc.
- `fatture/[id]/page.tsx`: due `Promise.all` — stessa struttura.
- `dashboard/page.tsx`: `Promise.all` per allDocs + oldestPendingRaw.
- Riduzione latenza stimata ~30-60% sulle pagine di dettaglio (più round-trip Supabase → DB in parallelo invece che sequenziali).

### File toccati (sessione FIX-14)
```
app/(app)/preventivi/[id]/page.tsx    [T-21a: banner template → testo muted; T-21b: banner free → testo muted; parallelizzazione query]
app/(app)/fatture/[id]/page.tsx        [parallelizzazione query]
app/(app)/dashboard/page.tsx           [parallelizzazione query]
DECISIONI_E_FEEDBACK.md               [T-21a/b/c → ✅/ℹ️]
CLAUDE.md                              [aggiornato]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde (nessun errore)
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi (nessuna regressione)
- Verifica per ispezione codice: T-21a confermato (banner giallo rimosso, testo muted); T-21b confermato (box blu → testo muted, rosso bloccante invariato); parallelizzazione verificata logicamente (query indipendenti in Promise.all).
- **Non testato in browser reale**: (1) bozza senza template → nessun banner allarmante giallo; (2) piano Free su bozza → promemoria quota discreto (non box colorato); (3) caricamento pagina dettaglio più veloce.

### Esito finale
🟡 FIX APPLICATO — causa confermata, fix coerente con i criteri di accettazione, tsc+build+test verdi. Da verificare manualmente in browser da Eli: i 3 punti sopra.

---

## A. HANDOFF — SESSIONE FIX-18 (12 giugno 2026)

### Fix applicato (commit `fix(invio): ricerca cliente istantanea nel form (filtro in memoria)`)

**T-18 — Suggerimenti cliente nel form si "aggiornano" dopo ~1s (effetto ricaricamento)**
- Causa confermata: `components/shared/ClientAutocomplete.tsx` chiamava `searchClientsAction` (server action) a ogni tasto con debounce 300ms — i risultati arrivavano in ritardo e la lista si ri-renderizzava, dando l'impressione di un "refresh".
- Fix: allineato al pattern già usato nel popup invio (`ClientSearchInput` in `SendEmailDialog.tsx`):
  - `ClientAutocomplete` precarica i clienti del workspace **una sola volta al mount** via `preloadClientsAction` (già usata dal popup, fino a 200 clienti).
  - Nuovo helper `filterClients(query, clients)` — filtro in memoria "contiene" case-insensitive su nome+cognome+email, max 8 risultati, soglia 1 carattere (coerente con FIX-17).
  - Rimossi: stato `loading`, debounce, chiamata `search()`/`searchClientsAction` dal componente. `searchClientsAction` resta in `lib/actions/clients.ts` per altri usi (non più referenziata da questo file).
  - Tendina (`open`) ora dipende solo da `isFocused && query non vuota` — risultati calcolati con `useMemo`.
  - Invariati: portale su `document.body` (FIX-16), selezione `onMouseDown`+`preventDefault`, chiusura su Esc/click fuori, `onCreateNew`.

### File toccati (sessione FIX-18)
```
components/shared/ClientAutocomplete.tsx                  [precarica clienti (preloadClientsAction) + filterClients in-memory, rimossi searchClientsAction/debounce/loading]
DECISIONI_E_FEEDBACK.md                                    [T-18 → 🟡 da riconfermare, aggiornato con fix FIX-18]
CLAUDE.md                                                  [aggiornato]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde (nessun errore)
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi (nessuna regressione)
- Verifica per ispezione codice: pattern identico a `filterClients`/`ClientSearchInput` di `SendEmailDialog.tsx` (già in uso e funzionante nel popup); selezione/portale/chiusura (FIX-16) invariati.
- **Non testato in browser reale**: criterio di accettazione del prompt — digitando il nome di un cliente nel form preventivo, i suggerimenti compaiono istantaneamente e non si "aggiornano" dopo un secondo.

### Esito finale
🟡 FIX APPLICATO — causa confermata (debounce + round-trip server), fix allineato al pattern già funzionante nel popup invio, tsc+build+test verdi, T-18 resta 🟡 "da riconfermare nel browser". Da verificare manualmente in browser da Eli: il criterio di accettazione sopra.

---

## A. HANDOFF — SESSIONE FIX-17 (12 giugno 2026)

### Fix applicato (commit `fix(invio): suggerimenti cliente dalla prima lettera + no flicker`)

**T-18 — Suggerimenti cliente devono comparire dalla 1ª lettera (oggi servono 2)**
- Causa principale confermata: `lib/actions/clients.ts` `searchClientsAction` usava `.textSearch('search_vector', query, { type: 'websearch', config: 'italian' })` — il full-text PostgreSQL `websearch` matcha **parole intere**, non prefissi/sottostringhe: digitando "Ma" non trova "Mario" → "Nessun cliente trovato" anche se il cliente esiste in rubrica.
- Fix: `searchClientsAction` ora usa `.or('name.ilike.%Q%,surname.ilike.%Q%,email.ilike.%Q%,piva.ilike.%Q%')` (Q = query con escape di `%`/`,`) — ricerca "contiene" su nome/cognome/email/P.IVA, funziona già dalla prima lettera. `eq('workspace_id', …)` e `limit(10)` invariati.
- `app/(app)/preventivi/_components/SendEmailDialog.tsx` (`ClientSearchInput`): soglia `filterClients` da `query.trim().length < 2` → `< 1`; `isOpen` da `value.trim().length >= 2` → `>= 1`. La ricerca qui è sincrona/in-memory (nessuna chiamata server), quindi nessun impatto sul fix di `searchClientsAction`.

**Flicker/auto-chiusura mentre si digita**
- Verificato per ispezione codice: `open`/`isOpen` resta `true` per tutta la durata della digitazione (finché `query`/`value` non è vuota), quindi `useAnchorRect` (dipende da `[open, anchorRef]`, ref stabile) non perde mai `rect` durante la digitazione e `useCloseOnOutsideMouseDown` non scatta per il digitare (solo per `mousedown` fuori da `wrapperRef`/`listRef`). **Nessun flicker reale individuato** — nessuna modifica necessaria oltre alla soglia.

### File toccati (sessione FIX-17)
```
lib/actions/clients.ts                                     [searchClientsAction: textSearch → .or(ilike) su name/surname/email/piva, funziona da 1 lettera]
app/(app)/preventivi/_components/SendEmailDialog.tsx      [ClientSearchInput: soglia filterClients/isOpen da 2 a 1 carattere]
DECISIONI_E_FEEDBACK.md                                    [T-18 → 🟡 da riconfermare, aggiornato con fix FIX-17]
CLAUDE.md                                                  [aggiornato]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde (nessun errore)
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi (nessuna regressione)
- Verifica per ispezione codice: nessun flicker individuato (vedi sopra); selezione cliente (FIX-08) e logica di invio non toccate.
- **Non testato in browser reale**: i 3 criteri di accettazione del prompt (suggerimento compare e resta digitando 1 sola lettera, sia nel form sia nel popup invio; nessun lampeggio; nessuna regressione selezione/invio).

### Esito finale
🟡 FIX APPLICATO — causa principale (textSearch full-text su parole intere) confermata con citazione file/riga, fix coerente con i criteri di accettazione, tsc+build+test verdi, T-18 resta 🟡 "da riconfermare nel browser". Da verificare manualmente in browser da Eli: i 3 criteri di accettazione sopra.

---

## A. HANDOFF — SESSIONE FIX-16 (11 giugno 2026)

### Fix applicato (commit `fix(invio): tendina suggerimenti via portale (T-18 — fix clipping)`)

**T-18 — Suggerimenti cliente non compaiono nel popup invio (causa: clipping, quarto tentativo)**
- Causa confermata: la riscrittura FIX-15 ha rimosso Radix Popover (correttamente, risolveva il bug di dismiss) ma anche il suo **portale**. La nuova tendina `<ul absolute>` è dentro al wrapper `relative`, che a sua volta è dentro al `DialogContent` reso scrollabile da `overflow-y-auto`/`max-h-[90dvh]` nel fix T-7 (sessione FIX-11) — la tendina veniva quindi **tagliata/clippata** dal contenitore e non era visibile (specialmente nel popup invio).
- Fix (come da `PROMPT_FIX_16_autocomplete_portale.md`): mantenuta TUTTA la logica FIX-15 (stato `isFocused`, ricerca/filtro, condizione `open`/`isOpen`, selezione `onMouseDown`+`preventDefault`, chiusura su selezione/Esc/click fuori) — la lista `<ul>` ora viene renderizzata con **`createPortal(..., document.body)`**, posizionata `position: fixed` con coordinate da `getBoundingClientRect()` del wrapper, così esce da qualsiasi `overflow-hidden`/`overflow-y-auto` (dialog, card).
- Nuovo file `components/shared/dropdown-portal.ts` — due hook condivisi usati da entrambi i componenti:
  - `useAnchorRect(anchorRef, open)`: calcola/ricalcola il `DOMRect` dell'anchor mentre la tendina è aperta, con listener `window.scroll` (`capture: true`, intercetta anche lo scroll interno del dialog) e `window.resize`.
  - `useCloseOnOutsideMouseDown(open, onClose, refs[])`: listener `document.mousedown` che chiude la tendina solo se il click non è dentro nessuno dei `refs` forniti (wrapper input + `listRef` della `<ul>` portata) — necessario perché, essendo la lista fuori dal DOM del wrapper, il vecchio check `wrapperRef.contains` non basta più.
- `components/shared/ClientAutocomplete.tsx`: aggiunto `listRef`, `rect = useAnchorRect(wrapperRef, open)`, `useCloseOnOutsideMouseDown(...)`; `<ul>` ora dentro `createPortal(..., document.body)` con `style={{ position: 'fixed', left: rect.left, top: rect.bottom + 4, width: rect.width, zIndex: 9999 }}`; `handleBlur` esteso per controllare anche `listRef.current?.contains(...)`.
- `app/(app)/preventivi/_components/SendEmailDialog.tsx` (`ClientSearchInput`): stessa identica modifica (stesso pattern, stessi hook condivisi).
- Selezione (`onMouseDown`+`preventDefault`) invariata — funziona anche attraverso il portale perché il `mousedown` sul bottone della lista bubble fino al `document` listener, che lo riconosce come "dentro `listRef`" e non chiude la tendina prima del click.
- Niente Radix Popover reintrodotto. `components/ui/popover.tsx` non toccato (ancora usato da `ShareButton.tsx` e `AtecoMultiSelect.tsx`).

### File toccati (sessione FIX-16)
```
components/shared/dropdown-portal.ts                      [NUOVO — useAnchorRect + useCloseOnOutsideMouseDown]
components/shared/ClientAutocomplete.tsx                  [tendina <ul> via createPortal su document.body, position:fixed da getBoundingClientRect]
app/(app)/preventivi/_components/SendEmailDialog.tsx      [ClientSearchInput: stessa riscrittura via portale]
DECISIONI_E_FEEDBACK.md                                    [T-18 → 🟡 da riconfermare nel browser, causa clipping documentata]
CLAUDE.md                                                  [aggiornato]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde (nessun errore)
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi (nessuna regressione)
- Verifica per ispezione codice: nessun residuo di `Popover`/`PopoverAnchor`/`PopoverContent` nei due file; `popover.tsx` ancora usato altrove (ShareButton, AtecoMultiSelect) — non toccato; logica di selezione/`selectedClientId` (FIX-08) invariata.
- **Non testato in browser reale**: i 4 criteri di accettazione del prompt (suggerimenti compaiono e restano nel popup invio senza essere tagliati dal bordo del dialog; tendina posizionata correttamente anche scrollando dentro il dialog; selezione click/touch funziona; nessuna regressione su FIX-08/invio).

### Esito finale
🟡 FIX APPLICATO — causa (clipping da overflow del DialogContent) confermata con citazione del fix T-7 che l'ha introdotta, tendina riscritta via portale come da prompt, tsc+build+test verdi, nessuna voce ✅ annullata (T-18 resta 🟡 "da riconfermare nel browser"). Da verificare manualmente in browser da Eli: i 4 criteri di accettazione sopra.

---

## A. HANDOFF — SESSIONE FIX-15 (11 giugno 2026)

### Fix applicato (commit `fix(invio): autocomplete cliente robusto senza Radix Popover (T-18 definitivo)`)

**T-18 — Suggerimenti cliente che compaiono e spariscono subito (terzo tentativo, definitivo)**
- Contesto: i due fix precedenti (onBlur 300ms+onPointerDown in sessione FIX-11; poi Radix `Popover`+`PopoverAnchor`+`onInteractOutside`+`anchorRef` in sessione FIX-13) erano stati segnati ✅ ma **continuavano a non funzionare nel test reale** — interazione sottile tra focus/dismiss-layer di Radix Popover, troppo fragile da chiudere "alla cieca" con altre patch incrementali.
- Fix (come da `PROMPT_FIX_15_autocomplete_robusto.md`): rimosso completamente `Popover`/`PopoverAnchor`/`PopoverContent` da entrambi i punti — sostituiti con un pattern autonomo identico:
  - Wrapper `<div className="relative">` contenente l'`<input>` e una `<ul>` posizionata `absolute left-0 right-0 top-full mt-1 z-50` con `max-h-64 overflow-y-auto`, bordo/ombra/sfondo.
  - Stato locale `isFocused` (no stato esterno gestito da Radix): la tendina è aperta quando `isFocused && (loading || results.length > 0 || query.trim().length > 0)` (`ClientAutocomplete`) / `isFocused && value.trim().length >= 2 && suggestions.length > 0` (`ClientSearchInput`).
  - Selezione voce: `onMouseDown={(e) => { e.preventDefault(); ... }}` (NON `onClick`) — scatta prima del `blur` dell'input, la lista non si chiude prima della selezione.
  - Chiusura: solo su selezione, `Esc` (`onKeyDown` sul wrapper), o `onBlur` del wrapper con `relatedTarget`/`document.activeElement` check (un `setTimeout(120ms)` verifica che il focus non sia rimasto dentro al wrapper — niente chiusura se si clicca/digita dentro input o lista).
  - Nessun furto di focus: la lista è un semplice `<ul>`, mai un layer modale.
- `components/shared/ClientAutocomplete.tsx`: riscritto come sopra; rimossi `anchorRef`/`Popover`/`PopoverAnchor`/`PopoverContent`; mantenuta invariata la logica di ricerca (`searchClientsAction`, debounce 300ms) e `onCreateNew`.
- `app/(app)/preventivi/_components/SendEmailDialog.tsx` (`ClientSearchInput`): stessa riscrittura; mantenuta invariata la logica di filtro in-memory (`filterClients`) e `onSelectClient` (incluso `selectedClientId` di FIX-08 — nessuna regressione sul conflitto cliente, non toccato).
- `components/ui/popover.tsx` non rimosso — ancora usato da `ShareButton.tsx` e `AtecoMultiSelect.tsx`.

### File toccati (sessione FIX-15)
```
components/shared/ClientAutocomplete.tsx                  [riscritto: tendina <ul> assoluta, isFocused, onMouseDown, no Radix Popover]
app/(app)/preventivi/_components/SendEmailDialog.tsx      [ClientSearchInput riscritto: stesso pattern]
DECISIONI_E_FEEDBACK.md                                    [T-18 → 🟡 da riconfermare, NON ✅]
CLAUDE.md                                                  [aggiornato]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde (nessun errore)
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi (nessuna regressione)
- Verifica per ispezione codice: nessun residuo di `Popover`/`PopoverAnchor`/`PopoverContent`/`anchorRef` nei due file; `popover.tsx` ancora usato altrove (ShareButton, AtecoMultiSelect) — non toccato.
- **Non testato in browser reale**: i 4 criteri di accettazione del prompt (suggerimenti compaiono e restano digitando ≥2 lettere, sia nel form preventivo sia nel popup invio; selezione click/touch funziona; chiusura solo su selezione/Esc/click fuori; nessuna regressione su FIX-08).

### Esito finale
🟡 FIX APPLICATO — pattern riscritto come da prompt, tsc+build+test verdi, nessuna voce ✅ annullata (T-18 resta 🟡 "da riconfermare", non promosso a ✅). Da verificare manualmente in browser da Eli: i 4 criteri di accettazione sopra.

---

## A. HANDOFF — SESSIONE FIX-13 (10 giugno 2026)

### Fix applicati (commit `fix(invio): suggerimenti portale + no popup al reload + email + label mobile + invio voci`)

**T-12bis — Testo email contatto troppo verboso**
- `components/email/PreventivoEmail.tsx` (~righe 127-139): "Per qualsiasi domanda, rispondi direttamente a questa email o scrivimi a {email}" → **"Per qualsiasi domanda scrivimi a {email}"** (mailto invariato).

**T-19 — Reload di una bozza riapre da solo il popup invio**
- Causa confermata: `?send=1` resta nell'URL dopo l'apertura automatica del dialog (`initialOpen`); un reload della pagina lo rilegge e riapre il popup.
- Fix: nuovo `useEffect` in `SendEmailDialog.tsx` (righe ~290-301) — se `initialOpen` ed esiste `?send` nell'URL, lo rimuove con `window.history.replaceState` (NON `router.replace`, per non innescare un nuovo fetch/render del Server Component). Eseguito una sola volta al mount.

**T-13bis — "Importa da preventivo" senza etichetta su mobile**
- Causa confermata: `app/(app)/fatture/page.tsx` (righe ~161-169) — il bottone header "Da preventivo" mostrava solo l'icona `FileInput` su mobile.
- Fix: etichetta "Importa da preventivo" sempre visibile (allineata al testo già usato in `CreateFromPreventivoButton.tsx`), niente `hidden sm:inline`.

**T-18bis — Suggerimenti cliente (popup invio + autocomplete) non compaiono / spariscono subito**
- Causa confermata — due bug distinti:
  1. `components/ui/input.tsx` — `Input` non era `React.forwardRef`: `PopoverAnchor asChild` (Radix) non riusciva ad ancorare correttamente il popover all'`<input>`, causando posizionamento/comportamento errato del dropdown.
  2. `onInteractOutside` di `PopoverContent` (sia in `SendEmailDialog.tsx`'s `ClientSearchInput` sia in `ClientAutocomplete.tsx`) considerava il `pointerdown` sull'`<input>` ancora "fuori dal popover" e lo chiudeva immediatamente — i suggerimenti apparivano e sparivano nello stesso istante.
- Fix:
  1. `components/ui/input.tsx`: `Input` convertito a `React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>`, con `displayName`.
  2. `SendEmailDialog.tsx` (`ClientSearchInput`, righe ~106, 130, 150-153) e `ClientAutocomplete.tsx` (righe ~51, 112, 131-134): aggiunto `anchorRef = useRef<HTMLDivElement>(null)` sul wrapper `<div>` dentro `PopoverAnchor asChild`; `onInteractOutside={(e) => { if (anchorRef.current?.contains(e.target as Node)) return; setOpen(false) }}` — il pointerdown sull'input non chiude più il popover.

**T-20 — Invio dalla toolbar può inviare un documento "senza voci" se il form ha modifiche non salvate (INDAGINE + FIX)**
- Causa confermata: `hasVoci` passato a `SendEmailDialogController`/`SendEmailDialog` è calcolato **server-side** al caricamento della pagina (`preventivi/[id]/page.tsx` righe 130-136 e analogo in `fatture/[id]/page.tsx`) dai `document_items` SALVATI nel DB — non riflette lo stato corrente (non salvato) di `PreventivoForm.tsx`. Se l'utente svuota le voci nel form senza salvare e poi clicca "Invia" dalla toolbar (componente fratello, stato indipendente), i guard client-side (`handleOpenChange`/`handleSend` in `SendEmailDialog.tsx`) vedono ancora `hasVoci=true` (prop stale) e lasciano procedere.
- Il guard server-side esistente in `app/api/documents/[id]/send-email/route.ts` (righe 163-168, `if (!doc.total || Number(doc.total) === 0)`) era insufficiente: controlla il totale persistito nel DB (non risente delle modifiche non salvate) e non replica la definizione di "voce completa" (descrizione non vuota + prezzo>0 + quantità>0) — una voce con descrizione vuota ma prezzo/quantità validi avrebbe `total>0` ma non sarebbe una "voce completa".
- **Scelta (tra le opzioni ammesse dal prompt — "almeno guardia server-side robusta" vs fix completo con auto-save/blocco su stato non salvato):** implementata SOLO la guardia server-side robusta — sostituito il check `doc.total === 0` con un controllo su `doc.document_items` (già incluso nella query esistente, nessuna query aggiuntiva) che replica esattamente il predicato `hasVoci` delle pagine dettaglio (almeno una voce con descrizione+prezzo+quantità validi). Questo rende il guard **indipendente da qualsiasi stato client** e copre TUTTI i percorsi di invio (toolbar, reinvio, futuri). Non implementato l'auto-save o il blocco su "form con modifiche non salvate" — più invasivo (richiederebbe sollevare lo stato "dirty" del form fino ai dialog di invio, componenti fratelli) e non necessario per soddisfare il criterio di accettazione ("nessun documento può essere inviato senza voci complete via qualsiasi percorso").
- File: `app/api/documents/[id]/send-email/route.ts` (righe ~163-178) — nuovo blocco `hasCompleteVoce` sostituisce il vecchio check `doc.total === 0`.

### File toccati (sessione FIX-13)
```
components/email/PreventivoEmail.tsx                      [T-12bis: testo contatto semplificato]
app/(app)/preventivi/_components/SendEmailDialog.tsx      [T-19: useEffect strip ?send via history.replaceState; T-18bis: anchorRef + onInteractOutside in ClientSearchInput]
app/(app)/fatture/page.tsx                                 [T-13bis: label "Importa da preventivo" sempre visibile]
components/ui/input.tsx                                    [T-18bis: Input → React.forwardRef]
components/shared/ClientAutocomplete.tsx                   [T-18bis: anchorRef + onInteractOutside]
app/api/documents/[id]/send-email/route.ts                 [T-20: guard hasCompleteVoce su document_items, sostituisce doc.total===0]
DECISIONI_E_FEEDBACK.md                                    [T-12bis/T-13/T-18/T-19/T-20 → ✅]
BACKLOG_MIGLIORAMENTI.md                                   [spostati in "Risolti" con causa+fix]
CLAUDE.md                                                  [aggiornato]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde (nessun errore)
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi (nessuna regressione)
- Verifica per ispezione codice: tutte le cause confermate con citazione file/riga; nessuna voce ✅ di `DECISIONI_E_FEEDBACK.md` annullata; FIX-07/08/11/12 (conflitto cliente, scroll dialog, sconto) non toccati.
- **Non testato in browser reale**: (1) suggerimenti cliente nel popup invio e nell'autocomplete — restano visibili e selezionabili su mobile/desktop; (2) reload di una bozza con `?send=1` non riapre il popup; (3) "Importa da preventivo" con etichetta visibile su mobile; (4) testo email semplificato; (5) tentativo di invio dopo aver svuotato le voci nel form senza salvare → bloccato con messaggio "Impossibile inviare un documento senza voci".

### Esito finale
🟡 FIX APPLICATO — cause confermate con citazioni file/riga per tutti i 5 punti, tsc+build+test verdi, nessuna voce ✅ annullata. Da verificare manualmente in browser: i 5 punti sopra.

---

## A. HANDOFF — SESSIONE FIX-12 (10 giugno 2026)

### Fix applicato (commit `fix(invio): sconto globale non blocca/confonde l'invio (T-14)`)

**T-14 — Preventivo bozza non si invia con sconto globale (totale negativo)**
- **Causa confermata (Ipotesi A, confermata da Eli):** in `lib/fiscal/calcoli.ts`, `afterDiscount = subtotal*(1 - pct/100) - discount_fixed` non aveva guardia sui negativi. Con una voce da 40€ e uno sconto fisso di 50€, `afterDiscount = -10` → `total = -10` (nessun'altra componente lo riporta positivo). Nessun CHECK constraint DB su `documents.total`, nessun controllo client-side sullo sconto: il documento veniva creato/salvato con `total` negativo e l'utente vedeva un comportamento confuso (la UI esistente non aveva alcun messaggio dedicato a questo caso).
- Non è stata eseguita una riproduzione end-to-end in browser (nessun ambiente dev disponibile in questa sessione) — causa confermata per ispezione codice + conferma diretta di Eli sul valore osservato (~−40€).

**Fix applicato:**
1. **`lib/fiscal/calcoli.ts`** — `afterDiscount` ora clampato: `Math.max(0, roundFiscale(subtotal*(1 - pct/100) - discount_fixed))`. Poiché `ritenuta` e `bollo` derivano da `afterDiscount` (≥0) e `taxAmount` è calcolato per voce (sempre ≥0), `total = afterDiscount + taxAmount + bollo - ritenuta` non può più essere negativo. Sconto = subtotale → `afterDiscount = 0`, `total = 0` (consentito, come da spec).
2. **`PreventivoForm.tsx`** — nuova validazione client-side `getDiscountError(items)`: ricalcola il subtotale dalle voci e l'`afterDiscount` GREZZO (non clampato) usando `discountPct`/`discountFixed`; se risulterebbe negativo, ritorna un messaggio specifico: *"Lo sconto globale (€ X) supera il totale delle voci (€ Y). Riduci lo sconto."*
   - Nuovo helper `runPreSubmitValidation()` — esegue prima `getVociError` (logica FIX-11/T-8 invariata, banner+scroll voci), poi `getDiscountError`. Se lo sconto è il problema: `setDiscountError(msg)` + scroll alla sezione "Sconti globali" (`discountSectionRef`) — **NON** tocca `formError`/`isVociErrorRef`, quindi nessuno scroll fuorviante alle voci.
   - `runPreSubmitValidation()` usato in `handleFormSubmit` (create mode, copre sia "Salva bozza" sia "Invia al cliente"/"Salva e apri" — entrambi `type="submit"`), `doSaveDraft` ed `doSaveAndRedirect` (edit mode).
   - Nuovo `useEffect` analogo a quello già esistente per `formError`/voci: ricalcola `getDiscountError` quando cambiano `voci`/`discountPct`/`discountFixed` e rimuove il messaggio appena lo sconto torna valido.
   - JSX: `ref={discountSectionRef}` sul box "Sconti globali (opzionale)"; messaggio `discountError` renderizzato sotto i due campi sconto (`text-destructive text-sm`, `role="alert"`).

### File toccati (sessione FIX-12)
```
lib/fiscal/calcoli.ts                                      [afterDiscount clampato a Math.max(0, ...) — mai totale negativo]
tests/unit/fiscal/calcoli.test.ts                          [+2 test: sconto fisso > subtotale → clamp a 0; sconto = subtotale → 0]
app/(app)/preventivi/_components/PreventivoForm.tsx        [getDiscountError(); runPreSubmitValidation(); discountError state+ref; wiring in handleFormSubmit/doSaveDraft/doSaveAndRedirect; JSX messaggio + ref sezione sconti]
DECISIONI_E_FEEDBACK.md                                    [T-14 → ✅ Fatto]
BACKLOG_MIGLIORAMENTI.md                                   [T-14 spostato in "Risolti" con causa+fix]
CLAUDE.md                                                  [aggiornato]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde (nessun errore)
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi (176 + 2 nuovi test su `calcolaDocumento` per sconto > subtotale e sconto = subtotale)
- Verifica per ispezione codice: `getVociError` (FIX-11/T-8) invariato e chiamato per primo in `runPreSubmitValidation` — nessuna regressione sulla validazione voci/invio (FIX-01/08/11); `formError`/`isVociErrorRef`/scroll-voci non toccati dal path sconto.
- **Non testato in browser reale**: riproduzione end-to-end (voce 40€ + sconto fisso 50€ → messaggio sotto "Sconti globali", niente scroll alle voci, invio bloccato finché lo sconto non viene ridotto; con sconto valido l'invio funziona normalmente).

### Esito finale
🟡 FIX APPLICATO — causa A confermata (citazioni file/riga + conferma diretta di Eli sul totale negativo osservato), fix coerente con i criteri di accettazione del prompt, tsc+build+test verdi. Da verificare manualmente in browser: scenario di riproduzione sopra.

---

## A. HANDOFF — SESSIONE FIX-11 (9 giugno 2026)

### Fix applicati (commit `fix(mobile): dialog scroll + catalogo 1a riga + suggerimenti + iniziali + share + email contatto`)

**T-7 — Dialog non scorrevoli su mobile (X tagliata fuori schermo)**
- Causa confermata: `components/ui/dialog.tsx` — `DialogContent` non aveva max-height né overflow, il contenuto alto usciva dallo schermo e la X era irraggiungibile.
- Fix: `DialogPrimitive.Content` ora ha `flex flex-col max-h-[90dvh] overflow-hidden`; i `{children}` sono wrappati in un inner div `overflow-y-auto flex-1 grid gap-4 p-4`; il bottone X rimane `absolute top-2 right-2 z-10` FUORI dall'inner div (positioned relative al container fixed, non scorre).

**T-6 — Voce da catalogo va come 2ª riga invece di sostituire la 1ª vuota**
- Causa confermata: `VociTable.tsx` — `lastIsEmpty` richiedeva `last.quantity === 1`, ma la prima riga potrebbe avere `quantity: 0` (documenti caricati dal DB prima di FIX-19) oppure altri valori.
- Fix: `lastIsEmpty = last.description.trim() === '' && (last.unit_price ?? 0) === 0` — ignora la quantità, check robusto.

**T-8 — Errore "voci mancanti" deve apparire PRIMA di aprire il popup invio**
- Causa confermata: `hasVoci` era calcolato come `total > 0` in `preventivi/[id]/page.tsx` e `fatture/[id]/page.tsx` — vero se c'è almeno un prezzo, ma non verificava che ci fosse anche una descrizione e una quantità.
- Fix: `hasVoci` ora controlla che almeno una voce abbia description non vuota + unit_price > 0 + quantity > 0 — usa `document_items` già inclusi nella query `select('*, document_items(*)')`.

**T-15 — Condivisione WhatsApp duplica il link nel messaggio**
- Causa confermata: `ShareButton.tsx` — `buildShareText()` includeva l'URL nella stringa di testo, poi `navigator.share({ text, url })` aggiungeva l'URL di nuovo → WhatsApp mostrava il link due volte.
- Fix: due funzioni separate — `buildShareTextWithUrl()` (per wa.me/mailto/copia) e `buildShareTextWithoutUrl()` (per `navigator.share`). In `doShare()`, `navigator.share({ text: textWithoutUrl, url })` — URL separato.

**T-16 — Togliere "Modifiche non ancora reinviate al cliente" dalla cronologia**
- Causa confermata: `DocumentTimeline.tsx` riga 147 — `detail: 'Modifiche non ancora reinviate al cliente'` nell'evento `modified`.
- Fix: rimossa la riga `detail`. L'evento "Documento aggiornato" resta senza dicitura (il banner nella pagina dettaglio già segnala il reinvio mancante).

**T-18 — Suggerimenti cliente assenti/spariscono troppo presto**
- Causa confermata:
  - (a) `SendEmailDialog.tsx` `ClientSearchInput`: `onBlur={() => setTimeout(setOpen, 150)}` — 150ms non basta su mobile per il touch→click sintetico.
  - (b) `ClientAutocomplete.tsx`: stessa causa, più `onMouseDown` che su mobile tocca dopo il blur.
- Fix in entrambi i file: timeout `onBlur` da 150ms → 300ms; `onMouseDown` → `onPointerDown` (si attiva PRIMA del blur su touch, evita la race condition).

**T-4 — Iniziali avatar insensate ("DD") dal nome account**
- Causa confermata: `app/(app)/layout.tsx` — `initials` calcolate da `user.user_metadata.full_name` (nome account, es. "Daniela Dellanno" → "DD"), non dalla ragione sociale del workspace.
- Fix: `initials` ora da `workspace.ragione_sociale ?? workspace.name` → coerenti con `WorkspaceLogo`.

**T-12 — Email non mostra l'email di contatto dell'artigiano**
- Causa confermata: `PreventivoEmail.tsx` non riceveva l'email del mittente; `send-email/route.ts` aveva `replyTo: user.email` ma non la passava al componente email.
- Fix: aggiunto prop `ownerEmail?: string | null` a `PreventivoEmail`; il corpo ora mostra "rispondi a questa email o scrivimi a [mailto link]". `send-email/route.ts` passa `ownerEmail: user.email ?? null`.

**T-13 — Tasto "Importa da preventivo" etichetta non chiara**
- Causa: `CreateFromPreventivoButton.tsx` — bottone con label "Crea da preventivo" (meno descrittivo).
- Fix: label cambiata in "Importa da preventivo" (nessun `hidden sm:inline` — già sempre visibile).

### File toccati (sessione FIX-11)
```
components/ui/dialog.tsx                                        [T-7: max-h + flex col + inner scrollable div; X fuori dallo scroll]
app/(app)/preventivi/_components/VociTable.tsx                  [T-6: lastIsEmpty senza lastQuantity check]
app/(app)/preventivi/[id]/page.tsx                              [T-8: hasVoci = almeno una voce completa]
app/(app)/fatture/[id]/page.tsx                                 [T-8: idem]
app/(app)/preventivi/_components/ShareButton.tsx                [T-15: buildShareTextWithUrl/WithoutUrl; navigator.share senza URL nel testo]
app/(app)/preventivi/_components/DocumentTimeline.tsx           [T-16: rimossa riga detail "Modifiche non reinviate"]
app/(app)/preventivi/_components/SendEmailDialog.tsx            [T-18a: onBlur 150→300ms; onMouseDown→onPointerDown]
components/shared/ClientAutocomplete.tsx                        [T-18b: onBlur 150→300ms; onMouseDown→onPointerDown]
app/(app)/layout.tsx                                            [T-4: initials da workspace.ragione_sociale]
components/email/PreventivoEmail.tsx                            [T-12: prop ownerEmail + mailto link nel corpo]
app/api/documents/[id]/send-email/route.ts                      [T-12: ownerEmail passato al componente email]
app/(app)/fatture/_components/CreateFromPreventivoButton.tsx    [T-13: label "Importa da preventivo"]
CLAUDE.md                                                       [aggiornato]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde (nessun errore)
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 176/176 verdi
- Verifica per ispezione codice: tutte le cause confermate con citazione file/riga.
- **Non testato in browser reale**: (1) dialog su 360px — scroll e X visibile; (2) voce da catalogo sostituisce 1ª riga; (3) invio con voci incomplete → errore PRIMA del popup; (4) condivisione WhatsApp senza URL duplicato; (5) iniziali avatar corrette; (6) email con link mailto artigiano.

### Esito finale
🟡 FIX APPLICATO — cause confermate con citazioni file/riga per tutti i 9 punti, tsc+build+test verdi. Da verificare manualmente in browser mobile (i 6 punti sopra).

---

## A. HANDOFF — SESSIONE PWA (9 giugno 2026)

### Feature implementata (commit `feat(pwa): app installabile (manifest + icone, senza service worker)`)

**MOB-1 — App installabile sulla schermata Home (PWA senza service worker)**

**Obiettivo:** rendere Carta Canta installabile su Android/Chrome e iOS/Safari come icona standalone senza aggiungere un service worker (niente caching, niente problemi di versione vecchia dopo i deploy).

**Cosa è stato fatto:**

1. **`app/manifest.ts`** — nuova metadata route Next.js che genera `/manifest.webmanifest`:
   - `name`: "Carta Canta — Preventivi e Fatture", `short_name`: "Carta Canta"
   - `start_url`: "/dashboard", `display`: "standalone"
   - `theme_color`: "#1a1a2e" (colore brand, usato come accent default in tutta l'app)
   - `lang`: "it", `background_color`: "#ffffff"
   - 3 icone: 192×192, 512×512, 512×512 maskable

2. **Icone PNG in `public/`** — generate con `sharp` (dipendenza transitiva di Next.js, nessuna nuova dep):
   - `icon-192.png` (192×192) — icona standard Android Chrome
   - `icon-512.png` (512×512) — icona hires
   - `icon-maskable-512.png` (512×512, ~10% padding safe zone) — icone adattive Android
   - `apple-touch-icon.png` (180×180) — iOS Safari "Aggiungi a schermata Home"
   - **⚠️ PLACEHOLDER** — sfondo brand navy `#1a1a2e` + monogramma "CC" bianco. Da sostituire col logo definitivo dell'artigiano. Lo script di generazione era inline (non salvato in scripts/).

3. **`app/layout.tsx`** — aggiunti a `metadata` e `viewport` (nessun metadata esistente rimosso):
   - `icons.apple`: `/apple-touch-icon.png` (iOS non legge sempre il manifest)
   - `appleWebApp`: `{ capable: true, title: 'Carta Canta', statusBarStyle: 'default' }`
   - `manifest`: `/manifest.webmanifest`
   - `viewport.themeColor`: `#1a1a2e` (barra status su Android/iOS)

**Nessun service worker** registrato. `MOB-2` (offline caching) rimane nel backlog.

### File toccati (sessione PWA)
```
app/manifest.ts                [NUOVO — metadata route → /manifest.webmanifest]
app/layout.tsx                 [aggiunto: icons.apple, appleWebApp, manifest, viewport.themeColor]
public/icon-192.png            [NUOVO — placeholder, 192×192]
public/icon-512.png            [NUOVO — placeholder, 512×512]
public/icon-maskable-512.png   [NUOVO — placeholder, 512×512 maskable]
public/apple-touch-icon.png    [NUOVO — placeholder, 180×180]
CLAUDE.md                      [aggiornato]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde; `.next/server/app/manifest.webmanifest.body` verificato — contiene JSON corretto con tutte le icone referenziate
- Verifica icone: `ls -la public/*.png` → 4 file presenti (192px, 512px, 512px maskable, 180px)
- **Non testato su dispositivo reale**: installazione "Aggiungi a schermata Home" su Android/Chrome e iOS/Safari — richiede deploy Vercel + test manuale da telefono.

### Esito finale
🟡 FIX APPLICATO — manifest e icone presenti e correttamente referenziati, tsc+build verdi. Da verificare manualmente: (1) aprire https://cartacanta.app su Android → menu Chrome → "Aggiungi a schermata Home" → icona CC appare, app si apre standalone; (2) su iOS Safari → condividi → "Aggiungi a schermata Home" → stesso risultato.
**Ricordare**: le icone sono placeholder con monogramma "CC" — sostituire col logo definitivo quando disponibile.

---

## A. HANDOFF — SESSIONE IMPROVE (9 giugno 2026)

### Miglioramenti applicati (commit `refactor(ux): form snellito + dashboard azioni + automazioni default + copy semplice`)

**M1 — Form preventivo/fattura: "Altre opzioni" collassabile**
- `PreventivoForm.tsx`: aggiunto stato `altreOpzioniOpen` con lazy initializer — aperto di default in edit mode se almeno un campo non-standard è valorizzato (note non vuote, validità diversa, bonus attivo, numero presente, template non Classico). Chiuso di default in create mode.
  - Campo "Cliente" e (per le fatture) "Numero fattura" sempre visibili.
  - Nel blocco collassabile: Numero preventivo (solo preventivi), Titolo del lavoro (M6), Template, Note pubbliche, Note interne, Il preventivo vale (giorni) (M6) / Scadenza pagamento, Termini, Bonus edilizio.
  - I campi restano nel DOM anche quando chiusi (`className={altreOpzioniOpen ? ... : 'hidden'}`) — nessun unmount, nessuna perdita di valori.
- `FatturaForm.tsx`: stessa logica — `altreOpzioniOpen` sempre `false` alla creazione (FatturaForm è sempre create mode). Numero fattura e Cliente sempre visibili. Resto nel collassabile.

**M2 — Prima voce pronta + focus immediato**
- `VociTable.tsx`: aggiunto prop `autoFocusFirst?: boolean` (default `false`); `autoFocus={autoFocusFirst && idx === 0}` su entrambi i description input (desktop e mobile).
- `PreventivoForm.tsx`: `autoFocusFirst={mode === 'create'}` passato a `<VociTable>`.
- `FatturaForm.tsx`: `autoFocusFirst={true}` passato a `<VociTable>` (sempre create mode).
- `VoiceInput.tsx`: bottone microfono `size-10` (40px × 40px) — area di tocco ≥40px.
- `FatturaForm.tsx` `newVoce()`: `quantity: 0` → `quantity: 1` (allineato a FIX-19 già applicato in VociTable).

**M3 — Dashboard "azioni prima, numeri dopo"**
- `dashboard/page.tsx`: "Prossima scadenza" spostata sopra le card KPI. "Attività recente" diventa card standalone full-width (rimossa dal vecchio grid 2+1 col).
- Ordine: header alert → Prossima scadenza → KPI cards → Grafico Andamento → Attività recente.

**M4 — "Crea fattura" come azione primaria**
- `ConvertiFatturaButton.tsx`: `variant="outline"` → `variant="default"` (bottone pieno); label "Converti in fattura" → "Crea fattura".

**M5 — Automazioni ON di default (verifica)**
- Verificato: DB migration 006 già ha `reminder_cliente: true` nel default JSONB. `DEFAULT_PREFS` in `notifiche.tsx` già `reminder_cliente: true`. `impostazioni/page.tsx` parsing usa `rawPrefs.reminder_cliente !== false` (default true). Nessuna modifica necessaria.

**M6 — Label più semplici**
- `PreventivoForm.tsx`: "Oggetto" → "Titolo del lavoro"; "Validità (giorni)" → "Il preventivo vale (giorni)" (solo preventivi; fatture già avevano "Scadenza pagamento (giorni)" corretto).
- `FatturaForm.tsx`: "Oggetto" → "Titolo del lavoro".
- Nessun cambio agli attributi `name`/`id`/payload.

### File toccati (sessione IMPROVE)
```
app/(app)/preventivi/_components/PreventivoForm.tsx        [M1: altreOpzioniOpen state+blocco collassabile; M2: autoFocusFirst={mode==='create'}; M6: label "Titolo del lavoro"/"Il preventivo vale"]
app/(app)/fatture/_components/FatturaForm.tsx              [M1: altreOpzioniOpen state+blocco collassabile; M2: autoFocusFirst+quantity:1 in newVoce; M6: label "Titolo del lavoro"]
app/(app)/preventivi/_components/VociTable.tsx             [M2: prop autoFocusFirst + autoFocus su description input desktop+mobile]
components/shared/VoiceInput.tsx                           [M2: bottone size-10 (40px)]
app/(app)/preventivi/_components/ConvertiFatturaButton.tsx [M4: variant="default", label "Crea fattura"]
app/(app)/dashboard/page.tsx                               [M3: Prossima scadenza sopra KPI; Attività recente standalone]
CLAUDE.md                                                  [aggiornato]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde (nessun errore)
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 176/176 verdi
- Verifica per ispezione codice: chiusura tag JSX PreventivoForm verificata; prop `autoFocusFirst` presente in VociTable e passato da entrambi i form; FatturaForm `altreOpzioniOpen` inizializzato a `false`.
- **Non testato in browser reale**: (1) nuovo preventivo — form mostra solo Cliente + Voci, "Altre opzioni" chiuso; (2) modifica preventivo con campi valorizzati — "Altre opzioni" aperto automaticamente; (3) focus sulla prima voce all'apertura; (4) microfono 40px su mobile; (5) dashboard con "Prossima scadenza" in cima.

### Esito finale
🟡 FIX APPLICATO — cause/struttura verificata per ispezione codice, tsc+build+test verdi. Da verificare manualmente in browser: i 5 punti sopra.

---

## A. HANDOFF — SESSIONE FIX-10 (9 giugno 2026)

### Fix/verifica applicati (commit `fix(ux): suggerimenti popup + badge Modificata + Totale preventivo Bold`)

**CHECK-A — Suggerimenti contatti nel popup invio: comportamento previsto**
- Causa investigata: i campi `ClientSearchInput` (Nome / Email con autocomplete) sono dentro `{!hasClient && (...)}` in `SendEmailDialog.tsx` — vengono renderizzati SOLO quando il documento non ha un cliente associato (`hasClient = false`).
- Conclusione confermata per ispezione codice: il documento di test aveva già un cliente → `hasClient = true` → la variante con autocomplete non viene mostrata. È **comportamento previsto**, non un bug.
- I wrapper `updateFirstName`/`updateLastName`/`updateTo` introdotti da FIX-08 (zerare `selectedClientId` per evitare falso conflitto) sono corretti e non interferiscono con l'autocomplete.
- `preloadClientsAction()` viene chiamato in `handleOpenChange` solo quando `!hasClient` — coerente col design.
- **Nessuna modifica necessaria.**

**CHECK-B — Badge "Modificato" → "Modificata" sulle fatture**
- Causa confermata: etichetta hardcoded "Modificato" in 2 punti (il terzo, `fatture/[id]/page.tsx`, era già corretto: "Fattura modificata — non ancora reinviata" da sessione FIX-02):
  - `app/(app)/fatture/page.tsx` riga 254: sempre "Modificato" anche per fatture
  - `app/(app)/dashboard/page.tsx` riga 574: "Modificato" nel feed misto preventivi+fatture
- Fix:
  - `fatture/page.tsx`: `Modificato` → `Modificata` (pagina sempre fatture, nessuna condizione necessaria)
  - `dashboard/page.tsx`: `Modificato` → `{doc.doc_type === 'fattura' ? 'Modificata' : 'Modificato'}` — `doc.doc_type` già in scope (usato a riga 560 in `getEventLabel`)
- `fatture/[id]/page.tsx`: già corretto ("Fattura modificata — non ancora reinviata") — nessuna modifica.
- `preventivi/page.tsx` e `preventivi/[id]/page.tsx`: restano "Modificato" (preventivi, maschile corretto).

**CHECK-C — Template Bold: "Totale da pagare" anche sui preventivi**
- Causa confermata: `lib/pdf/template.ts`, ramo `case 'bold'`, riga 596 — etichetta `Totale da pagare` hardcoded senza condizione su `isFattura`. La variabile `isFattura = doc.doc_type === 'fattura'` era già nello scope (usata altrove nel file).
- Fix: `isFattura ? 'Totale da pagare' : 'Totale'` — SOLO il testo, zero modifiche a dimensioni/colori/padding/struttura del box Bold.
- Verificato: preset Classico usa già "TOTALE" (corretto); Tecnico ed Elegante non hanno box totale dedicato (corretto).

### File toccati (sessione FIX-10)
```
app/(app)/fatture/page.tsx                               [CHECK-B: "Modificato" → "Modificata" — riga 254]
app/(app)/dashboard/page.tsx                             [CHECK-B: "Modificato" → doc_type condizionale — riga 574]
lib/pdf/template.ts                                      [CHECK-C: Bold box totale "Totale da pagare" → condizionale isFattura — riga 596]
CLAUDE.md                                                [aggiornato]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde (nessun errore)
- `npm run build` → verde, tutte le route generate
- Verifica per ispezione codice: CHECK-A confermato "previsto" (codice SendEmailDialog.tsx — `{!hasClient && <ClientSearchInput>}`); CHECK-B causa confermata con citazione riga; CHECK-C causa confermata con citazione riga.
- **Non testato in browser reale**: (1) badge "Modificata" in lista fatture e dashboard; (2) preventivo Bold mostra "TOTALE" e fattura Bold mostra "TOTALE DA PAGARE" nel PDF.

### Esito finale
🟡 FIX APPLICATO — cause confermate con citazioni file/riga per tutti e 3 i check, tsc+build verdi. Da verificare manualmente: i 2 punti sopra.

---

## A. HANDOFF — SESSIONE FIX-06 (9 giugno 2026)

### Fix/feature applicati (commit `feat(condivisione): condividi link via menu nativo/WhatsApp + marcatura inviato`)

**FIX-06.1 — Bottone "Condividi" sul dettaglio preventivo e fattura**
- Causa: nessun modo rapido per condividere il link pubblico `/p/[token]` con il cliente via WhatsApp o SMS — l'artigiano doveva copiare il link manualmente.
- Fix: nuovo componente `ShareButton.tsx` (`app/(app)/preventivi/_components/ShareButton.tsx`) — client component con due comportamenti:
  - **Mobile / Web Share API disponibile**: `navigator.share({ title, text, url })` → apre il menu nativo del dispositivo (WhatsApp, SMS, Telegram, ecc.) con testo precompilato "Le faccio avere il link per visualizzare il preventivo n. {numero} come da nostra intesa: {url}". Se l'utente annulla o l'API fallisce → apre il popover fallback.
  - **Desktop / fallback**: popover con 3 opzioni: **WhatsApp** (`wa.me/?text=…`), **Email** (`mailto:?subject=…&body=…`), **Copia link** (clipboard + `toast.success`).
  - Testo precompilato parametrizzato preventivo/fattura; numero pulito (strip prefissi legacy `Prev`/`Fatt`).
  - Il bottone mostra solo l'icona su mobile, icona + "Condividi" su sm+.
  - Aggiunto in `preventivi/[id]/page.tsx` e `fatture/[id]/page.tsx` dopo `PdfActions`, visibile solo se `doc.public_token` è valorizzato (sempre, per default DB).

**FIX-06.2 — Condivisione di una bozza segna il documento come "Inviato"**
- Causa: condividendo il link di una bozza, il documento rimaneva "Bozza" nell'app — incoerente con il fatto che il cliente l'ha ricevuto.
- Fix: se il documento è in stato `draft`, al click di "Condividi" appare un Dialog di conferma ("Condividendo, questo preventivo/fattura verrà segnato come Inviato e gli verrà assegnato il numero progressivo. Nessuna email verrà inviata da Carta Canta.") con bottone "Segna come inviato e condividi".
  - **Azione riusata**: `registerManualSendAction` (già esistente in `lib/actions/documents.ts`) — assegna numero progressivo + stato `sent` + `sent_at` + `expires_at` + `sent_snapshot`. Nessuna logica duplicata.
  - `registerManualSendAction` esteso con parametro opzionale `docTypeHint?: 'preventivo' | 'fattura'` — determina la sequenza corretta (`allocateDocNumber` vs `allocateInvoiceNumber`) e il path da revalidare (`/preventivi/[id]` vs `/fatture/[id]`). Retrocompatibile (i caller esistenti come `RegisterManualSendButton` non passano il 3° arg).
  - Aggiunto `doc_type` alla select della funzione per determinare il tipo dal DB (fallback se `docTypeHint` non passato).
  - Aggiunto `revalidatePath('/dashboard')` alla fine della funzione.
  - Dopo il successo: `router.refresh()` + apertura immediata della condivisione (Web Share API o popover).
  - Se documento già inviato: "Condividi" apre direttamente la condivisione senza dialog.

**FIX-06.3 — Pagina pubblica: "Contatta" → WhatsApp quando disponibile**
- Causa: `ActionBar.tsx` mostrava il telefono come `tel:` link (meno immediato di WhatsApp per un artigiano). Inoltre usava `Phone` icon (lucide) ora sostituita con `MessageCircle`.
- Fix: `ActionBar.tsx` — quando `contactPhone` è valorizzato, il link diventa `https://wa.me/{numero}?...` (deep link WhatsApp) con testo "Scrivi su WhatsApp" e icona `MessageCircle` verde; quando `contactEmail` è valorizzato, mantiene il `mailto:` link "Contatta {workspaceName}" (già corretto da FIX-12).
  - Helper `normalizePhoneForWhatsApp()` — normalizza il numero per wa.me (strip non-cifre, gestisce +39/0039/3xx italiani).
  - Nota: `contactPhone` è attualmente sempre `null` nel chiamante (`p/[token]/page.tsx` passa `contactPhone={null}` perché il modello `workspaces` non ha un campo `phone`). La UI è pronta per quando il campo verrà aggiunto allo schema.

### File toccati (sessione FIX-06)
```
app/(app)/preventivi/_components/ShareButton.tsx          [NUOVO — Web Share API + Popover fallback + Dialog conferma bozza]
lib/actions/documents.ts                                  [registerManualSendAction: +docTypeHint param; +doc_type in select; allocateInvoiceNumber per fatture; revalidate path per tipo; +revalidatePath('/dashboard')]
app/(app)/preventivi/[id]/page.tsx                        [import ShareButton; <ShareButton> nel blocco azioni]
app/(app)/fatture/[id]/page.tsx                           [import ShareButton; isDraft+hasVoci calcolati; <ShareButton> nel blocco azioni; flex-wrap sul div azioni]
app/p/[token]/_components/ActionBar.tsx                   [normalizePhoneForWhatsApp() helper; WhatsApp link quando contactPhone disponibile; rimosso import Phone; aggiunto MessageCircle]
CLAUDE.md                                                 [aggiornato]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde (nessun errore)
- `npm run build` → verde, tutte le route generate
- Verifica per ispezione codice: `registerManualSendAction` con `docTypeHint='fattura'` usa `allocateInvoiceNumber`; `isFattura` determina correttamente il path di revalidazione; `ShareButton` usa `PopoverAnchor` (non `PopoverTrigger`) per ancorare il contenuto senza conflitti con `handleShareClick`; dialog di conferma si apre solo su bozze; `doShare()` apre Web Share API se disponibile, altrimenti `setPopoverOpen(true)`.
- **Non testato in browser reale**: (1) Web Share API su mobile con WhatsApp; (2) popover desktop con i 3 link; (3) click "Condividi" su bozza → dialog → conferma → numero assegnato + stato "Inviato"; (4) WhatsApp link in ActionBar (contactPhone è sempre null oggi — richiede schema workspace con campo phone).

### Esito finale
🟡 FIX APPLICATO — cause confermate con citazioni file/riga, logica riusata (no duplicazione), tsc+build verdi. Da verificare manualmente in browser: i 4 punti sopra (specialmente il flusso bozza → conferma → inviato su dispositivo mobile).

---

## A. HANDOFF — SESSIONE FIX-05 (8 giugno 2026)

### Fix applicati (commit `fix(ux): dashboard KPI mese + empty state + conteggi + microfix lista/catalogo`)

**FIX-15 — Dashboard: KPI "del mese" si contraddicono con le liste "totali"**
- Causa confermata: in `app/(app)/dashboard/page.tsx` (righe ~393-417) le card KPI mostravano titoli generici ("Preventivi accettati", "Valore preventivi", "Valore fatturato") con `sub` = "{mese} · vs mese scorso" — non sufficientemente esplicito da evitare la lettura come bug rispetto ai TOTALI mostrati in `/preventivi` e `/fatture`. Inoltre `calcDelta()` (riga 50-53) ritorna `100` quando `previous=0 && current>0` e una percentuale negativa proporzionale quando `current=0` — generando "-100%" in rosso nei primissimi giorni del mese, demoralizzante e poco significativo (pochissimi dati).
- Fix:
  - Titoli card resi espliciti: "Preventivi accettati" → **"Accettati questo mese"**, "Valore preventivi" → **"Valore accettati questo mese"**, "Valore fatturato" → **"Fatturato questo mese"** (oltre al `sub` con il nome del mese, già presente).
  - Nuovo helper `suppressEarlyMonthDelta(now, delta, currentValue)`: nasconde il delta (ritorna `null` → `KpiCard` non lo mostra) quando `now.getDate() <= 5` **e** il valore corrente del mese è ancora `0` — evita "-100%" fuorviante nei primi 5 giorni quando non c'è ancora storico significativo. Applicato a tutte e 3 le KPI mensili.
  - Nessuna modifica a `KpiCard.tsx` necessaria (il componente già gestisce `delta=null` senza mostrare nulla).

**FIX-16 — Empty state sbagliato sui filtri (es. tab "Rifiutati")**
- Causa confermata: `app/(app)/preventivi/page.tsx` (righe ~339-352, ora ~360+) — l'empty state controllava SOLO `q` (ricerca testuale): qualunque tab di stato (`status=rejected` ecc.) o filtro avanzato senza risultati mostrava sempre *"Nessun preventivo ancora — Crea il primo preventivo"*, fuorviante quando i documenti esistono ma non corrispondono al filtro.
- Fix: aggiunta logica che distingue "nessun documento in assoluto" da "nessun risultato per il filtro attivo": se `status` è valorizzato → messaggio specifico per stato (mappa `STATUS_EMPTY_LABELS`: "Nessuna bozza"/"Nessun preventivo in attesa"/"...accettato"/"...rifiutato"); se altri filtri/ricerca attivi → "Nessun risultato per i filtri selezionati"; CTA "Crea il primo preventivo" mostrata SOLO quando non c'è alcun filtro/ricerca attivo (altrimenti fuorviante — l'utente ha già documenti).
- Stesso pattern applicato in `app/(app)/fatture/page.tsx` (righe ~193-203): empty state ora distingue `q` / `hasFilters` (filtri avanzati) / nessun filtro, con CTA "Vai ai preventivi accettati" mostrata solo nell'ultimo caso.

**FIX-17 — Conteggio "totali" e grammatica errati in Fatture**
- Causa confermata: `app/(app)/fatture/page.tsx` riga 147 — `{fatture?.length ?? 0} fatture totali` mostrava SEMPRE "fatture totali" anche quando la lista era già filtrata da ricerca/filtro (es. cercando "Pagata" → "1 fatture totali": sbagliato sia perché non sono "totali" — sono i risultati del filtro — sia per la grammatica plurale errata su "1").
- Fix: nuova logica — con `q` o filtri avanzati attivi (`hasFilters`) → **"N risultato"/"N risultati"**; senza filtro → **"N fattura"/"N fatture"** con singolare/plurale corretto.

**FIX-18 — Doppio bottone "Nuovo preventivo" in dashboard**
- Causa confermata: `app/(app)/dashboard/page.tsx` (righe ~352-357) aveva un bottone hero `<Button asChild size="lg"><Link href="/preventivi/nuovo"><Plus />Nuovo preventivo</Link></Button>` IDENTICO (stessa destinazione, stesso testo) a quello già presente nell'header globale `AppShell.tsx` (riga ~252, visibile su ogni pagina dell'app) — i due bottoni comparivano vicinissimi sullo schermo.
- Fix: rimosso il duplicato dall'hero dashboard; resta solo l'header globale. Header dashboard semplificato a solo titolo+sottotitolo (rimosso il `flex items-center justify-between` superfluo).

**FIX-19 — Nuova voce nasce con Q.tà 0 (totale sempre 0)**
- Causa confermata: `app/(app)/preventivi/_components/VociTable.tsx` — `newVoce()` impostava `quantity: 0`, più altre 2 occorrenze nei path di inserimento da catalogo (righe ~147, ~161) e un confronto "riga vuota" (`last.quantity === 0`, riga ~135) coerente con quel default.
- Fix: tutte e 4 le occorrenze cambiate a `quantity: 1` — una nuova voce nasce ora con Q.tà 1 (prezzo resta 0 finché non inserito, come da specifica).

**FIX-20 — Modifica voce catalogo non precarica l'Unità di misura**
- Causa confermata — **non era un problema di stato**: `app/(app)/catalogo/_components/CatalogItemForm.tsx` inizializzava correttamente `useState(item?.unit ?? UNITS[0].value)`. Il problema era che `UNIT_OPTIONS`/`UNITS` (fonte di verità in `lib/constants/units.ts`) NON contiene il valore `"h"` — voci di catalogo storiche con unità libera "h" (es. "Manodopera idraulica") non trovavano corrispondenza in nessun `<SelectItem>`, e `<SelectValue>` appariva vuoto pur con lo state correttamente valorizzato.
- Fix: nuovo helper `buildUnitOptions(savedUnit)` — se il valore salvato non è tra le opzioni standard, lo aggiunge dinamicamente in coda alla lista (resta visibile e selezionato in modifica, senza toccare la costante condivisa `UNIT_OPTIONS` marcata "fonte di verità — non duplicare"). `CatalogItemRow.tsx` verificato: mostra solo testo, nessun edit inline — nessuna modifica necessaria lì.

**FIX-21 — "AI Import" presentato come incluso mentre il bottone è "IN ARRIVO"**
- Causa confermata: `lib/stripe/plans.ts` (`PLAN_PRICING.pro.features`), `impostazioni/tabs/piano.tsx` (`PLAN_FEATURES.pro/lifetime`) e `abbonamento/page.tsx` (`FeaturePill label="AI Import" value={features.aiImport ? 'Incluso' : 'Non incluso'}`) presentavano la feature come pienamente disponibile, mentre `AiImportButton.tsx` mostra "IN ARRIVO" disabilitato finché `NEXT_PUBLIC_AI_IMPORT_ENABLED !== 'true'` — promessa di una funzione non attiva.
- Fix: nuova costante `AI_IMPORT_ENABLED` + helper `aiImportLabel(base)` in `lib/stripe/plans.ts` (stesso pattern già in uso in `AiImportButton.tsx`) — quando il flag è off, appende "(in arrivo)" al testo; quando è on, mostra il testo semplice. Applicato in:
  - `PLAN_PRICING.pro.features`: `aiImportLabel('AI Import da foto/PDF')`
  - `impostazioni/tabs/piano.tsx`: `aiImportLabel('AI Import (foto → preventivo)')` (pro), `aiImportLabel('AI Import')` (lifetime)
  - `abbonamento/page.tsx`: `<FeaturePill>` ora mostra "Non incluso" / "Incluso" / **"In arrivo"** (nuovo terzo stato) in base a `features.aiImport && AI_IMPORT_ENABLED`.

**FIX-22 — Tasto "+" (Nuovo preventivo / Nuova fattura) senza hover**
- Causa confermata: `components/ui/button.tsx` riga 12 — `variant="default"` usa il selettore Tailwind `[a]:hover:bg-primary/80`, che applica l'hover SOLO quando il `<Button>` CONTIENE un `<a>` come figlio. Ma "Nuovo preventivo"/"Nuova fattura" usano `<Button asChild><Link>...</Link></Button>` — con `asChild`, il `<Button>` stesso DIVENTA l'`<a>` (via `Slot.Root`), quindi quel selettore non matcha mai e il bottone appare senza hover/cursore. Il bottone "Esporta CSV" accanto usa `variant="outline"` con `hover:bg-muted` semplice (funziona sempre) — da qui la percezione di incoerenza.
- Fix mirato (NO modifica al componente condiviso `button.tsx`, che impatterebbe l'intera app senza screenshot di verifica): aggiunta classe esplicita `hover:bg-primary/80 cursor-pointer` ai due bottoni interessati in `preventivi/page.tsx` (riga ~285) e `fatture/page.tsx` (riga ~161).

**FIX-23 — Grafico "Andamento" senza scala asse Y**
- Causa confermata: `components/dashboard/RevenueChart.tsx` — `<BarChart>` aveva solo `<XAxis>`, nessun `<YAxis>`: l'altezza delle barre era priva di riferimento assoluto visibile (i valori comparivano solo al passaggio del mouse, inutile su mobile/touch).
- Fix: aggiunto `<YAxis axisLine={false} tickLine={false} tickFormatter={formatEurCompact} allowDecimals={false} width={48}>` con nuovo helper `formatEurCompact()` (formato compatto "1,2k €" per valori ≥ 1000, altrimenti "N €") — basso rischio, `recharts` già in uso, nessuna modifica al resto del grafico/legenda/tooltip.

**FIX-24 — Avviso nota legale incoerente col regime fiscale (DEFERITO A BACKLOG)**
- Investigato: `LegalNoticeField.tsx` non riceve né conosce `fiscal_regime` del workspace — il dato non è nemmeno selezionato nella query di `template/page.tsx` (`select('id, plan, name, ragione_sociale, logo_url')`). Implementare un confronto testo/regime richiederebbe far transitare `fiscal_regime` attraverso ≥5 file (`template/page.tsx` → `DefaultTemplateCard`/`CustomTemplateCard` → `DefaultSettingsForm`/`TemplateEditor` → `LegalNoticeField`), con relativo rischio di toccare componenti UI marcati "non modificare senza screenshot" (sez. F).
- Decisione: rimandato a backlog, come esplicitamente consentito dal prompt ("Se troppo oneroso, lasciare a backlog") — è un fix "minore, da valutare", non bloccante per il commit.

**FIX-25 — Stato fattura collegata nella lista preventivi (VERIFICA — già implementato)**
- Verificato `app/(app)/preventivi/page.tsx`: la query `convertedFattureMap` (righe ~172-184, batch unico, niente N+1) e il rendering badge (righe ~408-431: "Fattura pagata"/"Fattura emessa"/"Bozza fattura"/"Fattura annullata" mappati su stati REALI fattura `accepted`/`sent`|`viewed`/`draft`/`rejected`, NON "accettata"/"visto" da preventivo) erano **già presenti e corretti** — nessuna modifica necessaria. Il fix risultava già completo da una sessione precedente (probabilmente FIX-02/sessione 25, non documentato esplicitamente con questo numero).

### File toccati (sessione FIX-05)
```
app/(app)/dashboard/page.tsx                              [FIX-15: titoli KPI "questo mese" + suppressEarlyMonthDelta; FIX-18: rimosso bottone hero duplicato]
app/(app)/preventivi/page.tsx                             [FIX-16: empty state per filtro/stato; FIX-22: hover esplicito bottone "Nuovo preventivo"]
app/(app)/fatture/page.tsx                                [FIX-17: conteggio "N risultati"/"N fatture" corretto; FIX-16: empty state per filtro; FIX-22: hover esplicito "Nuova fattura"]
app/(app)/preventivi/_components/VociTable.tsx            [FIX-19: quantity default 0→1 in 4 punti]
app/(app)/catalogo/_components/CatalogItemForm.tsx        [FIX-20: buildUnitOptions() — precarica unità "libere"/legacy non in UNIT_OPTIONS]
lib/stripe/plans.ts                                       [FIX-21: AI_IMPORT_ENABLED + aiImportLabel() helper, applicato a PLAN_PRICING.pro.features]
app/(app)/impostazioni/tabs/piano.tsx                     [FIX-21: aiImportLabel() su feature pro/lifetime]
app/(app)/abbonamento/page.tsx                            [FIX-21: FeaturePill AI Import → "Non incluso"/"Incluso"/"In arrivo"]
components/dashboard/RevenueChart.tsx                     [FIX-23: <YAxis> + formatEurCompact()]
CLAUDE.md                                                 [aggiornato]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde (nessun errore)
- `npm run build` → verde, 35 route generate
- Verifica per ispezione codice (no browser — vedi nota su ambiente locale sessione 24): per ogni fix, causa confermata con citazione file/riga; FIX-25 verificato come già implementato leggendo query + rendering badge esistenti.
- **Non testato in browser reale**: (1) KPI dashboard a inizio mese senza delta "-100%"; (2) empty state tab "Rifiutati"/filtri; (3) conteggio "N risultati" in fatture filtrate; (4) hover sui bottoni "Nuovo preventivo"/"Nuova fattura"; (5) scala asse Y nel grafico Andamento — richiede verifica manuale da browser.

### Esito finale
🟡 FIX APPLICATO — cause confermate con citazioni file/riga per ognuno dei 9 punti (incluso FIX-25 verificato come già presente e FIX-24 motivatamente rimandato a backlog), tsc+build verdi. Da verificare manualmente in browser: i 5 punti elencati sopra in "Test eseguiti".

---

## A. HANDOFF — SESSIONE FIX-04 (8 giugno 2026)

### Fix applicati (commit `fix(cliente): email testo link-only + no email personale + documento pubblico responsive`)

**FIX-11 — L'email dice "PDF allegato" ma si invia solo il link**
- **Causa confermata — NON c'è alcun allegato PDF**: per scelta di prodotto (CLAUDE.md B.8, sessione 23) l'email invia SOLO il link pubblico (`/p/[token]`), l'allegato è stato rimosso perché il template dell'allegato non corrispondeva a quello scelto dall'utente. Il testo "PDF allegato" era residuo.
- Trovati 2 punti col testo errato:
  - `components/email/PreventivoEmail.tsx` riga 95: box informativo *"{La fattura/Il preventivo} in formato PDF è allegat{a/o} a questa email…"*
  - `app/(app)/preventivi/_components/ViewHistorySection.tsx` riga 39: tooltip *"queste aperture riguardano il link online, non l'allegato PDF dell'email"* — anche questo presuppone un allegato inesistente.
- `send-email/route.ts` e `SendEmailDialog.tsx` già corretti (default message "Le faccio avere il link…", nessuna menzione PDF) — nessuna modifica necessaria lì.
- Fix:
  - `PreventivoEmail.tsx`: box ora dice *"Puoi visualizzare {il preventivo/la fattura} online tramite il link qui sotto."* + per i preventivi *"Da lì puoi anche **accettarlo o rifiutarlo** direttamente online."* — niente più riferimenti ad allegati, testo parametrizzato preventivo/fattura.
  - `ViewHistorySection.tsx`: tooltip riformulato *"Ogni apertura del **link online** inviato via email viene registrata con data, ora e IP…"* — rimossa la menzione dell'allegato PDF inesistente.

**FIX-12 — Email personale dell'artigiano esposta al cliente**
- Causa confermata: `app/p/[token]/page.tsx` (righe 172-177) recupera `ownerEmail` via `admin.auth.admin.getUserById(workspace.owner_id)` — è l'**email di login dell'account** (es. `elly.4ee@gmail.com`), non un contatto business. Verificato che NON esiste un campo email/contatto business separato in `workspaces` (schema controllato in `types/database.ts`: solo `piva`, `indirizzo`, niente `email`/`pec`/`contact_email`). Verificato anche che `send-email/route.ts` riga 401 usa lo stesso `user.email` come `reply_to` — quindi l'indirizzo è già coerente col canale email, ma **veniva anche stampato in chiaro** come testo cliccabile in `ActionBar.tsx` (riga 61: `{contactEmail}` mostrato per esteso accanto a "Hai domande? Contatta {workspaceName}:").
- Decisione presa: poiché non esiste un'email business alternativa nello schema (allineare al `reply_to` non cambia l'indirizzo, è lo stesso), la soluzione minima e sicura è **non stampare più l'indirizzo in chiaro** — il link `mailto:` resta funzionante (apre il client di posta del cliente), ma il testo del link mostra solo "Contatta {workspaceName}" invece dell'indirizzo email per esteso. Stesso pattern già usato per le fatture (bottone "Contatta {workspaceName}" senza indirizzo visibile).
- Fix: `ActionBar.tsx` — rimossa la stampa di `{contactEmail}` come testo del link; ora il link `mailto:${contactEmail}` mostra solo "Contatta {workspaceName}" (icona Mail + testo). Il numero di telefono (`contactPhone`) resta visibile per esteso (non è un dato dell'account, è un recapito scelto consapevolmente).

**FIX-13 — Il documento pubblico richiede scroll orizzontale e taglia il contenuto su mobile**
- Causa confermata in `components/public/DocumentFrame.tsx`:
  1. Lo scale veniva calcolato in `useEffect` (dopo il paint) → primo render sempre con `scale=1` (iframe 794px fissi): su contenitori stretti (es. 360px) il documento appariva per un istante a piena larghezza, clippato dal contenitore (`overflow-hidden`) — "PREVENTIVO" tagliato in "PREV", totale fuori vista. Su dispositivi/condizioni dove il primo `setScale` non si "agganciava" in tempo al render visibile (font loading, layout shift), il flash diventava persistente.
  2. Il ricalcolo dipendeva SOLO da `window.addEventListener('resize', ...)`: qualunque variazione della larghezza del CONTENITORE non accompagnata da un resize della finestra (caricamento font, comparsa/scomparsa di scrollbar, rotazione su iOS Safari, ecc.) non veniva mai recalcolata — lo scale restava quello (sbagliato) calcolato al mount.
- Fix:
  - Sostituito `useEffect` con **`useLayoutEffect`** → lo scale viene calcolato e applicato PRIMA che il browser dipinga il frame, eliminando il flash di contenuto a piena larghezza/tagliato.
  - Sostituito il listener `window.resize` con un **`ResizeObserver`** sul contenitore (con fallback su `window.resize` se `ResizeObserver` non è disponibile) — segue ogni variazione reale della larghezza, non solo il resize della finestra.
  - `computeScale` ora usa `Math.min(1, containerWidth / A4_WIDTH_PX)` con guardia su `containerWidth` falsy (evita `scale = 0` o `NaN` in casi limite).
  - Aggiunto `overflowX: 'hidden'` esplicito + `max-w-full` sul contenitore come rete di sicurezza contro lo scroll orizzontale residuo.
- Nessuna modifica al layout interno del documento (`buildPdfHtml`/4 preset — INTOCCABILE) — solo al meccanismo di scaling esterno del frame.

**FIX-14 — Footer/diciture documento coerenti col tipo (verifica)**
- Verificato `lib/pdf/template.ts` post-FIX-02 (sessione precedente): `brandingSpan()` già condizionato (`isFattura ? 'Fattura generata' : 'Preventivo generato'`), tutte le occorrenze di "Valido fino al"/"Preventivo valido fino al" già condizionate con `!isFattura &&` (righe 473, 496, 607, 867). Nessuna occorrenza residua non condizionata — **nessuna modifica necessaria**, il fix della sessione FIX-02 copre già questo punto anche lato pagina pubblica (stessa fonte unica `buildPdfHtml`).

### File toccati (sessione FIX-04)
```
components/email/PreventivoEmail.tsx                      [box "PDF allegato" → testo link-only parametrizzato preventivo/fattura]
app/(app)/preventivi/_components/ViewHistorySection.tsx   [tooltip: rimossa menzione allegato PDF inesistente]
app/p/[token]/_components/ActionBar.tsx                   [link contatto: niente più indirizzo email in chiaro, solo "Contatta {workspaceName}"]
components/public/DocumentFrame.tsx                       [useLayoutEffect + ResizeObserver per scaling corretto senza flash; overflow-x:hidden esplicito]
CLAUDE.md                                                 [aggiornato]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, 35 route generate
- `npm test -- --run` → 176/176 verdi
- Verifica per ispezione codice: grep `PDF allegat\|allegat.*PDF\|in formato PDF` su tutto il progetto → solo commenti di codice residui (non testo utente); grep `Valido fino al\|Preventivo generato` su `lib/pdf/template.ts` → tutte le occorrenze condizionate `isFattura`/`!isFattura`.
- **Non è stato possibile testare in browser reale su 360px** (nessun ambiente locale con dati/token pubblici disponibili in questa sessione — vedi nota CLAUDE.md sessione 24 sul worktree). Il fix di `DocumentFrame.tsx` è stato verificato per LOGICA (timing `useLayoutEffect` pre-paint + `ResizeObserver` per ricalcolo continuo) ma NON con screenshot reale.

### Esito finale
🟡 FIX APPLICATO — cause confermate con citazioni file/riga (in particolare: **confermato che NON esiste alcun allegato PDF** nell'architettura attuale, il testo era residuo di una vecchia funzionalità rimossa), tsc+build+test verdi. Da verificare manualmente: (1) email ricevuta non menziona più "PDF allegato"; (2) pagina pubblica non mostra più l'indirizzo email personale in chiaro (solo bottone "Contatta {azienda}"); (3) su 360px il documento pubblico si scala per intero senza scroll orizzontale né tagli — **richiede screenshot reale da browser/dispositivo mobile, non eseguibile in questa sessione**.

---

## A. HANDOFF — SESSIONE FIX-03 (7 giugno 2026)

### Fix applicati (commit `fix(numerazione): strip prefisso Prev ovunque + bozze coerenti + helper text`)

**FIX-8 — Prefisso "Prev"/"Fatt" grezzo ancora visibile (form, link cliente, CSV)**
- Causa confermata: `formatDocNumber()` (`lib/utils/index.ts`) strippa correttamente il prefisso legacy per la UI in-app, ma diversi punti NON ci passavano attraverso:
  - `PreventivoForm.tsx` riga ~218: lo state iniziale del campo "Numero" veniva popolato con `defaultValues?.doc_number` grezzo → un documento legacy con `doc_number = "Prev009/2026"` mostrava "Prev009/2026" nel form editabile (e lo riproponeva tale e quale al salvataggio).
  - `lib/pdf/template.ts` (`buildPdfHtml`, fonte unica per PDF e link pubblico `/p/[token]` via `<DocumentFrame src=".../pdf?preview=1">`): 11 occorrenze usavano `doc.doc_number` grezzo nell'HTML generato (header documento, `pageTitle`/nome file PDF, ecc.) — nessuna strippava il prefisso legacy. Il documento embeddato nell'iframe del link cliente mostrava quindi "#Prev009/2026" anche se l'header `<span>` della pagina (riga 205, già corretto con `formatDocNumber`) mostrava "009/2026".
  - `app/api/preventivi/export-csv/route.ts` (riga 91) e `app/api/fatture/export-csv/route.ts` (riga 86): scrivevano `doc.doc_number`/`ft.doc_number` grezzo in CSV → righe miste "Prev009/2026" (legacy) e "010/2026" (nuovo formato).
- Fix:
  - `PreventivoForm.tsx`: `useState` iniziale ora fa `defaultValues?.doc_number?.replace(/^[A-Za-z]+/, '') ?? ...` — il campo "Numero" mostra/salva sempre il valore pulito.
  - `lib/pdf/template.ts`: aggiunta variabile `docNumberClean = doc.doc_number ? doc.doc_number.replace(/^[A-Za-z]+/, '') : null` subito dopo `docTypeLabel`; sostituite TUTTE le 11 occorrenze di `doc.doc_number` nell'HTML/`pageTitle` con `docNumberClean` (incluse due righe quasi-duplicate 381/399 per varianti header logo-destra/sinistra del preset Classico — entrambe ora coerenti).
  - `export-csv` (preventivi e fatture): import `formatDocNumber`; valore scritto ora `doc.doc_number ? formatDocNumber(doc.doc_number[, 'fattura']) : ''` — niente più prefisso legacy, fatture mostrano "Fatt. 001/2026" come nel resto dell'app, vuoto per le bozze senza numero (coerente con CSV = export dati, non placeholder UI).

**FIX-9 — Numerazione bozze incoerente ("–" vs numero)**
- Causa confermata: per decisione prodotto sessione 26, `createDocumentAction` assegna SEMPRE un `doc_number` alla creazione (anche per le bozze) — ma i documenti creati PRIMA di questa modifica hanno `doc_number = null` in DB. `formatDocNumber(null)` ritorna `'—'` (em-dash), che appare come un trattino misterioso accanto a bozze più recenti che mostrano regolarmente "008/2026" ecc. Non è un bug di assegnazione (verificato `allocateDocNumber`/`createDocumentAction` — funzionano correttamente per tutti i nuovi documenti), ma una conseguenza visibile del cambio di policy su dati storici.
- Decisione presa (nessuna riassegnazione retroattiva — rischiosa: potrebbe creare conflitti/buchi nella sequenza): sostituito il placeholder ambiguo `'—'` con un'etichetta esplicita **"Bozza senza numero"** (corsivo, muted) nelle liste preventivi e fatture, SOLO quando `doc_number` è effettivamente `null`. Lasciato invariato `formatDocNumber` (usato altrove con pattern `!== '—' ? ... : fallback` — cambiarne il valore di ritorno avrebbe rotto quei controlli in 6+ file).
- File: `app/(app)/preventivi/page.tsx` (riga ~378), `app/(app)/fatture/page.tsx` (riga ~208) — entrambe `{doc.doc_number ? formatDocNumber(...) : <span className="...italic text-muted-foreground">Bozza senza numero</span>}`.

**FIX-10 — Helper text contraddittorio sul campo "Numero"**
- Verificato `PreventivoForm.tsx`: sostituito il blocco ternario che mostrava alternativamente "Numero manuale — verrà usato all'invio." oppure "Le bozze non hanno un numero ufficiale. Il numero definitivo viene assegnato automaticamente all'invio." (falso: dalla sessione 26 le bozze HANNO sempre un numero alla creazione) con un unico messaggio coerente: **"Numero assegnato automaticamente alla creazione — modificabile manualmente."**
- `FatturaForm.tsx`: testo "Modifica la parte numerica se necessario." verificato — non contraddittorio (form di creazione nuova fattura, usa `peekNextInvoiceNumber()` che ritorna sempre formato pulito `NNN/YYYY`), nessuna modifica necessaria.

### File toccati (sessione FIX-03)
```
app/(app)/preventivi/_components/PreventivoForm.tsx    [doc_number iniziale strippato; helper text unico "Numero assegnato automaticamente..."]
lib/pdf/template.ts                                    [docNumberClean: strip prefisso legacy in pageTitle + 11 occorrenze HTML (incl. righe 381/399 duplicate)]
app/api/preventivi/export-csv/route.ts                 [import formatDocNumber; numero CSV pulito, niente prefisso legacy]
app/api/fatture/export-csv/route.ts                    [idem, con marcatore 'fattura' → "Fatt. 001/2026"]
app/(app)/preventivi/page.tsx                          [placeholder "Bozza senza numero" per doc_number null]
app/(app)/fatture/page.tsx                             [idem]
CLAUDE.md                                              [aggiornato]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde (nessun errore)
- `npm run build` → verde, 35 route generate
- `npm test -- --run` → 176/176 verdi (nessuna regressione su `formatDocNumber`/template/export)
- Verifica per ispezione codice (no browser, causa assenza ambiente con dati legacy in locale): grep `doc\.doc_number` su `lib/pdf/template.ts` post-fix → solo la riga di assegnazione `docNumberClean` rimane con riferimento grezzo; nessuna occorrenza display residua. CSV export: entrambe le route ora passano per `formatDocNumber` su valori non-null.

### Esito finale
🟡 FIX APPLICATO — causa confermata con citazioni file/riga, fix coerente con la policy di numerazione (sez. B.3), tsc+build+test verdi. Da verificare manualmente in browser: (1) form preventivo legacy con "Prev..." mostra numero pulito ed editabile; (2) link pubblico cliente di un documento legacy non mostra più "#Prev..."; (3) CSV export non contiene più prefissi misti; (4) lista preventivi/fatture mostra "Bozza senza numero" al posto di "–" per le bozze storiche senza numero.

---

## A. HANDOFF — SESSIONE FIX-02 (7 giugno 2026)

### Fix applicati (commit `fix(fatture): coerenza stati/etichette/grammatica vs preventivo`)

**FIX-4 — Badge "Visto" su fatture**
- Causa confermata: in `StatusBadge.tsx` (riga 65) l'override per `docType='fattura'` impostava solo `overrideDescription` per lo stato `viewed`, lasciando `overrideLabel` indefinito → fallback su `config.label = 'Visto'` (concetto da preventivo).
- Fix: aggiunto `overrideLabel = 'Inviata'` per `viewed` quando `docType === 'fattura'` — la fattura resta "Inviata" anche dopo l'apertura del link da parte del cliente (lo stato interno `viewed` non cambia, cambia solo l'etichetta mostrata).
- `DocumentTimeline.tsx`: l'evento "Prima apertura" è generico (icona Eye), nessuna dicitura "Visto" — nessuna modifica necessaria lì.

**FIX-5 — Diciture "da preventivo" nelle fatture (validità/scadenza)**
- Causa confermata: `lib/pdf/template.ts` aveva diversi punti non condizionati su `isFattura`:
  - riga 344 `brandingSpan()`: footer fisso `"Preventivo generato con Carta Canta · cartacanta.app"` per tutti i preset/doc_type
  - riga 491 (preset Bold, contactParts header): `Valido fino al: ${expiresDateShort}` senza check `isFattura`
  - riga 602 (footer di un preset): `Valido fino al ${expiresDate}` senza check `isFattura`
  - (le righe 411, 468, 805, 862 erano già correttamente condizionate con `!isFattura`)
- Fix (solo testo condizionale, NESSUNA modifica al layout dei 4 preset — verificato build):
  - `brandingSpan()`: footer ora `"Fattura generata con Carta Canta…"` per `isFattura`, `"Preventivo generato…"` altrimenti
  - riga 491 e 602: aggiunta condizione `!isFattura &&` — per le fatture la riga "Valido fino al" non compare (via minima scelta come da nota prodotto: rimuovere la dicitura invece di mostrarla errata; la vera scadenza-pagamento arriverà con la feature Pagamenti #2)
- `DocumentTimeline.tsx` riga 127: l'evento cronologia "Scade il" (icona Clock, stile preventivo/validità) ora condizionato `!isFattura && (status === 'sent' || status === 'viewed') && expiresAt` — non compare più sulle fatture. L'evento "Scaduta"/"Scaduto" (status `expired`, riga 119-126) resta — riflette uno stato reale del documento, non una dicitura di "validità".
- `app/p/[token]/page.tsx`: il banner di stato per `expired` era hardcoded "Preventivo scaduto" senza branch `isPreventivo` (riga 363-369 originale) — aggiunta variante fattura "Fattura scaduta — Questa fattura ha superato la data di scadenza…".
- `FatturaForm.tsx`: header voci "Voci preventivo" → ora parametrizzato (vedi FIX-5/VOCI sotto); campo "Validità (giorni)" → rinominato in **"Scadenza pagamento (giorni)"** (il campo alimenta comunque `validity_days`/`expires_at` lato DB — nessun cambio di logica, solo etichetta coerente col dominio fattura, accanto a "Termini di pagamento" già presente).

**FIX-5bis — Header "VOCI PREVENTIVO" nel form fattura**
- Causa confermata: l'header è hardcoded `"Voci preventivo"` in `VociTable.tsx` riga 121 — componente condiviso tra `PreventivoForm` e `FatturaForm`, senza alcuna prop che lo distinguesse.
- Fix: aggiunta prop opzionale `docType?: 'preventivo' | 'fattura'` (default `'preventivo'`) a `VociTable`; header ora `Voci {docType === 'fattura' ? 'fattura' : 'preventivo'}`. `FatturaForm.tsx` passa `docType="fattura"`.

**FIX-6 — Dialog che dicono "preventivo" su una fattura**
- Causa confermata: `ResendReminderDialog.tsx` aveva titolo/testo hardcoded `"Preventivo aggiornato"` / `"Vuoi reinviare il preventivo adesso?"`, nessuna prop `docType`. `RestoreVersionButton.tsx` aveva già `docType` (fix sessione FIX-01) — nessuna modifica necessaria lì.
- Fix: aggiunta prop opzionale `docType?: 'preventivo' | 'fattura'` (default `'preventivo'`) a `ResendReminderDialog`; titolo e testo ora `"Fattura aggiornata"` / `"Vuoi reinviare la fattura adesso?"` quando `isFattura`. `PreventivoForm.tsx` (componente condiviso, usato anche per le fatture) passa `docType={docType}` (variabile già presente nello scope, riga 131).

**FIX-7 — Grammatica femminile mancante per le fatture**
- Causa confermata:
  - `SendEmailDialog.tsx` riga 605: `"Dopo l'invio lo stato passerà a Inviato"` hardcoded maschile, anche per `docType === 'fattura'`.
  - `app/p/[token]/page.tsx` riga 195: `{docLabelCap} inviato tramite…` — sempre maschile, anche quando `docLabelCap = 'Fattura'`.
- Fix: entrambi ora condizionati su `docType`/`isPreventivo` → `"passerà a Inviata"` e `"Fattura inviata tramite…"` per le fatture; il preventivo resta invariato ("Inviato"/"Preventivo inviato tramite…").

**FIX-7bis — Avviso di trasparenza SdI sulle fatture**
- Aggiunto banner discreto (ambra, icona `AlertTriangle` già importata) in `app/(app)/fatture/[id]/page.tsx`, subito sotto l'intestazione del documento (sopra il blocco "Collegata al preventivo…"): *"Questo documento non sostituisce la fattura elettronica. Ricordati di trasmetterla tramite SdI (cassetto fiscale o commercialista)."* — solo per le fatture, nessuna logica fiscale, nessuna modifica al template PDF (per non rischiare regressioni di layout sui 4 preset INTOCCABILI).

### File toccati (sessione FIX-02)
```
app/(app)/preventivi/_components/StatusBadge.tsx        [overrideLabel='Inviata' per status viewed su fatture]
app/(app)/preventivi/_components/DocumentTimeline.tsx   [evento "Scade il" nascosto per fatture (!isFattura)]
lib/pdf/template.ts                                     [brandingSpan condizionale isFattura; "Valido fino al" condizionato !isFattura in 2 punti — solo testo, layout preset invariato]
app/p/[token]/page.tsx                                  ["inviato"→"inviat{o|a}"; banner stato 'expired' con variante fattura]
app/(app)/fatture/_components/FatturaForm.tsx           [docType="fattura" a VociTable; label "Scadenza pagamento (giorni)"]
app/(app)/preventivi/_components/VociTable.tsx          [prop docType; header "Voci preventivo"/"Voci fattura"]
app/(app)/preventivi/_components/ResendReminderDialog.tsx [prop docType; titolo/testo "Fattura aggiornata"/"reinviare la fattura"]
app/(app)/preventivi/_components/PreventivoForm.tsx     [docType={docType} passato a ResendReminderDialog]
app/(app)/preventivi/_components/SendEmailDialog.tsx    ["passerà a Inviata" per fatture]
app/(app)/fatture/[id]/page.tsx                         [banner trasparenza SdI sotto l'intestazione]
CLAUDE.md                                               [aggiornato]
```

---

## A. HANDOFF — SESSIONE FIX-09 (7 giugno 2026)

### Fix applicato (commit `fix(invio): reinvio email bloccata sul cliente`)

**Bug — "Reinvia al cliente" permetteva di modificare l'email destinatario senza alcun effetto persistente**
- Causa confermata: in `app/api/documents/[id]/send-email/route.ts` la creazione/associazione cliente avviene SOLO quando `!doc.client_id` (branch `if (!doc.client_id && body.clientId)` / `else if (!doc.client_id && body.to)`). Sul reinvio `doc.client_id` è già valorizzato → quei branch vengono saltati: l'email parte verso `body.to` ma cliente/email del documento non cambiano. Inoltre `SendEmailDialog.tsx` reimposta `to = clientEmail` ad ogni apertura del dialog (via `useEffect`), quindi la modifica manuale non persiste mai — comportamento fuorviante (l'utente crede di aver cambiato il destinatario in modo permanente).
- **Decisione di prodotto confermata:** "Reinvia" = rimandare lo STESSO documento allo STESSO cliente. L'email non è modificabile dal dialog di reinvio; per cambiare destinatario bisogna modificare l'email del cliente nella rubrica Clienti.
- Fix in `SendEmailDialog.tsx`:
  - Nuova prop opzionale `clientId?: string | null` (per il link "rubrica Clienti").
  - Campo "Email destinatario": quando `isResend && hasClient && clientEmail` → `<Input readOnly disabled>` con stile `bg-muted/50 text-muted-foreground cursor-default`, valore = email del cliente; sotto, testo di aiuto "Per inviare a un altro indirizzo, modifica l'email del cliente nella rubrica Clienti." con link a `/clienti/[clientId]` quando l'id è disponibile (sempre disponibile nei due punti che aprono il dialog in reinvio).
  - Caso "reinvio ma cliente senza email salvata" (`isResend && hasClient && !clientEmail`): campo resta editabile, mantenuto messaggio esistente "Nessuna email salvata per questo cliente."
  - Primo invio (`!hasClient`): invariato — `ClientSearchInput` editabile con autocomplete.
- `preventivi/[id]/page.tsx` e `fatture/[id]/page.tsx`: aggiunta `clientId={pdfClient?.id ?? null}` al `<SendEmailDialog isResend>`. Per la fattura aggiunti anche `recipientName` e `hasClient` (mancavano, allineati a `preventivi/[id]/page.tsx`; `hasClient` di default era `true` quindi nessuna regressione, ma ora è esplicito e corretto anche per documenti senza cliente).

**Verifica richiesta dal prompt (non-fix, solo controllo):** in entrambe le pagine dettaglio il blocco di reinvio è gated da `(doc.status === 'sent' || doc.status === 'viewed')` e passa sempre `hasClient={!!pdfClient}` + `recipientName`. Quando il documento ha un cliente (`pdfClient` non null), `hasClient` è `true` → la variante "con cliente" (header "A: …" + campo email) è sempre quella mostrata in reinvio, e la X di chiusura del dialog (parte del `<DialogContent>` shadcn, non condizionata da `hasClient`) è sempre presente. Non è stato possibile riprodurre uno stato in cui `hasClient` diventi `false` per un documento con cliente — nessun bug separato da segnalare.

### File toccati (sessione FIX-09)
```
app/(app)/preventivi/_components/SendEmailDialog.tsx   [clientId prop; campo email read-only in reinvio con cliente+email; testo guida con link rubrica]
app/(app)/preventivi/[id]/page.tsx                     [clientId={pdfClient?.id ?? null} a SendEmailDialog isResend]
app/(app)/fatture/[id]/page.tsx                        [clientId, recipientName, hasClient a SendEmailDialog isResend]
CLAUDE.md                                              [aggiornato]
```

---

## A. HANDOFF — SESSIONE FIX-08 (7 giugno 2026)

### Fix applicati (commit `fix(invio): conflitto cliente + cliente dopo invio + badge modificato su voci`)

**CHECK-1 — Falso conflitto "due contatti con la stessa email" selezionando un contatto esistente**
- Causa confermata: in `send-email/route.ts` (riga ~195) il controllo conflitto confrontava `existingClient.name` (solo "Mario") con `body.clientName` ("Mario Rossi" — nome+cognome dal dialog), generando un falso positivo per ogni contatto con cognome valorizzato. Inoltre `handleSelectClient` in `SendEmailDialog.tsx` non comunicava alla route che il contatto era stato scelto esplicitamente dall'autocomplete (non inviava l'id).
- Fix:
  - `SendEmailDialog.tsx`: aggiunto stato `selectedClientId`; `handleSelectClient` lo valorizza con `c.id`; nuovi wrapper `updateFirstName/updateLastName/updateTo` azzerano `selectedClientId` se l'utente modifica manualmente nome/cognome/email dopo la selezione (evita di associare l'id sbagliato); `handleSend` include `clientId` nel body quando presente (e in tal caso NON invia `clientName`).
  - `send-email/route.ts`: nuovo branch `if (!doc.client_id && body.clientId)` — verifica che il cliente appartenga al workspace e lo associa direttamente, **saltando del tutto** il controllo conflitto (scelta esplicita = nessuna ambiguità). Per il path con `clientName` digitato a mano: aggiunto `surname` alla `select` di `existingClient` e il confronto ora usa il nome COMPLETO `[name, surname].join(' ')` invece del solo `name`.

**CHECK-2 — Cliente non visibile nel dettaglio subito dopo l'invio**
- Causa confermata: `send-email/route.ts` salva correttamente `client_id` (verificato, righe ~230-242 prima della modifica). Il bug era lato UI: `PreventivoForm.tsx` riga 142 inizializza `selectedClient` una sola volta con `useState(defaultClient ?? null)` e non si risincronizza quando `defaultClient` cambia dopo `router.refresh()`.
- Fix: aggiunto `useEffect` in `PreventivoForm.tsx` che imposta `selectedClient = defaultClient` quando `defaultClient` diventa valorizzato **e** `selectedClient` è ancora `null` (non sovrascrive una selezione manuale dell'utente).

**CHECK-3 — Badge "Modificato" non compare cambiando solo descrizione/unità di una voce**
- Causa confermata: in `lib/actions/documents.ts`, sia `updateDocumentAction` (~righe 503-513) sia `saveDraftAction` (~righe 799-808) calcolavano `publicFieldsChanged` confrontando solo campi a livello documento + `Math.abs(fiscal.total - existingDoc.total) > 0.001`. Le voci non venivano confrontate riga per riga: cambi di quantità/prezzo alterano il totale (→ badge), ma descrizione/unità no (→ nessun badge).
- Fix: nuova funzione `itemsSignature()` (firma normalizzata `description|unit|quantity|unit_price|discount_pct|vat_rate` per riga, in ordine) + confronto vecchia/nuova lista voci. Estesa `publicFieldsChanged` in ENTRAMBE le action con `|| itemsChanged`.
  - `updateDocumentAction`: le voci originali ora vengono lette PRIMA del delete sempre quando `wasAlreadySent` (non solo quando manca `sent_snapshot` come prima), riusate sia per il confronto sia per l'eventuale `retroSnapshot`.
  - `saveDraftAction`: stessa logica — `originalItemsForCompare` letto sempre quando `wasAlreadySent`, riusato per `snapshotToCreate` e per il confronto. Il confronto è disattivato se `fiscal.itemTotals.length === 0` (in tal caso le voci nel DB restano invariate — comportamento tollerante preesistente — quindi nessun "cambio" da segnalare).

### File toccati (sessione FIX-08)
```
app/(app)/preventivi/_components/SendEmailDialog.tsx   [selectedClientId state + wrapper update*; clientId nel body invio]
app/api/documents/[id]/send-email/route.ts             [branch clientId → associazione diretta; surname in select + confronto nome completo]
app/(app)/preventivi/_components/PreventivoForm.tsx    [useEffect sync selectedClient ← defaultClient]
lib/actions/documents.ts                               [itemsSignature() helper; publicFieldsChanged esteso con itemsChanged in updateDocumentAction e saveDraftAction]
CLAUDE.md                                              [aggiornato]
```

---

## A. HANDOFF — SESSIONE FIX-01 (6 giugno 2026)

### Fix applicati (commit `ce3932d`)

**FIX-1 — Stato non aggiornato dopo invio (preventivo e fattura)**
- Causa: `router.refresh()` era chiamato solo nel bottone "Chiudi" del dialog di successo. Chiudendo via X/Escape la pagina non si aggiornava.
- Fix: `SendEmailDialog.tsx` — aggiunto `useEffect` che chiama `router.refresh()` + `toast.success` appena `sent` diventa `true`. Il refresh avviene in background anche se l'utente chiude via X.
- Aggiunta importazione `sonner` (già usata altrove nell'app).

**FIX-2 — "Ripristina versione inviata" su fattura → 404**
- Causa: `RestoreVersionButton.tsx` riga 30 hardcodeva `window.location.href = /preventivi/${documentId}` anche per le fatture.
- Fix: aggiunto prop `docType?: 'preventivo' | 'fattura'` (default `'preventivo'`). Il redirect usa `/${docType === 'fattura' ? 'fatture' : 'preventivi'}/${documentId}`.
- `fatture/[id]/page.tsx`: passato `docType="fattura"` a `RestoreVersionButton`.
- `lib/actions/documents.ts` `restoreToSentVersionAction`: aggiunti `revalidatePath('/fatture')` e `revalidatePath('/fatture/${documentId}')`.
- Testo del dialog ora dice "La fattura/Il preventivo" in base al tipo.

**FIX-3 — Cliente non riportato in conversione preventivo → fattura**
- Causa: `fatture/[id]/page.tsx` non costruiva `formDefaultClient` e non passava `defaultClient` a `PreventivoForm`, al contrario di `preventivi/[id]/page.tsx` che lo fa correttamente.
- Fix: aggiunto `id` e `surname` alla select di `pdfClient`; costruito `formDefaultClient`; passato `defaultClient={formDefaultClient}` a `PreventivoForm`.
- NB: la RPC `convert_preventivo_to_fattura` copiava già `client_id` correttamente — il bug era solo in come la fattura veniva poi visualizzata nel form.

### Rifinitura FIX-3 (commit successivo)
- `formDefaultClient` in `fatture/[id]/page.tsx` non includeva `surname` → il form mostrava solo "Mario" invece di "Mario Rossi".
- Fix: aggiunto `surname: pdfClient.surname ?? null` nell'oggetto. `PreventivoForm` usa già `(c as { surname?: string | null }).surname` nel display name (riga 561).

### File toccati (sessione FIX-01)
```
app/(app)/preventivi/_components/SendEmailDialog.tsx   [useEffect refresh+toast su sent=true; rimosso refresh da Chiudi]
app/(app)/preventivi/_components/RestoreVersionButton.tsx [docType prop; redirect dinamico; testo dialog]
lib/actions/documents.ts                               [restoreToSentVersionAction: revalidatePath fatture]
app/(app)/fatture/[id]/page.tsx                        [formDefaultClient con surname; defaultClient a PreventivoForm; docType a RestoreVersionButton; pdfClient select id+surname]
CLAUDE.md                                              [regola push permanente a fine OGNI task (sez. 0 + 0-B)]
```

---

## A. HANDOFF — SESSIONE 24 — AUDIT + FIX (30 maggio 2026)

### Audit completo dell'app eseguito

È stato fatto un audit read-only completo (UX/testi, flussi, UI, mobile, performance, dati, sicurezza, accessibilità, feature promesse). **Risultato: 0 bug bloccanti, 7 importanti, 12 miglioramenti.**

⚠️ **NOTA TECNICA IMPORTANTE per chi lavora nel worktree:** il tool **Grep senza `path` esplicito cerca nel worktree `.claude/worktrees/sweet-joliot-3c8147`** (codice committato più vecchio), mentre **Read e Edit con path assoluto `C:\Users\Public\carta-canta\...` operano sul repo principale aggiornato**. Durante l'audit i risultati Grep erano stale. **Regola: per ricerche affidabili usare sempre `path: "C:\Users\Public\carta-canta\..."` nel Grep.**

### Fix applicati nell'audit (commit `f89519b` + `5c3f893`)

1. **Link cliente `/p/[token]` — rimosso toggle "Adatta/Dimensione reale"** (`DocumentFrame.tsx`): non funzionava, rimosso. Resta solo lo scaling responsive mobile automatico. (commit `5c3f893`)
2. **Tab Team rimosso da Impostazioni** (`impostazioni/page.tsx`): il tab promuoveva "Passa a Team" con link a `/abbonamento` dove Team è nascosto → vicolo cieco. Rimosso da `NAV_ITEMS` + `TabsContent`. `team.tsx` e `lib/actions/team.ts` restano nel codice per riattivazione futura.
3. **AI Import: feature flag** (`AiImportButton.tsx`): aggiunto `AI_IMPORT_ENABLED = process.env.NEXT_PUBLIC_AI_IMPORT_ENABLED === 'true'`. Finché non è `'true'`, il bottone mostra "IN ARRIVO" disabilitato invece di far fallire l'utente Pro con "AI non disponibile". **Per riattivare: settare `NEXT_PUBLIC_AI_IMPORT_ENABLED=true` su Vercel + configurare `OPENAI_API_KEY`/`MISTRAL_API_KEY`.**
4. **StatusChangeDropdown — feedback + conferma** (`StatusChangeDropdown.tsx`): ora mostra `toast.success` dopo il cambio stato; richiede conferma (dialog) per "Rifiutato" e "Scaduto"; aggiunta transizione `expired → sent` (riapri documento scaduto); accetta prop `docType` per messaggi corretti. Passato `docType="fattura"` nel dettaglio fattura.
5. **Catalogo — azioni su mobile** (`CatalogItemRow.tsx`): i bottoni Mostra/Modifica/Elimina erano `opacity-0 group-hover` (invisibili su touch). Ora `opacity-100 sm:opacity-0 sm:group-hover:opacity-100`. Aggiunto toast su toggle.
6. **Catalogo — dialog conferma custom** (`CatalogItemRow.tsx`): sostituito `confirm()` nativo con `Dialog` custom per l'eliminazione voce.
7. **Messaggi errore più chiari**: `templates.ts` ("Errore." → "Impossibile impostare il template predefinito. Riprova."), `catalogo/actions.ts` (3 messaggi), `documents.ts` (salvataggio preventivo/voci/aggiornamento).
8. **Avatar menu — aria-label** (`AppShell.tsx`): aggiunto `aria-label="Menu account"`.
9. **Codice morto rimosso**: cancellati `KanbanView.tsx`, `ViewToggle.tsx`, `ClientFilter.tsx` (non importati da nessuna parte).
10. **Skeleton loading** (`loading.tsx`): allineati i breakpoint a `lg:grid-cols-4`/`lg:grid-cols-3` come il layout reale dashboard (prima `md:` → salto su tablet). Colonna stretta a sx, larga a dx.

### Problemi emersi dall'audit — stato aggiornato

| Gravità | Problema | Note |
|---|---|---|
| ✅ | **Codice morto PDF rimosso** (sessione 25): cancellati `PreventivoPDF.tsx`, `lib/pdf/generate.ts`, dipendenza `@react-pdf/renderer` (56 pacchetti rimossi via npm), entry `serverExternalPackages` in `next.config.ts`. Il test `generate.test.ts` testava già `buildPdfHtml` (non `generate.ts`) → mantenuto e aggiornato. | Chiuso. |
| ✅ | **GitHub OAuth**: deciso di NON implementarlo. Solo Google (`OAuthButtons.tsx`). Doc corretti. | Chiuso sessione 24. |
| ✅ | **Logo PNG nel PDF**: confermato dall'utente che appare correttamente. | Chiuso. |
| 🟢 | **Route PDF senza fallback membro team** (`api/documents/[id]/pdf/route.ts`): carica workspace solo via `owner_id`. Irrilevante ora (Team nascosto). | Riallineare quando Team riattivato. |

### Sessione 25 — Conferma cliente nel popup invio + test suite (commit `cdd8a30`)

**Task: conferma cliente esistente con stessa email (popup invio).**
- `send-email/route.ts`: quando l'utente digita un nome esplicito nel popup e quell'email appartiene già a un cliente con **nome diverso**, la route ritorna `{ ok: false, clientConflict: { id, name, email } }` (status 200) invece di inviare. Body accetta `confirmClientMatch: boolean`.
- `SendEmailDialog.tsx`: nuovo stato `clientConflict`; `handleSend(confirmMatch?)`. Se arriva un conflitto, mostra una schermata di conferma ("L'email X appartiene già a Mario Rossi. Vuoi inviare a questo contatto?") con bottoni "Sì, invia a {nome}" (richiama con `confirmClientMatch: true` → usa il cliente esistente) e "No, modifica i dati". Non si creano due clienti con la stessa email.

**⚠️ TEST SUITE — era ROTTA, ora RIPARATA (176/176 verdi).**
Durante l'audit è emerso che la suite aveva **35 test rotti** (il `npm build` non esegue i test, quindi i fallimenti erano passati inosservati per più sessioni). Cause e fix:
- `pdf/generate.test.ts` (5): asserzioni su watermark (rimosso sessione 23), colore default (`#374151` da sessione 21), font, "Nessun cliente". Aggiornate al comportamento attuale.
- `signupRollback.test.ts` (12): mancava il mock di `@/lib/auth-rate-limit` (usa `headers()` → "request scope" error); password di default ora deve essere forte (`Password123!`); mock user con `identities` non vuoto; test `workspace_name` rimosso (campo non più validato); successo → `verifica-email` (conferma email attiva).
- `clients.test.ts` (17): `createClientAction`/`updateClientAction` usano `softValidate` LENIENTE (campi invalidi → stripped con warning, non errore) e ritornano `{success:'created'/'updated'}` senza `redirect`. Aggiunto mock `select` per il rilevamento duplicati + `.not()` per il fallback `workspace_members`. Default formData con email valida (contatto obbligatorio).
- `toggleCatalog.test.ts` (1): messaggio errore aggiornato.

**Lezione:** il `npm run build` NON esegue i test. Per verificare la suite usare `npm test`. Eseguire `npm test` prima di chiudere sessioni che toccano validazioni, messaggi o template PDF.

---

## A. HANDOFF — SESSIONI 21p2 + 22 + 23 (30 maggio 2026)

### Commit recenti (ultimi deploy)

```
2497129  fix(fatture): truncate client name to keep date on one line
6c734d3  fix(ux): session 23 — team hidden, PDF text, zoom, expires_at, client required, fattura validation
0f912ee  fix(ux): session 22 batch A+B+C+D+F+G+H+L1
bf5cd21  fix(ux): zoom preview + fattura timeline grammar + resend log
dc4cb30  fix(ux): session 22 part 2 — auth, password, nav, badge, fattura-send
fad983a  fix(ux): session 22 — 13 fixes dashboard, auth, abbonamento, template, fatture, timeline
e40156b  fix(ux): session 21 part 2 — 17 fixes (A1-A3, B1-B9, C1-C3, AI import)
c7c7bd5  fix(nav): always show full 'Nuovo preventivo' text on all screen sizes
```

### Cosa è stato fatto (sessioni 21p2 – 23)

#### Fix bug critici
- **`cognome` → `surname`** in `preventivi/page.tsx` e `dashboard/page.tsx`: la query usava il nome colonna sbagliato rendendo la lista vuota
- **ResendReminderDialog redirect**: ora usa `docType === 'fattura' ? '/fatture' : '/preventivi'` invece di hardcode `/preventivi`
- **Reset password → onboarding**: `/auth/callback` controlla anche `type === 'recovery'`. Il template email Supabase è stato cambiato manualmente da `{{ .ConfirmationURL }}` a `/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`. La `/auth/confirm/route.ts` ora redirige sempre a `/reset-password/confirm` se `type=recovery`.
- **Reset password secondo click**: Se il token è scaduto/usato, redirige a `/reset-password?error=link_scaduto` con banner spiegativo
- **Signup email già registrata**: `signupAction` controlla `authData.user.identities?.length === 0` → ritorna "Esiste già un account" senza tentare workspace creation (evitava crash e potenziale cancellazione utente)
- **AI Import "Errore di connessione"**: `pdf-to-image.ts` importato dinamicamente in `api/ai/extract/route.ts` (fix Vercel Lambda crash da `@sparticuz/chromium`)
- **Fattura "Modificato" badge**: `updateDocumentAction` ora imposta `updated_after_send_at` se cambiano campi pubblici (stessa logica C1 di `saveDraftAction`)
- **Snapshot retroattivo corretto**: In `updateDocumentAction` lo snapshot viene letto PRIMA del delete+insert delle voci
- **Preventivi che si riordinano**: `saveDraftAction` non aggiorna più `updated_at` (solo `updateDocumentAction` lo aggiorna su salvataggio esplicito)
- **`expires_at` non ricalcolata al salvataggio**: Per documenti `sent`/`viewed`, `updateDocumentAction` non ricalcola `expires_at`. La scadenza riparte solo al reinvio.
- **Clienti senza contatto nel sollecito**: `createClientAction` e `QuickCreateClientDialog` richiedono ora email O telefono obbligatori → risolve il bug "Inserisci il cliente" che compariva anche dopo aver aggiunto il cliente (mancava email/telefono)
- **`PendingDocCard` messaggio**: Cambiato da "Inserisci il cliente" a "Inserisci l'email o il telefono del cliente"
- **`send-email/route.ts` cliente senza nome**: crea/associa cliente anche con solo email (fallback: usa email come nome)
- **`sent_at` non sovrascritto al reinvio**: `send-email/route.ts` non sovrascrive più `sent_at` → primo invio resta in cronologia. Aggiunge evento `resent` al `document_log`
- **Dashboard non si aggiornava**: `revalidatePath('/dashboard')` aggiunto a `updateDocumentAction`
- **Fattura vuota submit senza errori**: Validazione aggiunta in `onClick` dei bottoni FatturaForm (React 19 poteva bypassare `onSubmit` con `useActionState`)
- **Nome cliente schiacciava la data in lista fatture**: `truncate min-w-0` sul nome + `shrink-0` sulla data

#### Nuove feature
- **Piano Team nascosto**: rimosso dalle card abbonamento e da tutte le menzioni in referral
- **Password forte obbligatoria**: componente `PasswordStrength.tsx` — maiuscola, minuscola, numero, simbolo; validation in signup e reset password
- **"+ Nuovo preventivo" nel nav**: sempre visibile con testo su tutti i dispositivi
- **Badge "Modificato" sempre visibile**: rimosso `hidden sm:` — ora compare anche su mobile in liste preventivi e fatture
- **Nuova fattura: "Salva bozza" + "Invia al cliente"**: due bottoni distinti; spinner solo sul bottone cliccato (`pendingIntent` state)
- **Fattura `?send=1`**: `createInvoiceAction` con `intent=send` → redirect a `/fatture/[id]?send=1` → `SendEmailDialogController` si apre auto
- **Zoom preview template**: `TemplatePreviewDialog` ha controlli +/-/Ctrl+scroll
- **Link cliente "Adatta/Dimensione reale"**: `DocumentFrame.tsx` ha un toggle che scala il documento per entrare in schermo
- **Errori grammaticali fattura**: `DocumentTimeline` usa `docType` prop → "Inviata/Inviata al cliente/Accettata/Scaduta/Rifiutata" per fatture. `StatusBadge` già corretto. `PreventivoForm.tsx` "diversa" → "diverso" (prezzo)
- **Testo "PDF allegato" rimosso**: messaggio default email e descrizione dialog aggiornati a "link al documento"
- **Avviso reinvio**: nel footer del dialog reinvio → "reinviando, la scadenza ripartirà da oggi"
- **`expires_at` riparte al reinvio**: `send-email/route.ts` ricalcola `expires_at = oggi + validity_days` solo al (re)invio
- **Timeline fattura**: `DocumentTimeline` con `docType="fattura"` + evento `resent` nel log
- **Cronologia completa fattura**: C2 (banner Modificato) + C3 (DocumentTimeline) su `fatture/[id]/page.tsx`
- **Font PDF +20%**: `lib/pdf/template.ts` e `TemplatePreview.tsx` — tutti i font size scalati ×1.2
- **Watermark rimosso (L1)**: il watermark diagonale "Carta Canta" è rimosso per tutti i piani. Rimane solo il footer "Preventivo generato con Carta Canta" (visibile solo Free)
- **Grid `items-end`**: tutti i form a 2 colonne usano `items-end` per allineare gli input quando i label sono di altezze diverse
- **Impostazioni**: P.IVA e Email sempre `grid-cols-2` (non responsive)
- **Sort preventivi**: Non si riordinano più da soli grazie alla rimozione di `updated_at` da `saveDraftAction`
- **Ricerca fatture estesa**: usa query separata su `clients` (come preventivi) invece di `.or()` con tabelle embedded
- **Template dropdown**: filtra "Template predefinito" e pre-seleziona il template attivo (`is_default=true` escludendo "Template predefinito")
- **Template mobile**: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` — 1 colonna su mobile
- **Verifica email**: pagina con form "Rinvia email di verifica" usando `supabase.auth.resend()`
- **Viewport zoom**: `maximumScale: 5, userScalable: true` nel layout — abilitato pinch-to-zoom

### Bug aperti dopo sessione 23

| # | Bug | Stato |
|---|---|---|
| C | Lista preventivi si riordina ancora? | `updated_at` rimosso da `saveDraftAction` — se persiste, potrebbe essere un trigger DB da investigare |
| AI Import | "AI non disponibile" | Le API key (OpenAI/Mistral) non sono configurate in produzione — da attivare dopo test Pro |
| Logo PNG nel PDF | Non testato con logo reale | `fetchLogoBase64()` in `lib/pdf/logo.ts` |
| Google OAuth intermittente | Bug #8 | Intermittente, non confermato risolto |

### Cose da fare (non ancora implementate)

| # | Task | Note |
|---|---|---|
| E | Messaggi errore fattura per "Invia al cliente" | Confermati i messaggi, da applicare con testo "inviare" + validazione cliente obbligatoria prima dell'invio |
| Popup invio | Conferma se email = cliente esistente con nome diverso | Da aggiungere in `SendEmailDialog` (flusso: "Trovato cliente Mario Rossi con questa email — usare quello?") |
| B1 | Documento grande nello schermo | Il pulsante "Adatta" in DocumentFrame è deployato; verificare che funzioni |
| I | Overflow testo | Audit visivo su 320px da fare manualmente — segnalare screenshot specifici |
| Numerazione bozze | "Bozza 001" separata | Decisione prodotto pendente |
| SDI fatturazione elettronica | Provider gestito ~€0.10/fattura | Rimandato |

### Decisioni prese nelle sessioni 21-23

| Decisione | Dettaglio |
|---|---|
| Piano Team nascosto | Nascosto da abbonamento, referral, impostazioni — fino al lancio ufficiale |
| Watermark rimosso | Il watermark diagonale è rimosso per tutti. Footer "Generato con Carta Canta" rimane solo per Free |
| `expires_at` riparte al reinvio | La scadenza si ricalcola SOLO quando il documento viene (re)inviato, non al salvataggio |
| Email/telefono obbligatori | Ogni cliente deve avere almeno email o telefono — bloccante in tutti i form di creazione |
| Password forte | Almeno 1 maiuscola + 1 minuscola + 1 numero + 1 simbolo. Validato sia client-side che server-side |
| Font PDF +20% | `lib/pdf/template.ts` e `TemplatePreview.tsx` scalati — decisione confermata |
| AI Import | Le key OpenAI/Mistral rimangono vuote in prod fino a fine test Pro |

### File chiave toccati (sessioni 21-23)

```
lib/actions/documents.ts                   [saveDraftAction, updateDocumentAction: expires_at, updated_at, snapshot]
lib/actions/clients.ts                     [createClientAction: email/phone required]
lib/pdf/template.ts                        [font +20%, watermark rimosso, footer branding]
lib/stripe/plans.ts                        [Team features, Pro features pulite]
app/api/documents/[id]/send-email/route.ts [sent_at preserved, resent log, client creation]
app/auth/callback/route.ts                 [type=recovery check]
app/auth/confirm/route.ts                  [recovery → reset-password/confirm + error redirect]
app/(auth)/actions.ts                      [identities check, password validation, resendVerificationEmail]
app/(auth)/reset-password/page.tsx         [banner link scaduto]
app/(auth)/reset-password/confirm/page.tsx [PasswordStrength]
app/(auth)/signup/_components/SignupForm.tsx [PasswordStrength]
app/(auth)/verifica-email/page.tsx         [form rinvia email]
app/(app)/abbonamento/_components/PricingSection.tsx [Team hidden]
app/(app)/referral/_components/ReferralPageClient.tsx [Team removed]
app/(app)/dashboard/page.tsx               [KPI href, Prossima Scadenza sort, grid lg, activity feed]
app/(app)/dashboard/_components/PendingDocCard.tsx [messaggio contatto]
app/(app)/fatture/page.tsx                 [search, badge, truncate name]
app/(app)/fatture/[id]/page.tsx            [C2 banner, C3 timeline, SendEmailDialogController, docType]
app/(app)/fatture/_components/FatturaForm.tsx [validation onClick, pendingIntent, items-end, intent=send]
app/(app)/fatture/nuovo/page.tsx           [defaultTemplateId filter]
app/(app)/preventivi/page.tsx              [surname fix, badge Modificato visible]
app/(app)/preventivi/[id]/page.tsx         [defaultTemplateId filter]
app/(app)/preventivi/nuovo/page.tsx        [defaultTemplateId filter]
app/(app)/preventivi/_components/PreventivoForm.tsx [items-end, template filter, bonus edilizio copy]
app/(app)/preventivi/_components/SendEmailDialog.tsx [PDF text removed, resend warning, title tooltip]
app/(app)/preventivi/_components/DocumentTimeline.tsx [docType, resent event, grammar]
app/(app)/template/page.tsx                [grid-cols-1 sm, legalNotice, defaultLegalNotice]
app/(app)/template/_components/DefaultTemplateCard.tsx [w-full, legalNotice prop]
app/(app)/template/_components/CustomTemplateCard.tsx [w-full]
app/(app)/template/_components/TemplatePreview.tsx [font +20%]
app/(app)/template/_components/TemplatePreviewDialog.tsx [zoom controls]
app/(app)/impostazioni/tabs/generali.tsx   [grid-cols-2 items-end]
app/(app)/impostazioni/tabs/piano.tsx      [features Pro pulite]
app/(app)/_components/AppShell.tsx         [nav button testo completo]
app/api/ai/extract/route.ts                [dynamic import pdf-to-image]
components/public/DocumentFrame.tsx        [Adatta/Dimensione reale toggle]
components/shared/PasswordStrength.tsx     [NUOVO]
components/shared/ZoomControls.tsx         [NUOVO — non più usato direttamente]
components/shared/QuickCreateClientDialog.tsx [email/phone required]
```

---

## A. HANDOFF — SESSIONE 21 (27 maggio 2026)

### Cosa è stato fatto

**Template:**
- `LegalNoticeField.tsx`: dropdown adiacente al label (`flex items-center gap-2`, rimosso `justify-between`)
- Colore classico default: `#1a1a2e` → `#374151` (grigio scuro Tailwind gray-700) in: `lib/actions/templates.ts` (schema, PRESET_DEFAULTS, fallback x2, insert), `lib/actions/documents.ts` (resolveTemplateSnapshot), `app/api/documents/[id]/pdf/route.ts`, `app/api/documents/[id]/send-email/route.ts`, `app/api/p/[token]/pdf/route.ts`, `lib/pdf/template.ts` (fallback), `DefaultTemplateCard.tsx` (x2), `PresetSelector.tsx`, `TemplateEditor.tsx`
  - NB: i `safeAccentColor` fallback rimangono `#1a1a2e` (sono safety override, non default)
  - NB: gli header email del brand rimangono `#1a1a2e`
  - NB: colori elegante-specific (numero doc italic) rimangono `#1a1a2e`
- Fix `saveDefaultSettingsAction` duplicato template: cerca per `is_default=true` OR `name='Template predefinito'`; se trovato aggiorna invece di creare; rimette `is_default=true` sull'aggiornato
- `template/page.tsx`: "Template predefinito" escluso dai custom template card; `isDefaultActive` = true se nessun custom ha `is_default=true`; fallback colore custom `#374151`

**Dashboard:**
- Rimossa KPI card "In attesa di risposta"
- Rimossa sezione "Azioni rapide"
- Activity feed: `slice(0, 5)` invece di 10; badge viola "Modificato" + cognome cliente + troncatura ellissi
- "Prossima scadenza" posizionata PRIMA di "Attività recente"
- KPI "Preventivi accettati" → `href="/preventivi?status=accepted"`
- KPI "Valore preventivi" → `href="/preventivi?status=accepted"`
- Grafico: barra chiara = fatturato (fatture accepted per mese) invece di preventivi creati; legenda e tooltip aggiornati
- Copy "nessun watermark" → "watermark rimovibile" nei banner Free

**Invio manuale:**
- `RegisterManualSendButton.tsx`: aggiunto `<input type="date">` con default oggi e max=oggi; campo con hint
- `registerManualSendAction`: accetta `sentAtParam?: string` (YYYY-MM-DD); se omesso usa oggi

**Copy piano Pro:**
- `lib/stripe/plans.ts`: `'PDF senza watermark'` → `'Watermark Carta Canta rimovibile'`
- `preventivi/page.tsx` (2x): "nessun watermark" → "watermark rimovibile"
- `abbonamento/page.tsx`: `value='Rimosso'` → `value='Rimovibile'`

**Impostazioni:**
- `impostazioni/page.tsx`: tab label `hidden sm:inline` (solo icona su xs); `title={label}` per tooltip hover

**Pagina preventivi:**
- Rimosso sottotitolo "X inviati · Y accettati · Z bozze"
- Query aggiornata con `clients(id, name, cognome, email)` — mostra nome+cognome sotto ogni riga
- Troncatura `max-w-[120px] sm:max-w-[200px]` sul nome cliente per evitare compressione data
- Tooltip `title="Esporta CSV"` su bottone icon-only

**Preventivi in attesa (scadenze + PendingDocCard):**
- `scadenze/page.tsx`: query aggiunge `updated_after_send_at`; passa a `PendingDocCard`
- `PendingDocCard.tsx`:
  - Nessun contatto (email né phone) → mostra "Inserisci il cliente nel preventivo per poter inviare un sollecito" (con link al preventivo)
  - Badge viola quando `updatedAfterSendAt` set
  - Testo composito: "Inviato il X. Modificato il Y. Non ancora rinviato."
  - Import `UserRound` da lucide-react

**Pagina fatture:**
- Usa `StatusBadge` con `docType='fattura'` (labels: Inviata/Aperta/Pagata/Annullata/Scaduta) invece di custom Badge
- Query aggiunge `updated_after_send_at`; badge viola "Modificato" sulle righe
- Ricerca per stato con matching parziale: "pag"→Pagata, "inv"→Inviata, "boz"→Bozza ecc. (min 2 caratteri)
- `title` su bottoni icon-only (Da preventivo, Nuova fattura, Esporta CSV)
- Placeholder search aggiornato: "Cerca fattura o stato (pagata, bozza…)"

**Azioni e redirect:**
- `createInvoiceAction`: redirect a `/fatture` invece di `/fatture/${doc.id}`
- `ClientForm.tsx`: `useEffect` aggiunto per redirect a `/clienti` dopo `success='updated'` (senza warnings)

**Dashboard query:**
- `allDocs` select aggiornata con `updated_after_send_at, clients(name, cognome)` per activity feed

### Commit sessione 21

```
9868a67  feat(ux): 27-point batch — dashboard, fatture, preventivi, template, clienti
```

### File toccati (sessione 21)

```
app/(app)/template/_components/LegalNoticeField.tsx           [dropdown adiacente al label]
app/(app)/template/_components/DefaultTemplateCard.tsx        [colore #374151]
app/(app)/template/_components/PresetSelector.tsx             [defaultColor #374151]
app/(app)/template/_components/TemplateEditor.tsx             [useState default #374151]
app/(app)/template/page.tsx                                   [esclude 'Template predefinito' dai custom; isDefaultActive fix]
lib/actions/templates.ts                                      [schema default #374151; PRESET_DEFAULTS classico; fallback x2; insert #374151; fix saveDefaultSettingsAction duplicato]
lib/actions/documents.ts                                      [resolveTemplateSnapshot #374151; registerManualSendAction sentAtParam; createInvoiceAction redirect /fatture]
lib/pdf/template.ts                                           [fallback color #374151]
lib/stripe/plans.ts                                           [copy watermark rimovibile]
app/api/documents/[id]/pdf/route.ts                           [fallback #374151]
app/api/documents/[id]/send-email/route.ts                    [fallback #374151]
app/api/p/[token]/pdf/route.ts                                [fallback #374151]
app/(app)/dashboard/page.tsx                                  [KPI rimozione, layout, chart fatturato, feed slice(5), badge viola, cognome, redirect href]
app/(app)/dashboard/_components/PendingDocCard.tsx            [no-contact msg, badge viola, testo composito modificato]
components/dashboard/RevenueChart.tsx                         [legenda e tooltip fatturato]
app/(app)/preventivi/page.tsx                                 [rimozione sottotitolo, cognome, troncatura, tooltip, copy watermark]
app/(app)/preventivi/scadenze/page.tsx                        [updated_after_send_at in query + DocWithClient type + PendingDocCard prop]
app/(app)/preventivi/_components/RegisterManualSendButton.tsx [input date + sentDate state]
app/(app)/fatture/page.tsx                                    [StatusBadge, updated_after_send_at, ricerca stato, tooltip bottoni]
app/(app)/abbonamento/page.tsx                                [copy Rimovibile]
app/(app)/impostazioni/page.tsx                               [tab label hidden sm:inline + title]
app/(app)/clienti/_components/ClientForm.tsx                  [redirect /clienti dopo update]
CLAUDE.md                                                     [aggiornato]
```

### Bug risolti in sessione 21

| # | Bug / Richiesta | Stato |
|---|---|---|
| LegalNoticeField dropdown a destra invece che adiacente | Fix layout `flex items-center gap-2` | ✅ RISOLTO |
| Colore classico "grigio scuro" era nero (#1a1a2e) | Cambiato in #374151 ovunque | ✅ RISOLTO |
| saveDefaultSettingsAction crea duplicato "Template predefinito" | Cerca per is_default OR nome prima di creare | ✅ RISOLTO |
| "Template predefinito" appare come card custom | Escluso dalla lista custom in template/page.tsx | ✅ RISOLTO |
| Dashboard: KPI "In attesa di risposta" | Rimossa | ✅ RISOLTO |
| Dashboard: sezione "Azioni rapide" | Rimossa | ✅ RISOLTO |
| Dashboard: activity feed ultime 10 | Ridotto a ultime 5 | ✅ RISOLTO |
| Dashboard: "Prossima scadenza" dopo "Attività recente" | Spostata prima | ✅ RISOLTO |
| KPI non cliccabili | href aggiunto a Preventivi accettati e Valore preventivi | ✅ RISOLTO |
| Grafico mostra "preventivi creati" | Sostituito con fatturato (fatture accepted) | ✅ RISOLTO |
| Invio manuale senza scelta data | Input date con default oggi aggiunto | ✅ RISOLTO |
| Copy "nessun watermark" invece di "rimovibile" | Fix ovunque | ✅ RISOLTO |
| Tab impostazioni su 2 righe su mobile | Solo icona su xs (hidden sm:inline) | ✅ RISOLTO |
| Sottotitolo preventivi con contatori | Rimosso | ✅ RISOLTO |
| Cognome non mostrato in lista preventivi | Aggiunto con troncatura ellissi | ✅ RISOLTO |
| Data compressa da nome lungo in lista preventivi | Troncatura max-w e shrink-0 sulla data | ✅ RISOLTO |
| PendingDocCard senza suggerimento se manca contatto | Aggiunto suggerimento con link | ✅ RISOLTO |
| Badge viola "Modificato" mancante in PendingDocCard | Aggiunto | ✅ RISOLTO |
| Pagina fatture usa Badge custom invece di StatusBadge | Usa StatusBadge con docType=fattura | ✅ RISOLTO |
| Fatture non mostrano badge "Modificato" | Aggiunto badge viola | ✅ RISOLTO |
| Ricerca fatture non filtra per stato | Aggiunta ricerca per stato con prefisso | ✅ RISOLTO |
| Dopo creazione fattura → pagina dettaglio invece che lista | Redirect a /fatture | ✅ RISOLTO |
| Dopo salvataggio cliente → rimane nella pagina | Redirect a /clienti | ✅ RISOLTO |
| Cognome mancante in activity feed dashboard | Aggiunto con troncatura | ✅ RISOLTO |

### Cose aperte dopo sessione 21

1. Test manuali: template default → colore picker mostra #374151 (grigio scuro)
2. Test manuali: template/default → salva → non crea duplicato "Template predefinito"
3. Test manuali: invio manuale preventivo → campo data con default oggi modificabile
4. Test manuali: dashboard grafico → barra chiara = fatture pagate (non preventivi creati)
5. Test manuali: ricerca fatture "pag" → mostra solo paginate; "inv" → solo inviata
6. Test manuali: lista preventivi → cognome mostrato + data non compressa su mobile
7. Test manuali: PendingDocCard senza cliente → messaggio "Inserisci il cliente..."
8. Numerazione bozze separata — decisione prodotto pendente
9. Bug #8: Google OAuth intermittente
10. Bug #9: Logo PNG nel PDF — da testare con logo reale

---

## A. HANDOFF — SESSIONE 20 (24 maggio 2026)

### Cosa è stato fatto

**Rimozione prefisso Prev/Fatt dai numeri di documento:**
- `lib/utils/index.ts`: `formatDocNumber()` ora restituisce il numero senza prefisso letterale (es. "001/2026" invece di "Prev001/2026") — via `replace(/^[A-Za-z]+/, '')`.
- Fix applicato in 9 file: `preventivi/page.tsx`, `preventivi/[id]/page.tsx`, `fatture/[id]/page.tsx`, `DocumentTimeline.tsx`, `DocumentRowActions.tsx`, `LinkToPreventivoButton.tsx` (era aggiunto "Prev " esplicitamente!), `p/[token]/page.tsx`, `preventivi/scadenze/page.tsx`, `lib/actions/documents.ts` (email/solleciti), `app/api/documents/[id]/send-email/route.ts`.

**Migration `convert_preventivo_to_fattura` applicata dall'utente su Supabase SQL Editor.**

**Quota banner su dashboard spostato in cima:**
- `dashboard/page.tsx`: banner trial/quota ora in cima alla pagina (prima dell'header), sempre visibile per Free (rimossa soglia 75%), stile rosso/ambra.

**Fix watermark "NON ANCORA INVIATO" (regressione sessione 19):**
- `lib/pdf/template.ts`: il watermark era diventato "BOZZA" per tutti i preventivi non inviati — a causa della rimozione di `pdf_downloaded_at` in sessione 19 che lasciava la vecchia logica conditionals sempre su "BOZZA".
- Fix: semplificato a `if (doc.status === 'draft') { statusWatermarkText = 'NON ANCORA INVIATO' }`.

**Pagina Template — rimozione sezione Layout:**
- `app/(app)/template/page.tsx`: rimossa intera sezione "Layout" con i 4 preset card. La sezione Personalizzazione ora include:
  - `DefaultTemplateCard` sempre visibile come prima opzione (Default Classico, grigio scuro)
  - Template personalizzati dell'utente selezionabili accanto ad esso
  - `isDefaultActive = !templates?.some(t => t.is_default)` — Default attivo quando nessun custom template ha `is_default = true`
- `lib/actions/templates.ts`: aggiunta `clearDefaultTemplateAction` — toglie `is_default` da tutti i template del workspace (torna al Classico di sistema).
- `app/(app)/template/_components/DefaultTemplateCard.tsx`: NUOVO componente client — mostra preview Classico, chiama `clearDefaultTemplateAction()` al click, badge ✓ quando attivo.

**Audit mobile completo — fix applicati:**
- `app/(app)/preventivi/page.tsx`: icone fattura (FileCheck2 + Eye) e badge "Modificato" ora `hidden sm:flex`/`hidden sm:inline-flex` — elimina overflow testo su 320-375px.
- `app/(app)/preventivi/_components/VociTable.tsx`: riga 2 voci (Unità/Quantità/Prezzo/Sconto/IVA) cambiata da `grid-cols-5` a `grid-cols-4 sm:grid-cols-5` — su mobile IVA va a capo naturalmente, evita colonne da 40px.
- `app/(app)/impostazioni/tabs/generali.tsx`: `grid-cols-2` → `grid-cols-1 sm:grid-cols-2` per la riga P.IVA + Email.
- `app/(app)/catalogo/_components/CatalogItemForm.tsx`: `grid-cols-3` → `grid-cols-2 sm:grid-cols-3` per Unità/Prezzo/IVA.
- `app/(app)/preventivi/_components/SendEmailDialog.tsx`: `grid-cols-2` → `grid-cols-1 sm:grid-cols-2` per Nome/Cognome nel form invio senza cliente.

### Commit sessione 20

```
74b3feb  fix(ux): remove Prev/Fatt prefix from doc numbers + quota banner on dashboard
182cc11  fix(ux): strip Prev/Fatt prefix from all display locations
faa12b6  fix(ux): watermark + template page + mobile audit fixes
```

### File toccati (sessione 20)

```
lib/utils/index.ts                                        [formatDocNumber: strip prefix]
lib/actions/documents.ts                                  [email/solleciti: strip prefix]
app/api/documents/[id]/send-email/route.ts                [strip prefix da docNumber]
app/(app)/preventivi/page.tsx                             [formatDocNumber + hide fattura icons + Modificato badge on mobile]
app/(app)/preventivi/[id]/page.tsx                        [formatDocNumber breadcrumb/h1/fattura]
app/(app)/preventivi/_components/DocumentTimeline.tsx     [strip prefix da numero fattura]
app/(app)/preventivi/_components/DocumentRowActions.tsx   [formatDocNumber nel dialog delete]
app/(app)/preventivi/_components/VociTable.tsx            [grid-cols-4 sm:grid-cols-5 per riga voci mobile]
app/(app)/preventivi/_components/SendEmailDialog.tsx      [grid-cols-1 sm:grid-cols-2 per Nome/Cognome]
app/(app)/fatture/[id]/page.tsx                           [formatDocNumber]
app/(app)/fatture/_components/LinkToPreventivoButton.tsx  [rimosso "Prev " hardcoded]
app/(app)/preventivi/scadenze/page.tsx                    [strip prefix da docNumber]
app/(app)/dashboard/page.tsx                              [banner quota in cima, sempre visibile Free]
app/(app)/impostazioni/tabs/generali.tsx                  [grid-cols-1 sm:grid-cols-2 P.IVA+Email]
app/(app)/catalogo/_components/CatalogItemForm.tsx        [grid-cols-2 sm:grid-cols-3]
app/(app)/template/page.tsx                               [rimossa sezione Layout, DefaultTemplateCard]
app/(app)/template/_components/DefaultTemplateCard.tsx    [NUOVO]
app/p/[token]/page.tsx                                    [formatDocNumber header]
lib/actions/templates.ts                                  [clearDefaultTemplateAction NUOVO]
lib/pdf/template.ts                                       [fix watermark NON ANCORA INVIATO]
CLAUDE.md                                                 [aggiornato]
```

### Bug risolti in sessione 20

| # | Bug / Richiesta | Stato |
|---|---|---|
| Prefisso "Prev"/"Fatt" visibile in UI | Rimosso da tutti i punti di visualizzazione | ✅ RISOLTO |
| Watermark "BOZZA" invece di "NON ANCORA INVIATO" | Fix regressione sessione 19 | ✅ RISOLTO |
| Sezione "Layout" template — 4 card preset | Rimossa, sostituita con Default card | ✅ RISOLTO |
| Lista preventivi mobile — overflow/testo sovrapposto | Icone fattura + badge nascosti su mobile | ✅ RISOLTO |
| VociTable mobile — colonne IVA troppo strette | grid-cols-4 sm:grid-cols-5 | ✅ RISOLTO |
| Impostazioni P.IVA + Email — 2 col su 320px | grid-cols-1 sm:grid-cols-2 | ✅ RISOLTO |
| CatalogItemForm — 3 col su 320px | grid-cols-2 sm:grid-cols-3 | ✅ RISOLTO |
| SendEmailDialog Nome/Cognome — 2 col su 320px | grid-cols-1 sm:grid-cols-2 | ✅ RISOLTO |

### Cose aperte dopo sessione 20

1. Test manuali: lista preventivi su 375px → verificare che nomi non si sovrappongano più
2. Test manuali: VociTable mobile → IVA va a capo, non troppo stretta
3. Test manuali: pagina template → Default card e custom template selezionabili
4. Test manuali: watermark PDF su bozza → "NON ANCORA INVIATO"
5. Numerazione bozze separata — decisione prodotto pendente
6. Bug #8: Google OAuth intermittente
7. Bug #9: Logo PNG nel PDF — da testare con logo reale

---

## A. HANDOFF — SESSIONE 19 (24 maggio 2026)

### Cosa è stato fatto

**Fix messaggi di errore voci — specifici invece di "Voci non valide":**
- `lib/actions/documents.ts`: tutte e 3 le occorrenze `return { error: 'Voci non valide' }` sostituite con `return { error: voceList.error.issues[0]?.message ?? 'Dati voce non validi' }`.
  - In `createDocumentAction` (preventivi), `saveDraftAction`, `createInvoiceAction` (fatture)
  - Ora il server restituisce messaggi come "Descrizione obbligatoria", "Quantità non valida", "Prezzo non valido" — esattamente i messaggi definiti in `VoceSchema` (Zod).

**Rimosso "Lo stato del documento non cambierà." da SendEmailDialog:**
- `SendEmailDialog.tsx`: rimossa la riga `{isResend && (<> Lo stato del documento non cambierà.</>)}` dalla didascalia sotto il campo messaggi.

**Nome file PDF automatico:**
- `lib/pdf/template.ts`: funzione `wrap()` ora accetta `pageTitle?: string` come 4° parametro e lo inserisce come `<title>` nel `<head>` dell'HTML.
- `buildPdfHtml()`: calcola `pageTitle` = `"Preventivo 001/2026 - Carta Canta"` (o "Fattura ...") usando `doc.doc_number`. Se bozza senza numero → `"Preventivo - Carta Canta"`.
- Tutti e 4 i `return wrap(font, ..., fontName)` aggiornati in `return wrap(font, ..., fontName, pageTitle)`.
- Quando l'utente salva il PDF dal dialogo di stampa del browser, il nome file suggerito è automaticamente `"Preventivo 001/2026 - Carta Canta.pdf"`.

**Rimozione logica "PDF scaricato" (pdf_downloaded_at):**
- La logica di tracciamento `pdf_downloaded_at` è stata rimossa in quanto creava confusione nell'UX. Non viene più segnato il primo download del PDF.
- `StatusBadge.tsx`: rimosso prop `pdfDownloaded?: boolean`, rimossa label "Bozza · PDF scaricato" e relativo tooltip.
- `preventivi/page.tsx`: rimosso `pdf_downloaded_at` dalla select query; rimosso `pdfDownloaded={...}` da `<StatusBadge>`.
- `preventivi/[id]/page.tsx`: rimosso `hasPdfDownloaded`, rimosso `pdfDownloaded` da `<StatusBadge>`, rimosso banner ambra "PDF scaricato — numero non ancora assegnato". Condizione `!hasPdfDownloaded` rimossa dal banner trial Free.
- `api/documents/[id]/pdf/route.ts`: rimossa logica `isFirstDraftView`, rimosso `UPDATE pdf_downloaded_at`. Il blocco Free ora si attiva su qualsiasi apertura bozza (non solo la prima).

**Bottone "Registra invio manuale" sempre visibile nelle bozze:**
- `preventivi/[id]/page.tsx`: rimosso il vecchio banner condizionale (`isDraft && hasPdfDownloaded`). Sostituito con un banner sottile sempre visibile quando `isDraft` che mostra `<RegisterManualSendButton>` inline.
- Copy del banner: "Hai inviato il preventivo al cliente fuori dall'app? Registra l'invio per assegnare il numero progressivo e aggiornare lo stato."
- `RegisterManualSendButton.tsx` già esisteva e funzionava — nessuna modifica necessaria.

### Commit sessione 19

```
b5c74d1  fix(validation): replace generic 'Voci non valide' with specific Zod field messages
[commit corrente]  fix(ux): PDF filename + remove pdf_downloaded logic + manual send always visible
```

### File toccati (sessione 19)

```
lib/actions/documents.ts                                  [Voci non valide → messaggi Zod specifici]
app/(app)/preventivi/_components/SendEmailDialog.tsx      [rimosso "Lo stato del documento non cambierà."]
lib/pdf/template.ts                                       [pageTitle in wrap() → nome file PDF automatico]
app/(app)/preventivi/_components/StatusBadge.tsx          [rimosso pdfDownloaded prop]
app/(app)/preventivi/page.tsx                             [rimosso pdf_downloaded_at da query + StatusBadge prop]
app/(app)/preventivi/[id]/page.tsx                        [rimosso banner PDF scaricato, hasPdfDownloaded; aggiunto banner invio manuale sempre visibile]
app/api/documents/[id]/pdf/route.ts                       [rimosso tracking pdf_downloaded_at]
CLAUDE.md                                                 [aggiornato]
```

### Bug risolti in sessione 19

| # | Bug / Richiesta | Stato |
|---|---|---|
| "Voci non valide" generico su submit | Sostituito con messaggio Zod specifico | ✅ RISOLTO |
| "Lo stato del documento non cambierà." nel reinvio | Rimosso | ✅ RISOLTO |
| Nome file PDF non impostato | `<title>` in HTML → browser usa "Preventivo 001/2026 - Carta Canta" | ✅ RISOLTO |
| Badge "Bozza · PDF scaricato" nella lista | Logica pdf_downloaded rimossa | ✅ RISOLTO |
| Banner "PDF scaricato" nella pagina dettaglio | Rimosso | ✅ RISOLTO |
| Bottone invio manuale solo dopo download PDF | Ora visibile sempre nella bozza | ✅ RISOLTO |

### Cose aperte dopo sessione 19

1. Test manuali: salva PDF da preventivo con numero → verifica nome file "Preventivo 001/2026 - Carta Canta.pdf"
2. Test manuali: bozza → click "Registra invio manuale" → stato diventa Inviato + numero assegnato
3. Numerazione bozze separata — decisione prodotto pendente
4. Bug #8: Google OAuth intermittente
5. Bug #9: Logo PNG nel PDF — da testare con logo reale

---

## A. HANDOFF — SESSIONE 18 (22 maggio 2026)

### Cosa è stato fatto

**Fix colori e layout `DocumentTimeline`:**
- `DocumentTimeline.tsx`: evento `viewed` aveva `text-violet-700 bg-violet-100` → cambiato in `text-yellow-700 bg-yellow-100` per allinearlo al colore del `StatusBadge` "Visto"
- `preventivi/[id]/page.tsx`: aggiunto `<Separator>` + `mt-8` tra `DocumentTimeline` e `ViewHistorySection` — eliminato il collasso visivo tra le due sezioni

**Fix race condition `document_log` (eventi non comparivano subito):**
- `saveDraftAction`: la seconda query separata per leggere `document_log` è stata eliminata. Il campo viene ora incluso nel `select` iniziale e usato direttamente. Stesso fix applicato a `restoreToSentVersionAction`.
- Causa: la seconda lettura avveniva dopo un `UPDATE` nel DB e poteva restituire dati stale, causando la mancata visualizzazione dell'evento "Ripristinato" subito dopo il ripristino.

**Fix `RestoreVersionButton` scomparso dal banner "Preventivo modificato":**
- `preventivi/[id]/page.tsx`: il bottone era condizionato a `{(doc as any).sent_snapshot && <RestoreVersionButton>}`. Documenti inviati prima dell'introduzione di `sent_snapshot` (migration 033) avevano `sent_snapshot = null` → bottone nascosto.
- Fix: rimossa la condizione `sent_snapshot &&`. Il bottone ora è sempre visibile quando `updated_after_send_at` è set. La Server Action stessa gestisce il caso di snapshot assente restituendo un messaggio di errore.
- Aggiunto `space-y-2` al div interno del banner per separare visivamente testo e bottone.
- Cambiato `toLocaleDateString` → `toLocaleString` per mostrare anche l'ora nel banner.

**Fix "Nessuno snapshot disponibile per il ripristino" (legacy docs):**
- `saveDraftAction`: prima di sovrascrivere i dati di un documento `sent`/`viewed` già inviato, se `sent_snapshot` è `null`, viene creato retroattivamente uno snapshot dai campi+voci correnti.
- Lo snapshot viene scritto nella stessa update che imposta `updated_after_send_at`, prima che le voci vengano cancellate e riscritte.
- Questo garantisce che qualsiasi preventivo inviato prima di migration 033 acquisisca uno snapshot alla prima modifica — `RestoreVersionButton` funzionerà correttamente anche per questi documenti.

**Fix numero preventivo non assegnato al primo invio (da Nuovo Preventivo):**
- Causa: `createDocumentAction` creava il documento con `doc_number: null` e si aspettava che `send-email/route.ts` lo assegnasse. Se `router.refresh()` non rimontava `PreventivoForm` (React `useState` mantiene il valore iniziale `null`), il numero non compariva nell'UI.
- Fix: `createDocumentAction` ora, quando `intent === 'send'`, chiama `allocateDocNumber()` immediatamente, prima di fare l'INSERT. Il documento viene creato già con il numero assegnato. Il fallback nella route `send-email` rimane per retrocompatibilità.

**Fix lista preventivi — regressioni multiple ripristinate:**
Una sessione agente precedente aveva reintrodotto feature che erano state deliberatamente rimosse. Tutte ripristinate:
- Rimossi tab "Inviati" e "Visti" da `STATUS_TABS` — inglobati in "In attesa"
- Rimossa `ClientFilter` e la query `clientsForFilter` associata — sostituita da ricerca testuale unica
- Rimosso import di `ClientFilter`

**Fix ordinamento lista preventivi:**
- Sort default ("Più recenti") usava `doc_year DESC, doc_seq DESC, created_at DESC` → le bozze (con `doc_year`/`doc_seq` null) finivano sempre in fondo anche se appena modificate.
- Fix: sort default cambiato in `updated_at DESC` per tutti i sort che non hanno logica specifica.
- Stessa logica per `oldest`: ora `updated_at ASC`.
- `expiry`: `expires_at ASC NULLS LAST, updated_at DESC` (secondario: ultima modifica).
- Opzione rinominata "Più recenti" → "Ultima modifica".

**localStorage sort persistence:**
- `SortSelect.tsx`: completamente riscritto con `useEffect` + `usePathname`.
- Al cambio sort: salva in `localStorage` (key: `preventivi_sort_v1`). Se sort è `'recent'`, rimuove la chiave.
- Al mount: se non c'è `?sort=` nell'URL, legge `localStorage` e fa `router.replace(pathname?sort=...)` per ripristinare la preferenza salvata.

### B.3 AGGIORNATO — Numerazione documenti

> ⚠️ La regola B.3 nella sezione B è parzialmente obsoleta: il numero viene assegnato **sia al momento del primo invio** (via `send-email/route.ts`) **sia immediatamente alla creazione** se `intent === 'send'` in `createDocumentAction`. Vedi sezione B.3 per il testo aggiornato.

### Commit sessione 18

```
6495cbb  fix(timeline): yellow for viewed + storico spacing + fix document_log race condition
c7646bc  fix(preventivi): always show RestoreVersionButton in modified banner
383572c  fix(preventivi): create sent_snapshot retroactively on first edit of legacy sent docs
bc15e77  fix(preventivi): assign doc_number immediately when intent=send on create form
10ee491  fix(preventivi): remove Inviati/Visti tabs + fix sort + remove ClientFilter + localStorage
```

### File toccati (sessione 18)

```
app/(app)/preventivi/_components/DocumentTimeline.tsx     [viewed event color: violet → yellow]
app/(app)/preventivi/_components/SortSelect.tsx           [riscritto: localStorage + pathname + sort fix]
app/(app)/preventivi/[id]/page.tsx                        [Separator spacing + RestoreVersionButton unconditional + banner toLocaleString]
app/(app)/preventivi/page.tsx                             [rimosse Inviati/Visti tabs + ClientFilter + sort updated_at]
lib/actions/documents.ts                                  [saveDraftAction: retroactive snapshot + no second DB read; restoreToSentVersionAction: no second DB read; createDocumentAction: allocate number when intent=send]
CLAUDE.md                                                 [aggiornato]
```

### Bug risolti in sessione 18

| # | Bug | Stato |
|---|---|---|
| Timeline `viewed` viola invece di giallo | Fix `DocumentTimeline.tsx` colore event | ✅ RISOLTO |
| Evento "Ripristinato" non compariva subito | Eliminata seconda query DB per `document_log` | ✅ RISOLTO |
| `RestoreVersionButton` scomparso per legacy docs | Rimossa condizione `sent_snapshot &&` | ✅ RISOLTO |
| "Nessuno snapshot disponibile" su legacy docs | Snapshot creato retroattivamente alla prima modifica | ✅ RISOLTO |
| Numero non assegnato da Nuovo Preventivo + send | `createDocumentAction` chiama `allocateDocNumber` se `intent=send` | ✅ RISOLTO |
| Tab "Inviati" e "Visti" ricomparse | Rimossi da `STATUS_TABS` | ✅ RISOLTO |
| `ClientFilter` ricomparso nella toolbar | Rimosso import e JSX | ✅ RISOLTO |
| Sort "Ultima modifica" e "Scadenza vicina" non funzionavano | Sort default ora `updated_at DESC`, expiry con fallback `updated_at` | ✅ RISOLTO |
| Preferenza sort non salvata tra sessioni | `localStorage` con chiave `preventivi_sort_v1` | ✅ RISOLTO |

### Cose aperte dopo sessione 18

1. Test manuali: banner "Preventivo modificato" → bottone Ripristina → funziona per doc legacy (prima modifica crea snapshot)
2. Test manuali: nuovo preventivo → compila voci → invia direttamente → numero assegnato
3. Numerazione bozze separata — decisione prodotto pendente
4. Bug #8: Google OAuth intermittente
5. Bug #9: Logo PNG nel PDF — da testare con logo reale

---

## A. HANDOFF — SESSIONE 17 (21 maggio 2026)

### Cosa è stato fatto

**Font Google nei template PDF (fix `wrap()`):**
- `lib/pdf/template.ts`: aggiunto `GOOGLE_FONTS_URL` map e `googleFontsTag(fontName)` helper
- Tutti e 4 i `return wrap(font, ...)` ora passano `fontName` come terzo argomento
- Font coerenti su tutti i dispositivi, inclusi iOS/Android che non hanno Inter/GeistSans

**Pagina pubblica `/p/[token]` (font + UX bottoni):**
- `DocumentFrame.tsx`: accetta `src=` (URL reale) invece di `srcDoc` — risolve null-origin che bloccava Google Fonts nelle iframe
- Mobile scaling: `scale = containerWidth / 794` quando la viewport è più stretta del foglio A4
- `app/p/[token]/page.tsx`: rimossa la generazione HTML server-side, usa `<DocumentFrame src="/api/p/[token]/pdf?preview=1">` direttamente
- `ActionBar.tsx`: rimosso bottone "Scarica PDF" e icona `Download`; aggiunto un solo bottone "Visualizza preventivo" (`?preview=1` → no dialog stampa)
- `next.config.ts`: aggiunto rule `X-Frame-Options: SAMEORIGIN` per `/api/:path*/pdf` (serve per iframe embedding)
- `api/p/[token]/pdf/route.ts`: aggiunto parametro `preview` → `preparePrintHtml(html, !preview)`

**Rinomina bottone app:**
- `PdfActions.tsx`: "Salva come PDF" → "Salva o stampa il PDF"

**Fix bug "Prev Prev XXX/XXXX":**
- `lib/utils/index.ts`: `formatDocNumber()` restituisce direttamente `docNumber` (già include il prefisso); rimosso l'aggiunta manuale del prefisso

**Feature "Modificato dopo invio" (migration 033):**
- `supabase/migrations/033_updated_after_send.sql`: aggiunge `updated_after_send_at TIMESTAMPTZ` e `sent_snapshot JSONB` a `documents` — ✅ applicata manualmente
- `types/database.ts`: aggiornato con i nuovi campi
- `saveDraftAction`: imposta `updated_after_send_at = NOW()` quando il documento era già `sent`/`viewed`; ritorna `wasAlreadySent: boolean`
- `sendDocumentAction` + route `send-email`: salvano `sent_snapshot` al momento dell'invio, azzerano `updated_after_send_at`
- `restoreToSentVersionAction`: ripristina doc al `sent_snapshot` (campi + voci), azzera `updated_after_send_at`
- `ResendReminderDialog.tsx` (NUOVO): dialog "Vuoi reinviare al cliente?" → `?send=1`
- `RestoreVersionButton.tsx` (NUOVO): bottone + confirm dialog che chiama `restoreToSentVersionAction`
- `PreventivoForm.tsx`: dopo salvataggio di un doc già inviato → mostra `ResendReminderDialog`
- `preventivi/[id]/page.tsx`: banner ambra "Preventivo modificato — non ancora reinviato" + `RestoreVersionButton`
- `preventivi/page.tsx`: badge "Modificato" ambra su righe con `updated_after_send_at` non null
- `DocumentTimeline.tsx`: evento "Preventivo aggiornato" con icona Edit e colore ambra
- `PendingDocCard.tsx` + `dashboard/page.tsx`: indicatore "Modificato — cliente non aggiornato"

**Fix email senza allegato PDF:**
- Route `send-email`: rimosso `generatePdfBuffer`, `pdfBuffer`, `fileSlug`, `attachments`; l'email invia solo il link pubblico tramite `buildPdfHtml`/`/p/[token]`

**Fix TypeScript (lavoro agente precedente):**
- `PdfActions` in `preventivi/[id]/page.tsx`: ripristinati i props corretti (`documentId` + `docNumberSlug`)
- `restoreDocumentAction`: aggiunto `numberConflict?: boolean` al tipo di ritorno
- `linkDocumentAction` (NUOVO): collega/scollega manualmente una fattura a un preventivo via `origin_document_id`

### Migration 033 — applicata ✅

```sql
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS updated_after_send_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_snapshot JSONB;
```

### Commit sessione 17

```
6c1e287  feat(preventivi): track modifications after send + fix send-email route
bded5f4  fix(utils): formatDocNumber was prepending prefix to already-prefixed doc_number
a32f75c  fix(ux): rename 'Salva come PDF' to 'Salva o stampa il PDF'
3fb9834  fix(public-pdf): respect ?preview=1 to skip print dialog
e67d3b0  fix(public): remove Scarica PDF button + use iframe src= for Google Fonts
[altri commit sessione 17 precedenti alla compressione del contesto]
```

### File toccati (sessione 17)

```
lib/pdf/template.ts                                        [Google Fonts fix in wrap()]
lib/pdf/logo.ts                                            [preparePrintHtml()]
lib/utils/index.ts                                         [formatDocNumber fix]
lib/actions/documents.ts                                   [saveDraftAction, restoreToSentVersionAction, linkDocumentAction]
app/api/documents/[id]/send-email/route.ts                 [rimosso PDF attachment, aggiunto sent_snapshot]
app/api/documents/[id]/pdf/route.ts                        [restituisce HTML con print script]
app/api/p/[token]/pdf/route.ts                             [preview param, restituisce HTML]
app/(app)/preventivi/_components/PdfActions.tsx            [label + props fix]
app/(app)/preventivi/_components/PreventivoForm.tsx        [ResendReminderDialog dopo salvataggio]
app/(app)/preventivi/_components/ResendReminderDialog.tsx  [NUOVO]
app/(app)/preventivi/_components/RestoreVersionButton.tsx  [NUOVO]
app/(app)/preventivi/_components/DocumentTimeline.tsx      [evento "aggiornato"]
app/(app)/preventivi/[id]/page.tsx                         [banner + RestoreVersionButton + PdfActions fix]
app/(app)/preventivi/page.tsx                              [badge "Modificato"]
app/(app)/dashboard/page.tsx                               [updated_after_send_at in query]
app/(app)/dashboard/_components/PendingDocCard.tsx         [indicatore "Modificato"]
app/p/[token]/page.tsx                                     [DocumentFrame src= invece di srcDoc]
app/p/[token]/_components/ActionBar.tsx                    [rimosso "Scarica PDF"]
components/public/DocumentFrame.tsx                        [mobile scaling + src= support]
next.config.ts                                             [X-Frame-Options SAMEORIGIN per /pdf routes]
supabase/migrations/033_updated_after_send.sql             [NUOVO — applicata]
types/database.ts                                          [updated_after_send_at + sent_snapshot]
tests/unit/pdf/generate.test.ts                            [mock aggiornato]
CLAUDE.md                                                  [aggiornato]
```

### Bug risolti in sessione 17

| # | Bug | Stato |
|---|---|---|
| Font diverso nel link cliente vs app | `src=` URL invece di `srcDoc` → Google Fonts caricano | ✅ RISOLTO |
| "Scarica PDF" visibile nel link cliente | Rimosso `ActionBar.tsx` | ✅ RISOLTO |
| "Connessione negata" nell'iframe | `X-Frame-Options: SAMEORIGIN` per route PDF | ✅ RISOLTO |
| `?preview=1` apriva comunque dialog stampa | `preparePrintHtml(html, !preview)` | ✅ RISOLTO |
| "Prev Prev001/2026" doppio prefisso | `formatDocNumber` restituisce docNumber as-is | ✅ RISOLTO |

### Test manuali consigliati

| Check | Come |
|---|---|
| Font coerente link vs app | Apri un preventivo inviato → link cliente → font deve essere identico al template nell'app |
| "Modificato" badge | Modifica un preventivo inviato → salva bozza → deve apparire badge ambra nella lista |
| Dialog reinvio | Salva bozza su preventivo inviato → deve uscire dialog "Vuoi reinviare?" |
| Ripristina versione | Dal dettaglio preventivo modificato → bottone "Ripristina" → riporta ai dati dell'ultimo invio |
| Banner ambra | Preventivo modificato non reinviato → pagina dettaglio → banner ambra visibile |
| Email senza allegato PDF | Invia preventivo → email ricevuta NON deve avere PDF allegato |

### Cose aperte dopo sessione 17

1. Test manuali nella tabella sopra
2. Numerazione bozze separata — decisione prodotto pendente
3. Bug #8: Google OAuth intermittente
4. Bug #9: Logo PNG nel PDF — da testare con logo reale

---

## A-16. HANDOFF — SESSIONE 16 (21 maggio 2026)

### Stato attuale

Sessione 16 ha risolto definitivamente la generazione PDF rotta post-sessione 15. Il PDF server-side con Chromium headless non funziona su Vercel Lambda (nessuna versione di `@sparticuz/chromium` funziona — manca `libnss3` nell'ambiente serverless). La soluzione adottata è **browser print** via HTML: i route PDF ora restituiscono l'HTML di `buildPdfHtml()` con script di stampa iniettato. Template sempre coerente, zero costi extra.

### Architettura PDF definitiva (post-sessione 16)

```
buildPdfHtml(data) → HTML
  → /api/documents/[id]/pdf?preview=1  → mostra documento senza dialog stampa
  → /api/documents/[id]/pdf            → mostra documento + window.print() automatico
  → /api/p/[token]/pdf                 → idem (pagina pubblica)
  → send-email/route.ts → generatePdfBuffer() → @react-pdf/renderer → allegato email
```

**`@sparticuz/chromium` e `puppeteer-core` sono ancora in package.json ma NON vengono usati.** Possono essere rimossi in un future cleanup.

**Salva come PDF:** utente clicca → nuova tab → document HTML con dialogo di stampa Chrome → "Salva come PDF" → un click → PDF salvato. Identico al template.

**Perché non un download diretto:** richiederebbe server-side PDF generation (impossibile su Vercel Lambda) o servizio esterno a pagamento. Decisione confermata: soluzione attuale è il compromesso ottimale qualità/costo.

### Bug #6 stato aggiornato

| # | Bug | Stato |
|---|---|---|
| 6 | **PDF preview/download** | ✅ RISOLTO (sessione 16) — browser print, template identico |

### File toccati (sessione 16)

```
lib/pdf/generate.ts                            [riscritto più volte — finale: @react-pdf/renderer per email]
lib/pdf/logo.ts                                [aggiunto preparePrintHtml()]
app/api/documents/[id]/pdf/route.ts            [riscritto — restituisce HTML con print script]
app/api/p/[token]/pdf/route.ts                 [riscritto — restituisce HTML con print script]
app/(app)/preventivi/_components/PdfActions.tsx [aggiornato — ?preview=1 vs default]
next.config.ts                                 [serverExternalPackages aggiornato]
package.json                                   [puppeteer-core aggiunto, @sparticuz/chromium downgradato a v119, engines.node >=20]
.nvmrc                                         [aggiunto: 20]
CLAUDE.md                                      [aggiornato]
```

### Commit sessione 16

```
c7c7841  fix(pdf): detect environment for Chrome launch
3748bc2  fix(pdf): switch playwright-core → puppeteer-core
5b51110  fix(pdf): add puppeteer-core to serverExternalPackages
272ed5e  fix(pdf): require Node 20 for @sparticuz/chromium v131
bd24f9e  fix(pdf): downgrade @sparticuz/chromium to v119
6767ba8  fix(pdf): revert to @react-pdf/renderer (email only)
69089c2  feat(pdf): replace server-side PDF with browser print
d358851  fix(pdf): force background colors + differentiate preview vs save
```

---

## A-15. HANDOFF — SESSIONE 15 (21 maggio 2026)

### Stato attuale

Questa sessione ha completato l'architettura "fonte unica di verità" per i template: `buildPdfHtml()` in `lib/pdf/template.ts` ora è l'unico sistema che genera il layout di documenti su tutte e 4 le superfici. Vedi sezione H.

La sessione precedente (14, 20 maggio) aveva risolto la discordanza template a livello di snapshot/dati. Ora la discordanza è risolta anche a livello di RENDERING: tutte le superfici chiamano la stessa funzione.

### Migration pendenti

Nessuna. Tutte le migration 001–032 risultano applicate.

### Migration da applicare

**Tutte le migration 001–031 risultano applicate** (029: `last_reminder_at`, 030: `deleted_at`/soft-delete, 031: `next_invoice_number` SECURITY DEFINER+GREATEST — applicate manualmente il 20 maggio 2026). Non ci sono migration pendenti.

### Bug aperti — stato onesto dopo sessione 14

| # | Bug | Stato | Note |
|---|---|---|---|
| 1 | **Email finiscono nello spam** | ⚠️ PARZIALE | Fix codice: plain-text aggiunto, emoji rimosso. DNS non verificato. Richiede test manuale. |
| 2 | **Verifica email → reindirizza a login** | 🟡 FIX APPLICATO — da verificare | `proxy.ts`: `/verifica-email` aggiunto a `PUBLIC_PATHS`. Non testato in browser. |
| 3 | **Rate limit scatta su login riusciti** | 🟡 FIX APPLICATO — da verificare | `loginAction`: rate limit ora conta solo fallimenti. Non testato con login reali. |
| 4 | **Numero preventivo non assegnato all'invio** | ✅ CHIUSO | Causa: doppio overload `next_invoice_number(INT)` vs `(SMALLINT)`. Fix: migration 032. Verificato in browser. |
| 5 | **Numerazione non incrementa (sempre 001/2026)** | 🟡 FIX APPLICATO — da verificare | `peekNextDocNumber/InvoiceNumber`: `seq_type` → `doc_type`. Non testato con sequenza reale. |
| 6 | **PDF preview/download non funzionano** | 🟡 FIX APPLICATO — da verificare | `PdfActions`: ora server-side links (`/api/documents/[id]/pdf`). Non testato in browser. |
| 7 | **Mobile — IVA invisibile** | 🟡 FIX APPLICATO — da verificare | `VociTable`: rimosso `hidden sm:block`, `grid-cols-5` fisso, label corrette. Da verificare su device reale. |
| 8 | **Google OAuth → a volte chiede credenziali di nuovo** | ❌ APERTO | Intermittente. OAuth bfcache fix applicato in sessione 12 (225c949). Non confermato risolto. |
| 9 | **Logo PNG non visibile nel PDF** | ❌ APERTO | `fetchLogoBase64` implementato ma non testato con logo reale nei 4 preset. |
| 10 | **Warning "già inviato" su bozza vergine** | ✅ CHIUSO | Fix (`e603a48`): `handleSend()` ora naviga a `?send=1` senza chiamare `sendDocumentAction` prima. |
| 11 | **Template PDF/anteprima/link cliente discordanti** | ✅ CHIUSO (sessioni 14–15) | Dati: sezione G. Rendering: sezione H. |

### Email deliverability — cosa resta da fare fuori dal codice

1. Resend Dashboard → Domains → verifica **Status: Verified** per `send.cartacanta.app`
2. Verifica record SPF su `send.cartacanta.app` (deve includere Resend)
3. Bounce/complaint rate in Resend dashboard: < 5% / < 0.1%
4. Test diretto: invia preventivo a Gmail → verifica inbox (non spam)

### Da verificare manualmente prima del prossimo task

| Check | Come |
|---|---|
| Bug #2: link verifica email | Signup nuovo account → clicca "Vai alla pagina di verifica" → deve aprire /verifica-email |
| Bug #3: rate limit | 3 login riusciti consecutivi → nessun blocco |
| Bug #4: numero assegnato | Crea bozza senza numero → invia → doc_number nel DB deve essere Prev001/2026 |
| Bug #5: numerazione | Crea 3 preventivi → numeri devono essere Prev001, Prev002, Prev003 |
| Bug #6: PDF | Apri preventivo inviato → clicca Anteprima PDF → PDF si apre in nuova scheda |
| Bug #7: mobile IVA | Apri preventivo su telefono → IVA visibile nella griglia voci |

### Decisioni di prodotto pendenti — NON implementare senza conferma

| Decisione | Proposta | Stato |
|---|---|---|
| **Numerazione bozze** | "Bozza 001" senza anno finché non inviato, poi "Prev001/2026" al primo invio | ⏳ Attende conferma |
| **TASK 13 — Template preview consistency** | ✅ CHIUSO (sessione 14) — la discordanza tra preset scelto e PDF/link cliente è stata risolta. Se il task intendeva altro, specificare. |

---

## G. SESSIONE 14 — 20 MAGGIO 2026 — RIEPILOGO

### Problema segnalato

L'utente aveva impostato un template personalizzato, ma il PDF scaricato, l'anteprima e la pagina pubblica `/p/[token]` mostravano tutti template diversi tra loro e diversi da quello scelto.

### Cause radice identificate (3 bug distinti in cascata)

**Bug 1 — `PreventivoPDF.tsx` aveva un solo layout hardcoded**

`PreventivoPDF.tsx` non usava `preset_key` — la funzione `makeStyles()` non esisteva e il layout era unico (assomigliava al Bold) per tutti e 4 i preset. Il template selezionato era irrilevante.

Fix: riscrittura di `PreventivoPDF.tsx` con `makeStyles(primary, preset)` che differenzia:
- Font: Elegante → Times-Roman/Bold/Italic; tutti gli altri → Helvetica (font built-in, nessun download)
- Header: Bold → `backgroundColor: primary`; Tecnico → bordo inferiore 3px; Classico/Elegante → linea sottile
- Table header: Elegante → no fill + bordo grigio; Bold → tint 18% + testo colorato; Classico/Tecnico → fill pieno + testo bianco
- Footer: Bold → sfondo tinto; altri → grigio chiaro con border-top

**Bug 2 — `mapToPdfData` in `generate.ts` scartava `preset_key` e `font_family`**

La funzione di mapping non passava `preset_key` né `font_family` al componente `PreventivoPDF`. Anche dopo il fix al componente, il preset sarebbe rimasto ignoto.

Fix: aggiunto passaggio esplicito in `mapToPdfData`:
```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
preset_key:  (template as Record<string, unknown>).preset_key  as string | null ?? null,
font_family: (template as Record<string, unknown>).font_family as string | null ?? null,
```
(Cast `any` necessario perché Supabase `Json` non accetta `Record<string, unknown>`)

**Bug 3 — `saveDraftAction` non salvava mai i cambiamenti di template**

`saveDraftAction` parsava `template_id` dal form ma non lo scriveva mai nel DB (né nel documento, né in `template_snapshot`). Ogni cambio di template su una bozza veniva silenziosamente ignorato.

Fix: `saveDraftAction` ora:
1. Se `template_id` è presente nel form → fetch del template da Supabase
2. Salva `template_snapshot` sul documento
3. Azzera `pdf_url = null` per invalidare la cache

**Bug 4 — Pagina pubblica `/p/[token]` senza fallback template**

La pagina pubblica leggeva solo `doc.template_snapshot` e usava colori hardcoded se null. Per i documenti inviati prima dei fix, lo snapshot era null → la pagina mostrava preset di default.

Fix: implementata fallback chain a 4 livelli (snapshot → default workspace → qualsiasi template workspace → nessuno).

**Bug 5 (strutturale) — Layout card HTML diverso dal PDF**

Anche con il template corretto, la pagina pubblica aveva struttura visiva diversa dal PDF: date nel header invece che nella sezione info, colonna UM mancante, doc type label in maiuscolo/minuscolo diverso.

Fix: ristrutturata la card in `/p/[token]/page.tsx`:
- Header: logo+azienda a sinistra | tipo documento+numero a destra (date spostate)
- Bold: header card con `backgroundColor: colorPrimary`
- Tecnico: bordo sinistro 3px brand color
- Sezione 2 colonne: DESTINATARIO (sinistra) + DATA EMISSIONE+date (destra)
- Table header: rispetta il preset (Elegante → no fill; Bold → tint; Classico/Tecnico → fill pieno)
- Colonna UM aggiunta (`hidden sm:table-cell`)
- Doc type label: uppercase per tutti tranne Elegante (italic)

### File toccati (sessione 14)

```
components/pdf/PreventivoPDF.tsx        [RISCRITTURA PARZIALE — makeStyles() + 4 preset]
lib/pdf/generate.ts                     [mapToPdfData: aggiunto preset_key + font_family]
lib/actions/documents.ts                [saveDraftAction: salva template_snapshot + azzera pdf_url]
app/api/documents/[id]/send-email/route.ts  [sempre sovrascrive template_snapshot al primo invio]
app/p/[token]/page.tsx                  [fallback chain template + ristrutturazione card layout]
```

### Commit sessione 14

```
19188ae  fix(pdf): implement 4-preset rendering in PreventivoPDF + pass preset_key in mapToPdfData
24d5d3e  fix(draft): saveDraftAction now saves template_snapshot and invalidates pdf_url
fda7cbb  fix(public): 4-level template fallback chain in /p/[token]
9ebd1ef  fix(public): restructure /p/[token] card layout to match PDF structure
```

### Note tecniche importanti emerse

- `lib/pdf/template.ts` è **codice morto** — l'approccio Playwright/HTML non è mai usato. Il PDF reale è generato da `@react-pdf/renderer` via `PreventivoPDF.tsx`.
- I font di `@react-pdf/renderer` devono essere **built-in** (Helvetica, Times-Roman, Courier) o registrati esplicitamente con `Font.register()`. Non si possono usare font Google/system senza download.
- Supabase `Json` type non è assegnabile da `Record<string, unknown>` — serve cast `as any` con commento ESLint `// eslint-disable-next-line @typescript-eslint/no-explicit-any`.
- Il campo `PdfData.template` deve avere `preset_key?: string | null` e `font_family?: string | null` — aggiornare l'interfaccia se si aggiungono altri campi al template.

### Cose aperte dopo sessione 14

1. Test manuale: verificare PDF generato (session 14 fix) — ora sostituito dalla sessione 15 che usa playwright
2. Bug #5 numerazione (sempre 001/2026) — da verificare con sequenza reale
3. Bug #6 PDF preview/download — da verificare in browser
4. Bug #7 mobile IVA — da verificare su device reale
5. Logo PNG nel PDF — ora gestito da `fetchLogoBase64()` in `lib/pdf/logo.ts`; testare con logo reale

---

## H. SESSIONE 15 — 21 MAGGIO 2026 — RIEPILOGO

### Problema segnalato

Discordanza visiva tra le 4 superfici di rendering. La sessione 14 aveva allineato i DATI (snapshot, preset_key), ma non il RENDERING: ogni superficie aveva il proprio codice di layout separato e poteva divergere a qualsiasi modifica futura.

### Soluzione implementata: `buildPdfHtml()` come fonte unica di verità

La funzione `buildPdfHtml()` in `lib/pdf/template.ts` genera HTML completo (4 preset, watermark, logo, note legali, tutti gli stili inline). Tutte e 4 le superfici ora la usano:

| Superficie | Prima | Dopo |
|---|---|---|
| PDF scaricabile (e anteprima) | `@react-pdf/renderer` + `PreventivoPDF.tsx` (layout parallelo) | `playwright-core` + `@sparticuz/chromium` → `buildPdfHtml()` HTML → PDF |
| PDF allegato email | stessa chain di sopra | auto-corretto (chiama `generatePdfBuffer`) |
| Pagina pubblica `/p/[token]` | JSX custom con Tailwind (~200 righe) | `buildPdfHtml()` via `<DocumentFrame>` (iframe srcDoc) |
| Template preview settings | rimane `TemplatePreview.tsx` (fuori scope, dati campione) | invariato per ora |

### File creati / modificati

```
lib/pdf/logo.ts                         [NUOVO] fetchLogoBase64() — URL → data-URI base64
lib/pdf/generate.ts                     [RISCRITTURA] playwright-core + chromium + buildPdfHtml()
components/public/DocumentFrame.tsx     [NUOVO] <iframe srcDoc> auto-sizing per /p/[token]
app/p/[token]/page.tsx                  [SEMPLIFICATO] ~430 → ~270 righe; usa buildPdfHtml()
app/api/documents/[id]/pdf/route.ts     [+] export const maxDuration = 60 (Vercel Pro)
app/api/documents/[id]/send-email/route.ts [+] export const maxDuration = 60 (Vercel Pro)
```

### Architettura post-sessione 15

```
buildPdfHtml(data: PdfDocumentData): string
    ↓ chiamato da
    ├── lib/pdf/generate.ts → generatePdfBuffer() → playwright → PDF buffer
    │       ↓ chiamato da
    │       ├── /api/documents/[id]/pdf (download + anteprima)
    │       └── /api/documents/[id]/send-email (allegato email)
    └── app/p/[token]/page.tsx → <DocumentFrame html={...} />
                                     ↓
                                 <iframe srcDoc={html}> (browser)
```

### Note tecniche

- `@sparticuz/chromium` + `playwright-core` sono già in `package.json` — nessuna nuova dipendenza
- La precedente nota "Playwright/Chromium è codice morto" era riferita a `playwright-chromium` (con browser bundled). `playwright-core` + `@sparticuz/chromium` è l'approccio corretto per Vercel serverless.
- `maxDuration = 60` sulle due route PDF per Vercel Pro (Chromium startup ~5-15s)
- `fetchLogoBase64()` in `lib/pdf/logo.ts` scarica il logo workspace e lo converte in base64 (timeout 5s). Se fallisce, `buildPdfHtml()` usa il placeholder SVG.
- `DocumentFrame` usa `<iframe srcDoc={html}>` con auto-resize via `onLoad`. Su mobile l'A4 (210mm) richiede scroll orizzontale — questo è intenzionale (il documento è identico al PDF).
- `lib/pdf/template.ts` è ora LA fonte unica. Non toccarla senza screenshot aggiornati dei 4 preset.
- `PreventivoPDF.tsx` NON è più usato dalla chain di produzione. Può essere eliminato in una sessione di pulizia futura.

### Commit

```
c31aafc  feat(template): buildPdfHtml() as single source of truth for all PDF surfaces
```

### Cose aperte dopo sessione 15

1. Test manuale: aprire link pubblico di un preventivo inviato → deve mostrare esattamente lo stesso layout del PDF scaricabile
2. Test manuale: scaricare PDF → confrontare con link pubblico — devono essere identici
3. Performance: il primo PDF dopo cold start può richiedere 10-20s (Chromium download). Valutare se ottimizzare con caching del browser in `/tmp`.
4. `PreventivoPDF.tsx` + `@react-pdf/renderer` — ora inutilizzati. Rimuovere in una sessione di pulizia (richiede aggiornare tests/unit/pdf/generate.test.ts).
5. Bug #5 numerazione — da verificare
6. Bug #6 PDF preview — ora usa playwright, da verificare
7. Bug #7 mobile IVA — da verificare

---

---

# CONSOLIDAMENTO 15 LUGLIO 2026 — blocchi spostati da CLAUDE.md (contenuto integrale)

---

# ▼ Handoff 7-12 lug 2026 (spostati da CLAUDE.md §A0 il 15 lug 2026)

### Fatto anche (12 lug sera — audit COMPLETO #2 su richiesta Eli: 4 agent, ~60 findings, lotto fix unico)
Richiesta: "controlla tutta la app... soprattutto i feedback che ti avevo già notificato che non devono ripetersi". 4 agent (pattern ricorrenti · grammatica · bottoni artigiano · aree secondarie+tutorial), ogni finding ALTA verificato di persona prima del fix. **Demo fixato in corsa (PR #57): lo script scriveva doc_year/doc_seq che sono colonne GENERATED → rimosse dal payload; Eli deve `git pull` + `npm run seed:demo`.**
- **🔴 ALTA fixate:** (1) **NumericInput `locale`**: focus+blur sul Prezzo di una voce ≥1.000€ lo divideva per 1000 (parseFloat su "1.250,00"→1.25) → parseImportoIt ovunque (VociTable, CatalogPicker, CatalogItemForm); (2) **fattura SCADUTA non incassabile**: la RPC scade anche le fatture ma nessuna transizione expired→accepted esisteva → aggiunta in route+dettaglio+chips mobile, expired incluso in /fatture/scadenze, tab Inviate e badge Altro; (3) **webhook Stripe**: i 4 update piano erano senza check errore e rispondevano sempre 200 → ora throw→500 e Stripe RITENTA (prima un pagante poteva restare Free in silenzio); (4) **restore versione inviata**: delete/insert/update non controllati → poteva svuotare le voci dicendo ok; (5) **dettatura compact** (tutti gli usi): gli errori (quota/microfono/rete) erano INVISIBILI → toast; (6) **emoji nelle email** (9 template storici, regola B.6) rimosse + **support@→supporto@** (2 template).
- **MEDIA:** `applyDepositAndOptions` ignorava ogni errore (acconti/opzioni persi con "salvato") → isMissingColumnError + errore in update/saveDraft; duplicazione senza voci → rollback+errore; delete voci non controllato in update; invito commercialista controlla sendEmail; WhatsApp senza +39 interpretato come Francia → `lib/whatsapp.ts` condiviso su 4 superfici + ActionBar; cestino: conferma per l'eliminazione DEFINITIVA + spinner per-bottone + purge ora elimina DAVVERO foto (bucket+righe, anche nel cron — GDPR); prefill cliente da scheda usava `?client=` ma la pagina legge `client_id`; **/opengraph-image non era in PUBLIC_PATHS** → i crawler social ricevevano 307 (anteprime senza immagine; ⚠️ vale anche per il futuro assetlinks.json!); Anteprima PDF per Free bloccato → redirect /abbonamento (non più JSON grezzo); PDF con date Europe/Rome (era UTC: dopo le 23 data del giorno prima sul documento fiscale!) + email accettato/visto/rifiutato con ora italiana + export CSV liste + `document-date.ts` (confini "Scade oggi" per giorno di Roma); converti-fattura: guardia proposte non più bypassabile da un errore; segna-pagata: retry su payment_status; quota AI fail-open ristretta (un errore DB non bypassa più il kill-switch); AccontoCard+WorkPhotosCard anche su DESKTOP (registrare un acconto dal PC era impossibile); "Da preventivo" su mobile: trigger visibile anche dopo la chiusura del dialog + avviso se non ci sono preventivi; Salva in Impostazioni avvisa se il logo scelto non è stato caricato; AI import APPENDE alle voci manuali (non le cancella più).
- **BASSA/copy:** grammatica (4 concordanze "diversi→diverse" riformulate, "notificato"→"avvisato", "all'email", nota legale AcceptModal cita il bottone col nome VERO "Accetto il preventivo", toggle notifiche senza etichette inesistenti, aiuto "Accetta e firma"); export CSV liste via fetch+blob (`CsvDownloadButton`); errore "Usa come modello" in toast; delete foto con rollback; spinner per-sorgente in SopralluogoForm; suggerimenti ATECO non compaiono più su ricerca senza risultati; copy Copia-link bozza onesto; Ricomincia disabilitato durante il salvataggio import; clipboard referral con fallback; RequestRow con rollback; BottomNav attiva "Altro" su tutte le sezioni; label export in /studio "Registro fatture (CSV)"; copy elimina cliente/template onesti; lavori: MIGRATION_HINT solo per colonne mancanti.
- **DECISIONI APERTE per Eli:** (a) claim "30 giorni di prova" (landing+piano.tsx) vs welcome email "beta gratuita" — il trial di 30gg È applicato davvero (trigger 024 + checkFreeBlock): decidere se disattivarlo in beta o dirlo ovunque; (b) input 13-15px (design mockup di Eli) causano ZOOM automatico su iPhone — design vs UX, serve scelta; (c) eliminare un cliente con fatture emesse svuota nome/P.IVA sulle fatture (ora il dialog lo dice; valutare blocco tipo deleteAccount); (d) registrazione con Google da link ?studio=/?ref= perde invito e referral (i metadati viaggiano solo nel form email/password); (e) "Segnala profilo" su /professionisti è solo mailto (rilevanza notice-and-takedown). Deferiti con nota: KPI dashboard/bilancio con confini mese UTC (1-2h al bordo), template actions esiti parziali, markNotificationsRead silenzioso.
- tsc+build+**190/190** verdi; scan spazi build pulito.

### Fatto anche (12 lug — audit "quasi zero bug": 3 agent QA, 31 findings, TUTTI fixati o motivatamente deferiti)
Richiesta Eli: "non voglio essere io a trovare i bug". 3 agent hanno simulato un utente umano leggendo i percorsi di codice (artigiano + commercialista + tutorial). Fix in un unico lotto:
- **Sicurezza:** open redirect in `loginAction` (il `redirect` del form non era validato) + hardening `\` (i browser normalizzano `/\evil.com` → `//evil.com`) su proxy.ts, loginAction, auth/callback e OAuthButtons; **OAuth ora propaga `?redirect=`** (`/login?redirect=/studio` con Google atterra su /studio; chi entra per /studio salta l'onboarding artigiano); banner suggerimento commercialista riformulato in forma non assertiva (il `?studio=` è spoofabile).
- **Cancellazione account:** `deleteAccountAction` ora CANCELLA l'abbonamento Stripe prima di eliminare (prima restava attivo e addebitava un utente senza account!) e controlla l'errore di OGNI delete (prima un fallimento silenzioso poteva eliminare l'utente auth lasciando dati orfani).
- **Export CSV:** confini date in **Europe/Rome** (`romeDayStart` in lib/csv.ts — il server UTC spostava il confine di 1-2h), `isValidIsoDate` nelle 4 route (il solo regex accettava 2026-13-45), celle intestazione quotate intere, bilancio esclude le fatture ANNULLATE dalle entrate, bottoni export via **fetch+blob** (un errore mostra il messaggio nel dialog, prima navigava sul JSON grezzo), /studio fatture `nullsFirst:false`.
- **Salvataggi onesti:** `saveDraftAction` controlla update/delete/insert (prima un errore DB mostrava "salvato" perdendo dati); retry "tolleranti pre-migration" ristretti a `isMissingColumnError` (42703/PGRST204, nuovo `lib/supabase/errors.ts`) in expenses/sopralluoghi/lavori — prima un errore FK/RLS reale veniva mascherato salvando dati incompleti; `saveRapportoAction` atomico su `report_signed_at` (testo firmato mai sovrascritto); acconto % >100 clampato (prima spariva in silenzio); WorkPhotosCard rollback+toast se il toggle fallisce.
- **Commercialisti:** re-invito dopo revoca azzera accepted_at/user_id; race 23505 → esito "già registrato"; invito studio→cliente controlla `sendEmail.success` (niente scritture DB: dire "inviato" se non parte sarebbe falso); suggerimento soppresso se ESISTE già un link anche revocato (non riappare all'infinito); loop /studio con email non confermata → `/verifica-email` (helper `studioAuthRedirectPath`); AccountantCard spinner per-azione.
- **Altro:** bottone AI voci ora anche su bozze in edit (il flusso sopralluogo→preventivo atterra in edit: non compariva MAI); AI import passa da `handleVociChange` (preservava i tier); `newVoce` quantity 0 (riga vuota aggiunta non bloccava più il salvataggio con "quantità 1 prezzo 0"); route AI accessibili anche ai MEMBRI del workspace (prima 404 per i collaboratori Team); Free in /lavori/[id]: lock oro → /abbonamento al posto del dialog spese che falliva dopo; copy dialog elimina sopralluogo non promette più di cancellare le foto (restano sul preventivo); SupportForm disabilitato sotto 10 caratteri con hint (allineato al server).
- **Deferito con nota:** paginazione oltre le 1000 righe negli export CSV (default PostgREST) — irrilevante per il target (1000 fatture/anno = ben oltre il Free e la microimpresa tipo); da rivisitare se arriva un utente enterprise.
- tsc+build+**190/190** verdi; scan build Turbopack spazi ok.

### Fatto anche (11-12 lug — collaudo di Eli: PR #44→#53, config esterne COMPLETATE)
- **Config esterne CHIUSE da Eli (verificate una a una):** Turnstile ATTIVO su /signup (widget verificato in prod) · caselle OVH `supporto@/privacy@/segnalazioni@` → redirect alla casella dedicata FUNZIONANTI (l'inoltro OVH ritarda di qualche minuto: normale; filtri Gmail "non spam" creati) · tetti spesa OpenAI $10 + Mistral 10€ prepagato · PostHog riceve eventi · Sentry riceve errori (testato con sonda temporanea poi rimossa, PR #45/#46) · **DMARC → p=quarantine** su OVH · AI Import ATTIVO (`NEXT_PUBLIC_AI_IMPORT_ENABLED=true` + chiavi). Flagsmith NON serve (mai cablato, ignorare).
- **🔴 BUG CRITICO fixato (PR #51, CONFERMATO da Eli in prod):** `/p/[token]` crashava ("qualcosa è andato storto") dal 6 lug — `hasPaymentChannels` esportata da un file `'use client'` e chiamata dalla pagina server → client reference invocata dal server. Trovato via Sentry/Vercel runtime errors. Fix: funzione+tipo in `lib/payments/channels.ts` (server-safe). **Lezione: mai chiamare dal server helper esportati da moduli client.**
- **PR #47 — spazi mangiati da Turbopack** (10 punti in aiuto/privacy/termini/ShareButton/PaymentInfoCard) fixati con `{' '}`, metodo: scan del BUILD compilato (regola permanente in B.2). + **Form di contatto in /aiuto** (`sendSupportMessageAction` → email a supporto@ con replyTo utente, rate-limit 5/h) al posto del solo mailto (che senza client di posta non fa nulla).
- **PR #48 — lotto feedback UX:** /altro riorganizzato in gruppi (**"Il tuo ufficio"** [rinominato da Eli, PR #52]: Lavori/Calendario/Sopralluoghi/Clienti · **Soldi** · **Farsi conoscere** · **Strumenti** · Account); spinner foto per-bottone (Scatta/Galleria); dialog "Segna come inviato" dice che la scadenza riparte da oggi (verificato: expires_at ricalcolato); overlay "Bozza salvata" col numero assegnato e 4s (era 1,5s); hint foto in creazione preventivo.
- **PR #49 — AI voci dal sopralluogo:** `lib/ai/extract-text.ts` (prompt per appunti sbrigativi, Mistral small→OpenAI fallback, Zod) + `POST /api/ai/extract-voci` (stessa quota AI import, consumo solo a successo, 5/min) + bottone oro "Compila le voci dalle note (AI)" in create mode; le voci estratte si aggiungono a quelle manuali.
- **PR #50/#52** — voce "Vetrina dei professionisti" in Altro (apre /professionisti, prima irraggiungibile dall'app) + rinomina gruppo. **PR #53 — tutorial:** passo 3 evidenzia ANCHE le voci (data-tour="cliente" su wrapper Cliente+Voci), passo 4 popover sopra il bottone, fasi intermedie con "Avanti" (non "Fine") + toast che spiega che il tour continua sul preventivo salvato (sembrava bloccato a 4/6); tasto Esci bianco. **PR #44** — istruzioni PayPal.me (paypal.com/paypalme) e Satispay (serve account BUSINESS, dashboard.satispay.com) corrette dopo test reale.
- **⚠️ APERTO — demo senza documenti:** Eli ha lanciato `seed:demo`, login ok ma "non ha documenti pronti". Lo script THROWA con errore visibile se un documento fallisce → attesa dell'output del terminale al prossimo run per diagnosi.
- Backlog manuale Eli rimasto: avvocato (3 PDF + campi gialli + punto commercialista in privacy), SdI/OpenAPI (cancello n.1), Play Store (account + D-U-N-S), Stripe live+P.IVA.

### Fatto anche (9 lug — canale commercialisti FASE B: invito + area /studio read-only)
- **B implementata (dopo FASE A/export).** ⚠️ **Migration 051 (`accountant_links`) DA APPLICARE.** Tabella con **RLS abilitata SENZA policy** → raggiungibile solo via service role (admin client), controlli espliciti nel codice. NON riusa `workspace_members` (le sue RLS non applicano il ruolo → un viewer potrebbe scrivere/auto-invitarsi).
- **Lato artigiano** (`lib/actions/accountant.ts`, card `AccountantCard` in Impostazioni›Generale sotto "Scarica i tuoi dati"): `inviteAccountantAction(email)` (solo proprietario, email validata+lowercased, rate-limit 10/h per workspace, upsert idempotente su `(workspace,email)`, invia `AccountantInviteEmail` senza emoji), `revokeAccountantAction` (scoped al workspace), `listAccountantLinks` (stato Collegato/Invito inviato). Tutto tollerante pre-migration.
- **Lato commercialista** (`app/studio/*`, layout dedicato — NON la shell artigiano): `/studio` = griglia dei clienti che l'hanno invitato; `/studio/[workspaceId]` = KPI Fatturato/Incassato + elenco fatture read-only + download Pacchetto A1 (`/api/studio/[id]/export`). `lib/studio.ts`: `getStudioUser()` richiede `email_confirmed_at`; `assertAccountantAccess(user, wsId)` verifica SEMPRE il link attivo (match email **esatto** lowercased — no `ilike`/wildcard; `revoked_at IS NULL`) prima di restituire il workspace → **IDOR bloccato, mai fidarsi del solo URL** (l'admin client bypassa la RLS). Revoca a effetto immediato (check per-request).
- **Condivisione codice CSV:** `buildRegistroFattureCsv` estratto in `lib/fiscal/registro-fatture.ts`, usato sia da `/api/commercialista/export` (artigiano) sia da `/api/studio/[id]/export` (commercialista).
- Proxy: `/studio` non è pubblico → sloggato reindirizzato a `/login?redirect=/studio`; loggato passa. Validato su PG16 (7 test: unique case-insensitive, revoca, re-invito, IDOR cross-tenant, cascade, RLS senza policy). tsc+build+**190/190** verdi.
- **TODO GDPR (Eli/avvocato):** il commercialista è un nuovo destinatario dati → privacy policy + punto nel PDF avvocato. FASE C (XML FatturaPA massivo) resta bloccata su SdI live.
- **Completamento B (10 lug, migration 051 APPLICATA da Eli):** `/studio/[id]` ora mantiene la promessa "fatture, incassi E SPESE" — KPI Spese + **export Bilancio (entrate/uscite per cassa)** anche dallo studio: `buildBilancioCsv` estratto in `lib/fiscal/bilancio-csv.ts` (condiviso con `/api/bilancio/export`, che resta Pro-gated lato artigiano; lato studio nessun gate — sono i dati del cliente), nuova route `/api/studio/[id]/export-bilancio` (stessa `assertAccountantAccess`). `ExportCommercialistaButton` ha prop `kind: 'registro'|'bilancio'` (copy dedicata). FAQ "Come collego il mio commercialista?" in /aiuto + voce in /novita.
- **Loop virale bidirezionale (10 lug, zero migration):** (1) **invito inverso studio→artigiano**: card "Porta un tuo cliente" in `/studio` → `inviteClientFromStudioAction` (rate-limit 10/h per studio, NESSUNA scrittura DB) invia `StudioClientInviteEmail` con link `/signup?studio=<email>&utm_source=studio`; `UtmCapture` salva `?studio=` in sessionStorage (`cc_studio`) → hidden field in SignupForm → `user_metadata.studio_invite_email`; in AccountantCard `getSuggestedAccountantEmail()` mostra il banner oro "Il tuo commercialista ti ha invitato — Collega" (un tocco → `inviteAccountantAction`) → **il consenso alla condivisione resta SEMPRE all'artigiano** (niente auto-link). (2) **Bottone WhatsApp sul referral** (artigiano→collega, messaggio precompilato col link ?ref=).

### Fatto e già in produzione (PR mergiate su master)
- **PR #8** `1574da1` — **"Scarica i tuoi dati"** (Impostazioni › Generale): `GET /api/account/export` → JSON con account, attività, clienti, preventivi/fatture+voci, spese. Sola lettura. Chiude gap portabilità GDPR art. 20.
- **PR #9** `d9227b6` — **Foto scontrino (AI)** nel Bilancio: `lib/ai/receipt.ts` (Mistral pixtral primario → OpenAI fallback, categoria normalizzata sui preset) + `POST /api/ai/scan-receipt` (stessa quota/rate-limit dell'AI import) + bottone in `AddExpenseDialog` (dietro `NEXT_PUBLIC_AI_IMPORT_ENABLED`; amount/date resi controllati). **+ Pagina pubblica `/cancella-account`** (app/(legal)/cancella-account) — richiesta dal Data Safety del Play Store; link nel footer legale. Manifest già con icona maskable.

### Ricerche web consegnate a Eli (nella guida PDF)
- **Fisco frontaliera + P.IVA:** non obbligata ad aprirla finché non incassa → tenere l'app in **beta gratuita**; SaaS ad abbonamenti = attività abituale (servirà P.IVA quando monetizza); **forfettario probabilmente precluso** perché il reddito da frontaliera (>35k) conta nella causa ostativa. Da confermare col commercialista (domande pronte nel PDF).
- **Play Store:** via **TWA + PWABuilder**; nodo = tipo account **Personale (12 tester/14gg) vs Organizzazione (D-U-N-S, esente)**; serve assetlinks.json (fingerprint da lei), account demo per il review, Data Safety + URL cancellazione (fatto).
- **Compliance self-serve:** privacy/cookie/termini/registro trattamenti/DPA fornitori/Data Safety = fai-da-te; **no DPO**; servono professionisti solo per doppio ruolo+DPA utenti+AI (avvocato) e **tutta la parte fiscale** (commercialista).

### PDF consegnati a Eli (scratchpad/legal-pdf, via SendUserFile)
`CartaCanta_GUIDA_Eli.pdf` (guida operativa: cosa fare / cosa chiedere / Play Store / fai-da-te / cosa manca) + i 3 PDF professionisti (avvocato/commercialista/sicurezza).

### Fatto anche (PR #10 `feat: follow-up + service worker`)
- **Follow-up automatici (opt-in, default OFF)**: cron notturno invia UN sollecito al cliente se un preventivo è sent/viewed da ≥3gg, mai sollecitato e non in scadenza (riusa SollecitoClienteEmail + last_reminder_at). Toggle in Impostazioni›Notifiche. Chiave `followup_auto` nel JSONB notification_prefs → nessuna migration.
- **Service worker** (`public/sw.js`, conservativo network-first per le pagine + cache statici + `offline.html`): registrato solo in prod via `components/shared/ServiceWorkerRegister.tsx`. Velocità percepita + punteggio PWA per il Play Store.

### Fatto anche (PR #11 `e5bca20` — fix da ri-verifica runtime)
**BUG TROVATO col `next start` locale:** il matcher del proxy esclude solo le immagini → `/manifest.webmanifest` (bug pre-esistente!), `/sw.js`, `/offline.html` e `/cancella-account` venivano rediretti a /login per gli sloggati (SW non registrabile, install PWA rotta sulla landing, pagina Play Store non pubblica). Fix: aggiunti a PUBLIC_PATHS in proxy.ts. Verificato in locale: 200 su tutte, /dashboard resta 307. ⚠️ Lezione: ogni nuova route/file pubblico va aggiunto a PUBLIC_PATHS (il matcher NON esclude .js/.html/.webmanifest).

### Fatto anche (PR #13 `2659e45` — calendario sopralluoghi + camera + prefill)
- **Calendario sopralluoghi** (decisione vincolante DECISIONI_E_FEEDBACK): campo Appuntamento (datetime-local) sul sopralluogo; card "Prossimi appuntamenti" in cima alla lista con bottone **navigazione Google Maps** (`google.com/maps/dir/?api=1&destination=`). Orari in **Europe/Rome** (`romeIso()` in lib/actions/sopralluoghi.ts per il parsing con offset CET/CEST; display con timeZone). **⚠️ Migration 047** (`scheduled_at` + indice) validata 2× su PG16 — **da applicare da Eli**; query/salvataggi tolleranti pre-migration (retry senza colonna).
- **Scatta foto** nel sopralluogo: secondo input `capture="environment"` → tile "Scatta" apre la fotocamera; "Galleria" per la selezione multipla.
- **Prefill richiesta marketplace → preventivo**: "Crea preventivo" passa `?titolo=&nota=`; PreventivoForm ha `initialTitle`/`initialInternalNotes` (create mode) e apre "Altre opzioni" col prefill.
- Verificato anche: promemoria acconto = notifica campanella già esistente (lib/notifications.ts); due_date hint già nel form fatture. NON restano feature promesse non implementate salvo quelle bloccate su Eli/professionisti.

### Audit tasti/funzionalità — COMPLETATO (PR #16 `669186c`)
4 agent paralleli, findings verificati di persona. 8 fix: **ATECO azzerati salvando il tab Generale** (ALTA — update condizionale); **Riapri preventivo scaduto** falliva (expired→sent mancante + rinnovo expires_at); pagine `/p/[token]/grazie|scaduto|rifiutato` senza filtro deleted_at; "Importa con AI" assente su desktop Catalogo; agenda sopralluoghi con query dedicata; follow-up con finestra 30gg su sent_at; KPI "In attesa" include expired; categoria scontrino case-insensitive. **Fix precedente (PR #15 `42d3316`):** bottone Cerca fuori schermo su /professionisti (input senza minWidth:0) + stesso pattern in Signup/Marketplace/Onboarding/ImportWizard. Resto dell'app verificato pulito (foto-scontrino e2e, cron follow-up anti-spam, pubbliche, Stripe, auth, notifiche, Europe/Rome round-trip).

### Fatto anche (sera 7 lug — PR #19/#20/#21)
- **PR #19**: /calendario (appuntamenti raggruppati per giorno + Maps) + voce in Altro; Bilancio: finestra grafico ancorata al mese selezionato, MonthPicker nativo (input type=month trasparente sul titolo), navigazione con replace (freccia indietro esce dalla pagina), clamp mesi futuri; spinner per-azione in MarketplaceProfileForm e SopralluogoForm (bug: girava sul bottone non premuto).
- **PR #20 (lotto 1 lista mancanti)**: /aiuto (6 FAQ + supporto@cartacanta.app — CASELLA DA CREARE da Eli) e /novita (changelog utente) in Altro›Account; "Sto arrivando" WhatsApp precompilato nel Calendario.
- **PR #21 — GESTIONE LAVORI (decisione Eli: opzione A, sezione dedicata)**: tabella `lavori` (⚠️ **migration 048 da applicare**, validata 2× su PG16 con test vincoli); "Apri lavoro" sul preventivo accettato (idempotente, indice univoco document_id); /lavori (filtri pill per stato), /lavori/[id] (stepper stati da_iniziare→in_corso→finito→fatturato con started_at/finished_at, note+dettatura, Maps, link preventivo/fattura, WorkPhotosCard sul documento di origine), /lavori/nuovo; lib/actions/lavori.ts tollerante pre-migration; voce Lavori in Altro›Strumenti. PROSSIMI della lista: agenda settimanale coi Lavori (#4), rapportino firmato (#5), margine per lavoro (#6), Sentry/PostHog (#8, servono chiavi), captcha (#9), account demo (#10). LANCIO.md creato (PR #18) con piano di lancio da compilare.

### Fatto anche (8 lug — PR #23 + audit-2 + piano sponsorizzate)
- **PR #23 — agenda settimanale (#4) + margine per lavoro (#6)**: ⚠️ **migration 049 APPLICATA da Eli** (lavori.scheduled_at+report_*, expenses.lavoro_id). /calendario → vista settimanale (?w=, lun-dom, sopralluoghi+lavori uniti, chips "Lavori in corso", WhatsApp "sto arrivando" + Maps per evento); campo "Prossimo intervento" sul Lavoro; card "Economia del lavoro" (Preventivato/Speso/Margine) con spese collegate via `expenses.lavoro_id` (select Lavoro in AddExpenseDialog, sticky nel dettaglio lavoro). Fix successivi (`fe52294`): reset lavoroId nel dialog, Novità gated sul flag AI, toast creazione lavoro.
- **Ricerche recuperate dopo le interruzioni** (limiti di sessione avevano ucciso gli agent): piano sponsorizzate consegnato — **Meta senza pixel** (Lead Ads nativi + campagna Traffico con UTM; CMP+Pixel solo in fase 2), test 300€/14gg, KPI CPL<6€/reg<12€/attivazione≥30%, claim vietati per microimprese (AGCM). Tutto in **LANCIO.md §5-bis**. Audit tasti round-2 completato (tutti i findings fixati).

### Fatto anche (8 lug — rapportino #5 + pre-sponsorizzate: /prova + UTM)
- **Rapportino di fine lavoro firmato (#5)**: card sul dettaglio Lavoro (compare a stato finito/fatturato o se già creato) — testo con dettatura, `saveRapportoAction` (lib/actions/lavori.ts) genera token una tantum → link pubblico **`/r/[token]`** (testo + firma nome/tocco, admin client come /p/) + `POST /api/r/[token]/sign` (rate-limit 5/h per token, update condizionale `.is('report_signed_at', null)` anti doppia-firma, salva nome/IP/UA/timestamp — stessa FES dei preventivi). Dopo la firma il testo è bloccato (server-side in saveRapportoAction); banner verde "Firmato da X il …"; bottone WhatsApp precompilato. Usa le colonne `report_*` della **049 già applicata — NESSUNA nuova migration**. Token UUID validato con regex prima della query (evita errore cast PG). `/r/` in PUBLIC_PREFIXES.
- **Landing ads `/prova`** (pubblica, in PUBLIC_PATHS): claim unico "Il preventivo è fatto prima di risalire sul furgone", CTA→/signup, 3 passi, proof, checklist feature, mini-FAQ, footer legale. Copy conforme ai claim leciti (beta gratuita, MAI "gratis per sempre"). Manca solo il video demo (lo gira Eli).
- **UTM alla registrazione**: `components/shared/UtmCapture.tsx` nel layout root (first-touch → sessionStorage `cc_utm`) → hidden fields in SignupForm → `signupAction` le salva in `user_metadata` (utm_source/medium/campaign/content/term, max 100 char). Zero cookie, zero pixel — attribution per fonte da `auth.users.raw_user_meta_data->>'utm_source'`.
- Verificato con `next start` locale: /prova 200 pubblica; /r/ token invalido e inesistente → 404 (non redirect a login); /lavori e /dashboard restano 307; API sign risponde 404 JSON corretti.

### Fatto anche (8 lug — email di benvenuto: BUG trovato + fix)
- **BUG:** la welcome email (`lib/email/templates/welcome.tsx`) esisteva ma **in produzione non partiva mai**. `signupAction` la inviava solo se `authData.session` esisteva, ma con le conferme email attive (prod) la sessione al signup è null → la action esce prima con `verifica-email`. Il codice della welcome era di fatto **raggiungibile solo in dev** (auto-confirm). Inoltre il template violava 2 regole del progetto: **emoji** (🎉 ✅ — regola B.6 spam score) e claim errato **"8 preventivi (30 giorni di prova)"** (il Free è 8 storici, niente scadenza a 30gg).
- **FIX:** invio spostato in `app/auth/confirm/route.ts` quando `type === 'signup'` (il punto in cui l'utente vero conferma l'email) — `sendWelcomeBestEffort()` legge nome da user_metadata + workspace, await breve prima del redirect (Resend ~200-500ms, la lambda non si congela), best-effort (non blocca mai l'onboarding), token monouso = invio unico. Il path dev in signupAction resta (nessun doppio invio: i due percorsi si escludono). Template riscritto: **niente emoji**, claim corretto (8 preventivi, beta gratuita), CTA "Crea il primo preventivo" → /preventivi/nuovo (attivazione), contatto supporto@. Prop `dashboardUrl`→`ctaUrl`.
- Verificato: tsc+build+185 test verdi; render del template controllato (0 emoji, 0 claim "giorni di prova", CTA e supporto@ presenti). ⚠️ Da verificare in prod: registrare un'email vera e confermare → deve arrivare la welcome (richiede RESEND_API_KEY, già in prod).

### Fatto anche (8 lug — script account demo #10)
- **`scripts/seed-demo.ts`** (+ `npm run seed:demo`, + `scripts/README.md`): crea/RIPRISTINA un account dimostrativo per il **Play Store** (i revisori devono poter entrare) e per le demo di vendita. Utente `demo@cartacanta.app` / `CartaCanta-Demo-2026` creato con `email_confirm: true` (login immediato, niente conferma). Workspace idraulico (Idraulica Bianchi, forfettario, piano `pro`) con 4 clienti, 6 voci catalogo, 5 documenti (fattura pagata + preventivo accettato/firmato + inviato + scaduto + bozza, totali dal motore fiscale `calcolaDocumento`), 4 spese per il Bilancio, `invoice_sequences` allineate. **Idempotente**: `wipeUserWorkspaces` azzera i dati del solo demo e li ricrea. Env caricate da `.env.local`/`.env` con parser inline (nessuna dipendenza). Import statico di `createAdminClient` (niente top-level await: tsx→cjs non lo supporta).
- ⚠️ Lo script **lo lancia Eli** dal suo PC (`npm run seed:demo`): scrive sul DB di produzione (SERVICE_ROLE_KEY). Io non l'ho eseguito. Dry-run validato con env finte: env-loader + import + logica + gestione errori OK, fallisce solo alla chiamata di rete (atteso). tsc+build+185 verdi.

### Fatto anche (8 lug — captcha Turnstile #9, cablato e disattivato)
- **Cloudflare Turnstile sulla registrazione**: `components/shared/TurnstileWidget.tsx` (client, explicit render, rimonta su errore per token fresco) + `lib/turnstile.ts` (verifica server via siteverify, IP da x-forwarded-for) + call in `signupActionInner` dopo la validazione campi. **Gated**: senza `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (client) e `TURNSTILE_SECRET_KEY` (server) il widget non compare e la verifica ritorna true → registrazione IDENTICA a oggi. Fail-open se Cloudflare irraggiungibile (non perde iscrizioni legittime). Nessun CSP da toccare (next.config non ha CSP; X-Frame-Options DENY riguarda il framing delle NOSTRE pagine, non l'iframe di Turnstile). Env in `.env.example`.
- ⚠️ Per attivarlo Eli: su Cloudflare (dash → Turnstile) crea un widget per cartacanta.app → mette le 2 chiavi su Vercel → redeploy (il site key è inlined a build-time). Verificato in locale (senza chiavi): /signup 200, zero script/campo Turnstile, registrazione invariata. Percorso attivo da verificare in prod con chiave reale. tsc+build+185 verdi.

### Fatto anche (8 lug — PostHog analytics #8, cablato e disattivato)
- **PostHog EU** (`posthog-js` già in deps): `components/shared/PostHogProvider.tsx` (init gated su `NEXT_PUBLIC_POSTHOG_KEY`, host EU, `capture_pageview:false` + pageview manuale su cambio pathname, autocapture, `person_profiles:'identified_only'`) montato nel layout root; `lib/analytics.ts` → `phCapture(event, props)` no-op senza chiave. Evento esplicito **`signup_completed`** con le UTM in SignupForm (guard `signupTracked` anti-doppio) → attribution sponsorizzate. Il resto del funnel (primo preventivo creato/inviato) è ricostruibile da pageview+autocapture SENZA toccare il form fiscale (la creazione fa redirect server-side, nessun hook client pulito). Verificato senza chiave: /, /signup, /prova 200, nessun posthog.init. tsc+build+185 verdi.
- ⚠️ Per attivarlo Eli: crea progetto su PostHog EU → mette `NEXT_PUBLIC_POSTHOG_KEY` (+ eventuale `NEXT_PUBLIC_POSTHOG_HOST`) su Vercel → redeploy. Poi costruisce il funnel in PostHog: pageview /signup → signup_completed → pageview /preventivi/nuovo → pageview /preventivi/[id].

### Fatto anche (8 lug — Sentry monitoraggio errori #8, cablato e disattivato)
- **Sentry** (`@sentry/nextjs ^10`): `instrumentation.ts` (register server/edge + `onRequestError`, tutto gated sul DSN con import dinamico → niente Sentry caricato/eseguito senza chiave), `instrumentation-client.ts` (init browser con import dinamico dietro `NEXT_PUBLIC_SENTRY_DSN` inlined a build-time → dead-code + zero peso nel bundle se off), `sentry.server.config.ts` + `sentry.edge.config.ts` (init gated). Replay disattivato, `sendDefaultPii:false`. **NON** ho aggiunto `withSentryConfig` a next.config (evita il webpack plugin + rischio build): la cattura errori a runtime funziona comunque; le source map (stack leggibili) si aggiungono dopo con `withSentryConfig` + `SENTRY_AUTH_TOKEN` se serve. Verificato senza DSN: build verde, /, /dashboard(307), /signup ok, nessuna attività Sentry. tsc+build+185 verdi.
- ⚠️ Per attivarlo Eli: crea progetto su Sentry → mette lo stesso DSN in `SENTRY_DSN` e `NEXT_PUBLIC_SENTRY_DSN` su Vercel → redeploy.

### Fatto anche (9 lug — cancellazione account self-service, Opzione A)
- **Decisione Eli (ricerca + suo pop-up):** Opzione A = cancella subito account+dati personali NON fiscali, **conserva le fatture 10 anni** (art. 17.3.b GDPR + art. 2220 c.c.; obbligo del titolare P.IVA, noi teniamo la sua copia). ⚠️ **Migration 050** (`workspaces.deleted_at` + `anonymized_at` + indice) DA APPLICARE.
- **`lib/actions/account.ts` → `deleteAccountAction(confirmText)`**: solo il PROPRIETARIO; richiede di digitare "ELIMINA". Via admin client: rimuove i file storage (work-photos + logo); cancella le tabelle NON fiscali del workspace (catalog_items, expenses, lavori, sopralluoghi, work_photos, templates, marketplace_*, reviews, notification_reads, voice_usage, sdi_usage, ai_import_usage, document_views, workspace_members, invoice_sequences); cancella i **preventivi** (`documents doc_type<>'fattura'` → voci in cascade); cancella i **clienti non fatturati** (tiene quelli referenziati da una fattura); **congela il workspace** (deleted_at/anonymized_at, azzera logo/phone/notification_prefs, TIENE ragione_sociale/piva perché servono sulle fatture); infine **elimina l'utente auth** (login impossibile) + signOut. Le fatture + voci + clienti fatturati + identità fiscale del workspace RESTANO congelati.
- **`components/shared/DeleteAccountCard.tsx`**: card "Elimina account" in Impostazioni›Generale (sotto "Scarica i tuoi dati") → pop-up che spiega cosa si cancella/cosa resta, offre "Scarica i tuoi dati", richiede di scrivere ELIMINA; a fine mostra congedo e va a "/". Pagina pubblica `/cancella-account` aggiornata (in-app come via primaria).
- **Validato su PG16** (stub con FK reali): dopo la cancellazione restano SOLO la fattura + le sue 2 voci + il cliente fatturato + workspace congelato; tutto il resto a 0. tsc+build+185 verdi.
- ⚠️ **Da testare da Eli sull'account DEMO** (`npm run seed:demo` lo ricrea), NON sul suo reale, prima di fidarsi. Formulazione esatta e campi minimi da far validare all'avvocato. Il purge definitivo dopo 10 anni (cron su `deleted_at`) è un TODO futuro.

### Fatto anche (9 lug — canale commercialisti: mappa verificata + FASE A implementata)
- **Doppia ricerca** (esigenze studi + analisi competitor FIC/TeamSystem/Danea/Aruba/Zucchetti/QBO/Xero) → **mappa in LANCIO.md §12-bis**, poi **verificata adversarialmente** (norme via web indipendente + claim tecnici sul codice + sicurezza design): tutti i claim normativi confermati, 8 precisazioni integrate.
- **⚠️ SCOPERTA NORMATIVA CHIAVE (verificata 2×):** dal 1/1/2024 obbligo fattura elettronica via SdI per TUTTI i forfettari → le fatture PDF di Carta Canta valgono solo come copia di cortesia/proforma finché l'SdI non è live (fattura non-SdI = "non emessa", sanzioni 250-2.000€). I preventivi non hanno obblighi. **L'SdI (bloccato su credenziali OpenAPI di Eli) è il must-have n.1.** Da valutare con l'avvocato il copy in-app sulla fattura PDF.
- **FASE A implementata — Export "Pacchetto commercialista"**: `GET /api/commercialista/export?from&to` = registro CSV delle fatture emesse nel periodo (data emissione `sent_at`→fallback created_at dichiarato, numero, cliente, P.IVA/CF, **imponibile netto sconti**, IVA, bollo, totale, stato incasso, incassato totale + data ULTIMO incasso; annullate nel registro ma fuori dai totali → spiegano i buchi di numerazione; note esplicative nel file). Formato Excel IT (`;`+BOM), anti-injection via **`lib/csv.ts`** (helper estratti dall'export bilancio, che ora li importa). **`lib/fiscal/imponibile.ts`** (`imponibileNettoSconti`, stessa formula afterDiscount del motore) + **5 test** che lo confrontano con calcolaDocumento → 190 test totali. UI: `ExportCommercialistaButton` (dialog date, default anno corrente) nel header desktop /fatture + card in Impostazioni›Generale. Senza gate di piano (sono i dati dell'utente, come l'export fatture). Voce in /novita.
- **Limite dichiarato:** una sola coppia `paid_at/paid_amount` per fattura (acconti cumulativi sovrascrivono la data) → colonne "incassato totale/data ultimo incasso", NON registro movimenti. FASE B (invito commercialista + area /studio read-only con `accountant_links`, MAI riusare workspace_members: RLS senza enforcement ruolo, viewer potrebbe scrivere/auto-invitare) e FASE C (XML FatturaPA post-SdI) in LANCIO §12-bis — B parte al prossimo ok di Eli.


---

# ▼ Promemoria datato 8 luglio 2026 (mostrato, azioni in gran parte completate)

---

## ⏰ PROMEMORIA PER ELI — DA MOSTRARE L'8 LUGLIO 2026 (richiesto il 7 lug: "ricordamelo domani")

> Ieri Eli non poteva fare azioni manuali. Ricordarle queste cose (nessuna urgenza tecnica, l'app è già live e schermata):
> 1. **Far leggere i 3 PDF** ai professionisti (avvocato, commercialista, sicurezza) — inviati in chat il 7 lug.
> 2. **Compilare i campi in giallo** nelle pagine Privacy e Termini (ragione sociale, P.IVA, foro, email privacy) DOPO l'ok dell'avvocato.
> 3. **Decidere la forma giuridica / questione Partita IVA** — vedi ricerca fiscale frontaliera nel report del 7 lug: da validare col commercialista.
> 4. **Creare la casella** segnalazioni@cartacanta.app.
> 5. In sospeso da prima: **DMARC** OVH (none→quarantine), **OpenAI** key su Vercel per AI Import, **Stripe** live quando pronta.
> 6. ~~Migration 047~~ FATTA da Eli il 7 lug sera. **Applicare la migration 048 (Lavori)** su Supabase SQL Editor — testo nel messaggio del 7 lug notte.
> 7. **Creare la casella supporto@cartacanta.app** (la pagina Aiuto in app la usa già).


---

# ▼ Sessioni 5-7 luglio 2026 (compliance, audit, feature-pack)


## A. HANDOFF — SESSIONE COMPLIANCE + SICUREZZA (7 luglio 2026)

### Contesto
Sessione lunga con Eli: (1) portare in produzione i fix dell'audit via PR; (2) UI campi ricerca a sfondo bianco; (3) simulazione completa flussi artigiano+cliente con fix; (4) notifiche navigabili; (5) Bilancio con grafico cliccabile + export CSV per il commercialista; (6) **compliance legale + cybersecurity**: brainstorming multi-agent, ricerca web, implementazione protezioni e testi legali, 3 PDF per avvocato/commercialista/consulente sicurezza.

### Fatto in questa sessione (PR mergiate su master, deploy Vercel)
- **PR #1** `25c83fe` — fix audit correttezza/sicurezza/UI (Commit A+B della sessione 6 lug).
- **PR #2** `3bc0955` — catalogo: un solo bottone navy, CTA card AI in oro.
- **PR #3** `dfab89f` — ri-audit UX: notifiche navigabili, marketplace raggiungibile (link in landing), niente ripetizioni/tasti inutili, badge non-stato a contorno, input 16px (no zoom iOS).
- **PR #4** `f2fe0cc` — campi ricerca a sfondo bianco (SearchBar, Catalogo, Sopralluoghi, Professionisti, ClientAutocomplete).
- **PR #5** `b32b0f6` — Bilancio: colonne grafico cliccabili (naviga al mese) + Esporta CSV con intervallo date (criterio di cassa, `;` + BOM per Excel IT). Solo Pro.
- **PR #6** `819fa03` — simulazione percorsi: quota Free non consuma slot su fatture né su ri-invio; cestino non operabile (route pubbliche/cron/liste); acconti post-conversione. **Migration 046 applicata da Eli.**
- **PR #7** `3ca83b8` — **COMPLIANCE + SICUREZZA (questo lotto):**
  - **Sicurezza:** header `Permissions-Policy`/`Cross-Origin-Opener-Policy`/`X-Permitted-Cross-Domain-Policies` (next.config.ts); `lib/public-rate-limit.ts` (Upstash persistente + fallback in-memory) su accept/decline/review/marketplace-richiesta/ai-extract/view; open-redirect fix su auth/callback+confirm (solo path interni); anti CSV/formula-injection negli export (bilancio/preventivi/fatture); webhook SdI con `timingSafeEqual`; iframe pubblico in `sandbox`; log senza email/destinatari; retention GDPR nel cron (`document_views` >12 mesi, `marketplace_requests` >12 mesi).
  - **Legale:** privacy (doppio ruolo Titolare/Responsabile, fornitori Mistral/OpenAI/AssemblyAI + basi DPF/SCC, trasparenza AI); termini (no consulenza fiscale, contenuti utente, funzioni AI, recensioni/directory come hosting provider, recesso+conservazione fiscale); informative nei punti di raccolta (accettazione preventivo=FES, recensioni, richiesta marketplace, footer link pubblico, tooltip dettatura).
- **3 PDF generati** (scratchpad, inviati a Eli via file): `CartaCanta_Avvocato.pdf`, `CartaCanta_Commercialista.pdf`, `CartaCanta_Sicurezza.pdf` — ricognizioni tecniche con domande aperte per ciascun professionista. Non sono pareri, da validare.

### Migration: NO in questo lotto compliance (retention usa tabelle esistenti). 046 già applicata da Eli in PR #6.

### Gap/backlog emersi (NON implementati — richiedono decisione)
1. **Cancellazione account + export completo self-service in-app** (gap GDPR ALTO): oggi via email. Serve sign-off legale su cosa trattenere (conservazione fiscale).
2. **2FA opzionale (TOTP)**, **CSP con nonce**, **Sentry in prod**, **penetration test indipendente**, **procedura data breach formale** — raccomandazioni pre-lancio commerciale.
3. **TOP feature da ricerca web** (Jobber/ServiceM8/Tradify): follow-up automatici, pagamento con carta nel link pubblico, foto scontrino spese → da valutare, non implementati.
4. **PWA/offline** per velocità percepita (manifest + install + Serwist) → proposto, non implementato.
5. **Numerazione fatture con buchi** (bozze cancellate): valutare assegnazione all'emissione — domanda posta al commercialista nel PDF.
6. SdI/OpenAPI: bloccato su credenziali + validazione legale (invariato).

### Azioni manuali per Eli (config esterna) — vedi fondo dell'ultimo messaggio in chat
Compilare i campi `[…]` nei testi legali (ragione sociale, P.IVA, foro, email privacy), decidere forma giuridica, casella segnalazioni@, revisione professionale dei 3 PDF.

### Test eseguiti
tsc verde · build verde · **185/185** verdi (dopo il lotto compliance). Deploy Vercel #7 partito su master. Non testato in browser.

### Esito finale
🟡 FIX APPLICATO + PDF CONSEGNATI — da verificare in browser e da far validare ai professionisti. Nessuna migration in questo lotto.

---

## A-old. HANDOFF — SESSIONE AUDIT (6 luglio 2026) — audit completo app + fix

### Contesto
Eli ha chiesto un audit di TUTTA la app (funzioni, tasti, coerenza, estetica, copertura decisioni .md, sensatezza dei flussi). Eseguito con 4 agent paralleli (UI blocchi 1-5, UI blocchi 6-9, flussi/sicurezza, copertura decisioni .md). Fix applicati in 2 commit sul branch `claude/dettaglio-preventivo-review-gyavu7`.

### Fatto in questa sessione
1. **Commit A (`7ac51f5`) — correttezza/sicurezza:**
   - **saveDraftAction riparata** (bug grave introdotto il 6 lug): non gestiva option_tier/fiscalDoc/acconti — l'auto-save corrompeva i preventivi con opzioni a livelli. Ora replica create/update; totali NON azzerati se il parse voci fallisce durante la digitazione.
   - `parseImportoIt` condiviso in `lib/utils` (+7 test → 185 totali): le 5 copie locali leggevano "85.50" come 8550 (fallback irraggiungibile). Usato ovunque (expenses, SegnaPagata, AccontoCard, ImportWizard, acconti form/server).
   - Accept pubblico: update condizionale `.in('status',['sent','viewed'])` (no doppia accettazione) + le proposte non scelte si cancellano SOLO dopo lo status update.
   - `/api/fatture/[id]/status`: acconti CUMULATIVI (prima il secondo sovrascriveva il primo) + blocco importo > residuo.
   - `registerDepositReceivedAction`: valida doc_type=preventivo, status=accepted, importo ≤ totale.
   - Opzioni a livelli: gate server-side piano Free (`parseOptionsFields(data, isPro)`).
   - Converti-fattura: 409 se più proposte e nessuna `accepted_tier`.
   - SDI: claim atomico anti doppio-invio (sdi_status→'inviata' condizionale, ripristino su errore provider); 422 su sconti e IVA mista (XML fase 1 non li rappresenta); webhook accetta esiti solo da 'inviata'.
   - AI extract: tetto estrazioni SU DB (righe `plan_at_use='extract'` in ai_import_usage: 10 Free / 60 Pro / 3000 globale mese) — il costo AI nasce all'estrazione; quote di salvataggio filtrate su `plan_at_use IN ('free','pro')`.
   - Ricerche: sanitizzati `,()` nei filtri `.or()` ilike (6 punti).
   - Marketplace: publish/unpublish via ADMIN client (enabled/published_at non più scrivibili dal client → migration 045); Invio nel form salva bozza (intentRef, non più submitter).
   - Pagina pubblica: acconto già ricevuto mostrato anche sul preventivo, QR EPC sul saldo ("Saldo …").
   - Update tolleranti 038/041 SEPARATI (`applyDepositAndOptions`).
2. **Commit B (`c98226f`) — coerenza UI/UX:** scala tipografica nelle nuove feature (sezioni 11→13px, KPI 10→12, badge 10→11); header mobile normalizzati (titolo a sinistra, spacer 24); campanella anche su desktop dashboard; notifiche navigate-first; badge richieste NUOVE in Altro; WorkPhotosCard conferma eliminazione + avviso >6 foto; dropzone cliccabile; sopralluogo photo-first (titolo default datato); Segna pagata blocco > totale; published sync marketplace; pill Marketplace in /abbonamento; validazione contatto RequestForm; stelle tap 32px; copy serbatoio/intestatario/directory vuota; medie recensioni su 500.

### Migration: SÌ — **045_security_fixes.sql** da applicare da Eli (validata su PG16 locale, idempotente)
Storage work-photos scoped alla cartella `{user_id}/`; reviews aggiornabili solo su reported_at/report_reason; marketplace_profiles enabled/published_at/vies_checked_at solo service-role; marketplace_requests solo cambio status dal client. ⚠️ Da applicare INSIEME al codice (il publish marketplace ora usa l'admin client, funziona anche pre-045; ma senza 045 le colonne privilegiate restano scrivibili dal client).

### Gap emersi dall'audit NON ancora implementati (prossimi task)
1. **Cron promemoria acconto** (decisione vincolante in DECISIONI_E_FEEDBACK — backlog).
2. **Consensi/testi legali**: click-through conservazione SDI, privacy sub-responsabile AI/SDI, consenso recensioni (prerequisito di LANCIO recensioni+marketplace — validazione legale da Eli).
3. **due_date fatture + sollecito pagamento** (colonna 038 esiste, UI mai fatta).
4. **Prefill richiesta marketplace → nuovo preventivo**.
5. Rate limit Upstash (persistente) sugli endpoint pubblici — oggi in-memory.
6. XML SDI: ScontoMaggiorazione + DatiRiepilogo per aliquota (fase 2 — per ora bloccati con 422).

### Test eseguiti
tsc verde · build verde · **185/185** verdi (7 nuovi test parseImportoIt). Migration 045 applicata 2 volte su PostgreSQL 16 locale con stub Supabase (idempotente, grants verificati). Non testato in browser.

### Esito finale
🟡 FIX APPLICATO — da verificare in browser da Eli. ⚠️ Migration 044 (se non già fatta) + 045 da applicare.

---

## A-pre. HANDOFF — SESSIONE FEATURE-PACK (5 luglio 2026) — perf + Bilancio

### Contesto
Eli ha approvato in blocco l'intero pacchetto feature (mockup in `mockup-mobile/`): Bilancio → Pagamenti F1 → Acconti → AI Import → Notifiche Home → Sopralluoghi/Foto/Opzioni → SDI → Recensioni → Marketplace. Decisioni vincolanti in `DECISIONI_E_FEEDBACK.md` (sez. "Ciclo incasso", "Budget €50", "Cantiere", "Crescita"). Un blocco = un commit; procedere in autonomia.

### Fatto in questa sessione
1. **Perf fase 1** (`6a34dc9`): `PageSkeleton` + `loading.tsx` su 9 route + `staleTimes {dynamic:30, static:180}`.
2. **Perf fase 2** (`419a4a3`): `lib/workspace-context.ts` — `getSessionWorkspace()` con `React.cache()`; layout + 20 pagine convertite. **Le nuove pagine DEVONO usare questo helper.**
3. **Blocco 1 Bilancio (Pro)** (`fe521ab`): route `/bilancio` (mese ‹›, KPI Entrate/Uscite/Utile, grafico 6 mesi, lista spese, `AddExpenseDialog`, `DeleteExpenseButton`), `lib/actions/expenses.ts`, `lib/constants/expense-categories.ts`, voce in Altro›Strumenti (pill PRO), lock Free. Entrate a cassa (paid_at/paid_amount, fallback accepted).
4. **Blocco 2 Pagamenti F1** (`9a6e7a4`): tab Impostazioni›Pagamenti (IBAN mod-97, PayPal/Satispay con aiuto passo-passo, note placeholder contanti), `lib/payments/iban.ts`+`epc.ts` (QR EPC via `qrcode`), `PaymentInfoCard` su `/p/[token]` (fatture da pagare + preventivi accettati), sezione "Come pagare" in fondo al PDF (4 preset, prima della nota legale), `SegnaPagataButton` → dialog importo+data (importo<totale → payment_status `partial`, stato invariato), route `/api/fatture/[id]/status` estesa.
5. **Blocco 3 Acconti** (`d8fa81f`): toggle in Altre opzioni (pillole %/€, default 30, anteprima live), persistenza `deposit_type/deposit_value` (update tollerante in create/saveDraft), riga ambra acconto su pagina pubblica (MobilePublicCard `deposit` prop) + PDF (`depositHtml`), `AccontoCard` nel dettaglio preventivo accettato + `registerDepositReceivedAction`, QR EPC con importo acconto/saldo, conversione → fattura `partial` con spostamento incasso (no doppio conteggio).
6. **Blocco 4 AI Import** (`aee4af4`): card oro nel Catalogo + route `/catalogo/importa` (`ImportWizard`: upload → estrazione → righe EDITABILI → salva), `lib/ai/quota.ts` (Free 1 a vita contato al salvataggio, Pro 15/mese, serbatoio 300+100×Pro, kill-switch 1500), `importCatalogItemsAction`, `/api/ai/extract` aperto ai Free con quota + **Mistral primario/OpenAI fallback** (corretto l'ordine), voce "Carica il listino nel catalogo" in Completa il profilo. Tutto dietro `NEXT_PUBLIC_AI_IMPORT_ENABLED`.
7. **Blocco 5 Notifiche Home** (`d9e05b2`): campanella nell'header dashboard (badge non lette, anche Free), route `/notifiche` (`NotificationList`: pallino blu per-notifica, Segna tutte lette), `lib/notifications.ts` (tipi: viewed, acconto — SDI arriverà), `markNotificationsReadAction`, toggle in Impostazioni›Notifiche (`inapp_visto`, `inapp_acconto` in notification_prefs).

### Migration: SÌ — TRE da applicare da Eli (in ordine)
- **038_ciclo_incasso.sql**: `expenses` + `documents.payment_status/paid_at/paid_amount/due_date` + canali pagamento workspace + `deposit_type/deposit_value` + retrofill fatture accepted→paid.
- **039_ai_import_usage.sql**: registro utilizzi AI Import.
- **040_notification_reads.sql**: stato lettura notifiche campanella.
Tutto il codice è TOLLERANTE pre-migration (query con `as any` + try/fallback). `types/database.ts` NON rigenerato → nuove tabelle/colonne accedute via cast con commento eslint.

### Prossimi blocchi (ordine concordato — decisioni in DECISIONI_E_FEEDBACK.md)
6. ✅ FATTO (6 lug — commit `f1f3754` + `16b790a`): Sopralluoghi (`/sopralluoghi`, trasforma in preventivo con Note interne + foto collegate) · Foto prima/dopo (WorkPhotosCard su entrambi i dettagli, occhio visibilità default OFF, 6 Free/∞ Pro, pagina pubblica non PDF) · Opzioni a livelli (toggle Pro nel form, tier su document_items.option_tier, TierPicker pubblico, accettazione tiene solo la proposta scelta e ricalcola i totali). Migration 041 APPLICATA da Eli.
7. **SDI** (Pro + Free cap 8 trasmissioni totali; sotto-budget €15 kill-switch; costo MAI mostrato — "Incluso nel piano Pro · Conservazione a norma inclusa"; scartata → notifica app + EMAIL; provider gestito da scegliere — vedi ricerca-fatturazione-elettronica/DECISIONE_SDI.md; servono credenziali provider da Eli — BLOCCANTE).
8. ✅ FATTO (6 lug — commit `6ce9a46`): Recensioni a domande chiuse (4 stelle + Sì/No), sblocco automatico a fattura `payment_status='paid'`, nome puntato, pagina `/recensioni` con aggregati, Segnala (notice-and-takedown). Migration 042 APPLICATA da Eli.
9. ✅ FATTO (6 lug — commit `5e42767`): Marketplace MVP — `/marketplace` opt-in con verifica automatica (VIES via `lib/marketplace/vies.ts` + email confermata + profilo completo), directory pubblica `/professionisti` (Pro "In evidenza" in cima), `/richieste` in app (Nuova/Letta/Risposta), email teaser senza dettagli. Migration 043 APPLICATA da Eli. NB: creare casella `segnalazioni@cartacanta.app`; validazione legale = prerequisito di LANCIO per recensioni+marketplace.
Backlog: calendario sopralluoghi con deep-link Google Maps; promemoria acconto via cron; tipi notifica SDI (col blocco 7).
7-bis. ✅ STRUTTURA SDI FATTA (6 lug): migration 044 (codice_destinatario/pec su clients, stati sdi_* su documents, sdi_config_done_at, tabella sdi_usage) · `lib/sdi/` (types, xml FatturaPA RF19/N2.2/bollo/dicitura, quota Free 8 a vita + kill-switch 85/mese ≈ €15, provider mock + skeleton OpenAPI) · `POST /api/fatture/[id]/sdi` (validazioni dati fiscali/cliente, canale destinatario/PEC salvato in rubrica, ensureConfiguration una tantum) · `POST /api/webhooks/sdi` (esiti → stati + email scarto `sdi_scartata.tsx`) · `SdiCard` sul dettaglio fattura (costo MAI mostrato — "Incluso nel piano Pro · Conservazione a norma inclusa"; Free "N di 8"; badge PROVA col mock) · notifiche campanella `sdi_scartata`/`sdi_da_trasmettere` + toggle in Impostazioni. Tutto dietro `NEXT_PUBLIC_SDI_ENABLED`; senza `OPENAPI_SDI_API_KEY` → provider MOCK. ⚠️ Endpoint/payload OpenAPI DA VERIFICARE IN SANDBOX quando arrivano le chiavi.
**RESTANO (bloccati su Eli) per il go-live SDI:** (1) screenshot contratto/DPA OpenAPI da far revisionare, (2) registrazione su console.openapi.com + chiavi sandbox/prod + credito, (3) validazione testi legali. Decisioni: OpenAPI, SOLO INVIO, Pro illimitato, layer astrazione lib/sdi/. BUDGET RICONCILIATO (Eli 6 lug): sotto-budget Free €15/mese (tetto unico €50) — supera il €30 del doc di giugno. Cap per-utente Free (5 a vita vs 8): chiesto a Eli.

### Test eseguiti
tsc verde · build verde · 178/178 verdi dopo OGNI blocco. Non testato in browser — verifiche da Eli elencate in REGISTRO_AGGIORNAMENTI.md per blocco.

### Esito finale
🟡 FIX APPLICATO — da verificare in browser da Eli. ⚠️ Migration 038+039+040 da applicare.

---

---

# ▼ Sessioni UI-Rev / G-QA / G6 (14-18 giugno 2026)


## A. HANDOFF — SESSIONE UI-Rev (18 giugno 2026) — continuazione (22)

### Fix applicati — RIFINITURE Nuovo preventivo (1 commit `940a633`)

**COMMIT Q — Note parentesi eredita Label; SUBTOTALE allineato ai Label campi**

**(1) Note/Note interne — parentesi uniforme alla Label:**
- Rimosso `style={{ fontSize: 14, fontWeight: 400, color: '#8a887f' }}` dagli `<span>` "(visibili al cliente)" e "(non visibili al cliente)"
- Gli span ora ereditano lo stile della Label padre (12px/600/#8a887f/letterSpacing 0.05em/uppercase)
- Risultato: "NOTE (VISIBILI AL CLIENTE)" tutto uniforme

**(2) FiscalSummary SUBTOTALE — allineato ai Label dei campi:**
- `fontSize: 13, letterSpacing: '.07em', color: '#6f6d64'` → `fontSize: 12, letterSpacing: '0.05em', color: '#8a887f'`
- `fontWeight: 600` e `textTransform: 'uppercase'` invariati

### File toccati (sessione UI-Rev — commit Q)
```
app/(app)/preventivi/_components/PreventivoForm.tsx  [1: rimossi override span Note/Note interne]
app/(app)/preventivi/_components/FiscalSummary.tsx   [2: Subtotale 12px/#8a887f/0.05em]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: verificare da Eli — "NOTE (VISIBILI AL CLIENTE)" uniforme; "SUBTOTALE" stesso stile di "TERMINI DI PAGAMENTO".

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (18 giugno 2026) — continuazione (21)

### Fix applicati — RIFINITURE Nuovo preventivo (1 commit `8880eeb`)

**COMMIT P — pt-3 su div "Altre opzioni" (spazio tra toggle e primo campo)**

- `PreventivoForm.tsx` ~705: `altreOpzioniOpen ? 'space-y-5 pb-4'` → `'space-y-5 pb-4 pt-3'`
- Aggiunge ~12px di padding-top quando il pannello è aperto → stacco visivo tra "ALTRE OPZIONI" e "NUMERO PREVENTIVO".

### File toccati
```
app/(app)/preventivi/_components/PreventivoForm.tsx  [pt-3 su div Altre opzioni]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: verificare da Eli — più spazio tra toggle "ALTRE OPZIONI" e primo campo.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (18 giugno 2026) — continuazione (20)

### Fix applicati — RIFINITURE Nuovo preventivo (1 commit `71b0806`)

**COMMIT O — label MAIUSCOLO, 3 frasette identiche, SUBTOTALE uppercase**

**(1) Label 8 campi "Altre opzioni" → MAIUSCOLO:**
- Aggiunto `textTransform: 'uppercase'` allo style esistente (replace_all)
- Stile finale: `fontSize: 12, fontWeight: 600, color: '#8a887f', letterSpacing: '0.05em', textTransform: 'uppercase'`

**(2) 3 frasette aiuto — unificate a 12px + #767676:**
- "Numero assegnato automaticamente..." (PreventivoForm ~736): `text-[14px] text-muted-foreground` → `text-[12px]` + `style={{ color: '#767676' }}`
- "Percentuale di detrazione..." (PreventivoForm ~953): stessa trasformazione, mantenuto `maxWidth: 320`
- "Regime forfettario — operazione fuori campo IVA" (FiscalSummary ~99): `text-xs` + `color: #6f6d64` → `text-[12px]` + `style={{ color: '#767676' }}`

**(3) "SUBTOTALE" — stile uguale a cc-section-label:**
- FiscalSummary ~65: `<span>Subtotale</span>` → `<span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64' }}>Subtotale</span>`
- Rimossa classe `text-muted-foreground` dal div wrapper (il valore € destra invariato)

### File toccati (sessione UI-Rev — commit O)
```
app/(app)/preventivi/_components/PreventivoForm.tsx  [1: textTransform uppercase Labels; 2: frasette 12px/#767676]
app/(app)/preventivi/_components/FiscalSummary.tsx   [2: frasette 12px/#767676; 3: Subtotale uppercase #6f6d64]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: verificare da Eli — label MAIUSCOLE, 3 frasette stessa dimensione/colore, SUBTOTALE uppercase.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (18 giugno 2026) — continuazione (19)

### Fix applicati — RIFINITURE Nuovo preventivo (1 commit `789557b`)

**COMMIT N — FiscalSummary nota regime forfettario leggibile**

- `FiscalSummary.tsx` riga regime forfettario: `className="text-xs text-muted-foreground/70 border-t pt-2"` → `className="text-xs border-t pt-2" style={{ color: '#6f6d64' }}`
- Motivo: `text-muted-foreground/70` produceva un grigio al 70% di opacità — quasi invisibile. `#6f6d64` è il grigio scuro già in uso per `.cc-section-label`.

### File toccati
```
app/(app)/preventivi/_components/FiscalSummary.tsx  [color #6f6d64, rimossa opacità /70]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: verificare da Eli — nota "Regime forfettario — operazione fuori campo IVA" visibile nel riepilogo.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (18 giugno 2026) — continuazione (18)

### Fix applicati — RIFINITURE Nuovo preventivo (1 commit `231e7a5`)

**COMMIT M — gerarchia titoli, icona bonus, valori voce 13px, catalogo**

**(1) `.cc-section-label` color più scuro:**
- `globals.css`: `color: #8a887f` → `#6f6d64`

**(2) "Altre opzioni" toggle → stile cc-section-label:**
- `<span>` toggle: `fontSize: 16, fontWeight: 600, color: 'var(--cc-text)'` → `fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64'`

**(3) `<Label>` campi "Altre opzioni" → 12px small-caps:**
- Tutti i `<Label style={{ fontSize: 15, fontWeight: 600, color: '#161616' }}>` → `style={{ fontSize: 12, fontWeight: 600, color: '#8a887f', letterSpacing: '0.05em' }}` (replace_all, 8 occorrenze)

**(4) Tag → BadgePercent in badge "Bonus attivo":**
- Import: `Tag` rimosso, `BadgePercent` aggiunto
- `<Tag size={16} /> Bonus attivo` → `<BadgePercent size={16} /> Bonus attivo`

**(5) Rimosso badge "Bonus N%" accanto a "VOCI":**
- Rimosso il blocco `{bonusAttivo && <span>...<Tag size={14} /> Bonus {bonusPerc}%</span>}` dall'header card VOCI

**(6) Valori campi riga voce fontSize 14 → 13:**
- VociTable: `fontSize: 14, height: 44` → `fontSize: 13, height: 44` (replace_all, 10 occorrenze: 5 campi × desktop+mobile)
- NON toccati: textarea Descrizione, totale riga, etichette colonne, VOCE N

**(7) CatalogPicker bande categoria #ececef:**
- `className="px-4 py-1.5 bg-muted border-b sticky top-0"` → `className="px-4 py-1.5 border-b sticky top-0" style={{ background: '#ececef' }}`

### File toccati (sessione UI-Rev — commit M)
```
app/globals.css                                              [1: cc-section-label color #6f6d64]
app/(app)/preventivi/_components/PreventivoForm.tsx          [2: Altre opzioni; 3: Labels; 4: BadgePercent; 5: no badge VOCI]
app/(app)/preventivi/_components/VociTable.tsx               [6: fontSize 14→13 campi voce]
app/(app)/preventivi/_components/CatalogPicker.tsx           [7: bande #ececef]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: verificare da Eli — titoli sezione più scuri, Altre opzioni stile uppercase, label campi piccole grigie, icona BadgePercent, no badge VOCI, campi voce 13px, bande catalogo #ececef.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (18 giugno 2026) — continuazione (17)

### Fix applicati — RIFINITURE Nuovo preventivo (1 commit `aaf5321`)

**COMMIT L — label 16→15, bottoni height:50, campi voce fontSize 15→14**

**(1) Label campi "Altre opzioni" 16 → 15:**
- `<Label style={{ fontSize: 16, ... }}>` → `fontSize: 15` su tutti gli 8 campi (Numero/Titolo/Template/Note/Note interne/Validità/Termini/Bonus edilizio)

**(2) Bottoni altezza fissa 50px:**
- CAUSA: `<Button>` shadcn ha `h-9` (36px) nel className base; il padding inline non aumenta l'altezza con `box-sizing:border-box`
- FIX: aggiunto `height: 50, boxSizing: 'border-box'` su:
  - Edit mode draft "Salva bozza": `style={{ flex: 1 }}` → `style={{ flex: 1, height: 50, boxSizing: 'border-box' }}`
  - Edit mode "Aggiorna preventivo/fattura": stessa aggiunta
  - Create mode "Salva bozza": rimosso `padding: '14px 13px'`, aggiunto `height: 50, boxSizing: 'border-box'`
  - Create mode "Invia al cliente": rimosso `padding: '14px 13px'`, aggiunto `height: 50, boxSizing: 'border-box'`

**(3) Campi numerici riga voce: fontSize 15 → 14:**
- Solo i valori dentro i campi (Unità, Q.tà, Prezzo, Sconto, IVA), desktop e mobile
- Descrizione textarea (15) e totale riga (15) invariati
- Etichette colonna (13) invariate

### File toccati (sessione UI-Rev — commit L)
```
app/(app)/preventivi/_components/PreventivoForm.tsx  [1: label 16→15; 2: bottoni height:50]
app/(app)/preventivi/_components/VociTable.tsx        [3: campi voce fontSize 15→14]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: verificare da Eli — label più piccole, bottoni più alti, campi voce.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (18 giugno 2026) — continuazione (16)

### Fix applicati — RIFINITURE Nuovo preventivo (1 commit `4c9c2d4`)

**COMMIT K — SelectTrigger w-full+items-start + font +1px globale**

**(A) Allineamento riga voce:**
- Desktop grid: `items-center` → `items-start` (campi si allineano al top, immune a elementi Radix extra nel flusso)
- Mobile grid: `items-end` → `items-start`
- Tutti i SelectTrigger (Unità desktop+mobile, IVA desktop+mobile): aggiunto `className="w-full"` (il select ora riempie la colonna come gli Input)
- Mobile Unità: `className="truncate"` → `className="w-full truncate"`

**(B) Font +1px (tutte le scritte di Nuovo preventivo, stesse eccezioni precedenti):**
- `cc-section-label` (globals.css): `font-size: 12px` → `13px` (CLIENTE/VOCI/RIEPILOGO)
- Etichette colonne voce desktop: `text-xs` → `text-[13px]`
- Etichette colonne voce mobile (Descrizione/Unità/Q.tà/Prezzo/Sconto/IVA): `fontSize: 12` → `13`
- "VOCE N": `fontSize: 11` → `12`
- Testo dentro i campi (VociTable + PreventivoForm Input/Select/Textarea): `fontSize: 14` → `15`
- Totale riga voce (desktop + mobile): `fontSize: 14` → `15`
- Label form (PreventivoForm): `fontSize: 15` → `16`
- Toggle "Altre opzioni": `fontSize: 15` → `16`
- Sub-label (visibili/non visibili, bonus badge VOCI): `fontSize: 12/13` → `13/14`
- Help text (`text-[13px]`): → `text-[14px]`
- Discount labels (Sconto %/€): `fontSize: 13` → `14`
- Link "Gestisci i template": `fontSize: 13` → `14`
- "* Campo obbligatorio": `fontSize: '13px'` → `'14px'`
- **ECCEZIONI rispettate:** header "Nuovo preventivo" (17px) ✓, TOTALE Riepilogo ✓, bottoni 14px ✓

### File toccati (sessione UI-Rev — commit K)
```
app/(app)/preventivi/_components/VociTable.tsx     [A: items-start, w-full; B: font sizes]
app/(app)/preventivi/_components/PreventivoForm.tsx [B: font sizes labels/fields/sub-labels/help]
app/globals.css                                     [B: cc-section-label 12→13px]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: verificare da Eli — allineamento 5 campi riga voce, font più grandi.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (18 giugno 2026) — continuazione (15)

### Fix applicati — RIFINITURE Nuovo preventivo (1 commit `2d4df9f`)

**COMMIT J — altezza 44px uniforme + Aggiungi voce a sinistra**

**(1) Altezza 44px uniforme su tutti i 5 campi voce (desktop + mobile):**
- Tutti i campi: `height: 44, boxSizing: 'border-box'`, padding orizzontale only (`'0 10px'` semplici, `'0 20px 0 10px'` per Prezzo/Sconto con simbolo €/%)
- Desktop Unità SelectTrigger: rimosso `className="h-9"`, aggiunto height+boxSizing+padding inline
- Desktop Q.tà NumericInput: aggiunto height+boxSizing+padding inline
- Desktop Prezzo NumericInput: rimosso `className="pr-5"`, aggiunto height+boxSizing+padding inline
- Desktop Sconto Input: rimosso `className="pr-5"`, aggiunto height+boxSizing+padding inline
- Desktop IVA SelectTrigger: rimosso `className="h-9"`, aggiunto height+boxSizing+padding inline
- Mobile tutti e 5: `padding: '11px ...'` + `height: 'auto'` → `padding: '0 ...'` + `height: 44, boxSizing: 'border-box'`

**(2) "Aggiungi voce" allineato a sinistra:**
- Footer: `<div className="px-4 py-3 border-t flex gap-3">` → `style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}`
- `<Button variant="ghost" size="sm" className="flex-1">` → `<button>` plain con `style={{ color: '#1a1a2e', fontWeight: 500, fontSize: 14, padding: 0, background: 'none', border: 'none' }}`
- `<Plus className="size-4" />` → `<Plus size={18} />`
- CatalogPicker resta a destra invariato

### File toccati (sessione UI-Rev — commit J)
```
app/(app)/preventivi/_components/VociTable.tsx   [1: height 44px tutti i campi desktop+mobile; 2: footer aggiungi voce]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: verificare da Eli — altezza uniforme 5 campi, "Aggiungi voce" a sinistra.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (17 giugno 2026) — continuazione (14)

### Fix applicati — RIFINITURE Nuovo preventivo (1 commit `d27a4d9`)

**COMMIT I — 9 RIFINITURE pixel-identical al mockup**

**(1) Link "Gestisci i template →":**
- Aggiunto sotto il SelectContent Template in PreventivoForm `Altre opzioni`
- `<Link href="/template">` con `Settings size={15}`, `fontSize: 13, color: #1a1a2e, fontWeight: 500`
- Aggiunti imports: `Link` da 'next/link', `Settings` da lucide-react

**(2) font-family: inherit su tutti i form inputs (globals.css):**
- Aggiunto in `@layer base`: `input, textarea, select { font-family: inherit; }`
- Garantisce Inter su tutti i campi (evita font di sistema su iOS/Android)

**(3) Badge oro Bonus N% vicino a "VOCI":**
- Quando `bonusAttivo = true`, a destra dell'etichetta "VOCI" compare: `<Tag size={14} /> Bonus {bonusPerc}%`
- `fontSize: 12, fontWeight: 600, color: '#b08d3e'`
- `cc-section-label` con `marginBottom: 0` nel flex row del VOCI header

**(4) Bottoni più alti:**
- Salva bozza: `padding: '13px'` → `'14px 13px'`
- Invia al cliente: `padding: '13px'` → `'14px 13px'`

**(5) Campo Prezzo 2 decimali formato italiano:**
- `NumericInput` refactored: aggiunto `locale?: boolean` prop + `isFocused` state
- `formatVal(v)` → quando `locale=true`: `toLocaleString('it-IT', {minimumFractionDigits:2,maximumFractionDigits:2})`
- `onFocus`: `setIsFocused(true)` + `e.currentTarget.select()` (select-all per editing)
- `useEffect` aggiornato con guard `!isFocused` (evita snap durante digitazione)
- `onBlur`: formatta con `formatVal`, svuota se NaN
- `locale` applicato su: desktop Prezzo NumericInput, mobile Prezzo NumericInput

**(6) Caret ClientAutocomplete centrato:**
- Input: rimossi `p-0 h-auto text-[13px]` dalla className
- Aggiunto `style={{ fontSize: 14, fontFamily: 'inherit', height: 20, lineHeight: '20px', padding: 0 }}`
- `height: 20px = lineHeight` → cursore centrato nel flex container

**(7) Filtro lettere in tempo reale:**
- `NumericInput.onChange`: aggiunto `raw = e.target.value.replace(/[^\d.,]/g, '')`
- Sconto VociTable (desktop + mobile): aggiunto `onKeyDown={(e) => { if (['e','E','+','-'].includes(e.key)) e.preventDefault() }}`
- `onChange` Sconto: guard `!isNaN(n)` per evitare NaN nel discount_pct
- Stessa logica aggiunta ai campi Sconto globale in PreventivoForm discountSlot

**(8) Altezza uniforme mobile (item 8 — Unità = Q.tà = Prezzo = Sconto):**
- Mobile Q.tà: rimosso `className="h-9"` → `style={{ border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 10px', fontSize: 14, height: 'auto' }}`
- Mobile Prezzo: rimosso `className="h-9 pr-5"` → `style={{ border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 20px 11px 10px', fontSize: 14, height: 'auto' }}`
- Mobile Sconto: rimosso `className="h-9 pr-5"` → `style={{ border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 20px 11px 10px', fontSize: 14, height: 'auto' }}`
- Tutti ~40px allineati con Unità SelectTrigger (stesso padding 11px)

**(9) +1px a tutte le scritte (eccezioni rispettate):**
- `cc-section-label` globals.css: `font-size: 11px` → `12px` (CLIENTE/VOCI/RIEPILOGO)
- Etichette colonne mobile VociTable: `fontSize: 11` → `12`
- Testo campi VociTable (textarea, NumericInput, Select): `fontSize: 13` → `14`
- "VOCE N": `fontSize: 10` → `11`
- Totale riga (desktop + mobile): `fontSize: 13` → `14`
- Label form PreventivoForm: `fontSize: 14, fontWeight: 600` → `fontSize: 15`
- Input/Select/Textarea PreventivoForm: `fontSize: 13` → `14`
- Sub-label (visibili/non-visibili): `fontSize: 12` → `13`
- Help text (`text-xs`): → `text-[13px]`
- Discount labels: `fontSize: 12` → `13`
- `* Campo obbligatorio`: `fontSize: '12px'` → `'13px'`
- **ECCEZIONI rispettate:** header "Nuovo preventivo" (17px) ✓, TOTALE Riepilogo ✓, bottoni (14px) ✓

### File toccati (sessione UI-Rev — commit 14)
```
app/globals.css                                              [2: font-family inherit; 9: cc-section-label 12px]
app/(app)/preventivi/_components/VociTable.tsx               [5: NumericInput locale+isFocused; 7: lettera filter+onKeyDown; 8: mobile height uniforme; 9: font sizes +1px]
app/(app)/preventivi/_components/PreventivoForm.tsx          [1: template link; 3: bonus badge VOCI; 4: bottoni padding; 6: ClientAutocomplete; 9: font sizes +1px]
components/shared/ClientAutocomplete.tsx                     [6: caret alignment height 20px]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: verificare da Eli — template link, bonus badge VOCI, prezzo 2 decimali, caret cliente, altezza campi uniforme, font +1px tutto form.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (17 giugno 2026) — continuazione (13)

### Fix applicati — Nuovo preventivo pixel-identical al mockup (1 commit `6e56a69`)

**COMMIT H — 10 fix pixel-identici al mockup**

**(1) Header mobile (`preventivi/nuovo/page.tsx`):**
- Sfondo `#fff`, `borderBottom: '0.5px solid #eeeeee'`, `padding: '12px 15px'`
- X in cerchio `34×34px`, `borderRadius: 50%`, `background: #f4f4f5`; icona X `size={19}` `color: #55534b`
- Titolo `17px/600/#161616`; spacer `width: 34px`

**(2) ClientAutocomplete.tsx — box mockup:**
- Stato ricerca (no cliente): `background: #f7f7f8; border: 0.5px solid #e6e6e6; borderRadius: 11px; padding: 11px 13px; display: flex; alignItems: center; gap: 8px`
- Search icon: `size={18}` `color: #8a887f` `flexShrink: 0`
- Input: `border-0 bg-transparent shadow-none focus-visible:ring-0 p-0 h-auto flex-1 text-[13px] placeholder:text-[#8a887f]`
- Stato selezionato: stessa struttura flex con stesso sfondo/bordo

**(3) VoiceInput.tsx — prop `compact`:**
- `compact?: boolean` — quando true: `<button>` plain senza shadcn Button, icona `14×14px`, `color: inherit` (o `#ef4444` quando recording), nessun testo feedback
- Tutti i chiamanti in VociTable e PreventivoForm usano `compact`

**(4) VociTable.tsx — descrizione flex container (desktop + mobile):**
- Rimossa struttura `relative` + mic assoluto; ora `display: flex; alignItems: center; gap: 8; border: 1px solid #e3e3e6; borderRadius: 10; padding: 11px 12px`
- Textarea: `flex: 1; border: none; padding: 0; fontSize: 13`
- VoiceInput: `compact; className="flex-none text-[#8a887f]"`

**(5) VociTable — SelectTrigger mobile (Unità + IVA):**
- Override: `border: 1px solid #e3e3e6; borderRadius: 10; padding: 11px 10px; fontSize: 13; height: auto`

**(6) VociTable — VOCE N letterSpacing:** `0.04em` → `0.05em`

**(7) VociTable — totale (desktop + mobile):**
- Formato: `€ {lineTotal.toLocaleString('it-IT', {minimumFractionDigits:2, maximumFractionDigits:2})}`
- Colori: `13px #8a887f` per label, `bold #161616` per importo
- Rimosso import `formatCurrency` da VociTable (non più usato)

**(8) PreventivoForm — vari fix:**
- Asterisco "Numero fattura \*": `text-destructive` → `style={{ color: '#b08d3e' }}`
- SelectTrigger Template e Termini: `border: 1px solid #e3e3e6; borderRadius: 10; padding: 11px 12px; fontSize: 13; height: auto`
- Note VoiceInput: `compact` + rimosso `size-6` dal className
- Textarea "Personalizzati": aggiunto `border: 1px solid #e3e3e6; borderRadius: 10; padding: 11px 12px`

**(9) PreventivoForm — Bonus edilizio active state:**
- Label dello switch sempre "Attiva bonus edilizio" (non mostra più `Bonus {bonusPerc}%`)
- Quando attivo: flex row con input `width: 118px; border: #e3e3e6; borderRadius: 10; padding: 11px 28px 11px 12px; fontSize: 13` + badge `<Tag size={16} /> Bonus attivo` in oro `#b08d3e`
- Aggiunto `Tag` agli import lucide-react

**(10) PreventivoForm — Sconto (discountSlot):** Input `border: #e3e3e6; borderRadius: 10; padding: 11px 28px 11px 12px; fontSize: 13`

### File toccati (sessione UI-Rev — commit 13)
```
components/shared/VoiceInput.tsx                             [prop compact]
components/shared/ClientAutocomplete.tsx                     [box mockup flex, selected style]
app/(app)/preventivi/nuovo/page.tsx                          [header mobile mockup]
app/(app)/preventivi/_components/VociTable.tsx               [desc flex, select style, totale format, letterSpacing]
app/(app)/preventivi/_components/PreventivoForm.tsx          [asterisco, select, VoiceInput compact, bonus, sconto]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: verificare da Eli — header mobile, ClientAutocomplete box, mic compatto, desc flex, select style, totale formato, bonus active.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (17 giugno 2026) — continuazione (12)

### Fix applicati — Nuovo preventivo pixel-identical al mockup (1 commit `e75fa36`)

**COMMIT G — globals.css + PreventivoForm + VociTable: form pixel-identical al mockup**

**(1) globals.css:**
- `.cc-card-md`: `border-radius: 13px` → `14px`; shadow → `0 1px 2px rgba(20,20,40,.05), 0 8px 24px -10px rgba(20,20,40,.15)`; `padding: 14px 15px` → `15px 15px`
- `.cc-section-label`: `font-size: 12px` → `11px`; `font-weight: 500` → `600`; `letter-spacing: 0.08em` → `.07em`; `color: var(--cc-text-tertiary)` → `#8a887f`; `margin-bottom: 12px` → `11px`

**(2) PreventivoForm.tsx:**
- Card 1 padding: `14px 15px` → `15px 15px` (inline override)
- "Altre opzioni" toggle: `fontSize 14, fontWeight 500` → `fontSize 15, fontWeight 600`
- Content div: `space-y-4` → `space-y-5` (20px tra i gruppi)
- Rimosso `(opzionale)` da: Numero preventivo, Titolo del lavoro, percentuale bonus
- Label field in "Altre opzioni": `style={{ fontSize: 14, fontWeight: 600, color: '#161616' }}` su tutti i Label
- Note/note interne: `space-y-1.5` → `space-y-2`; Label → `fontSize 14/600/#161616` con sub-text `12px/#8a887f`; Textarea `border #e3e3e6, borderRadius 10, padding 11px 36px 11px 12px`; VoiceInput `right-[11px] top-[11px] text-[#8a887f]`
- Inputs (doc_number, title, validity_days, bonus%): `border #e3e3e6, borderRadius 10, padding 11px 12px, fontSize 13`
- Bonus Switch: `className="data-[state=checked]:bg-[#c9a44c]"` (oro quando attivo)
- Bonus label: mostra `Bonus {bonusPerc}%` in oro invece di "Bonus attivo" con Zap
- `Zap` rimosso dagli import
- "* Campo obbligatorio": `style={{ fontSize: '12px', color: '#b08d3e', margin: '14px 15px 10px' }}`
- Bottone container: `gap: 9` → `gap: 11, padding: '0 15px'`
- "Salva bozza" (create mode): `border #e3e3e6, borderRadius 12, padding 13px, fontSize 14, fontWeight 500`
- "Invia al cliente" (create mode): `flex 1.2, borderRadius 12, padding 13px, fontSize 14, fontWeight 600, boxShadow mockup-exact`

**(3) VociTable.tsx:**
- Textarea descrizione (desktop + mobile): `border #e3e3e6, borderRadius 10, padding 11px 36px 11px 12px, fontSize 13`; rimossi `rounded-md border border-input px-3 py-2 pr-9` dalla className
- VoiceInput (desktop + mobile): `right-[11px] top-[11px] text-[#8a887f]`
- Label colonne mobile (Descrizione, Unità, Q.tà, Prezzo, Sconto, IVA): `fontSize 11, color #8a887f` inline style

### File toccati (sessione UI-Rev — commit 12)
```
app/globals.css                                              [1: cc-card-md, cc-section-label]
app/(app)/preventivi/_components/PreventivoForm.tsx          [2: tutto il form]
app/(app)/preventivi/_components/VociTable.tsx               [3: textarea, VoiceInput, label colonne]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: verificare da Eli — Nuovo preventivo (form), Altre opzioni aperte, Bonus edilizio attivo.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (17 giugno 2026) — continuazione (11)

### Fix applicati — Allineamento mockup mobile Commits A–F (6 commit)

**COMMIT A — VociTable: mic overlay, trash top-right, VOCE label, unità 90px** (`ebe4b2d`)

1. Mic `VoiceInput` posizionato in overlay assoluto dentro textarea descrizione (`absolute right-1 top-1 size-6`, parent `relative`; `pr-9` sulla textarea).
2. Trash `Trash2` in alto a destra accanto alla label "VOCE N" (10px, 600, #8a887f). Rimosso dal footer.
3. Label "VOCE N": `fontSize 10, fontWeight 600, color '#8a887f', letterSpacing 0.04em`.
4. Grid mobile unità: `90px` (era `52px`). Grid desktop: `2fr 90px 90px 100px 80px [90px] 32px`.
5. Tutti i campi `style={{ fontSize: 13 }}` uniforme.
6. Asterischi → `<span style={{ color: '#b08d3e' }}>*</span>` (oro, era Tailwind `text-destructive`).
7. Rimossa colonna Tipo (Standard/Trainante/Trainato) completamente dal VociTable.

**COMMIT B — PreventivoForm, FiscalSummary, lib/constants/units** (`c55b5b4`)

8. Note/note-interne: `VoiceInput` in overlay assoluto (`absolute right-1 top-1 size-6`); `pr-9` su Textarea; `fontSize: 13`.
9. "* Campo obbligatorio" asterischi: `style={{ color: '#b08d3e' }}`.
10. Payment terms "Personalizzati": rimosso `name` dal Select; aggiunto `<input type="hidden" name="payment_terms" value={paymentTerms === 'Personalizzati' ? paymentTermsCustom : paymentTerms}>` + Textarea condizionale per testo libero.
11. Scadenza stimata (`dueDateHint`): visibile solo per `docType === 'fattura'` (rimossa per preventivi).
12. Bonus edilizio: `Checkbox` → `Switch` (oro quando attivo); label con `Zap` icon; `onCheckedChange` chiama `setVatRateDefault(10)` / `null`.
13. Nuovo help text bonus: "Percentuale di detrazione, indicata al cliente solo a titolo informativo..."
14. IVA 10% default quando bonus attivo già implementato via `setVatRateDefault`.
15. `lib/constants/units.ts`: aggiunti `{ value: 'a corpo' }` e `{ value: 'cad' }` → 12 unità totali. `PreventivoForm` ora usa `UNIT_VALUES` importato da `lib/constants/units`.
16. `FiscalSummary`: rimosso calcolo trainanti/trainati e relativo render (colonna `bonusEdilizio` rimossa dal destructuring).

**COMMIT C — CatalogPicker: asterischi oro** (`90e5dcf`)

17. Entrambi i `text-destructive` nel form creazione voce → `style={{ color: '#b08d3e' }}`.

**COMMIT D — Dettaglio preventivo: banner oro, azioni 48px, no Salva PDF** (`143c9af`)

18. Banner quota Free: `<p>` testuale → card bianca con bordo sinistro oro 3px, icona ♛, `{N}/{MAX} preventivi gratuiti`, Link "Passa a Pro →".
19. Rimosso info text "Stai usando il template predefinito Classico...".
20. `PdfActions.tsx`: rimosso bottone "Salva o stampa il PDF" — resta solo "Anteprima".
21. `chipBase`: `height: 48, borderRadius: 13, fontSize: 14, border: '1px solid #e7e7ea', boxShadow: '0 1px 2px rgba(20,20,40,.04)'`. Azioni mobili redesign: Anteprima (grigio `#6b6f7a`, Eye), Condividi (navy fill), MobileStatusChips per `sent/viewed`.
22. Nuovo `MobileStatusChips.tsx`: client component con chip Accettato (verde #2f8a63, CheckCircle2) e Rifiutato (rosso #b05656, XCircle) — chiama `PATCH /api/preventivi/[id]/status`.

**COMMIT E — DocumentTimeline: badge pastello per stato** (`084a382`)

23. Ogni fase usa `badgeBg` + `badgeColor` inline style (al posto di Tailwind classes):
    - `created`: bg `#f0f0f2`, icon `#b3b1ab`
    - `sent/resent`: bg `#d8e8fb`, icon `#3f6fb0`
    - `viewed`: bg `#fbe1ee`, icon `#c25b91`
    - `accepted/restored/fattura`: bg `#d4efe2`, icon `#2f8a63`
    - `rejected`: bg `#f5dede`, icon `#b05656`
    - `expired/expires`: bg `#f5e9d0`, icon `#b0863e`
    - `modified`: bg `#ede9f7`, icon `#7c3aed`
    - Linea connettore: `borderLeft: '1.5px solid #e5e5ea'` (era `border-border` Tailwind).
    - Badge circle: `outline: '2px solid #fff'` invece di `ring-2 ring-background`.

**COMMIT F — ShareButton: dialog unificato con canali** (`084a382`)

24. Titolo dialog: `"Invia {docLabel} {numClean}"`, sottotitolo `"Scegli come inviarlo a {clientName}."`.
25. Link row: URL senza protocollo troncato + bottone "Copia" (Copy 14px).
26. Tre cerchi canale 46px (`#f2f2f5` bg, border `#e7e7ea`, navy icon 20-21px): WhatsApp (SVG ufficiale), Email (`Mail`), Altre app (`Share2` + `navigator.share`).
27. Rimosso Popover fallback e tile "Copia link" (Copia rimasta solo nella link row).
28. Info note per bozze: "Condividendo, questo {docLabel} verrà segnato come Inviato e riceverà il numero progressivo."
29. Rimosso dialog conferma separato + flusso "Ho già inviato per altra via".
30. Flusso `openChannel`: se `isDraft` → auto-save (`window.__cc_doSave`) → `registerManualSendAction` → `router.refresh()` → apri canale. Aggiunta prop `clientName?: string | null`.
    - `fatture/[id]/page.tsx` e `preventivi/[id]/page.tsx` aggiornati con `clientName={clientName}`.

### File toccati (sessione UI-Rev — commit 11)
```
app/(app)/preventivi/_components/VociTable.tsx         [A: mic, trash, VOCE, unità 90px, font 13, asterischi oro, no Tipo]
lib/constants/units.ts                                  [B: +a corpo, +cad]
app/(app)/preventivi/_components/PreventivoForm.tsx    [B: mic note, custom payment, bonus Switch, units import, asterischi oro]
app/(app)/preventivi/_components/FiscalSummary.tsx     [B: rimosso trainanti/trainati]
app/(app)/preventivi/_components/CatalogPicker.tsx     [C: asterischi oro]
app/(app)/preventivi/_components/PdfActions.tsx        [D: rimosso Salva PDF]
app/(app)/preventivi/_components/MobileStatusChips.tsx [D: nuovo — chip Accettato/Rifiutato]
app/(app)/preventivi/[id]/page.tsx                     [D: chipBase 48px, banner oro, no template info, azioni mobili; F: clientName]
app/(app)/preventivi/_components/DocumentTimeline.tsx  [E: badge pastello inline styles]
app/(app)/preventivi/_components/ShareButton.tsx       [F: dialog unificato, canali cerchi, no Popover]
app/(app)/fatture/[id]/page.tsx                        [F: clientName a ShareButton]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: tutti i commit A–F da verificare da Eli (VociTable mic, custom payment terms, bonus Switch, azioni mobile 48px, MobileStatusChips, DocumentTimeline pastello, ShareButton dialog canali).

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (16 giugno 2026) — continuazione (10)

### Fix applicati — Bug ShareButton hasVoci stale (1 commit `7ceb719`)

**COMMIT 15 — ShareButton: guard live + auto-save prima di condividere**

**Bug trovato:** `hasVoci` è una prop calcolata server-side (`docItems.some(...)` nel documento salvato). Se l'utente aggiunge voci nel form senza salvare, la prop è stale → ShareButton mostra toast "Aggiungi almeno una voce" anche se le voci sono presenti nel form.

**Causa reale:** il guard `if (!hasVoci)` in `handleShareClick` usa la prop di pagina, non lo stato corrente del form.

**Fix implementato:**

**(1) PreventivoForm.tsx — due nuovi `useEffect`:**
- `useEffect([doSave])`: espone `doSave` su `window.__cc_doSave` (rimosso on unmount). ShareButton chiama questo per auto-salvare prima di condividere.
- `useEffect([voci])`: dispatcha `cartacanta:voci-changed` con `{ hasVoci: boolean }` ad ogni modifica alle voci nel form.

**(2) ShareButton.tsx:**
- Import `useEffect` aggiunto.
- `hasVociLocal = useState(hasVoci)` + `useEffect` che ascolta `cartacanta:voci-changed` → aggiorna `hasVociLocal` in tempo reale.
- Guard `if (!hasVoci)` → `if (!hasVociLocal)` (usa stato corrente del form).
- `handleConfirm`: chiama `window.__cc_doSave()` (auto-save) prima di `registerManualSendAction`. Se il salvataggio fallisce, mostra l'errore nel dialog e non procede.

**(3) lib/actions/documents.ts:**
- `'Il documento non ha voci'` → `'Il preventivo non ha voci salvate. Salva le modifiche prima di condividere.'` (fallback se auto-save non disponibile).

**Flusso risultante:**
1. Utente aggiunge voci → `cartacanta:voci-changed` → `hasVociLocal=true` → guard non blocca
2. Utente clicca Condividi → dialog "Segna come inviato" si apre
3. Utente conferma → `window.__cc_doSave()` salva le voci → `registerManualSendAction` → successo
4. Caso limite (no form montato): server restituisce messaggio chiaro "Salva le modifiche prima"

### File toccati (sessione UI-Rev — commit 15)
```
app/(app)/preventivi/_components/PreventivoForm.tsx  [window.__cc_doSave; cartacanta:voci-changed dispatch]
app/(app)/preventivi/_components/ShareButton.tsx     [hasVociLocal; ascolta evento; auto-save in handleConfirm]
lib/actions/documents.ts                             [errore server migliorato]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: verificare da Eli — aggiungere voci, NON salvare, cliccare Condividi → deve salvare e condividere senza errori.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (16 giugno 2026) — continuazione (9)

### Fix applicati — Note, CatalogPicker (1 commit `14c31eb`)

**COMMIT 14 — Note auto-espandibili, icona Nuova voce, titoli categoria**

**(1) Textarea note auto-espandibili (PreventivoForm.tsx):**
- Entrambi i campi (`notes` e `internal_notes`): rimosso `rows={N}`, aggiunto `className="resize-none overflow-hidden"`, `style={{ minHeight: '40px' }}`.
- Callback ref: `ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }}` — imposta l'altezza iniziale al contenuto pre-compilato.
- `onChange` aggiornato: resetta a `'auto'` poi imposta a `scrollHeight + 'px'` — il box cresce col testo.

**(2) Icona "Nuova voce" in CatalogPicker (CatalogPicker.tsx):**
- `<PackagePlus>` → `<Plus>` sul bottone "Nuova voce" (riga ~369). `PackagePlus` rimosso dagli import se inutilizzato.

**(3) Titoli categoria CatalogPicker più chiari (CatalogPicker.tsx):**
- Banda categoria: `bg-muted/50` → `bg-muted`; span: `font-semibold text-muted-foreground` → `font-bold text-foreground/70`. Si distingue nettamente dalle voci sottostanti.

### File toccati (sessione UI-Rev — commit 14)
```
app/(app)/preventivi/_components/PreventivoForm.tsx  [1: note/note-interne auto-espandibili]
app/(app)/preventivi/_components/CatalogPicker.tsx   [2: icona Plus; 3: header categoria]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser** — verificare da Eli.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (16 giugno 2026) — continuazione (8)

### Fix applicati — Sfondo grigio #fafafa su mobile (1 commit `5a16004`)

**COMMIT 13 — AppShell: bg-[#fafafa] su mobile**

- `app/(app)/_components/AppShell.tsx`: `<main>` → aggiunta classe `bg-[#fafafa] lg:bg-background`.
- Risultato: tutte le pagine app su mobile hanno sfondo #fafafa; le card e la fascia titolo bianca rimangono su `#fff`; su desktop resta `bg-background` (invariato).

### File toccati (sessione UI-Rev — commit 13)
```
app/(app)/_components/AppShell.tsx   [bg-[#fafafa] lg:bg-background su <main>]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde
- **Non testato in browser** — verificare da Eli che lo sfondo grigio compaia su mobile e non su desktop.

### Esito finale
🟡 FIX APPLICATO — tsc+build verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (16 giugno 2026) — continuazione (7)

### Fix applicati — Nuovo Preventivo / Nuova Fattura (1 commit `ab05d45`)

**COMMIT 12 — VociTable formatCurrency, griglia prezzo, AI pill, placeholder cliente, spaziatura**

**(1) Totale voce formato italiano:**
- `VociTable.tsx`: aggiunto import `formatCurrency` da `@/lib/utils`.
- Mobile (riga Totale): `€{lineTotal.toFixed(2)}` → `{formatCurrency(lineTotal)}` → es. "€ 2.800,00".
- Desktop (riga `= …`): stessa sostituzione.

**(2) Campo Prezzo più largo su mobile:**
- `VociTable.tsx` riga griglia numerica: `grid-cols-4` → `grid-cols-[52px_1fr_1.5fr_1fr]` (Unità fissa 52px, Q.tà normale, Prezzo 1.5fr, Sconto normale). Con IVA si torna a `sm:grid-cols-5` da sm+.

**(3) AiImportButton "IN ARRIVO" discreto:**
- `AiImportButton.tsx`: il branch `!AI_IMPORT_ENABLED` ora restituisce `<span>` (non Button) — fontSize 11, color `var(--cc-text-3)`, opacity 0.75, icona Wand2 11px. Testo: "Importa con AI · in arrivo". Meno ingombrante accanto al titolo VOCI.

**(4) Placeholder ClientAutocomplete:**
- `components/shared/ClientAutocomplete.tsx`: default `placeholder` cambiato da `'Cerca cliente…'` a `'Cerca o crea cliente…'`. Si applica ovunque il componente è usato (form preventivo, fattura, cliente nuovo).

**(5) Spaziatura card Cliente:**
- `PreventivoForm.tsx`: `<div className="cc-section-label">` nella card Cliente/Fattura → aggiunto `style={{ marginBottom: 0 }}`. La card ha `gap: 14` (flexbox), quindi il totale era gap(14) + marginBottom(12) = 26px. Ora è solo 14px.

### File toccati (sessione UI-Rev — commit 12)
```
app/(app)/preventivi/_components/VociTable.tsx      [1: formatCurrency; 2: grid 52px_1fr_1.5fr_1fr]
app/(app)/preventivi/_components/AiImportButton.tsx  [3: pillola discreta]
app/(app)/preventivi/_components/PreventivoForm.tsx  [5: marginBottom:0 su cc-section-label]
components/shared/ClientAutocomplete.tsx             [4: placeholder "Cerca o crea cliente…"]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: totale voce formato italiano; Prezzo non troncato; AI pillola discreta; placeholder cliente; spaziatura card — verificare da Eli.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (16 giugno 2026) — continuazione (6)

### Fix applicati — spaziatura Home, fascia-titolo, gap card (1 commit `6b66304`)

**COMMIT 11 — spaziatura Home, fascia bianca Preventivi/Fatture, marginBottom card**

**(1) Ombra ripristinata (via git revert):** commit `3e4fc8f` ha annullato `9a26537` (ombra troppo forte). L'ombra card è tornata a `0 1px 2px rgba(20,20,40,.04), 0 6px 16px -8px rgba(20,20,40,.13)` (valore originale in `--cc-shadow`).

**(2) Home — più spazio tra le card (dashboard/page.tsx + MobileScadenzaCard.tsx):**
- Banner quota: `margin: '13px 15px 0'` → `'18px 15px 0'`
- MobileScadenzaCard outer div: `margin: '13px 15px 0'` → `'18px 15px 0'`
- KPI grid: `margin: '15px 15px 0'` → `'20px 15px 0'`
- Activity card: `margin: '18px 15px 18px'` → `'23px 15px 18px'`

**(3) Fascia bianca titolo su Preventivi e Fatture (mobile only):**
- `preventivi/page.tsx` e `fatture/page.tsx`: aggiunto `<div className="lg:hidden -mx-4 -mt-4 mb-4" style={{ background: '#fff', borderBottom: '0.5px solid var(--cc-border-color)', padding: '15px 15px 13px' }}>` come primo figlio del container, con h1 dentro.
- Il `-mx-4 -mt-4` cancella il `p-4` del container mobile → la fascia va a piena larghezza.
- L'header originale (h1 + bottoni desktop) è diventato `hidden lg:flex` su entrambe le pagine.
- Il banner Free, la ricerca, i filtri e le card restano sul grigio di sfondo sotto la fascia.

**(4) Più spazio tra i documenti:**
- `preventivi/page.tsx` e `fatture/page.tsx`: card wrapper `marginBottom: 12` → `marginBottom: 16`.

### File toccati (sessione UI-Rev — commit 11)
```
app/(app)/dashboard/page.tsx                          [2: margini banner/KPI/activity]
app/(app)/dashboard/_components/MobileScadenzaCard.tsx [2: margin 13→18]
app/(app)/preventivi/page.tsx                         [3: fascia bianca mobile; 4: marginBottom 16]
app/(app)/fatture/page.tsx                            [3: fascia bianca mobile; 4: marginBottom 16]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: spaziatura Home; fascia bianca titolo Preventivi/Fatture; gap card — verificare da Eli.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (16 giugno 2026) — continuazione (5)

### Fix applicati — Home + badge + Ordina (1 commit `09d197f`)

**COMMIT 10 — KPI mese centrate, no logo, altri-N in card, WA precompilato; Visto lilla; Ordina min-w**

**(A1) KPI grid mobile (dashboard/page.tsx):** cards centrate (`textAlign:'center'`), padding `14px 12px`, label rinominate ("Preventivi accettati" / "Fatturato"), aggiunta riga mese corrente sotto il valore (`fontSize 11, color #8a887f, marginTop 2`). `meseCorrente` calcolato da `now.toLocaleDateString('it-IT', { month: 'long' })`.

**(A2) Rimozione logo azienda dall'header (dashboard/page.tsx):** rimosso blocco `{workspace.logo_url && (<img.../>)}`. Resta solo "Ciao, {fullName}" + workspaceName a sinistra e avatar a destra.

**(A3) "Altri N in scadenza" dentro la card (dashboard/page.tsx + MobileScadenzaCard.tsx):** rimossa la card separata "Altri N in scadenza" (`allPendingCount > 1` block). Aggiunta prop `otherPendingCount` a MobileScadenzaCard. Se > 0: dentro la card, sotto l'hint, linea grigia + Link a `/preventivi/scadenze` con `AlertTriangle` + conteggio.

**(A4) WhatsApp messaggio precompilato (MobileScadenzaCard.tsx):** aggiunte props `publicToken`, `workspaceName`, `expiresAt`. Se `publicToken` disponibile: `whatsappHref = https://wa.me/${phoneDigits}?text=${encodeURIComponent(msg)}`. Messaggio: "Buongiorno {clientName}, le ricordo il preventivo {docNumber} in scadenza il {gg/mm}. Può visionarlo qui: {link}. Cordiali saluti, {workspaceName}". Anche `public_token` aggiunto alla query in dashboard/page.tsx.

**(B) SortSelect min-w (SortSelect.tsx):** `<DropdownMenuContent>` → `className="min-w-[190px]"` per evitare che "Scadenza vicina" / "Ultima modifica" vadano a capo.

**(C) Badge "Visto" colore lilla (StatusBadge.tsx + dashboard/page.tsx):** viewed bg `#d8e8fb` → `#e2e3f7` (lilla-azzurro, distinto da sent `#d8e8fb`). `getMobileBadgeBg`: `sent` e `viewed` ora separati (non più nel fall-through).

### File toccati (sessione UI-Rev — commit 10)
```
app/(app)/dashboard/page.tsx                          [A1/A2/A3/A4/C: KPI, no logo, altri-N props, public_token, getMobileBadgeBg]
app/(app)/dashboard/_components/MobileScadenzaCard.tsx [A3/A4: otherPendingCount, publicToken, WA msg, Link+ArrowRight]
app/(app)/preventivi/_components/SortSelect.tsx        [B: min-w-[190px]]
app/(app)/preventivi/_components/StatusBadge.tsx       [C: viewed #e2e3f7]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: KPI centrate con mese; header senza logo; "Altri N" dentro la card; WA messaggio precompilato; badge Visto lilla; Ordina senza testo troncato.

### Fix aggiuntivi — 3 micro-fix (1 commit `3bad10f`)

**(A) Badge "Visto" rosa:** viewed bg `#e2e3f7` → `#fbe1ee` (StatusBadge + getMobileBadgeBg in dashboard).

**(B) SearchBar placeholder più piccolo:** aggiunta classe `placeholder:text-sm` all'Input — placeholder a 14px, testo digitato resta 16px → niente zoom automatico su iOS.

**(C) Placeholder unificato:** mobile SearchBar su Preventivi e Fatture usa "Cerca numero, cliente, voce…".

**(D) Ombra card più marcata (commit `9a26537`):** `--cc-shadow` aggiornato in `globals.css` → `0 2px 5px rgba(20,20,40,.07), 0 10px 28px -8px rgba(20,20,40,.22)`. Aggiornate anche le costanti `SH` hardcoded in `dashboard/page.tsx` e `MobileScadenzaCard.tsx`. Non tocca `--cc-shadow-md/fab/btn`.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (16 giugno 2026) — continuazione (4)

### Fix applicati — 5 fix CSS/UX (1 commit `2e76148`)

**COMMIT 9 — ombra pillola, Ordina→DropdownMenu, SearchBar focus, badge colori, sort scadenza vicina**

**(1) Ombra pillola non tagliata (globals.css):** `.cc-tabs` padding `6px 0` → `10px 0 15px`. Il container `.cc-tabs` aveva `overflow-x: auto` (da `.cc-filter-scroll`) che tagliava l'ombra verticale `.cc-tab-active`. Il padding extra crea spazio sopra/sotto l'ombra prima del clip.

**(2) SortSelect: Select → DropdownMenu modal={false}:** sostituito l'intero `<Select>` Radix con `<DropdownMenu modal={false}> + <DropdownMenuRadioGroup> + <DropdownMenuRadioItem>`. Il `<Select>` usava `react-remove-scroll` → aggiungeva `padding-right` al body per compensare la scrollbar → la pagina si restringeva all'apertura. Con `modal={false}` non blocca lo scroll e non compensa. Trigger: testo con `ChevronDown size 14`, border-0 bg-transparent. Mantenuta tutta la logica (sessionStorage, router.push ?sort=, displaySort ottimistico).

**(3) SearchBar: digitazione non cancellata dal sync URL:** aggiunto `inputRef = useRef<HTMLInputElement>(null)`. Nel `useEffect` che sincronizza il valore dall'URL, aggiunto guard: `if (inputRef.current && document.activeElement === inputRef.current) return`. L'Input ora ha `ref={inputRef}`. Problema precedente: il router ripristinava l'URL (con il debounce) e il `useEffect` rimpiazzava il valore locale mentre l'utente stava ancora digitando.

**(4) Colori StatusBadge allineati alla palette Home:** viewed `#f7e6c8` → `#d8e8fb` (blu chiaro = coerente con "Inviato"), rejected `#fadfdf` → `#f5dede` (rosa tenue), expired `#f7e6c8` → `#f5e9d0` (ambra tenue). Si applica su preventivi + fatture + dettaglio (intenzionale). La Home NON è stata toccata (usa `getMobileBadgeBg` separato).

**(5) Sort "Scadenza vicina" — pending prima:** il DB non supporta ORDER BY CASE via Supabase. Soluzione: quando `sort === 'expiry'`, limit aumentato a 200 (da 50) + JS sort dopo il fetch. Grouping: pending (status in ['sent','viewed','expired']) per `expires_at ASC` (null in fondo), gli altri (accepted/rejected/draft) per `updated_at DESC`. La variabile `displayDocuments` contiene il risultato ordinato; il render usa `displayDocuments.map(` invece di `(documents ?? []).map(`.

### File toccati (sessione UI-Rev — commit 9)
```
app/globals.css                                          [cc-tabs padding 10px 0 15px]
app/(app)/preventivi/_components/SortSelect.tsx          [Select → DropdownMenu modal=false]
components/shared/SearchBar.tsx                          [inputRef + guard activeElement]
app/(app)/preventivi/_components/StatusBadge.tsx         [viewed/rejected/expired colori]
app/(app)/preventivi/page.tsx                            [sort=expiry: limit 200 + JS sort displayDocuments]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: ombra pillola non tagliata; Ordina non restringe la pagina; digitazione non cancellata in SearchBar; badge colori aggiornati; "Scadenza vicina" mostra pending prima.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (16 giugno 2026) — continuazione (3)

### Fix applicati — 5 fix CSS/UX trasversali (1 commit)

**COMMIT 8 — CSS duplicato rimosso, Ordina popper, ricerca modificato, sort Fatture**

**(1) CSS duplicato rimosso (globals.css):** eliminato il blocco vecchio `.cc-tabs/.cc-tab/.cc-tab-active` con `border-bottom` (~righe 343-364) — causava la sottolineatura residua sui filtri. Resta solo la definizione pill-style.

**(2) SortSelect menu in basso (position popper):** `<SelectContent>` → `position="popper" align="end" sideOffset={6}`. Vale per Preventivi e (tramite lo stesso componente) Fatture.

**(3) Ricerca "modificato" su Preventivi:** nel blocco di ricerca testuale, prima del ramo statusMatch, aggiunto controllo `MODIFIED_KW` → `.not('updated_after_send_at', 'is', null)`. Parole: modificato/a/i/e (exact + prefisso min 4 chars).

**(4) Ricerca "modificata" su Fatture:** stesso pattern aggiunto nel blocco ricerca fatture.

**(5) "Ordina" funzionante su Fatture:** aggiunto `sort?` a searchParams, import `SortSelect`, ordinamento dinamico (default `updated_at ASC` = "Meno recenti", coerente con Preventivi). Il testo statico "Più recenti" è sostituito con `<SortSelect currentSort={sort} />`.

### File toccati (sessione UI-Rev — commit 8)
```
app/globals.css                          [rimosso blocco cc-tabs duplicato con border-bottom]
app/(app)/preventivi/_components/SortSelect.tsx  [SelectContent position=popper align=end]
app/(app)/preventivi/page.tsx            [ricerca "modificato"]
app/(app)/fatture/page.tsx               [ricerca "modificata" + sort funzionante]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: filtri senza sottolineatura; menu Ordina si apre sotto; ricerca "modificato/a" filtra correttamente; ordinamento Fatture funziona — verificare da Eli.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (16 giugno 2026) — continuazione (2)

### Fix applicati — Pagina Fatture: allineamento mockup + ⋮ per riga (1 commit)

**COMMIT 7 — Fatture: filtri pill, bottoni restyled, badge affiancato, ⋮ per riga, redirect fix**

**(0) CSS valori esatti del mockup (globals.css — condiviso Preventivi+Fatture):**
- `.cc-tab`: padding `6px 9px` → `6px 5px` (inattivo più compatto)
- `.cc-tab-active`: padding `7px 16px` → `10px 22px` (attivo più grande)

**(1) Filtri Fatture scorrevoli:** `className="cc-tabs"` → `className="cc-tabs cc-filter-scroll"`

**(2) Rimosso ⋮ mobile CSV:** eliminato `<a lg:hidden ... MoreVertical>`. Rimosso `MoreVertical` dall'import.

**(3) Badge "Modificata" affiancato al badge stato (riga 1):** rimosso da riga 2, spostato inline con StatusBadge in `<div display:flex gap:6>`. Stile: bg `#e9e0f7`, color `#2b2b2b`, 11px weight 600, radius 999, padding `2px 8px`.

**(4) Bottoni creazione restyled (mobile):**
- "Da preventivo" PRIMARIO a sinistra: navy bg, bianco, borderRadius 14, boxShadow navy, con icona `FileInput`
- "Nuova fattura" SECONDARIO a destra: bianco, bordo `#ededf0`, var(--cc-shadow), con icona `Plus`

**(5) Titolo "Fatture" fontWeight 500 → 600**

**(6) ⋮ per riga:**
- Card fattura avvolta in `<div position:relative marginBottom:12>`. Link padding `'14px 50px 14px 15px'`.
- `DocumentRowActions` in absolute top/right, fuori dal Link (tap su ⋮ non naviga).
- workspace select aggiornato con `name, ragione_sociale`; clients select con `email`.

**(DocumentRowActions — reso doc-type-aware):**
- Aggiunto prop `docType?: 'preventivo' | 'fattura'` (default 'preventivo').
- Dialog "Elimina preventivo" → dinamico. aria-label dinamico.

**(duplicateDocumentAction — fix redirect per fatture):**
- `lib/actions/documents.ts`: redirect ora va a `/fatture/${newDoc.id}` se `doc_type === 'fattura'`, altrimenti `/preventivi/`. Aggiunto `revalidatePath('/fatture')`.

### File toccati (sessione UI-Rev — commit 7)
```
app/globals.css                                          [cc-tab/cc-tab-active valori esatti mockup]
app/(app)/fatture/page.tsx                               [tutti i fix 0-6]
app/(app)/preventivi/_components/DocumentRowActions.tsx  [prop docType; dialog/aria dinamici]
lib/actions/documents.ts                                 [duplicateDocumentAction redirect doc-type-aware]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser reale**: filtri Fatture pill, bottoni restyled, badge affiancato, ⋮ per riga, redirect "Usa come modello" su fattura va a /fatture/ — verificare da Eli.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (16 giugno 2026) — continuazione

### Fix applicati — Allineamento mockup Preventivi + scaduti in "In attesa" (1 commit)

**COMMIT 6 — 7 fix Preventivi: shift, filtri CSS, ricerca, ordina, puntini, banner, scaduti**

**(1) Shift laterale — fix vero:**
- `app/(app)/_components/AppShell.tsx`: `<main>` → `style={{ scrollbarGutter: 'stable' }}`. Elemento corretto (scrollabile è `<main>`, non `html`).

**(2) Filtri CSS shared (no più inline):**
- `app/globals.css`: aggiunte classi `.cc-tabs`, `.cc-tab`, `.cc-tab-active` (pill style).
- `app/(app)/preventivi/page.tsx`: div filtri ora usa `className="cc-tabs cc-filter-scroll"` + `<Link className={isActive ? 'cc-tab-active' : 'cc-tab'}>`.

**(3) SearchBar più alta:**
- `components/shared/SearchBar.tsx`: aggiunto `h-11` all'Input (44px, combacia col mockup).

**(4) "Ordina" solo testo:**
- `app/(app)/preventivi/_components/SortSelect.tsx`: `SelectTrigger` → `border-0 bg-transparent shadow-none h-auto`. Appare come testo "Meno recenti ▾" senza riquadro.

**(5) Puntini ⋮ grigi:**
- `app/(app)/preventivi/_components/DocumentRowActions.tsx`: `MoreHorizontal` → `className="size-4 text-muted-foreground"`.

**(6) Banner Free — card corta oro:**
- `app/(app)/preventivi/page.tsx`: banner ambra lungo sostituito con card bianca, bordo sinistro oro `#c9a44c`, icona ♛, testo "{N}/{MAX} preventivi gratuiti" + link "Passa a Pro →".

**(7) "In attesa" include gli scaduti:**
- `app/(app)/preventivi/page.tsx`: query `status === 'attesa'` → `.in('status', ['sent','viewed','expired'])`. Mappa ricerca testuale 'attesa'/'in attesa' → stessa terna. Cast TypeScript aggiornato. I preventivi scaduti restano visibili sotto "In attesa" e non spariscono dal tab.

### File toccati (continuazione sessione UI-Rev — commit 6)
```
app/(app)/_components/AppShell.tsx                      [scrollbarGutter stable su main]
app/globals.css                                         [cc-tabs, cc-tab, cc-tab-active]
app/(app)/preventivi/page.tsx                           [filtri CSS, banner oro, scaduti in attesa]
components/shared/SearchBar.tsx                         [h-11]
app/(app)/preventivi/_components/SortSelect.tsx         [SelectTrigger senza bordo]
app/(app)/preventivi/_components/DocumentRowActions.tsx [MoreHorizontal grigio]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser reale**: verificare da Eli shift laterale, filtri pill, ordina testuale, banner oro, scaduti in "In attesa".

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

### Fix applicati — Pillole filtro e scroll orizzontale (1 commit)

**COMMIT 5 — Filtri Preventivi: pillole più piccole + niente slittamento laterale**

**(a) Pillole più piccole:**
- `app/(app)/preventivi/page.tsx`: tab attivo `8px 16px` → `6px 13px`; tab inattivo `6px 10px` → `5px 9px`.

**(b) Scroll orizzontale senza shift di pagina:**
- `app/globals.css`: aggiunta utility `.cc-filter-scroll` (overflow-x auto, scrollbar nascosta). Aggiunto `scrollbar-gutter: stable` su `html`.
- `app/(app)/preventivi/page.tsx`: aggiunto `className="cc-filter-scroll"` al container flex dei tab, così i 5 filtri scorrono DENTRO la barra senza spingere la pagina.

### File toccati (continuazione sessione UI-Rev)
```
app/(app)/preventivi/page.tsx   [pad pillole ridotto; cc-filter-scroll su container tab]
app/globals.css                 [utility cc-filter-scroll; scrollbar-gutter: stable su html]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser reale**: verificare da Eli che i filtri non causino più scroll laterale di pagina.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (16 giugno 2026)

### Fix applicati — Revisione UI mobile (4 commit)

**COMMIT 1 — Salvataggio lavoro non committato**
- `mockup-mobile/home_v2.html`: mockup di riferimento Home + Preventivi
- `ricerca-fatturazione-elettronica/implementazione-e-testi-legali.md`: nuova ricerca SDI
- `ricerca-fatturazione-elettronica/DECISIONE_SDI.md`, `fonti.md`: aggiornamenti

**COMMIT 2 — Normalizzazione fine-riga a LF**
- Creato `.gitattributes` con `* text=auto eol=lf`
- `git add --renormalize .` → eliminati ~81 file di rumore CRLF dal working tree
- `REVISIONE_UI.md`: aggiornato (segnata sessione Home implementata)

**COMMIT 3 — Home: testo Attività recente grigio scuro**
- `app/(app)/dashboard/page.tsx`: riga mobile activity feed — aggiunto `color: 'var(--cc-text-2)'` al div del nome/numero documento (era colore default del tema, troppo scuro/nero)

**COMMIT 4 — Preventivi (lista) mobile: restyling completo**

**(a) Rimosso ⋮ mobile (Export CSV):**
- `app/(app)/preventivi/page.tsx`: rimossa l'ancora `<a>` mobile con `MoreVertical` a lines ~263-266. Rimossi `MoreVertical` e `Bell` (inutilizzato) dall'import lucide-react.

**(b) Badge "Modificato" affiancato a StatusBadge in riga 1:**
- Riga 1 (numero · cliente | badge): StatusBadge e badge "Modificato" ora avvolti in `<div display:flex gap:6>`. Stile badge: `#e9e0f7` bg, `#2b2b2b` testo, fontSize 11, fontWeight 600, borderRadius 999, padding `2px 8px`.
- Rimosso il vecchio badge "Modificato" (viola scuro `#7c3aed`) dalla riga 2.

**(c) StatusBadge restyling globale:**
- `app/(app)/preventivi/_components/StatusBadge.tsx`: sostituito approccio Tailwind className con inline styles. Niente più bordi colorati. Testo sempre `#2b2b2b`, fontWeight 600. Sfondi tenue: draft `#e8e8e8` · sent `#d8e8fb` · viewed `#f7e6c8` · accepted `#d4efe2` · rejected `#fadfdf` · expired `#f7e6c8`. Si applica ovunque (fatture, dettaglio — intenzionale).

**(d) SearchBar più elegante:**
- `components/shared/SearchBar.tsx`: Input → `rounded-xl border-[#e6e6e6] bg-[#f7f7f8] focus:bg-white focus-visible:bg-white`. Si applica su tutte le pagine che usano SearchBar.

**(e) Più spazio attorno a "Ordina":**
- `app/(app)/preventivi/page.tsx`: riga Ordina → `py-3` → `py-4`.

**(f) Filtri tab stile B (pill):**
- Container filtri: `background:#f2f2f4, borderRadius:999, padding:3px 4px`. Rimosso `borderBottom`.
- Tab attivo: pillola bianca `bg:#fff`, `boxShadow` galleggiante, `color:var(--cc-navy)`, fontWeight 600, padding `8px 16px`.
- Tab inattivo: solo testo `color:var(--cc-text-2)`, padding `6px 10px`, nessun bg/bordo.

### File toccati (sessione UI-Rev)
```
.gitattributes                                          [nuovo — normalizzazione LF]
mockup-mobile/home_v2.html                              [nuovo — mockup riferimento]
ricerca-fatturazione-elettronica/implementazione-e-testi-legali.md  [nuovo — ricerca SDI]
ricerca-fatturazione-elettronica/DECISIONE_SDI.md       [aggiornato]
ricerca-fatturazione-elettronica/fonti.md               [aggiornato]
REVISIONE_UI.md                                         [aggiornato]
app/(app)/dashboard/page.tsx                            [COMMIT 3: color cc-text-2 su activity feed]
app/(app)/preventivi/page.tsx                           [COMMIT 4: no ⋮ mobile, badge affiancato, py-4, filtri B]
app/(app)/preventivi/_components/StatusBadge.tsx        [COMMIT 4: restyling inline style — si applica globalmente]
components/shared/SearchBar.tsx                         [COMMIT 4: rounded-xl, bg #f7f7f8, border #e6e6e6]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser reale**: filtri pill B, badge Modificato affiancato, StatusBadge nuovi colori, SearchBar restyle, testo activity feed grigio — verificare da Eli sul telefono.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE G-QA-R (15 giugno 2026)

### Fix applicati — Re-test mobile (commit `fix(mobile): G-QA-R`)

**QA-R1 — Menu ⋮ bloccava l'app**
- `DocumentRowActions.tsx`: aggiunto `modal={false}` a `<DropdownMenu>` → Radix non imposta più `pointer-events:none` sul body durante l'apertura del menu → no freeze.
- `preventivi/[id]/page.tsx` e `fatture/[id]/page.tsx`: rimosso il pulsante `<a href="#mobile-altre-azioni">⋮</a>` dal mobile header (anchor scroll su pagine pesanti causava freeze). Sostituito con `<Link href="?edit=1"><Pencil /></Link>`.

**QA-R2 — "Condividi" icona senza etichetta vs "Anteprima" enorme**
- `ShareButton.tsx`: rimosso `hidden sm:inline` dalla span label → "Condividi" sempre visibile. Aggiunto prop `triggerStyle?: React.CSSProperties` applicato al Button trigger.
- `preventivi/[id]/page.tsx` e `fatture/[id]/page.tsx`: passato `triggerStyle={chipBase}` a ShareButton nella sezione chip mobile → stessa dimensione di "Anteprima".

**QA-R3 — Form editabile sempre visibile anche per doc non modificabili**
- `preventivi/[id]/page.tsx`: `searchParams` esteso con `edit?: string`; `PreventivoForm` avvolto in `<div className={edit !== '1' ? 'hidden lg:block' : undefined}>`. Pencil nel header → `?edit=1` mostra il form.
- `fatture/[id]/page.tsx`: stessa logica + fattura accepted/rejected → form non compare mai su mobile. Chip "Modifica" cambiato da `href="#fattura-form-section"` a `href="/fatture/[id]?edit=1"` (Link, non anchor scroll).

**QA-R4 — "Ordina:" vuoto su mobile**
- `SortSelect.tsx`: `SelectTrigger` da `w-full sm:w-40` → `w-36` (larghezza fissa, evita collapse nel flex container). Label mostrata con `useState` locale + aggiornamento ottimistico in `handleChange`, invece di `<SelectValue />` che non rendeva il testo su mobile.

### File toccati (sessione G-QA-R)
```
app/(app)/preventivi/_components/DocumentRowActions.tsx  [QA-R1: modal=false]
app/(app)/preventivi/_components/ShareButton.tsx         [QA-R2: label visibile + triggerStyle prop]
app/(app)/preventivi/_components/SortSelect.tsx          [QA-R4: w-36 + label con stato locale]
app/(app)/preventivi/[id]/page.tsx                       [QA-R1: no ⋮, Pencil→?edit=1; QA-R2: triggerStyle; QA-R3: form hidden]
app/(app)/fatture/[id]/page.tsx                          [QA-R1: no ⋮, Pencil→?edit=1; QA-R2: triggerStyle; QA-R3: form hidden + chip Modifica]
DECISIONI_REDESIGN_MOBILE.md                             [sezione G-QA-R aggiunta]
CLAUDE.md                                                [aggiornato]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: tutti e 4 i punti G-QA-R da verificare da Eli sul telefono.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli (lista in `DECISIONI_REDESIGN_MOBILE.md` sezione G-QA-R).

---

## A-quater. HANDOFF — SESSIONE G-QA (14 giugno 2026)

### Fix applicati — QA mobile (3 commit: G-QA1+QA2, G-QA3)

**G-QA1.1 — Impostazioni: tab orizzontali su mobile**
- `app/(app)/impostazioni/page.tsx`: Tabs root → `flex flex-col` su mobile (invece del layout sidebar). Icone tab nascoste con `hidden lg:block`. Label sempre visibile.

**G-QA1.2 — Abbonamento Pro: card dettagli piano**
- `app/(app)/abbonamento/page.tsx`: aggiunta card Pro con feature list, fatturazione mensile/annuale, SwitchBillingButton, link "Gestisci abbonamento" via `createPortalSessionAction`.

**G-QA2.1 — Clienti: righe lista tappabili su tutta la riga**
- `app/(app)/clienti/page.tsx`: aggiunto `active:bg-muted/50 cursor-pointer` alle Link della lista.

**G-QA2.2 — Scheda cliente: sola lettura + Modifica via URL**
- `app/(app)/clienti/[id]/page.tsx`: form edit nascosto di default su mobile (`hidden lg:block`); chip "Modifica" usa `?edit=1`; chip "Preventivo" rimosso; chip "Chiama" rimasto.

**G-QA2.3 — Cestino: spinner infinito→stato vuoto**
- `app/(app)/cestino/page.tsx`: `setLoading(false)` negli early-return quando `!user` o `!workspaceId`.

**G-QA3.1 — Doppie etichette rimosse**
- `PreventivoForm.tsx`: rimossa Label "Cliente" ridondante. `VociTable.tsx`: rimosso h2 "Voci preventivo".

**G-QA3.2 — Header creazione compatto (✕ · Titolo)**
- `preventivi/nuovo/page.tsx` e `fatture/nuovo/page.tsx`: header mobile `lg:hidden` con X link + titolo centrato + spacer. Breadcrumb/titolo desktop in `hidden lg:block`.

**G-QA3.3 — FiscalSummary a piena larghezza**
- `FiscalSummary.tsx`: rimosso wrapper `flex justify-end`. Il riepilogo ora occupa tutta la larghezza disponibile.

**G-QA3.4 — Sconto dentro Riepilogo**
- `PreventivoForm.tsx`: rimossa Card 4 "Sconti globali" separata. Sconto spostato dentro FiscalSummary via prop `discountSlot`. Aggiunto stato `discountOpen` + hidden inputs quando il pannello sconto è chiuso.
- `FiscalSummary.tsx`: aggiunto `discountSlot?: React.ReactNode` con separatore visivo.

**G-QA3.5 — Banner accettato completo + Crea fattura su mobile**
- `preventivi/[id]/page.tsx`: banner "Accettato e firmato dal cliente" (sempre, non condizionale); IP mostrato se presente. `ConvertiFatturaButton` aggiunto anche nel gruppo azioni mobile (`lg:hidden`).

**G-QA3.6 — Catalogo: ⋮ header + IVA% in riga**
- `catalogo/page.tsx`: MoreVertical al posto del contatore voci nell'header mobile.
- `CatalogItemRow.tsx`: sottotitolo mobile `unit · IVA X%`; colonne unità e IVA desktop `hidden lg:inline`.

**G-QA3.7 — Wording: "Da catalogo" · "Salva" · badge scadenze**
- `CatalogPicker.tsx`: "Dal catalogo" → "Da catalogo".
- `template/page.tsx`: bottone navy "Personalizza" → "Salva".
- `altro/page.tsx`: query scadenze entro 3gg; badge oro con contatore su "Scadenze e solleciti".

### File toccati (sessione G-QA)
```
app/(app)/impostazioni/page.tsx                [QA1.1: flex-col mobile, icone hidden lg:block]
app/(app)/abbonamento/page.tsx                 [QA1.2: card Pro con dettagli]
app/(app)/clienti/page.tsx                     [QA2.1: active:bg-muted cursor-pointer]
app/(app)/clienti/[id]/page.tsx                [QA2.2: form hidden lg:block, ?edit=1, chip Preventivo rimosso]
app/(app)/cestino/page.tsx                     [QA2.3: setLoading(false) negli early-return]
app/(app)/preventivi/_components/PreventivoForm.tsx  [QA3.1: no Label Cliente; QA3.4: no Card4, discountSlot]
app/(app)/preventivi/_components/VociTable.tsx  [QA3.1: no h2 Voci]
app/(app)/preventivi/nuovo/page.tsx            [QA3.2: header mobile ✕·Titolo]
app/(app)/fatture/nuovo/page.tsx               [QA3.2: header mobile ✕·Titolo]
app/(app)/preventivi/_components/FiscalSummary.tsx  [QA3.3: no flex justify-end; QA3.4: discountSlot prop]
app/(app)/preventivi/[id]/page.tsx             [QA3.5: banner + IP + ConvertiFatturaButton mobile]
app/(app)/catalogo/page.tsx                    [QA3.6: MoreVertical]
app/(app)/catalogo/_components/CatalogItemRow.tsx  [QA3.6: mobile subtitle unit·IVA%]
app/(app)/preventivi/_components/CatalogPicker.tsx  [QA3.7: "Da catalogo"]
app/(app)/template/page.tsx                    [QA3.7: "Salva"]
app/(app)/altro/page.tsx                       [QA3.7: scadenze badge]
DECISIONI_REDESIGN_MOBILE.md                   [sezione G-QA aggiunta]
CLAUDE.md                                      [aggiornato]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde (dopo ogni gruppo G-QA1+QA2, G-QA3)
- `npm run build` → verde
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser reale**: tutti e 13 i punti G-QA vanno verificati da Eli sul telefono.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli (lista completa in `DECISIONI_REDESIGN_MOBILE.md` sezione G-QA).

---

## A-bis. HANDOFF — SESSIONE G6 (14 giugno 2026 — precedente)

### Fix applicati (commit `fix(mobile): G6 — template Classico no-Pro label + P.IVA spostata in tab Fiscale`)

**G6a — Template: Classico non mostra mai "Pro"**
- `app/(app)/template/page.tsx` riga 164: `{isActive ? 'Attivo' : (locked ? 'Pro' : 'Pro')}` → `{isActive ? 'Attivo' : preset.pro ? 'Pro' : ''}`. Entrambi i branch restituivano `'Pro'` — anche il Classico (senza `preset.pro`) mostrava "Pro" quando non era il preset attivo. Ora mostra stringa vuota per i preset senza `preset.pro`.

**G6b — Impostazioni: P.IVA / Codice Fiscale spostato da tab Generale a tab Fiscale**
- `app/(app)/impostazioni/tabs/generali.tsx`: rimosso il blocco `grid-cols-2` che conteneva P.IVA + Email account (righe 97-112). L'email (auth, read-only) ora è un campo standalone con label "Email" (non più "Email account").
- `app/(app)/impostazioni/tabs/fiscali.tsx`: aggiunto `Input` per "P.IVA / Codice Fiscale" in testa alla card (rinominata "Dati fiscali"); `useState` per `piva`; hidden field per inviarlo col form; campo controllato visibile.
- `lib/actions/workspace.ts`: `WorkspaceFiscalSchema` esteso con `piva: z.string().max(16).optional()`; `raw` del parsing include `formData.get('piva')`; l'update usa spread condizionale `...(parsed.data.piva !== undefined && { piva: parsed.data.piva || null })` per rispettare il tipo Supabase.

### File toccati (sessione G6)
```
app/(app)/template/page.tsx                   [riga 164: preset.pro ? 'Pro' : '' invece di always 'Pro']
app/(app)/impostazioni/tabs/generali.tsx      [rimosso P.IVA; Email standalone con label "Email"]
app/(app)/impostazioni/tabs/fiscali.tsx       [aggiunto Input piva + useState + hidden field; card rinominata "Dati fiscali"]
lib/actions/workspace.ts                      [WorkspaceFiscalSchema +piva; raw +piva; update spread condizionale]
DECISIONI_REDESIGN_MOBILE.md                  [FASE 6 aggiornata con nota G6]
CLAUDE.md                                     [aggiornato]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi
- Verifica per ispezione codice: `preset.pro` è definito solo su Bold/Tecnico/Elegante (non su Classico) → Classico ora mostra '' quando non attivo; campo P.IVA in Fiscale usa `useState` + hidden field (pattern identico a `bolloAuto`, `fiscalRegime` etc.).
- **Non testato in browser reale**: (1) pagina Template su mobile → Classico inattivo mostra stringa vuota; (2) Impostazioni → tab Fiscale mostra il campo P.IVA con il valore attuale; (3) salvataggio P.IVA dal tab Fiscale funziona.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli: i 3 punti sopra.

---

---

# ▼ Task imminenti sessione 25 + promemoria DMARC giugno (completati: DMARC quarantine e AI Import attivi dall'11-12 lug)


## ⏰ TASK IMMINENTI DA FARE NEI PROSSIMI GIORNI (confermati dall'utente — sessione 25)

> **1. DMARC → quarantine** (azione manuale OVH dell'utente)
> L'utente riceve le email. Prima di passare a `p=quarantine`: controllare i report DMARC
> (SPF+DKIM pass) + test reale a Gmail/Outlook (inbox, non spam). Vedi checklist completa sotto.
> Sequenza obbligatoria: `none → quarantine → reject` (mai saltare a reject).
>
> **2. Attivare AI Import**
> Bottone oggi "IN ARRIVO" disabilitato. Per attivare: `NEXT_PUBLIC_AI_IMPORT_ENABLED=true` su Vercel
> + chiavi `OPENAI_API_KEY` / `MISTRAL_API_KEY`. Da fare dopo i test del piano Pro.
>
> **3. Fatturazione elettronica (SDI)** — task grosso pianificato. Richiede provider SDI gestito (~€0.10/fattura).

---

## ⏰ PROMEMORIA DATATO — DA LEGGERE SE LA DATA È INTORNO AL 15 GIUGNO 2026

> **DMARC cartacanta.app — verifica e aggiornamento policy**
>
> Il 15 maggio 2026 è stato configurato DMARC su OVH Cloud con `p=none`.
> Trascorse ~4 settimane → è il momento di controllare i report e aggiornare.
>
> **Checklist:**
> 1. Verifica report DMARC nella casella `rua=` — devono esserci report XML da Gmail/Outlook.
>    Se SPF e DKIM passano → si può procedere.
> 2. Invia preventivo di test a Gmail e Outlook → verifica inbox, non spam.
> 3. Se tutto ok: OVH Cloud → DNS → `_dmarc.cartacanta.app` → cambia da `p=none` a `p=quarantine`
>    Nuovo valore: `v=DMARC1; p=quarantine; rua=mailto:tuaemailpersonale@gmail.com;`
> 4. Se ci sono errori → NON cambiare policy. Segnala e risolvi prima.
>
> **Regola ferrea:** mai saltare da `p=none` a `p=reject`. Sequenza: `none → quarantine → reject`.

---

