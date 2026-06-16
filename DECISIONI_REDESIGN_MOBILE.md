# DECISIONI REDESIGN MOBILE — Carta Canta

> Registro di TUTTE le decisioni prese con Eli sul redesign mobile (mockup → poi implementazione).
> **Regola:** non annullare queste decisioni senza istruzione esplicita di Eli. Aggiornare a ogni nuovo feedback.
> Stato mockup: pagina HTML `Carta_Canta_mockup_mobile.html` (outputs). Implementazione nel codice: NON ancora fatta.

Ultimo aggiornamento: 15 giugno 2026

> **Feedback generale di Eli:** PRIMA di inserire o cambiare qualcosa nell'app/mockup, controllare SEMPRE questo file e le decisioni già prese — per non reintrodurre cose già scartate o rifare modifiche. (Es. il piano Lifetime era stato messo per errore: non va mostrato.)

---

## A. Navigazione (DEFINITIVA 14 giu — corregge versione precedente)
- Barra in basso a **4 tab + "+" centrale**: **Home · Preventivi · [ + ] · Fatture · Altro**.
- Il **"+" è CENTRALE** (FAB integrato al centro della barra, stile originale) = "Nuovo preventivo". NON flottante, NON in basso a destra.
- Il "+" deve essere **perfettamente centrato**: la barra usa **5 colonne uguali** (CSS grid `repeat(5,1fr)`, `justify-items:center`, `align-items:end`), **NON** `space-between` — con `space-between` le etichette di larghezza diversa ("Preventivi" più larga di "Fatture"/"Altro") spostavano il "+" verso destra. ✅ Applicato a mockup + `CC_MOBILE.css` (`.cc-bottomnav`); ⏳ da replicare identico in `components/mobile/BottomNav.tsx` (Code).
- **Clienti NON è un tab**: si raggiunge da **"Altro"** (gruppo Strumenti). Quindi i 4 tab sono Home, Preventivi, Fatture, Altro (Clienti spostato in Altro).
- **"Altro"** apre un menu: profilo/piano, Strumenti (**Clienti**, Catalogo, Template, Scadenze), Account (Impostazioni, Abbonamento, Cestino), Esci.
- Su **Fatture**: due pulsanti **in cima** → "Nuova fattura" (pieno navy) + "Da preventivo" (contorno).
- Lista **Clienti**: pulsante "Nuovo cliente" in alto.
- ⚠️ NOTA per Code: la prima implementazione (commit fase 1) ha usato erroneamente "+" flottante + Clienti come tab (seguendo una versione vecchia di questo file). Va CORRETTA come sopra (fonte di verità = mockup `home_browser.html`/`m_altro.html`).

## B. Filtri di stato (liste Preventivi e Fatture)
- Preventivi: Tutti / Bozze / In attesa / Accettati / Rifiutati. Fatture: Tutte / Bozze / Inviate / Pagate / Annullate.
- **UNA sola riga**, NON scorrevole, NON su due righe.
- Stile: **testo semplice con spazi UGUALI** tra le voci (space-between); voce **attiva = navy + sottolineatura** (NON pillola piena). Tutte le voci visibili senza tagli.
- "Ordina" presente nelle liste (Più recenti / Scadenza / Importo).
- (Desktop) Filtri di stato aggiunti anche a Fatture — già implementato da Code.

## C. Date nelle liste
- **Data contestuale allo stato** (già implementato da Code, mobile+desktop): accettato → "Accettato il…"; in scadenza → "Scade tra N g" (rosso); bozza → "Modificato/a il…"; fattura pagata → "Pagata il…"; rifiutato/annullato → "Rifiutato/Annullata il…".
- Badge "Modificato/a" resta separato dalla data.
- Un preventivo modificato dopo l'invio resta tra gli "In attesa" (stato sent/viewed invariato).

