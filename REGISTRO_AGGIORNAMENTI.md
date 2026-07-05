# 📒 REGISTRO AGGIORNAMENTI — Carta Canta

> **Chi tiene questo file:** **Code Mobile** (l'assistente Claude che lavora sulla parte **mobile** dell'app, in coppia con Eli).
> **Cosa contiene:** TUTTO quello che ho fatto io — modifiche apportate, bug trovati/risolti, feedback ricevuti da Eli e come li ho recepiti, con l'esito di ogni intervento.
> **Regola:** ordino per data, dalla più recente in cima. A fine di ogni intervento aggiungo qui la voce, poi `git push` su `origin/master` (→ deploy Vercel).
> **Legenda esito:** ✅ verificato in browser da Eli · 🟡 fix applicato (tsc+build+test verdi, da verificare da Eli) · ⏳ in corso · ❌ aperto.
>
> Nota: questo è il changelog "operativo" di Code Mobile. Le **decisioni** stanno in `DECISIONI_E_FEEDBACK.md`/`DECISIONI_UI_CONSOLIDATE.md`, la **revisione UI** in `REVISIONE_UI.md`, le **regole/handoff** in `CLAUDE.md`. Qui c'è il "cosa ho cambiato e perché".

---

## 5 luglio 2026 — Blocco 1 del pacchetto feature: BILANCIO (Pro) 🟡