## D. Stile visivo (eleganza)
- **Schede bianche con OMBRA morbida** (no bordi marcati). NIENTE fondi **azzurro/grigio** decorativi.
- **Colore SOLO dove indica significato**: stati (pillole/testo colorato), avvisi (banner). Iniziali/avatar in neutro caldo (NON azzurro).
- **Nuovo preventivo** e **Nuova fattura**: ombre **più marcate** (tante schede da distinguere bene).
- Direzione "editoriale/hairline" (righe senza schede, stato a pallino, etichette maiuscoletto ovunque): **RIFIUTATA** — toglie chiarezza. Si mantiene lo stile a schede.
- Tipografia: font Inter; scritte più piccole **alzate** (11→12, 12→13 px); icone Tabler outline.

## E. Schermate creazione/dettaglio
- **Nuovo preventivo / Nuova fattura**: schede Cliente · Voci · Altre opzioni (collassabile) · Riepilogo; azioni "Salva bozza" + "Invia al cliente". Nuova fattura ha Numero + Data e "Totale da pagare".
- **Dettaglio preventivo/fattura**: azioni **Invia · Condividi · Anteprima** (NON un generico "PDF"). "Salva/stampa PDF" nel menu ⋮.
- **PDF/email**: l'email manda il LINK pubblico, **niente allegato PDF** (l'allegato non rispettava il template). "Anteprima" e "Salva/stampa PDF" invece esistono e rispettano il template (`buildPdfHtml`).
- **Template**: 4 preset (Classico, Bold, Tecnico, Elegante). Personalizzazione reale: Colore accento, Font, Posizione logo, Mostra logo, Watermark Carta Canta, Note legali, + Anteprima/Salva. (Mockup corretto il 13 giu — prima mancavano font/posizione logo/watermark e mostrava solo 2 preset.)

## E-ter. Descrizione voce — textarea auto-grow (anti-regressione)
- Il campo **Descrizione** in `VociTable.tsx` è un **`<textarea>`** con auto-crescita (rows=1, cresce col contenuto; niente scroll interno; niente altezza fissa). Sia desktop che mobile.
- **NON riportare** il campo a `<Input>` (input a riga singola): una descrizione lunga (es. "Installazione caldaia a condensazione con collaudo e messa in servizio inclusi") verrebbe troncata e non leggibile durante la compilazione.
- Il mic (VoiceInput) rimane accanto, allineato in alto (`items-start`).

## F. Dati cliente
- **P.IVA / Codice Fiscale = UN UNICO campo** "P.IVA / Codice Fiscale" con rilevamento automatico (11 cifre = P.IVA, 16 caratteri = CF), come su desktop. **Adottare in OGNI interfaccia mobile** che raccoglie dati fiscali.
- Cliente: serve almeno **email o telefono** (obbligatorio per inviare).
- **Ordine campi indirizzo: Città → Provincia → CAP** (dall'alto verso il basso / da sinistra verso destra), in OGNI schermata che li chiede, sia **mobile sia desktop**. ✅ Applicato in `ClientForm.tsx`, `impostazioni/tabs/generali.tsx`, `onboarding/page.tsx`.
- **Autocompletamento indirizzo già esistente** (hook `useComuneLookup`, mobile+desktop): CAP a 5 cifre → riempie città+provincia; città → riempie CAP+provincia. Mantenere.
- Tolta dalla scheda cliente la frase d'aiuto "P.IVA: 11 cifre · CF: 16 caratteri…" (non importante).

## G. Logo / brand
- **Logo definito** — file in `carta-canta/branding/` (varianti compatte, orizzontali, centrate, light/dark).
- Colori brand: navy **`#1a1a2e`**, oro **`#c9a44c`** (accento; variante scura `#b08d3e`), crema **`#f3ede0`**, grigio testo `#6b6a73`.
- Wordmark **serif Georgia** "Carta **Canta**" (con "Canta" in oro); icona = quadrato arrotondato navy con due archi a "C" concentrici (oro esterno + crema interno); tagline "il tuo ufficio in tasca".
- **Pagina di Accesso**: usa il logo centrato (`brand-extended-centered`). ✅ inserito nel mockup.
- DA VALUTARE con Eli: introdurre l'**oro `#c9a44c`** come accento in tutta l'app (oggi gli accenti sono navy).

## E-bis. Piani / abbonamento
- **NIENTE piano Lifetime / una-tantum** nell'UI: rimosso dalla vendita (FIX-28, "piano non più venduto"). Non mostrarlo. Piani offerti: Free, Pro (mensile/annuale). (Team è nascosto.)

---

## BUG / DA SISTEMARE (app reale)
- ✅ **[BUG-MOB-1] RISOLTO** (verificato da Eli nel browser, 13 giu 2026). Causa: Radix Dialog `modal` → `pointer-events:none` sul body → la tendina portata su `document.body` era visibile ma non cliccabile. Fix: `pointerEvents:'auto'` inline sull'`<ul>` portale (+ `data-dropdown-portal`/`onPointerDownOutside` per il dismiss). Funziona.
- 🟡 **[BUG-MOB-1] Fix 2° tentativo — da verificare nel browser** (sessione FIX-POPUP-CLICK-2, 13 giugno 2026): causa reale confermata = Radix Dialog (modal=true) chiama `disableBodyPointerEvents()` che imposta `document.body.style.pointerEvents = 'none'` sul body. La tendina portata su `document.body` eredita `pointer-events: none` → visibile (z-index 9999) ma NON cliccabile. Il fix precedente (`onPointerDownOutside`+`data-dropdown-portal`) bloccava solo il dismiss, non ripristinava il click. Fix 2: `pointerEvents: 'auto'` aggiunto inline sull'`<ul>` portale (sovrascrive l'ereditato `none` dal body) in `SendEmailDialog.tsx` (`ClientSearchInput`) e `ClientAutocomplete.tsx`. Il `data-dropdown-portal` + `onPointerDownOutside` rimangono per impedire il dismiss del dialog al click. **Da verificare nel browser: clicco un suggerimento → cliente selezionato; scroll ok; dialog si chiude ancora con Esc/click fuori.**

## IMPLEMENTAZIONE — STATO FASI

| Fase | Descrizione | Stato |
|---|---|---|
| **FASE 0** | Design tokens (palette, ombre, raggi, font Inter) in `globals.css` + layout.tsx | ✅ commit `feat(mobile): design tokens` |
| **FASE 1** | Bottom nav + pagina Altro | ✅ commit `feat(mobile): bottom nav + pagina Altro` |
| **FASE 2** | Liste preventivi e fatture | ✅ commit `feat(mobile): FASE 2 — liste preventivi e fatture` |
| FASE 3 | Form nuovo preventivo / nuova fattura | ✅ commit `feat(mobile): form nuovo preventivo e nuova fattura` |
| FASE 4 | Dettaglio preventivo / fattura | ✅ commit `feat(mobile): dettaglio preventivo e fattura` (G4: ⋮ header, banner stato pre-azioni, riepilogo compatto voci+totale, RegisterManualSendButton in Altre azioni; fattura: secondary row Modifica+Segna pagata, SegnaPagataButton, id ancoraggi) |
| FASE 5 | Clienti + Catalogo | ✅ commit `feat(mobile): clienti e catalogo` |
| FASE 6 | Template, Impostazioni, Abbonamento, Cestino, Login | ✅ commit `feat(mobile): template, impostazioni, abbonamento, cestino, login` — rifiniture G6: commit `fix(mobile): G6 — template Classico no-Pro label + P.IVA spostata in tab Fiscale` |
| FASE 7 | Pagina pubblica | ✅ commit `feat(mobile): pagina pubblica con firma e motivo` |

## G-QA — CORREZIONI POST-IMPLEMENTAZIONE (14 giugno 2026)