### Bilancio — Entrate − Uscite = Utile, mese per mese (mockup "ciclo incasso" §1, approvato)
- **Dove:** Altro › Strumenti › **Bilancio** (nuova voce; per i Free ha l'etichetta PRO e apre la schermata col lucchetto + "Passa a Pro").
- **Schermata:** selettore mese ‹ › · 3 card **Entrate / Uscite / Utile** · grafico a barre **ultimi 6 mesi** (entrate navy, uscite grigie) · lista **spese del mese** con categoria+data+cestino · bottone **"+ Aggiungi spesa"**.
- **Entrate automatiche** (criterio di cassa, come deciso): fatture segnate Pagata + acconti incassati, nel mese dell'incasso. Le fatture già Pagata di prima entrano subito (retro-compat nella migration).
- **Nuova spesa in 10 secondi:** importo (formato italiano) · categoria a tendina (Materiali, Carburante, Attrezzatura, Tasse e contributi, Altro **+ "Altra categoria…"** libera) · data (oggi di default) · descrizione **dettabile col microfono**. Conferma col toast standard (10 s + ✕). Eliminazione con conferma.
- **⚠️ Migration 038 da applicare su Supabase** (testo in chat): tabella `expenses` + colonne pagamento (`payment_status`, `paid_at`, `paid_amount`, `due_date`, canali IBAN/PayPal/Satispay/note) + colonne acconto — copre già i prossimi blocchi Pagamenti e Acconti, così è UNA sola migration per tutto il ciclo incasso. La pagina è tollerante: funziona (senza spese) anche prima della migration.
- Test: tsc verde · build verde · 178/178 verdi. Da verificare in browser da Eli.

---

## 5 luglio 2026 — Velocizzazione navigazione, fasi 1+2 (Code Mobile)

### `419a4a3` — perf fase 2: sessione e workspace condivisi per richiesta 🟡
- **Causa della lentezza:** ad ogni navigazione layout E pagina rifacevano OGNUNO il giro `getUser()` → workspace per owner → fallback membro Team (il layout anche una 4ª query per il flag tutorial): ~5-6 round-trip Supabase **in serie** prima ancora di chiedere i dati veri della pagina.
- **Fix:** nuovo `lib/workspace-context.ts` — `getSessionWorkspace()` con `React.cache()`: utente + workspace caricati **una sola volta per richiesta** e condivisi da layout e pagina. Il flag tutorial arriva nello stesso select (riga intera).
- **20 pagine convertite** (Dashboard, Preventivi ×4, Fatture ×4, Clienti ×2, Catalogo, Altro, Template ×4, Abbonamento, Impostazioni, Referral) + layout: −622 righe di codice duplicato. Guard e redirect originali invariati.
- Test: tsc verde · build verde · 178/178 verdi. Da sentire "a mano" da Eli: le pagine devono aprirsi visibilmente più svelte.

### `6a34dc9` — perf fase 1: skeleton istantanei + cache di navigazione 🟡
- **Skeleton immediato** su Dashboard, Preventivi (lista+dettaglio), Fatture (lista+dettaglio), Clienti, Catalogo, Altro: appena tocchi una voce compare subito la struttura della pagina (fascia bianca + card shimmer) invece dello schermo fermo.
- **Router cache 30s** (`staleTimes`): tornare su una pagina appena visitata è istantaneo (poi si aggiorna da sola in background).

---

## 5 luglio 2026 — Pacchetto V2 approvato da Eli (Code Mobile)

### `322acef` + `7944c6a` — V2: toast salvataggio, bottone unico "Invia al cliente", tipografia, pastelli, prezzo, card cliente 🟡
- **Decisioni registrate in `DECISIONI_E_FEEDBACK.md`** (sezione "UI mobile — feedback Eli 4–5 lug"): Duplica/Elimina SOLO da ⋮ lista · una sola dicitura "Invia al cliente" · errori form NON pastello · grigi invariati · scala tipografica unica · NO punto 6 mappa.
- **Toast salvataggio Impostazioni** (Generale/Fiscale/Notifiche): conferma in basso 10s+✕ — prima l'Alert era in cima al tab, fuori schermo.
- **Bottone unico "Invia al cliente"** in ogni stato (preventivi+fatture, mobile+desktop): apre il pop-up canali; l'icona **Email apre il popup email** (dialog montato per ogni stato senza trigger, `hideTrigger`). Overlay ShareButton in portal; apertura via evento (footer bozza, "reinvia?") e via `?send=1` dopo la creazione. Eliminati "Condividi", "Rinvia al cliente", chip "Invia" fattura, `OpenSendDialogButton`.
- **Abbonamento mobile**: `MobileProCard` con selettore Mensile €19 / Annuale €182 — il bottone addebita il prezzo mostrato (prima: card €182/anno ma checkout mensile — BUG PREZZO).
- **Card Cliente nel dettaglio**: se il cliente non è in rubrica → card statica + "Non è in rubrica · Aggiungilo →" (prima link `#` morto).
- **CTA**: "Scopri Pro"/"Scopri i piani Pro" → "Passa a Pro".
- **Scala tipografica**: titoli pagina 20/600 uniformi (Altro/Catalogo/Clienti erano 22; Preventivi peso 500); mezzi pixel eliminati (13.5→14, 12.5→13, 11.5→12, 10.5→11; TemplatePreview esclusa).
- **Pastelli**: banner/chip/avvisi dai Tailwind saturi ai pastelli di sistema su ~20 superfici; **errori form lasciati rossi accesi** (decisione Eli).
- **In attesa di ok Eli**: punto 22 (wording pagina pubblica).

### `e1f14bf` — Punti mappa 5, 7–16, 18–21 (tutti approvati da Eli) 🟡
- "Vai all'abbonamento" (tab Piano) · ✕ per uscire dalla modifica fattura · KPI Home mobile tappabili · deep-link ATECO corretto · "Nuovo template" Free → /abbonamento · "Usa come modello" mantiene sempre il titolo · KPI Fatturato → ?status=accepted · chip Modifica cliente scrolla al form · rimosso doppione "Nuovo preventivo" scheda cliente · ricerca Catalogo su desktop · template "In uso" ovunque + card Default e bottoni editor allineati al mobile · back Cestino coerente · **canale Email scadenze = sollecito in-app anche per le fatture** (template email esteso con docType) · onboarding "Salta per ora" · WhatsApp pagina pubblica desktop ora visibile (passato il telefono workspace).
- **Punto 17 chiuso**: il tab Notifiche resta a salvataggio automatico (con toast di conferma) — deciso con Eli.

---

## 4 luglio 2026 — Feedback batch: caret, riordino, scrollbar font, Invia su bozza + audit Invia/Condividi (Code Mobile)

### `8c14485` — 5 feedback: caret centrato, niente salto su Preventivi, scrollbar Font, "Invia al cliente" su bozza, popup email via evento 🟡
- **"Le ultime modifiche non le vedo applicate":** verificato — email bloccata da rubrica, toast persistente, anteprima mobile scalata e documento=template **sono tutte su master** (`a150b3a`), così come il fix caret (`8ee31b1`). Se in produzione non si vedono è il **deploy Vercel/cache browser**: controllare su Vercel che l'ultimo deploy corrisponda al commit e fare hard-refresh.
- **Caret ricerca cliente:** irrobustito — `ClientAutocomplete` ora usa un `<input>` nudo (niente classi shadcn h-8/py-1 che potevano disallineare il cursore), `height=lineHeight=20px`.
- **Riordino visibile su /preventivi (~1s dopo l'apertura):** causa = `SortSelect` ripristinava la preferenza da sessionStorage DOPO il primo paint (`router.replace`). Ora la preferenza è in un **cookie di sessione** (`cc_sort_preventivi` / `cc_sort_fatture`) letto **server-side**: la lista arriva già nell'ordine finale al primo render.
- **Scrollbar sparita col menu Font (Template):** il Select Radix blocca lo scroll (react-remove-scroll). Font → `DropdownMenu modal={false}` (stesso pattern di "Ordina"), mobile + desktop.
- **Bozza in modifica: solo "Salva bozza":** aggiunto bottone navy **"Invia al cliente"** accanto (valida → salva → apre il popup email). Vale anche per le bozze fattura.
- **Bug latente trovato nell'audit:** i bottoni che aprivano il popup email via `?send=1` sulla **stessa pagina** (chip "Invia" mobile fattura, dialog "reinvia?") non funzionavano: il dialog già montato legge `initialOpen` solo al mount. Ora si apre via evento `cartacanta:open-send-dialog` (nuovo `OpenSendDialogButton`); `?send=1` resta per gli arrivi da altre pagine (es. dopo la creazione). `SendEmailDialogController` ora aggiorna `hasVoci` in tempo reale dal form.

### `82cc48f` — Audit Invia/Condividi: bozza mobile apriva il popup sbagliato 🟡
- **Trovato dall'audit chiesto da Eli:** sul dettaglio preventivo mobile in BOZZA il chip navy diceva **"Invia al cliente"** ma apriva il popup **Condividi**. Ora apre il **popup email**. Regola applicata ovunque: *"Invia al cliente" = popup email (oggetto/destinatario/testo) · "Condividi" = popup canali (WhatsApp/link/altre app)*.
- **Aperto per Eli:** sullo SCADUTO il chip "Rinvia al cliente" apre il popup Condividi (con reset scadenza) — va bene così o deve aprire l'email?

### Feedback Eli — numero assegnato nel pop-up di salvataggio/invio 🟡
- **Richiesta:** quando si salva/invia un NUOVO documento, il pop-up deve mostrare **ben visibile il numero assegnato** e restare aperto finché non lo si chiude.
- **Fatto:** (1) `createDocumentAction`/`createInvoiceAction` passano il numero nel redirect (`?bozza=001/2026`); (2) `DraftSavedBanner` riscritto: riquadro "NUMERO ASSEGNATO — 001/2026" in grande, **niente auto-chiusura** (prima 2s), bottone Chiudi + tap sullo sfondo; (3) pop-up "Bozza salvata" ora anche su **Nuova fattura** (prima nessun feedback); (4) pannello di successo del popup email: riquadro col numero del documento (già persistente fino alla ✕).

### Feedback Eli (invio, cronologia, anteprima) 🟡
- **Pop-up invio spariva subito / banner fisso:** causa del pop-up che spariva = `router.refresh()` immediato dopo l'invio → sulla bozza il dialog (montato solo per status draft) veniva smontato dal re-render. Ora: **pop-up di successo resta finché non lo chiudi** (refresh rimandato alla chiusura); **banner in basso (toast) si chiude da solo dopo 10 secondi** (prima restava per sempre), con ✕ per chiuderlo prima.
- **Cronologia: manuale vs cliente.** "Accettato e firmato" compariva anche per la segnatura manuale. Ora: firma dalla pagina pubblica → *"Accettato e firmato dal cliente"*; accettato dalla pagina pubblica senza firma → *"Accettato dal cliente"*; segnato a mano → *"Segnato come accettato manualmente"* (criterio: la pagina pubblica salva sempre signer_name/accepted_ip, il PATCH manuale no). Stesso aggiornamento su banner verde + timeline desktop. Rifiuto: *"Rifiutato dal cliente"* solo se c'è il motivo dalla pagina pubblica, altrimenti *"Rifiutato"* neutro (il rifiuto manuale non salva campi distintivi — per distinguerlo al 100% servirebbe una migration, proposta a Eli).
- **Anteprima ancora grande:** il meta viewport width=794 era deployato ma alcuni browser/WebView lo ignorano. Aggiunto fallback garantito in `preparePrintHtml`: se la larghezza visibile < 794px, il foglio viene scalato con `transform: scale()` (rimosso in stampa via beforeprint + CSS).

### Feedback Eli (Altro + Cestino) 🟡
- **"Completa il profilo" in Altro non dice cosa manca:** la riga ora è una card che elenca le **voci mancanti** (Dati attività / Telefono / Logo / ATECO); tap sulla voce = apre il punto esatto delle Impostazioni (tab + ancora), come la card in Home.
- **Scheda profilo in Altro → Impostazioni:** è voluto (lì si modificano nome/dati attività); ora punta esplicitamente al tab Generale.
- **Cestino: titolo documento visibile** (mobile): sotto "numero · cliente" compare il titolo del lavoro — nel cestino non si può aprire il documento, serve per riconoscerlo. Su desktop c'era già.



### `a8d31c3` — Pre-fix: tab Impostazioni underline + deep-link checklist profilo 🟡
- Tab attivo senza riquadro (solo underline, come mockup); `?tab=` + ancore (#telefono/#logo/#ateco): i 4 passi della checklist profilo aprono il punto esatto.

### `5da5891` — BLOCCO 1 Solleciti: Preventivi in scadenza + Fatture da incassare a mockup 🟡
- Card condivisa `ScadenzaSollecitoCard`: pillola scadenza contornata (Scaduto #b05656 / In scadenza #b0863e / Aperto #3f6fb0) = bordo sinistro card; StatusBadge + Modificato; cliente·numero + importo; sezione SOLLECITA (Chiama tel: / WhatsApp wa.me precompilato / Email sendReminderAction o mailto per fatture). Card riepilogo in cima (IN ATTESA DI RISPOSTA / TOTALE DA INCASSARE). Solo sollecito manuale, cron intatti. Scelte: "In scadenza" = ≤7gg; esclusi status expired (query sent/viewed da specifica).

### `7ba3afd` — BLOCCO 2 Template: lista accordion + editor a mockup + gating Free/Pro 🟡
- Lista mobile: tap = anteprima grande (documento reale) + Usa/Modifica, una sola aperta; riga chiusa senza tasti. Editor: Nome → Anteprima reale → Stile (lucchetti Pro) → Personalizzazione → "Salva" + "Salva e imposta come predefinito". Gating dal riquadro mockup: **nota legale al Free**, **colore accento solo Pro**, filigrana/font/posizione logo Pro, 1 template Free. TemplatePreview + pdf/template.ts: SOLO i 2 ritocchi autorizzati (numero moderato, box TOTALE Bold più piccolo — mockup sez. 7 = screenshot di riferimento).
- Dubbi per Eli: (a) colore default Classico resta #374151 (mockup usa navy #1a1a2e); (b) su Free un template con stile Pro resta selezionabile ("Usa questo") — solo lucchetto visivo; (c) "Elimina template" tenuto su mobile anche se non nel mockup.

## 3 luglio 2026 — Fatture, allineamento Voci, nuovo modello Template, Telefono (Code Mobile)

### `32f7ac9` — Promemoria "Completa il tuo profilo" (Home + Altro) 🟡
- **Decisione ripresa:** flusso "Completa il profilo" già deciso in `SPEC_NUOVE_FEATURE.md` (invito post-login, dismissibile, progresso "1 di 3") — adattato: voci basate sui dati OGGI essenziali (l'AI import è ancora disabilitato) + **Telefono** (esempio di Eli: senza, il cliente non può contattarti).
- **Fatto:**
  - **Home:** card "Completa il tuo profilo — N di 4 fatto" con barra oro e 4 voci calcolate dai dati reali (Dati attività/ragione sociale · Telefono · Logo · Codice ATECO); le voci mancanti linkano alle Impostazioni, le fatte hanno la spunta verde. **✕ = nascosta 3 giorni** (localStorage), sparisce per sempre a 4/4.
  - **Altro:** riga "Completa il profilo" con badge oro **N/4** sotto la scheda profilo, visibile solo finché incompleto.
- **File:** `dashboard/_components/CompleteProfileCard.tsx` (nuovo), `dashboard/page.tsx`, `altro/page.tsx`.
- **Nota:** integrato commit di Eli `ba9bf19` (aggiornamento mockup: dettaglio, Cambia preventivo, solleciti, template completo — nuovo file `Carta_Canta_mockup_template.html`).

### `fc2c5f2` — Onboarding: "Completa più tardi" funzionante + logo + coriandoli brand 🟡
- **Feedback Eli:** (1) "Completa più tardi" non funziona; (2) coriandoli della pagina "Inizia!" coi colori del logo; (3) logo/colori app nell'onboarding.
- **Causa (1):** il bottone portava a /dashboard ma il layout dell'app rimanda a /onboarding chiunque non abbia la ragione sociale (che si inserisce proprio al passo 1) → rimbalzo immediato.
- **Fatto:** (1) cookie `cc_onboarding_skip` (30gg) impostato dal bottone e rispettato dal gate del layout → si entra nell'app e si completa dopo dalle Impostazioni. (2) Coriandoli con la palette del logo (navy `#1a1a2e`, oro `#c9a44c`/`#b08d3e`, crema `#f3ede0`). (3) **Icona logo CC** (navy+oro) in testa a tutte le pagine dell'onboarding.
- **File:** `app/onboarding/page.tsx`, `app/(app)/layout.tsx`.

### ⚠️ AZIONE MANUALE ELI — mail di conferma registrazione nello spam (config Supabase SMTP)
- **AGGIORNAMENTO (fatto da Eli):** Custom SMTP Resend configurato ✅ (sender `noreply@send.cartacanta.app`), template in italiano ✅, test ok (primo indirizzo era "Suppressed" su Resend → sbloccato/testato con altro indirizzo). La mail **arriva ma ancora in spam** → rifiniture in sospeso: (1) verificare header Gmail SPF/DKIM/DMARC=PASS; (2) segnare "Non spam" su 2-3 test; (3) disattivare open/click tracking su Resend per `send.cartacanta.app`; (4) arricchire il template con firma. La reputazione migliora con l'uso.
- **Segnalazione:** la mail di conferma post-registrazione finisce nello spam.
- **Causa:** la invia lo **SMTP integrato di Supabase** (mittente condiviso `mail.app.supabase.io`, reputazione bassa, limite 2-4 email/ora) — nessuna config SMTP nel codice. Le email preventivi invece passano da Resend (`send.cartacanta.app`, SPF/DKIM/DMARC ok).
- **Da fare (dashboard Supabase, ~5 min):** Authentication → Emails → **SMTP Settings** → Custom SMTP con Resend (host `smtp.resend.com`, porta 465, user `resend`, password = RESEND_API_KEY, sender `noreply@send.cartacanta.app`, name `Carta Canta`). Consigliato: template "Confirm signup" in italiano, senza emoji. Test: registrazione con Gmail → inbox.

### `558f8f1` — 🐛 RISOLTO il crash alla registrazione (validatePasswordServer in modulo client) 🟡
- **Sintomo:** ogni registrazione falliva ("Qualcosa è andato storto", poi col guard "Errore imprevisto durante la registrazione").
- **CAUSA TROVATA:** `validatePasswordServer` viveva in `PasswordStrength.tsx` (modulo **'use client'**) ed era chiamata dentro `signupAction`/`resetPasswordAction` (**'use server'**). In Next.js 16, chiamare sul server una funzione importata da un modulo client **lancia un'eccezione** → crash sistematico, subito dopo i controlli campi. (Riguardava anche il **reset password**.)
- **Fix:** regole password spostate in **`lib/password.ts`** (modulo neutro); `PasswordStrength.tsx` le ri-esporta per i client component; `actions.ts` importa da `lib/password`.
- **File:** `lib/password.ts` (nuovo), `components/shared/PasswordStrength.tsx`, `app/(auth)/actions.ts`.
- **Da verificare da Eli:** registrazione con email nuova → deve arrivare alla pagina "Controlla la tua email".

### `1a681db` — Signup: "Qualcosa è andato storto" → guard eccezioni + log ⚠️ (da riprodurre)
- **Feedback Eli:** inserendo una mail in registrazione è comparso "qualcosa è andato storto".
- **Verificato:** quella schermata è l'**error boundary** globale (`app/error.tsx`) — scatta solo per eccezioni NON gestite; tutti gli errori previsti del signup (email già registrata, password debole, rate limit, errore workspace) tornano come testo rosso nel form. Nessun throw evidente nel codice; niente log accessibili da qui.
- **Fatto:** `signupAction` e `resendVerificationEmailAction` ora hanno un **guard globale**: qualsiasi eccezione → errore leggibile nel form + `console.error` (visibile nei log Vercel per la diagnosi).
- **Da Eli:** riprovare la registrazione; se l'errore si ripresenta, ora sarà un messaggio nel form e nei log Vercel ci sarà la causa (`[signupAction] eccezione non gestita`).

### `8049d40` — Copia link su scaduto: conferma esplicita prima di far ripartire la validità 🟡
- **Feedback Eli:** copiando il link di un preventivo scaduto la scadenza ripartiva senza un messaggio chiaro di conferma.
- **Verificato:** vero solo per gli SCADUTI (sugli inviati la copia non tocca la scadenza; sulle bozze c'è già la conferma "Segna come inviato"). La copia chiamava `resendExpiredAction` subito, col toast a cose fatte.
- **Fatto:** ora la copia mostra un **pannello di conferma** ("Fai ripartire" / "Non ora") con i giorni scelti nel select "Nuova scadenza" e l'avviso che senza rinvio il link mostra il preventivo come scaduto. La validità riparte **solo alla conferma**.
- **File:** `ShareButton.tsx`.

### `9d48b43` — Pagina pubblica: info importanti nella card (validità, termini, note, sconto, bollo) 🟡
- **Feedback Eli:** (1) numero preventivo assente sulla pagina pubblica → verificato: il codice è corretto e identico al mockup; su un preventivo **nuovo il numero c'è** — quello vecchio era un documento legacy con `doc_number` null (offerta migration di backfill, in sospeso). (2) mancano info importanti per il cliente (termini, scadenza…).
- **Fatto (oltre il mockup 18, segnato in SCOSTAMENTI):** nella card documento della pagina pubblica mobile aggiunti — **"Valido fino al {data}"** (preventivo) / **"Scadenza pagamento"** (fattura), **"Termini di pagamento"** (per entrambi; rimosso il vecchio box ambra solo-fattura), **Note** visibili al cliente (box grigio), righe **Sconto** (verde, con %) e **Marca da bollo** nel riepilogo quando presenti.
- **File:** `p/[token]/_components/MobilePublicCard.tsx`, `p/[token]/page.tsx`.

### `068b174` — Striscia vuota a destra (scrollbar-gutter) + verifica/fix ordinamento 🟡
- **Feedback Eli:** (1) alcune pagine sembrano spostate a sinistra, con spazio vuoto a destra; (2) verificare gli strumenti "Ordina" di Preventivi e Fatture per ogni opzione.
- **Causa (1):** `scrollbar-gutter: stable` sul `<main>` riservava SEMPRE una striscia per la scrollbar, anche quando è overlay (mobile/Chrome moderno) → contenuto più stretto e a sinistra su TUTTE le pagine. **Fix:** gutter attivo solo da `lg` in su (`.cc-main-gutter`), dove serviva per evitare lo shift.
- **Verifica ordinamento (2):** opzioni = Ultima modifica (updated_at DESC) ✓ · Meno recenti (ASC, default) ✓ · Importo ↓/↑ (total, null in fondo) ✓ · **Scadenza vicina**: sui preventivi OK (pending prima per scadenza crescente); **sulle fatture era sbagliato** (solo ORDER BY expires_at: bozze/pagate mischiate alle non pagate). **Fix:** stesso riordino dei preventivi (in attesa di pagamento prima, per scadenza crescente; poi le altre per ultima modifica) + limit 200. **Fix extra:** la preferenza salvata era **condivisa** tra Preventivi e Fatture (stessa chiave sessionStorage) → ora per-pagina.
- **File:** `globals.css`, `AppShell.tsx`, `fatture/page.tsx`, `SortSelect.tsx`.

### `3fe4020` — Audit dimensioni pagine mobile: rimossi -mx-4/-mt-4 orfani 🟡
- **Feedback Eli:** alcune pagine hanno dimensioni sbagliate / bordi non visibili (screenshot Cestino). Ricontrollare tutte tranne le bloccate.
- **Audit fatto su tutte le pagine (app):** lo stesso bug del Template (`-mx-4` senza `p-4` padre → blocco 32px più largo dello schermo) era replicato in **Cestino**, **Abbonamento** e **Fatture da incassare**; inoltre il `-mt-4` residuo (anche su Template) mangiava il padding safe-area disallineando l'header rispetto alle pagine col pattern pulito (Clienti/Catalogo/Impostazioni/dettagli — verificate OK).
- **Fatto:** rimossi `-mx-4 -mt-4` dai wrapper mobile di Cestino, Abbonamento, Fatture da incassare e `-mt-4` dal Template. Ora tutte le pagine hanno la stessa larghezza (niente overflow) e lo stesso allineamento verticale dell'header. Nessun altro residuo nel codebase.
- **Correlati:** `getContextualDate` fix (`7fb4790`): niente "Scaduto il" per accettati/rifiutati → mostra "Accettato/Rifiutato il". Etichetta fattura collegata allineata a destra (`67d3aa0`).
- **File:** `cestino/page.tsx`, `abbonamento/page.tsx`, `fatture/scadenze/page.tsx`, `template/page.tsx`, `lib/utils/document-date.ts`, `preventivi/page.tsx`.

### `b5c6db9` — ATECO 2025 (dataset + preset catalogo riallineati) 🟡
- **Richiesta Eli:** sostituire `lib/data/ateco.ts` col dataset ATECO 2025 fornito (voci "⚠ verificare" lasciate come sono) e riallineare `ateco-presets.ts` ai nuovi codici.
- **Fatto:** dataset sostituito integralmente (searchAteco invariata). Preset riallineati: **coperture 43.91→43.41**; nuova chiave **43.91 = Lavori di muratura** (nuovo significato 2025); **parrucchieri 96.02→96.21**; **estetiste → 96.22**; mantenuti **alias legacy** `96.02`/`86.90` per i workspace con codici 2007 già salvati. Le altre chiavi (43.21/43.22/43.31-34, 71.1, 62, 74.10/74.20, 45.2, 16) matchano per prefisso e restano valide.
- **File:** `lib/data/ateco.ts`, `lib/catalog/ateco-presets.ts`.

### `472ac79` — Template mobile: overflow orizzontale (tasti fuori bordo) 🟡
- **Feedback Eli (bug con causa):** in Template i tasti "Usa/In uso/Nuovo template" uscivano dal bordo destro. Causa: `-mx-4` sul wrapper mobile senza un `p-4` padre da cancellare → blocco 32px più largo dello schermo.
- **Fatto:** rimosso `-mx-4` (tenuto `-mt-4`); su `<main>` (AppShell) aggiunto `overflow-x-hidden` come rete di sicurezza globale. `MobileTemplateList` non toccato.
- **File:** `template/page.tsx`, `AppShell.tsx`.

### `6b1aefa` — BUG safe-area (titoli tagliati) + Free scaduto due motivi 🟡
- **Feedback Eli (bug, causa già diagnosticata):** su mobile i titoli di molte pagine erano tagliati in alto / pagina spostata su. Causa: `<main>` senza padding-top su mobile + viewport senza `viewportFit:'cover'` (safe-area = 0).
- **Fatto (fix globale, tutte le pagine):**
  - `app/layout.tsx`: viewport **`viewportFit: 'cover'`** → abilita `env(safe-area-inset-top)`.
  - `globals.css`: utility **`.cc-main-safe-top`** = `padding-top: max(env(safe-area-inset-top), 16px)`, azzerata da `lg` in su.
  - `AppShell.tsx`: classe `.cc-main-safe-top` sul `<main>` (mantenuto `scrollbarGutter`, `pb-[72px]`). Le fasce bianche Preventivi/Fatture (`-mt-4`) stanno dentro contenitori `p-4` → si allineano al nuovo top safe-area (non risalgono sotto il notch).
  - **⚠️ Da verificare da Eli sul telefono** (lista pagine nel suo messaggio): titolo mai tagliato.
- **Free scaduto (Abbonamento + Impostazioni→Piano):** ora **cita entrambi i motivi** (riga documenti rossa se limite raggiunto, riga tempo rossa se prova terminata); la **barra è rossa solo per il limite documenti**, non per il tempo; CTA ridotta a **"Passa a Pro per continuare."**
- **File:** `app/layout.tsx`, `app/globals.css`, `AppShell.tsx`, `abbonamento/page.tsx`, `impostazioni/tabs/piano.tsx`.

### `b2b9576` — Piano Free scaduto per documenti O giorni di prova 🟡
- **Feedback Eli:** il Free scade sia per numero di documenti sia per giorni di prova; se scaduto (per uno dei due) va mostrato in Abbonamento e in Impostazioni→Piano.
- **Fatto:** entrambe le pagine ora usano `checkFreeBlock` (già la fonte di verità del blocco). Mostrano: badge **"Scaduto"**, barra uso preventivi, riga **periodo di prova (giorni rimanenti / terminato)** e il **motivo del blocco** (limite 8 preventivi raggiunto **oppure** prova di 30 giorni terminata).
- **File:** `abbonamento/page.tsx`, `impostazioni/tabs/piano.tsx`.

### `c9c81f3` · `69fe967` — Rifiniture badge/lista + "Sincronizza con Stripe" 🟡
- **Feedback Eli:** (1) fattura collegata più piccola e a sinistra; (2) rinominare "Scadenze e solleciti" (chiaro = preventivi); (3) badge scadenze non compare (3 preventivi sotto i 5 giorni); (4) badge anche per fatture; (5) titolo Abbonamento tagliato; (6) il suo Pro è un abbonamento Stripe reale → manca la parte sotto.
- **Fatto:**
  - Lista preventivi: etichetta fattura collegata ridotta a **11px**, sulla riga dell'importo.
  - Altro: **"Scadenze e solleciti" → "Preventivi in scadenza"**; badge finestra **3→7 giorni** (ora cattura i preventivi in scadenza entro la settimana); badge **"Fatture da incassare"** oro con stessa logica (entro 7gg o scadute).
  - Abbonamento: header con `minWidth:0`+ellipsis anti-taglio.
  - **"Sincronizza con Stripe"** (`resyncSubscriptionAction` + `ResyncButton`): cerca il cliente Stripe per **email** e ripopola i campi (`plan`, `stripe_customer_id`, `stripe_subscription_id`, `subscription_ends_at`, `billing_interval`). Il bottone compare quando il piano è Pro/Team/Lifetime ma manca `stripe_subscription_id`. Risolve il caso di Eli (abbonamento Stripe reale ma campi non sincronizzati → parte sotto nascosta). **⚠️ RIMOSSO poi su richiesta di Eli (commit `f6ce706`): bottone + azione + componente eliminati.**
- **Nota webhook:** il webhook Stripe è **corretto** (popola i campi su checkout e subscription.updated); i dati mancavano perché l'abbonamento è precedente al webhook o non ha fatto match sul workspace.
- **File:** `preventivi/page.tsx`, `altro/page.tsx`, `abbonamento/page.tsx`, `lib/actions/subscription.ts`, `abbonamento/_components/ResyncButton.tsx` (nuovo).

### `96c3344` — Pagina "Fatture da incassare" + rifiniture 🟡
- **Feedback Eli:** (1) fattura collegata sulla riga dell'importo; (2) badge scadenze solo i più urgenti; (3) Piano/Abbonamento numeri reali + Pro mensile/annuale + parte sotto Pro; (4) creare sezione fatture in scadenza.
- **Fatto:**
  - **Nuova pagina `/fatture/scadenze` ("Fatture da incassare"):** fatture inviate/viste non pagate, ordinate per scadenza pagamento, con **KPI** (Da incassare / Scaduto), giorni di ritardo, link al dettaglio. Voce **"Fatture da incassare"** in *Altro* con **badge rosso** (n. fatture scadute).
  - **Lista preventivi:** "Fattura NNN · Pagata/Emessa" spostata **sulla riga dell'importo** (era sotto il badge).
  - **Badge scadenze (Altro):** torna a contare **solo i preventivi urgenti** (scadenza entro 3 giorni), non tutti.
  - **Abbonamento/Piano:** mostrata la **fatturazione (mensile/annuale)** per il Pro quando `billing_interval` è valorizzato.
- **Verificato (non erano bug):** i numeri del piano Free (preventivi inviati/rimanenti) in *Impostazioni→Piano* e in *Abbonamento* **usano già dati reali** (`sent_quota_used`). La "parte sotto" del Pro (card annuale, Gestisci abbonamento, Rinnovo il) è **condizionata a dati Stripe reali** (`stripe_subscription_id`/`stripe_customer_id`/`subscription_ends_at`): con un Pro impostato a mano (senza abbonamento Stripe) quei campi sono vuoti → sezioni nascoste per scelta.
- **Da chiarire con Eli:** il suo Pro è un abbonamento Stripe reale o impostato a mano? Screenshot dello stato Free per il titolo "in parte nascosto".
- **File:** `fatture/scadenze/page.tsx` (nuovo), `preventivi/page.tsx`, `altro/page.tsx`, `abbonamento/page.tsx`, `impostazioni/tabs/piano.tsx`.

### `ce4c554` — Badge scadenze, tab Impostazioni, nota forfettario, fattura collegata in lista 🟡
- **Feedback Eli:** (1) badge scadenze non compare; (2) tab Impostazioni diversi dal mockup; (3) nota forfettario diversa dal mockup; (4) Piano Pro manca "Rinnovo il"; (5) valutare pagina fatture in scadenza; (6) in lista preventivi mostrare la fattura collegata sotto al badge.
- **Fatto:**
  - **Badge scadenze (Altro):** contava solo i preventivi in scadenza **entro 3 giorni** → ora conta **tutti i preventivi in attesa** (sent/viewed), come la pagina `/preventivi/scadenze`. Per questo prima spesso era 0.
  - **Tab Impostazioni:** rimosso lo sfondo a pillola/rounded shadcn sull'attivo → **underline pulito** come il mockup (tab full-width, attivo navy+underline, inattivo #8a887f).
  - **Nota forfettario (Fiscale):** ora è il testo **esatto** del mockup: "I documenti riporteranno la dicitura di legge del regime forfettario (operazione non soggetta a IVA, L. 190/2014)." (non più la nota legale grezza da `calcoli.ts`).
  - **Lista preventivi:** se un preventivo ha una **fattura collegata**, sotto al badge stato compare **"Fattura NNN · Pagata/Emessa/Annullata"** (verde/blu/grigio), su mobile e desktop.
- **Aperti:** (4) "Rinnovo il" è già nel codice del tab Piano ma appare solo se `subscription_ends_at` è valorizzato (da verificare sui dati di Eli). (5) Ricerca fatta → raccomandazione: **SÌ, priorità alta** (scadenzario/"Da incassare").
- **File:** `altro/page.tsx`, `impostazioni/page.tsx`, `impostazioni/tabs/fiscali.tsx`, `preventivi/page.tsx`.

### `5d8ecb8` — Paese cliente libero + collegamento preventivo→fattura segna Accettato + doc scostamenti 🟡
- **Feedback Eli:** (1) il campo Paese non deve essere "Italia" di default; (2) collegando un preventivo inviato a una fattura, avvisare che verrà segnato come Accettato; (3) creare un file .md con la lista delle cose chieste in aggiunta/modifica rispetto al mockup.
- **Fatto:**
  - `ClientForm`: **Paese** senza default "Italia" (campo vuoto, placeholder "Italia").
  - `linkDocumentAction`: se si collega un preventivo **inviato/visto** → viene segnato **Accettato** (`status='accepted'`, `accepted_at=now`). `LinkToPreventivoButton`: **avviso** (banner ambra) nel dialog quando il preventivo selezionato è inviato/visto + **toast** "collegato e segnato come Accettato".
  - Creato **`SCOSTAMENTI_DAL_MOCKUP.md`**: elenco delle eccezioni volute da Eli rispetto ai mockup.
- **File:** `clienti/_components/ClientForm.tsx`, `fatture/_components/LinkToPreventivoButton.tsx`, `lib/actions/documents.ts`, `SCOSTAMENTI_DAL_MOCKUP.md` (nuovo).

### `f5d5666` — Dettaglio fattura: card "Preventivo collegato" + cronologia uniforme + coerenza font 🟡
- **Feedback Eli:** (1) mostrare il preventivo collegato come card in alto (Apri + Cambia) invece del bottone in basso; (2) cronologia uguale al mockup per preventivi E fatture; (3) coerenza dimensioni scritte/titoli tra preventivo e fattura. Decisioni: data+ora nella cronologia (non solo giorno), ok ingrandire i titoletti del preventivo, "Scade il" resta solo nel preventivo.
- **Fatto:**
  - **Card "Preventivo collegato"** in cima al dettaglio fattura (mobile): 🔗 + label + numero + **Apri** + **Cambia**; rimossi il banner "Da preventivo · Vai →" e il blocco "Collega/Cambia" in basso (ora desktop-only). `LinkToPreventivoButton`: aggiunto trigger **compatto** ("Cambia"/"Collega") + **Scollega** dentro il dialog.
  - **Cronologia uniforme:** scoperto che la fattura usava `DocumentTimeline` (stile diverso) mentre il preventivo aveva una cronologia inline già a mockup. Riscritto `DocumentTimeline` alla resa del mockup (cerchio 20px, icona 12px, linea `#ececef`, titolo 13.5/600/#161616, **data+ora**), in una card. Etichette fattura: Creata/**Pagata** (icona €)/**Annullata**.
  - **Coerenza font:** titoletti sezione del preventivo (CLIENTE/RIEPILOGO/CRONOLOGIA) da **11px/#8a887f** a **13px/#6f6d64** (= fattura/mockup). Il resto già combaciava.
- **File:** `fatture/[id]/page.tsx`, `fatture/_components/LinkToPreventivoButton.tsx`, `preventivi/_components/DocumentTimeline.tsx`, `preventivi/[id]/page.tsx`.

### `ee7da3d` — Scheda cliente allineata al mockup (spazi/riquadri/font) 🟡
- **Feedback Eli:** la scheda Nuovo cliente ha spazi e dimensioni carattere diversi dal mockup.
- **Causa:** il form usava gli `<Input>` shadcn di default (gap 4px label→campo, 12px tra campi, box/altezza diversi) invece dei riquadri del mockup.
- **Fatto:** `ClientForm` allineato al mockup 03 — riquadri `border #e3e3e6 / radius 10 / padding 11px 12px / font 14`, label 7px sopra il campo, 14px tra i campi e tra le card. Rimosso `text-transform:uppercase` dal campo P.IVA (il placeholder mostrava "ES." invece di "es."; il valore resta maiuscolo via stato).
- **File:** `clienti/_components/ClientForm.tsx`.

### `34ac35a` — Campo Telefono attività + "Chiama l'artigiano" reale ⚠️ (migration da applicare)
- **Feedback Eli:** "Chiama l'artigiano" sulla pagina pubblica scaduta deve essere una vera chiamata → opzione (a): aggiungere il numero di telefono.
- **Fatto:** `workspaces.phone` (migration) + campo **Telefono** in *Impostazioni → Generale* (name `phone`, salvato da `updateWorkspaceData`). Pagina pubblica **scaduto**: se c'è il telefono → `tel:` "Chiama l'artigiano"; altrimenti fallback `mailto:` "Contatta l'artigiano". `types/database.ts` aggiornato a mano (workspaces.phone).
- **⚠️ Migration:** `ALTER TABLE workspaces ADD COLUMN phone TEXT;` — **da applicare su Supabase prima dell'uso** (senza, il salvataggio di Impostazioni→Generale fallisce: colonna inesistente).
- **File:** `lib/actions/workspace.ts`, `impostazioni/tabs/generali.tsx`, `p/[token]/scaduto/page.tsx`, `types/database.ts`.


### `7f9c4cb` · `90ae703` — Fattura: rimossa "Altre azioni" + tasti "Segna pagata / Annulla fattura" 🟡
- **Feedback Eli:** togliere "Altre azioni" dal dettaglio fattura (azioni già disponibili fuori). Poi: aggiungere accanto a "Segna pagata" un tasto bianco stessa dimensione, come le chip "Segna accettato/rifiutato" del preventivo.
- **Fatto:** rimossa la card "Altre azioni" (Duplica/Elimina restano nel ⋮ della lista; su desktop "Segna pagata/annullata" resta nell'header). Aggiunto **AnnullaFatturaButton** (bianco, X rossa) affiancato a **SegnaPagataButton** (navy), entrambi `flex 1 · h48 · radius 13` come le chip del preventivo.
- **File:** `fatture/[id]/page.tsx`, `_components/AnnullaFatturaButton.tsx` (nuovo), `SegnaPagataButton.tsx`.

### `c6fb3d4` — Titolo "Voci preventivo/fattura" + bonus edilizio fattura come interruttore 🟡
- **Feedback Eli:** (1) il titolo "Voci" deve diventare "Voci preventivo"; (2) del bonus edilizio voglio vedere solo l'interruttore (niente opzioni Ecobonus/Sismabonus…).
- **Fatto:** titolo ora "Voci preventivo" / "Voci fattura" (docType-aware). `FatturaForm`: bonus da Select a 4 voci → **interruttore on/off + percentuale**, identico al preventivo (il tipo bonus non era usato in calcoli/PDF, verificato).
- **File:** `PreventivoForm.tsx`, `FatturaForm.tsx`.

### `479a805` — Card "Voci" allineata alle card adiacenti 🟡
- **Feedback Eli:** la card Voci ha testo/riquadri disallineati rispetto a Cliente/Altre opzioni; allinearli.
- **Causa:** padding doppio (cc-card-md 15px + header/righe interne). **Fatto:** card Voci `padding:0`, righe `px-4→15px` → titolo e riquadri a 15px come le vicine, divisore a tutta larghezza (vale preventivo + fattura).
- **File:** `PreventivoForm.tsx`, `VociTable.tsx`.

### `65a07ae` — Template: nuovo modello "lista dei template" (mobile) 🟡
- **Decisione Eli:** la pagina Template mostra i TUOI template (**Default** + **Template personalizzato 1/2/…**); scegli quello attivo per i documenti; toccandone uno si apre l'editor dove scegli lo stile base (Classico/Bold/…) e personalizzi secondo il piano. Decisioni: **Free = solo Default** (Classico + colore + logo; Bold/Tecnico/Elegante = Pro), nomi **auto ma rinominabili**, preset **dentro l'editor**.
- **Fatto:** pagina `/template` mobile → **lista** (`MobileTemplateList`) con "In uso/Usa"; editor con preset **bloccati per Free** (solo Classico); `createBlankCustomTemplateAction` ("Nuovo template" Pro, auto-nome); `editDefaultTemplateAction` (apre l'editor completo sul Default, find-or-create). Supera il mockup Template 15/16 (vecchio modello a griglia).
- **File:** `lib/actions/templates.ts`, `TemplateEditor.tsx`, `MobileTemplateList.tsx` (nuovo), `template/page.tsx`.
- **Nota:** desktop invariato (già a lista con DefaultTemplateCard/CustomTemplateCard). Da verificare da Eli in browser.

---

## 1 luglio 2026 — Copia link conferma "Inviato" + tutte le pagine del mockup `pagine2` (Code Mobile)

Metodo: pixel-perfect al mockup, override degli stili shadcn dove differiscono, **niente valori inventati** (i dubbi lasciati indietro e raccolti in fondo per Eli). Componenti condivisi e pagine preventivo (bloccate) NON toccati.

### `<share>` — Condividi: "Copia link" chiede conferma per segnare come Inviato (bozze) 🟡
- **Feedback Eli:** cliccando "Copia link" nel pop-up Condividi, chiedere conferma per segnare il preventivo come **Inviato** (NON aggiungere "Segna come inviato" al ⋮ della lista).
- **Fatto:** `ShareButton.copyLink` → su una **bozza**, dopo aver copiato il link compare una conferma inline *"Vuoi segnare questo preventivo come Inviato? Riceverà il numero progressivo."* con **Non ora** / **Segna come inviato** (auto-salva + `registerManualSendAction`). Documenti già inviati/scaduti: comportamento invariato.
- **File:** `app/(app)/preventivi/_components/ShareButton.tsx`.

### `0d3b118` — Pixel-perfect di TUTTE le 26 schermate del mockup `Carta_Canta_mockup_pagine2.html` 🟡
- **Richiesta Eli:** "procedi con la modifica delle pagine come descritto nel nuovo mockup. Falle tutte. Se hai dubbi, lasciali indietro… alla fine chiedimi i dubbi prima di applicarli."
- **Fatto (33 file, solo layout mobile; desktop `lg:` preservato):**
  - **Clienti** — Lista (fascia bianca, righe avatar/nome/sottotitolo/chevron, rimosso badge P.IVA), Scheda (header+chip Chiama/Modifica, info-card, documenti, Elimina outline), Nuovo/Modifica form (label uppercase, asterischi oro, bottone navy 50px).
  - **Catalogo** — lista raggruppata per categoria (bande #ececef), righe `unità · IVA%`, form voce mockup.
  - **Fatture** — Dettaglio (header+matita, card Cliente/Riepilogo, banner "Da preventivo", azioni Anteprima/Condividi, "Segna pagata" navy), Nuova fattura (Cliente + Voci + Altre opzioni + bottoni).
  - **Altro** (hub) + **Impostazioni** (tab-bar mobile, tab Generale/Fiscale/Notifiche/Piano Free+Pro, ToggleSwitch mockup).
  - **Abbonamento** (Free: quota+card oro Pro; Pro: piano attivo+annuale), **Template** (griglia preset 2×2+personalizzazione Pro), **Cestino** (banner 15gg, righe con Ripristina/Elimina).
  - **Pagina pubblica** — card documento, bottom-sheet Firma/Rifiuta, stati grazie/scaduto/rifiutato.
  - **Auth** — Login, Signup, Verifica email; **Onboarding** passo 1.
- **Metodo:** 7 gruppi in parallelo su file disgiunti; tsc + build + 178/178 test verdi prima del push.
- **DUBBI raccolti (da decidere con Eli PRIMA di applicare — vedi messaggio dedicato):** SearchBar/OAuthButtons/PasswordStrength condivisi (ritocco pixel fuori area); Template Pro personalizzazione inline vs editor; griglia preset interattiva al tap; Bonus edilizio toggle vs Select 4 opzioni; "Chiama l'artigiano" (manca telefono workspace nel DB); IVA mista in Riepilogo/pagina pubblica; onboarding campi extra (ATECO/indirizzo) vs card snella; form modifica fattura mobile usa `PreventivoForm` (bloccato).

---

## 29 giugno 2026 — Sessione Dettaglio preventivo + Pop-up Condividi (Code Mobile)

Metodo: Eli è il giudice visivo (screenshot dal telefono); io leggo sempre il codice reale, replico il mockup **al pixel** (`mockup-mobile/Carta_Canta_mockup_app.html` + `DESIGN_TOKENS.md`), e pubblico su `master` (Vercel). Eli ha autorizzato il push diretto su `master` (nessun cliente reale ancora).

### `8775992` — Cronologia preventivo: nodo finale "Scade il {data}" 🟡
- **Feedback Eli:** nella cronologia aggiungere in fondo quando scade il documento. Etichetta "**Scade il**" confermata da Eli.
- **Fatto:** cronologia mobile del dettaglio preventivo → per Inviato/Visto con scadenza futura, nodo finale "Scade il {data}" (ambra, Clock). Allinea il mobile al desktop.
- **File:** `app/(app)/preventivi/[id]/page.tsx`.

### `dc8e91e` — Dettaglio preventivo: rimossa "Altre azioni" (no doppioni col ⋮) 🟡
- **Feedback Eli:** ripetizione di comandi (Duplica/Elimina) tra ⋮ della lista e "Altre azioni" del dettaglio → **opzione B**: gestione solo dalla lista ("solo da fuori schermata preventivo").
- **Fatto:** rimossa la card "Altre azioni" dal dettaglio preventivo mobile (Duplica/Elimina restano nel ⋮ della lista: Usa come modello / Invia bozze / Elimina). Rimossi import inutilizzati.
- **Aperti/segnalati:** "Segna come inviato" (bozze) esce dal dettaglio mobile (resta desktop; da aggiungere al ⋮ se Eli vuole). **Dettaglio FATTURA non toccato**: la sua "Altre azioni" include "Segna pagata/Annullata" (non nel ⋮) → da sistemare quando si fa la pagina Fattura Dettaglio col mockup `pagine2`.
- **File:** `app/(app)/preventivi/[id]/page.tsx`.

### `408dea7` — og card firma come default per TUTTA l'app (verificato) 🟡
- **Feedback Eli:** condividendo il link di una **pagina interna** (es. `/fatture/[id]?edit=1`) su WhatsApp compariva ancora la vecchia icona CC.
- **Causa:** le pagine interne sono dietro login → il crawler non autenticato viene rediretto al **login**, che non aveva `og:image` → icona CC di default. Il logo firma era solo su `/p/[token]`.
- **Fatto:** aggiunto `app/opengraph-image.tsx` (root) → la card 1200×630 col logo firma è ora il **default per tutta l'app**; `/p/[token]` mantiene il suo override. Logo colocato in `app/logo-firma.png`.
- **Verificato in produzione:** `cartacanta.app/login` espone `og:image = /opengraph-image` (1200×630, image/png). ✅
- **Cache WhatsApp:** vale sempre (link nuovo / re-scrape).

### `1ab116c` — Sconto globale: chiusura con X + form fattura allineato al preventivo 🟡
- **Feedback Eli:** (a) nel preventivo lo sconto si apriva col "+" ma non c'era modo di richiuderlo; (b) lo sconto era gestito diversamente tra preventivo (dentro il Riepilogo) e fattura (card separata "Sconti globali").
- **Verifica (chiesta prima di toccare):** confermato — preventivo usava `discountSlot` dentro `FiscalSummary`, fattura aveva la `Card 4` separata (incoerenza storica: G-QA3.4 aveva aggiornato solo il preventivo).
- **Fatto:** `PreventivoForm` → bottone **X** nel pannello sconto aperto che **chiude e azzera** Sconto %/€ (icona scelta da Eli). `FatturaForm` → sconto spostato **dentro il Riepilogo** (stesso discountSlot, apri/chiudi con X), **rimossa** la card separata.
- **Nota:** validazione "sconto > totale" (T-14) resta solo nel preventivo (non portata in fattura — da fare se Eli vuole).
- **File:** `PreventivoForm.tsx`, `FatturaForm.tsx`.

### `169714c` — Form fattura: numero in Inter (no monospace) + rimosso "(opzionale)" 🟡
- **Feedback Eli:** sulla pagina Fatture il numero aveva un font diverso dal resto; e "Sconti globali (opzionale)" → togliere "opzionale".
- **Fatto:** `FatturaForm` → campo Numero fattura non più `monospace` (ora Inter, coerente). Rimosso "(opzionale)" da "Sconti globali" e da "Titolo del lavoro" (regola DESIGN_TOKENS: opzionale è implicito).
- **File:** `FatturaForm.tsx`.

### `33eee9a` — og card: logo più grande (meno spazio attorno) 🟡
- **Feedback Eli:** il logo nell'anteprima WhatsApp aveva troppo spazio attorno.
- **Fatto:** `opengraph-image.tsx` → logo da 820→1000px di larghezza (margini ridotti, un po' d'aria mantenuta).
- **Cache WhatsApp:** la nuova dimensione si vede solo con un link nuovo / re-scrape.

### `56bdc0e` — Pop-up: anche "Copia" fa ripartire la validità (scaduto) 🟡
- **Feedback Eli:** per un preventivo scaduto anche il pulsante "Copia" deve far ripartire la scadenza, con un avviso.
- **Fatto:** in `ShareButton.copyLink`, se il preventivo è scaduto: copia il link + chiama `resendExpiredAction` (reimposta scadenza + stato Inviato) + toast "Link copiato. La validità riparte: scade tra N giorni." + chiude il pop-up. Negli altri stati "Copia" resta semplice copia.
- **File:** `app/(app)/preventivi/_components/ShareButton.tsx`.

### Pop-up Condividi centrato + og card 500→edge (verificata 200) 🟡
- **Feedback Eli:** il pop-up sembrava "spostato in basso" (bottom-sheet senza margine inferiore visibile) → **centrarlo nella pagina**.
- **Bug trovato (dai log Vercel):** la card OG dava **500** in produzione → `fetch failed: not implemented` (il runtime **nodejs** non legge i file locali via fetch). Per questo WhatsApp non mostrava immagine anche sui link nuovi.
- **Fatto:** (1) `ShareButton` → pop-up reso **card centrata** (overlay flex, margini su tutti i lati, angoli arrotondati, scroll se alta). (2) `opengraph-image.tsx` → runtime **edge** + data-URI base64 robusto. **Verificato in produzione: la route risponde 200 (PNG)**.
- **File:** `app/(app)/preventivi/_components/ShareButton.tsx`, `app/p/[token]/opengraph-image.tsx`.
- **Cache WhatsApp:** i link già condivisi restano con la vecchia anteprima → serve link NUOVO o re-scrape su Meta Sharing Debugger.

### og:image come card 1200×630 generata (WhatsApp non mostrava nulla) 🟡
- **Bug/feedback Eli:** con un link nuovo l'anteprima WhatsApp non mostrava **alcun** logo. Causa: l'`og:image` era il logo "largo" 900×210 → WhatsApp scarta le immagini troppo strette.
- **Fatto:** creata `app/p/[token]/opengraph-image.tsx` (Next `ImageResponse`, runtime nodejs) → **card 1200×630** col logo firma centrato su sfondo crema `#f3ede0`. Logo colocato in `app/p/[token]/logo-firma.png`. In `generateMetadata` rimosso l'`og:image` manuale (lo fornisce la card). Rimosso `public/og-logo-firma.png` (superato).
- **Nota cache:** vale sempre la cache di WhatsApp → testare con link NUOVO o re-scrape dal Meta Sharing Debugger.

### (docs) — Rimando a questo registro in RIPARTI_QUI + verifica og:image
- Aggiunto in `RIPARTI_QUI.md` (sez. 1, voce 4-bis) il rimando a `REGISTRO_AGGIORNAMENTI.md`.
- **Verifica og:image (29 giu):** letto l'HTML LIVE di `cartacanta.app/p/[token]` via Vercel → la metadata è corretta (`og:image = https://cartacanta.app/og-logo-firma.png`, `og:title "Preventivo N · Azienda"`). L'immagine risponde 200. Quindi il "vecchio logo CC" che si vede su WhatsApp è **solo la cache di WhatsApp** (anteprima salvata al primo invio, prima della fix): si aggiorna con un link NUOVO o forzando il re-scrape dal Meta Sharing Debugger.

### `f5ee961` — Anteprima link WhatsApp = logo "firma" nuovo (og:image) 🟡
- **Feedback Eli:** nell'anteprima del link su WhatsApp deve comparire il logo nuovo (quello della Home), non l'icona "CC".
- **Bug/causa:** la pagina pubblica `/p/[token]` non aveva metadata Open Graph → WhatsApp ripiegava sull'icona app.
- **Fatto:** aggiunto `generateMetadata` alla pagina pubblica con `og:image` = logo firma, titolo "{Preventivo N · Azienda}" + descrizione. Asset copiato in `public/og-logo-firma.png`.
- **File:** `app/p/[token]/page.tsx`, `public/og-logo-firma.png` (nuovo).
- **Nota:** WhatsApp tiene in cache le anteprime → si vede solo su condivisioni NUOVE. Immagine attuale 900×210 (logo originale); eventuale "card" 1200×630 da fare se Eli vuole.

### `671327f` — Pop-up: X di chiusura + rinvio scaduto con scadenza a scelta 🟡
- **Feedback Eli:** (1) togliere il trattino grigio in alto (sembra trascinabile ma non lo è) e mettere una X per chiudere; (2) per lo scaduto "Rinvia al cliente" deve permettere di scegliere a mano tra quanti giorni scade.
- **Fatto:** rimossa la maniglia, aggiunta **X** in alto a destra. Per gli scaduti il pop-up mostra un menu a tendina **"Nuova scadenza"** (15/30/45/60/90 gg). Nuova server action `resendExpiredAction(documentId, validityDays)` (reimposta `expires_at` + stato sent, **senza** consumare quota Free). `ShareButton`: prop `isExpired` + `defaultValidityDays`.
- **File:** `ShareButton.tsx`, `app/(app)/preventivi/[id]/page.tsx`, `lib/actions/documents.ts`.

### `89011ec` — Pop-up Invia/Condividi → bottom-sheet (mockup) 🟡
- **Bug trovato:** il dialog centrato si tagliava a destra con nomi cliente lunghi → "Altre app" finiva fuori schermo.
- **Fatto:** sostituito il Dialog centrato con un **bottom-sheet** pixel dal mockup "Pop-up — Invia / Condividi": overlay scuro, sheet ancorato in basso (radius 22 in alto, ombra verso l'alto), 3 canali a piena larghezza (WhatsApp/Email/Altre app), link row con "Copia".
- **File:** `ShareButton.tsx`.

### `865eebe` — Dettaglio preventivo mobile pixel-perfect in TUTTI gli stati 🟡
- **Contesto:** il mockup è stato aggiornato da Eli con **6 schermate per stato** (BOZZA/INVIATO/VISTO/ACCETTATO/RIFIUTATO/SCADUTO) + card "Altre azioni".
- **Fatto:** vista mobile ricostruita per stato:
  - BOZZA: titolo "Bozza", "Creata il", banner Free, primario "Invia al cliente", in Altre azioni "Segna come inviato".
  - INVIATO: Anteprima + Condividi, Segna accettato/rifiutato.
  - VISTO: badge rosa, card "Visualizzazioni", cronologia con "Visto dal cliente".
  - ACCETTATO: banner verde firmato + "Crea fattura" navy.
  - RIFIUTATO: banner rosso + motivo.
  - SCADUTO: banner ambra + primario "Rinvia al cliente".
  - "Altre azioni" ridisegnata (card a tendina, righe Duplica/[Segna inviato]/Elimina), **prima** della Cronologia.
- **Componenti:** `ShareButton` (trigger label/icona parametrici), `StatusBadge` (padding 3px 11px da DESIGN_TOKENS), `MobileStatusChips` (icone Check/X), `Duplicate/Delete/RegisterManualSend` (variante `asRow`), `AltreAzioniCard` (riscritta), `globals.css` (divisori `.cc-altre-rows`).
- **File:** `app/(app)/preventivi/[id]/page.tsx` + i componenti sopra + `app/globals.css`. (Inclusa la regola fissa **pixel-perfect** in `RIPARTI_QUI.md` sez. 3.)

### `7b6cbc6` (28 giu) — Dettaglio preventivo (INVIATO) prima passata pixel 🟡
- **Feedback Eli (checklist):** header "Preventivo N" centrato + matita in cerchio; riga stato badge + "Inviato il"; banner Free oro; card Cliente; card Riepilogo (Subtotale/IVA/Totale/Valido fino al); Anteprima + **Condividi navy pieno**; "Segna accettato/rifiutato" bianchi con sola icona colorata; Cronologia coi toni dei badge.
- **Fatto:** prima ricostruzione mobile dell'INVIATO (poi estesa a tutti gli stati in `865eebe`). Desktop separato e invariato.

### `e80e531` (27 giu) — Dettaglio preventivo: prime rifiniture 🟡
- **Feedback Eli:** chip uniformi/stessa altezza, banner accettazione in verde **pastello** (non acceso), importi a 2 decimali, "Crea fattura" con etichetta visibile e non duplicato, "Segna accettato/rifiutato" su sfondo bianco con sola icona colorata.
- **Fatto:** applicate; poi consolidate nei commit successivi.

### Note di processo (29 giu)
- **Accesso GitHub:** all'inizio sessione il push falliva (403). Causa: rendendo il repo **privato**, l'app GitHub di Claude aveva perso la scrittura. Risolto da Eli **installando l'app Claude** sul repo (GitHub → app Claude → repository access → carta-canta). Da lì push OK.
- **Punti lasciati aperti / da decidere con Eli:** eventuale card og:image 1200×630; se "Cambia stato" va tenuto anche su mobile (ora solo desktop, come da mockup); "Altre azioni" default chiusa.

---

*Prima di questa data: lo storico dettagliato è in `CLAUDE.md` (sezione A — HANDOFF) e `STORICO_SESSIONI.md`.*