Sessione QA mobile: rilevati scostamenti dai mockup e corretti in ordine di gravità.

| ID | Descrizione | File | Commit |
|---|---|---|---|
| **G-QA1.1** | Impostazioni: tab orizzontali su mobile (flex-col al posto del layout sidebar desktop) | `impostazioni/page.tsx` | `fix(mobile): G-QA1+QA2` |
| **G-QA1.2** | Abbonamento Pro: card con dettagli piano (feature list, fatturazione, Gestisci abbonamento) | `abbonamento/page.tsx` | `fix(mobile): G-QA1+QA2` |
| **G-QA2.1** | Clienti: righe lista tappabili su tutta la riga (`active:bg-muted/50 cursor-pointer`) | `clienti/page.tsx` | `fix(mobile): G-QA1+QA2` |
| **G-QA2.2** | Scheda cliente: sola lettura su mobile; "Modifica" (`?edit=1`) mostra il form; rimosso chip "Preventivo" | `clienti/[id]/page.tsx` | `fix(mobile): G-QA1+QA2` |
| **G-QA2.3** | Cestino: stato vuoto invece di spinner infinito (setLoading(false) nei return early) | `cestino/page.tsx` | `fix(mobile): G-QA1+QA2` |
| **G-QA3.1** | Rimossa Label "Cliente" ridondante in PreventivoForm; rimosso h2 "Voci" in VociTable | `PreventivoForm.tsx`, `VociTable.tsx` | `fix(mobile): G-QA3` |
| **G-QA3.2** | Header mobile compatto (✕ · Titolo) su preventivi/nuovo e fatture/nuovo | `preventivi/nuovo/page.tsx`, `fatture/nuovo/page.tsx` | `fix(mobile): G-QA3` |
| **G-QA3.3** | FiscalSummary: rimosso wrapper `flex justify-end` — a piena larghezza su mobile | `FiscalSummary.tsx` | `fix(mobile): G-QA3` |
| **G-QA3.4** | Sconto globale spostato dentro FiscalSummary via `discountSlot` prop; hidden inputs quando chiuso | `PreventivoForm.tsx`, `FiscalSummary.tsx` | `fix(mobile): G-QA3` |
| **G-QA3.5** | Banner "Accettato e firmato dal cliente" completo; ConvertiFatturaButton visibile su mobile | `preventivi/[id]/page.tsx` | `fix(mobile): G-QA3` |
| **G-QA3.6** | Catalogo: MoreVertical in header; CatalogItemRow: sottotitolo mobile con unità · IVA% | `catalogo/page.tsx`, `CatalogItemRow.tsx` | `fix(mobile): G-QA3` |
| **G-QA3.7** | Wording: "Da catalogo", "Salva", badge numero scadenze in Altro | `CatalogPicker.tsx`, `template/page.tsx`, `altro/page.tsx` | `fix(mobile): G-QA3` |

## G-QA-R — Re-test giro 2 (15 giugno 2026)

| ID | Descrizione | Fix | Commit |
|---|---|---|---|
| **QA-R1** | Menu ⋮ bloccava l'app (freeze): su lista (`DropdownMenu modal=false`); su dettaglio (ancora scroll `#mobile-altre-azioni` → rimosso, sostituito con Pencil→`?edit=1`) | `DocumentRowActions.tsx`, `preventivi/[id]/page.tsx`, `fatture/[id]/page.tsx` | `fix(mobile): G-QA-R` |
| **QA-R2** | "Condividi" icona senza etichetta accanto a "Anteprima" enorme | `ShareButton.tsx` (label sempre visibile + `triggerStyle` prop); `preventivi/[id]` e `fatture/[id]` (passato `chipBase`) | `fix(mobile): G-QA-R` |
| **QA-R3** | Dettaglio troppo lungo: form editabile sempre visibile anche su mobile non-modificabile | `preventivi/[id]` e `fatture/[id]`: form `hidden lg:block` di default; Pencil in header → `?edit=1` mostra il form; fattura accepted/rejected → niente form su mobile | `fix(mobile): G-QA-R` |
| **QA-R4** | "Ordina:" appariva vuoto su mobile | `SortSelect.tsx`: larghezza fissa `w-36` (era `w-full`, collassava in flex); label esplicita con `useState` invece di Radix `SelectValue` | `fix(mobile): G-QA-R` |

## G-QA-R2 — Fix simmetria chip Condividi/Anteprima (15 giugno 2026)

| ID | Descrizione | Fix | Commit |
|---|---|---|---|
| **QA-R2b** | Condividi (Button shadcn) = 28px, Anteprima (`<a>`) = 41px — altezze diverse | `chipBase` in `preventivi/[id]` e `fatture/[id]`: aggiunto `height: 'auto'` — sovrascrive `h-7` di Tailwind su Button shadcn; nessun effetto su `<a>` (già auto) | `fix(mobile): simmetria chip Condividi/Anteprima` |

**Causa tecnica:** `<Button size="sm">` applica `h-7` (28px) via Tailwind. Il `chipBase` inline override padding ma non height (height non era dichiarato). `<a>` non ha vincoli altezza → cresce a ~41px con padding 10px. Fix: `height: 'auto'` in inline style sovrascrive il class-based height.

**Da verificare nel browser (Eli):**
- QA-R1: ⋮ nelle liste Preventivi/Fatture → apre menu senza freeze; dettaglio mobile → Pencil funziona
- QA-R2: "Condividi" e "Anteprima" stessa dimensione chip (ri-verificare post fix QA-R2b)
- QA-R3: Dettaglio preventivo/fattura → form non visibile; Pencil nel header → `?edit=1` mostra il form
- QA-R4: "Ordina: Meno recenti" visibile nella riga sotto i tab

**Da verificare nel browser (Eli — G-QA precedenti):**
- G-QA1.1: Impostazioni → tab orizzontali su mobile
- G-QA1.2: Abbonamento → card Pro con dettagli
- G-QA2.1: Clienti → tap su tutta la riga naviga al dettaglio
- G-QA2.2: Scheda cliente → sola lettura; "Modifica" apre il form (URL `?edit=1`)
- G-QA2.3: Cestino → stato vuoto se nessun documento nel cestino
- G-QA3.1-7: form/wording/UI (verificare visivamente)

## HOME REDESIGN — Implementazione (15 giugno 2026)

Ridisegno completo della Home (dashboard) mobile secondo la spec BLOCCATA in `REVISIONE_UI.md`.

### File toccati
```
app/(app)/_components/AppShell.tsx              [header → hidden lg:flex — rimossa barra globale da tutti i mobile]
app/(app)/dashboard/page.tsx                    [redesign completo mobile + separazione netta mobile/desktop]
app/(app)/dashboard/_components/MobileScadenzaCard.tsx  [nuovo client component — card scadenza mobile]
app/(app)/dashboard/_components/MobileAvatarMenu.tsx    [nuovo client component — avatar dropdown mobile]
```

### Cosa implementato
1. **AppShell header nascosto su mobile** (`hidden lg:flex`): rimuove la doppia intestazione globale su TUTTE le pagine mobile (intenzionale).
2. **Brand strip** (`lg:hidden`): SVG inline da mockup v8 — icona + "Carta **Canta**" + tagline oro #b08d3e — centrata, padding 6px 15px, sfondo bianco con bordo sottile.
3. **Home header** (`lg:hidden`): logo azienda 42×42 (img se `logo_url` presente, altrimenti placeholder tratteggiato) + "Ciao, [nome]" 18px/600 + ragione sociale 12px #55534b + avatar navy 38×38 che apre `MobileAvatarMenu`.
4. **Sfondo #fafafa** su mobile, `bg-background` su desktop.
5. **Banner quota Free** (mobile): card bianca con bordo-left 3px oro + Crown icon + "X/8 preventivi gratuiti" + "Passa a Pro →" (NO arancione). I banner bloccati (rosso) mostrati su entrambi.
6. **Card scadenza** (`MobileScadenzaCard`): header urgenza "Scade domani/oggi/Scade il X" in oro #b08d3e; riga numero·cliente + importo 18px/600; badge viola "Modificato" se serve; azioni "Sollecita per mail" (navy, flex-1) + WhatsApp + Chiama (se telefono); hint testuale; tutta la card è tappabile (naviga a /preventivi/[id]).
7. **"Altri N in scadenza →"** (`lg:hidden`): riga card bianca/shadow con triangolo arancio + testo + chevron → /preventivi/scadenze. Visibile solo se `allPendingCount > 1`.
8. **KPI grid** (`lg:hidden`): 2 colonne, card bianche con shadow `SH`, border-radius 12px.
9. **Activity feed** (`lg:hidden`): badge sfondo tenue #d8e8fb/#d4efe2/#e8e8e8 + testo #2b2b2b; prefisso "Prev" sui preventivi (⚠️ SOLO in questa schermata — non altrove).
10. **Desktop invariato**: `hidden lg:block` con p-6 max-w-5xl, tutte le card/KPI/chart come prima.

### Dati aggiunti
- `logo_url` aggiunto alla query workspace (usato nel mobile header).
- `expiresAt` aggiunto a `pendingDoc` (da `oldestPendingRaw.expires_at`).
- `allPendingCount` calcolato da `docs` (per il row "Altri N").
- `expiresLabel` calcolato server-side: "Scade oggi / domani / Scade il X / In attesa / Scaduto".
- `fullName` fallback → `workspaceName` (non più stringa "Ciao").

### Da verificare nel browser (Eli)
- Brand strip visibile in cima, centrata, proporzionata
- Home header: logo azienda (o placeholder tratteggiato) + "Ciao, [nome]" + nome workspace + avatar navy
- Avatar apre il dropdown (Impostazioni / Abbonamento / Esci)
- Banner quota Free (oro) o nessun banner (Pro)
- Card scadenza visibile se ci sono preventivi in attesa
- "Sollecita per mail" funziona (invia reminder)
- "Altri N" row visibile se >1 preventivo in attesa
- KPI grid: sfondo bianco con ombra (non beige)
- Activity feed: prefisso "Prev" sui preventivi + badge tenui
- Desktop: layout invariato (4 KPI + chart + activity card)
- AppShell header assente su mobile su TUTTE le pagine (non solo Home)

## HOME RIFINITURE — 5 fix (16 giugno 2026)

| # | Fix | File |
|---|---|---|
| 1 | Logo placeholder rimosso: se `workspace.logo_url` è null → niente riquadro tratteggiato (solo saluto) | `dashboard/page.tsx` |
| 2 | Icona WhatsApp: SVG inline del logo vero (non `MessageCircle`); rimosso import `MessageCircle` | `MobileScadenzaCard.tsx` |
| 3 | "Vedi tutti" rimosso dall'header Attività recente mobile; il link restava nel solo desktop | `dashboard/page.tsx` |
| 4 | Iniziali avatar = `nome[0] + cognome[0]` da `user_metadata`; fallback full_name poi ragione sociale | `dashboard/page.tsx` |
| 5 | `MobileAvatarMenu`: rimossa prop `fullName` (e riga nome nel dropdown — resta solo mail) | `MobileAvatarMenu.tsx`, `dashboard/page.tsx` |

## FEATURE PIANIFICATE (futuro — vedi BACKLOG_MIGLIORAMENTI.md)
- Agenda appuntamenti settimanali (sync Google Calendar, data nel preventivo).
- Centro notifiche in-app (campanello Home).
