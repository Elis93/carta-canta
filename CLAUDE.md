# CLAUDE.md — Memoria permanente del progetto Carta Canta

> **Fonte di verità per Claude Code.**
> Va aggiornato a fine di ogni sessione con: feature implementate, decisioni prese, bug emersi, cose rimandate.
> **Ultima sessione: 17 agosto 2026** (verifica profonda: 2 revisori sul diff 15→17 ago, pipeline completa, 2 collaudi Chromium sul blocco app e sulla guida di sezione; fix nanoid).
> Gli handoff qui sotto partono dal **3 agosto**; quelli precedenti sono in `STORICO_SESSIONI.md` (consolidamenti: 14 giu · 15 lug · 6 ago 2026).
>
> **Dove sta cosa:** decisioni di prodotto e feedback → `DECISIONI_E_FEEDBACK.md` · azioni manuali di Eli → `COSE_DA_FARE_ELI.md` · sicurezza → `SICUREZZA.md` + `AUDIT_COPERTURA_SICUREZZA.md` · collaudi → `TEST_DA_FARE_ELI.md` · cancelli pre-lancio → `PRIMA_DEL_LANCIO.md`.
> I documenti di `_archivio-doc/` sono **roba finita**: non usarli come riferimento, contengono affermazioni non più vere.

---

## ⚠️ REGOLE DI LAVORO PERMANENTI — DA APPLICARE SEMPRE (Eli, 12 ago 2026)

> Queste due regole valgono per **ogni** task, senza eccezioni. Sono in cima al file apposta: le rileggi a ogni sessione.
>
> 1. **PRIMA di rispondere**, analizza i requisiti, individua i possibili **casi limite (edge cases)** e traccia una **breve scaletta** del tuo ragionamento racchiusa nel tag `<thinking>`.
> 2. **DOPO aver generato la soluzione**, fai una **revisione critica**: verifica se ci sono bug di memoria, problemi di realizzazione o requisiti non rispettati, e **correggili prima di consegnare** la risposta.

---

## A0. HANDOFF — sessioni recenti (dalla più recente)

### ⏰ PROMEMORIA DA DARE A ELI — PULIZIA FILE ORFANI (richiesta esplicita del 5 ago: "ricordamelo, io me lo dimenticherò")
**⚠️ CLAUDE: se leggi questa riga il 1° settembre 2026 o dopo, TIRALA FUORI TU nella prima risposta — non aspettare che Eli se ne ricordi.**
Il job `/api/cron/orphan-files` gira il **1° di ogni mese alle 4:00** e da lì scrive un report; oggi è in SOLA LETTURA (`ORPHAN_CLEANUP_ENABLED` non impostata: conta e riferisce, non cancella).
**Cosa fare quando è il momento:** ① farsi mandare da Eli il report (Vercel → Logs, cerca `[cron/orphan-files]`, oppure la riga `orphan_cleanup` in `security_events`); ② **leggere i numeri PRIMA di accendere**: il segnale di salute è `orfani` PICCOLO rispetto a `file`. Se `orfani ≈ file` su un bucket, il confronto sbaglia ancora e accendere cancellerebbe roba viva — è esattamente quello che è successo il 5 ago col cache-buster `?v=` dei loghi, preso solo perché la cancellazione era spenta; ③ solo allora dire a Eli di aggiungere `ORPHAN_CLEANUP_ENABLED=true` su Vercel + Redeploy; ④ spuntare la casella in `COSE_DA_FARE_ELI.md §0-ter` e togliere questo promemoria.
⚠️ Se il report NON esiste (zero righe, zero log), la causa più probabile NON è "zero orfani": è che il cron non è partito. Verificare l'autenticazione della route (`Authorization: Bearer`, non `?secret=` — bug del 5 ago) e che `CRON_SECRET` sia su Vercel.

### ⏭️ PROMEMORIA PLAY STORE (29 lug, richiesta Eli): quando la TWA diventa app vera, ① attivare la "Location delegation" nel pacchetto (PWABuilder/Bubblewrap) così Posizione compare nel pannello Android dell'app; ② AGGIORNARE le istruzioni del pop-up "Attiva la posizione" in `NearMeButton` (variante standalone: oggi manda su Chrome→lucchetto perché le PWA delegano il permesso al sito). Annotato anche in COSE_DA_FARE_ELI.md §4.

### ✅ 15 ago (13) — Tutorial, seconda passata (foto di Eli): 4 correzioni
- **[a] «Testo grande» ora ingrandisce ANCHE gli elementi con px INLINE.** La prima passata bumpava solo le classi (`.driver-popover-title/description`), ma il bottone «Testo grande attivo…», la riga «Lo trovi in Altro…» e i badge demo hanno il font-size **inline** (vince sullo stile per classe). Aggiunti override `!important` in cc-large per `#cc-tour-textlarge`, `.cc-tour-mobile/.cc-tour-desktop` e `.cc-tour-demobadge` (classe nuova sul badge). **Verificato in Chromium**: tutti gli elementi scalano ×1.14–1.24.
- **[b, passo 3] La card cliente era SCURA.** Avevo evidenziato la voce (mic) → la card cliente restava sotto l'overlay (markTour sugli elementi di pagina non li alza sopra l'overlay, resta scuro). Ora l'elemento evidenziato torna la **card Cliente** (illuminata dal ritaglio driver) e il popover va **`side: 'top'`** — sopra la card, così NON copre le voci sotto. ⚠️ Se su un telefono non c'è spazio sopra, driver potrebbe ribaltarlo sotto: **da collaudare**.
- **[c, passo 2] Il + sporgeva ancora dal ritaglio.** Misurato in Chromium: il cerchio sporge **esattamente 22px** sopra il box del bottone → `stagePadding` Fase A portato **24→28** (margine). La foto di Eli era da una build precedente (cache PWA): il fix c'era già ma non deployato quando ha provato.
- **[d, passo 5] Testo riscritto** come dettato da Eli: «…un badge di stato, che ti informa a colpo d'occhio lo stato del documento», «La cronologia mostra tutta la storia del documento», «Per accedere a tutte le funzioni dell'app, Completa il profilo in Home».
- ⚠️ **Trappola nota (annotata, non ancora un problema segnalato)**: in cc-large l'overlay/ritaglio del tour è contro-zoomato (net 1.0) mentre gli elementi di pagina sono a 1.15 → i ritagli potrebbero disallinearsi col «Testo grande» attivo. Da verificare se emerge.
- tsc+build verdi · Chromium sul testo del popover e sulla geometria del FAB.

### ✅ 17 ago (12) — La grazia 2FA teneva spento il blocco impronta a config finita (finestra 10→2 min)
Eli: «configuro il 2FA, riapro la app ed entra in home senza chiedere né impronta né password — l'impronta però è su Ad ogni accesso». Catena vera: il tasto **«Ho salvato i codici» era morto** (fix nel giro (6)) → la config del 2FA **non si chiudeva** → la grazia `cc_2fa_flow` (che spegne AppLock per il giro all'Authenticator) restava accesa **10 minuti** → chiudi/riapri entro quei minuti → il blocco impronta NON scattava, anche con timeout «Ad ogni apertura» (0).
- **Fix**: la finestra della grazia in `AppLock` passa da **10 a 2 minuti** (basta per il giro all'Authenticator; a config finita `fatto()` la rimuove comunque). Col tasto ora funzionante la grazia si spegne all'istante a config completata → l'impronta torna a scattare.
- **Chiarito a Eli** (comportamento VOLUTO): impronta = ogni riapertura (col timeout scelto); 2FA = solo al **login vero** (dopo «Esci»/telefono nuovo), mai a ogni apertura. Sono complementari. Il `DEFAULT_TIMEOUT` del blocco è 15 min: chi riapre entro 15 min non vede l'impronta a meno di aver scelto «Ad ogni apertura».
- tsc+build+**733** test verdi.

### ✅ 17 ago (11) — Cestino più veloce: via la catena di 3-4 richieste lato client
Eli: «la trovo ancora molto lenta a caricare sezioni (cestino, archivio) e pagine — il prefetch è stato fatto?». Sì (`RoutePrefetcher` + i `loading.tsx` esistono), ma ha DUE limiti: ① `router.prefetch` su una rotta DINAMICA scalda solo lo **scheletro** (il boundary `loading.tsx`), NON i dati; ② il **cestino carica i dati lato BROWSER** con una catena in fila (getUser → workspace owner → eventuale workspace_members → documenti): 3-4 round-trip prima di vedere qualcosa.
- **Fix (la sezione che ha nominato)**: `CestinoInline` accetta ora `workspaceId` dal server. Le pagine che lo montano hanno GIÀ fatto `getSessionWorkspace` → passandolo si saltano getUser + le due query di risoluzione → **da 3-4 richieste a UNA** (i soli documenti). Cablato nei 4 punti: liste preventivi/fatture/sopralluoghi (avevano già `workspace`) e `/cestino` standalone (reso **async**, prima era sincrono e non aveva il workspace). Fallback al vecchio percorso se il prop manca.
- ⚠️ **Archivio e pagine in generale**: già coperti da `loading.tsx` (scheletro immediato) + prefetch dello scheletro; il costo residuo è il render lato server (query DB + il `getUser()` di sicurezza a ogni navigazione). Ridurlo davvero vorrebbe dire fare il fetch iniziale del cestino/liste SUL SERVER (dati che arrivano con la pagina, zero waterfall) — più invasivo, valutabile in un giro dedicato se serve ancora.
- tsc+build+**733** test verdi.

### ✅ 17 ago (10) — Segnaposto più chiari (non sembrano compilati) + Filigrana con la pillola «Pro»
Due punti di Eli.
- **[UI] I SEGNAPOSTO sembravano già compilati** («es. Posa piastrelle», «es. Manodopera»…): usavano `--cc-muted` (#6f6d64, scurito il 15 ago per l'audit WCAG sul testo VERO) → troppo scuri per un hint. Nuova variabile **`--cc-placeholder` (#a29f96)**, più chiara del testo secondario: un campo vuoto ora si distingue a colpo d'occhio da uno compilato. La regola globale `::placeholder` ha ora `!important` per battere ANCHE il `placeholder:text-muted-foreground` dei campi shadcn (Input/Textarea) → tutti i segnaposto allo stesso grigio. In cc-large il segnaposto è `#77746c` (leggibile ma più chiaro del testo #55534b). ⚠️ Il placeholder NON è contenuto essenziale (sparisce appena scrivi) → può stare sotto la soglia AA; l'audit del 15 ago riguardava il testo reale, non i segnaposto. Verificato in Chromium (normale + Testo grande): hint chiaro vs valore scuro.
- **[UI] Template › Filigrana**: per un Free diceva «Sempre attiva 🔒» — ma toglierla È una funzione Pro (`isPro ? Switch : …`). Ora la stessa pillola **«🔒 Solo con Pro»** delle righe Colore/Font/Logo (Eli: «se si può disattivare con Pro, lasciamo la scritta Pro come le altre»).
- tsc+build+**733** test verdi · scan 0.

### ✅ 17 ago (9) — Il Cestino è una vista a sé: via l'Archivio, dentro una freccia indietro
Eli: «quando entro in Cestino vedo anche Archivio; dovrei vedere solo la pagina del cestino e ci deve essere un tasto indietro per tornare al menu precedente».
- **Vista cestino di Preventivi/Fatture/Sopralluoghi ripulita**: tolti la pillola **Archivio** e la pillola **Cestino** attiva (ridondante, era solo un'etichetta). Al loro posto un'intestazione con **freccia indietro** (`BackButton`, fallback alla lista: `/preventivi`·`/fatture`·`/sopralluoghi`) + titolo **«Cestino»** (mobile) / «Cestino preventivi»·«Cestino fatture» (desktop). Il tasto Cestino di INGRESSO resta accanto all'Archivio nella lista — cambia solo la vista una volta dentro (FAQ e /novita restano vere: descrivono l'accesso).
- ⚠️ Modello: la stessa forma della pagina `/cestino` standalone (BackButton + titolo, niente toggle). `BackButton` torna alla lista via `router.back()` (arrivi dal tasto Cestino) o al fallback su link diretto.
- Verificato in Chromium (band a 390px): freccia + titolo, zero sbordi. tsc+build+**733** test verdi · scan 0.

### ✅ 17 ago (8) — Gli SCONTI in chiaro nel Riepilogo (voci + totale + complessivo)
Eli: «visualizzare in modo chiaro sia gli sconti applicati alle singole voci che quelli totali finali». Prima gli sconti di voce erano INVISIBILI nel riepilogo (mangiati dentro i totali di riga) e lo sconto documento aveva una riga anonima «Sconto». Tutto in `FiscalSummary` (condiviso preventivo+fattura), **SOLO display — regola F, `calcoli.ts` intatto**: i numeri derivano dagli output del motore.
- **Riga voce**: la % di sconto della singola voce compare accanto al totale di riga (verde, **fuori dallo span troncabile** — dentro, con una descrizione lunga l'ellissi si mangiava proprio la percentuale: trovato in Chromium al primo giro).
- **Sopra il Subtotale**, solo se c'è almeno uno sconto di voce: «**Totale senza sconti**» (prezzo pieno, arrotondato per riga come fa il motore) e «**Sconti sulle voci** −X». Senza sconti di voce le due righe non esistono e il riepilogo è identico a prima.
- La riga dello sconto documento diventa «**Sconto sul totale**» (per distinguerla dagli sconti di voce).
- **«Sconto complessivo** −X · Y%» sotto il Totale — SOLO quando ci sono entrambi i tipi (con uno solo sarebbe un doppione); % sul prezzo pieno.
- **Verificato in Chromium sul componente VERO a 390px, 3 casi**: entrambi gli sconti (2.400→−200→2.200→−110→2.090, complessivo −310 · 12,9%) · solo sconti voce (niente complessivo né «Sconto sul totale») · nessuno sconto (riepilogo identico a prima). Zero sbordi. Voce in /novita; FAQ rilette, nessuna descrive il riepilogo.
- tsc+build+**733** test verdi · scan 0.

### ✅ 17 ago (7) — Sopralluogo: 2 frasi via · le foto «mancanti» nel preventivo · pop-up Nuova voce ripulito
Quattro punti serali di Eli (1 foto). Il quarto è una risposta, non codice.
- **[COPY] Tolte le 2 frasi del sopralluogo** («Gli appunti vengono copiati nelle Note interne…» sotto i tasti; «Le misure salvate restano qui col loro calcolo… Passano nelle Note interne» sotto Calcola una misura). ⚠️ Solo il testo: il comportamento resta (appunti+misure → Note interne), e la FAQ del righello che lo spiega resta vera.
- **[BUG percepito, causa vera trovata] «Creo un preventivo dal sopralluogo e le foto mancano»** — le foto NON si perdevano: `createPreventivoFromSopralluogoAction` le collega davvero (`work_photos.document_id`), ma l'atterraggio è su **`?edit=1`** e su mobile la card «Foto lavoro» viveva SOLO nel blocco `hidden lg:block` (la vista di lettura, che la mostra, in edit non è renderizzata) → sembravano sparite. **Fix**: nella zona form del dettaglio preventivo la `WorkPhotosCard` non è più solo-desktop — su mobile in modifica compare sotto il form (in lettura resta la copia della vista read, nessun doppione). AccontoCard resta solo-desktop lì.
- **[UI] Pop-up «Nuova voce catalogo» (dal CatalogPicker) ripulito** sullo stile dei campi della voce: etichette piccole grigie sopra, campi h-44 col bordo standard, riga Prezzo·Unità·IVA come nel form, **Categoria a riga intera** (a mezza colonna il segnaposto «es. Manodopera» usciva tagliato — foto di Eli), prezzo **testo `inputMode=decimal` con «0,00»** invece di `type=number` con «0.00» (parseImportoIt accetta virgola E punto). Verificato in Chromium sul componente vero (stub di supabase/actions): campi 44px, zero sbordi, segnaposto intero.
- **[RISPOSTA] «Se non ho voci con margine non compare la sezione margine?»** — Sì, per costruzione (decisione del trasloco, giro (5)): la card Margine esiste solo se almeno una voce ha un costo; il costo arriva da catalogo/listini/suggerimenti, e per una voce scritta a mano si imposta sulla voce del Catalogo. Offerta l'alternativa (card sempre presente, chiusa) se la vuole: una riga da cambiare.
- tsc+build+**733** test+smoke 28/28 verdi · scan 0.

### ✅ 17 ago (6) — [BUG] «Ho salvato i codici» morto — e la grazia 2FA che teneva spento il lucchetto
Eli: «non posso cliccare su HO SALVATO I CODICI, non accade nulla» + «attivo il 2FA, chiudo e riapro, entra in home senza chiedermi nulla». **I due sintomi si spiegano a vicenda.**
- **[BUG] `fatto()` faceva `await getMfaStatus()` senza busy né catch**: se la chiamata al server falliva o restava appesa — il caso tipico è la **pagina rimasta aperta attraverso un deploy** (gli id delle server action ruotano e ogni chiamata dalla pagina vecchia muore) — la promise rifiutata spariva nel silenzio: nessun errore, nessun cambio di schermata, tasto «morto». **Fix**: `fatto()` è ora **sincrono** — si arriva alla schermata codici solo dopo un enroll/rigenera riusciti, quindi lo stato è già noto (`remaining = codes.length`, fase `on`): il tasto chiude SEMPRE, all'istante, senza rete. + **cintura try/catch su attiva/conferma/rigenera/disattiva**: una action che LANCIA (non solo `{error}`) ora mostra «Connessione al server non riuscita: riprova…» invece del nulla.
- **[CONSEGUENZA sul lucchetto] Finché si resta sulla schermata codici, la grazia `cc_2fa_flow` (10 min) è viva** — è quella che permette di passare all'Authenticator senza lucchetto a metà enroll. Col tasto morto Eli restava inchiodata lì: chiudi/riapri entro 10 min → AppLock salta il blocco → «entra in home senza chiedermi nulla». Chiudendo la fase (ora il tasto funziona) la grazia si rimuove e il blocco impronta torna normale.
- **Verificato in Chromium sul componente VERO** (action stubbate, origine http per sessionStorage): flusso completo Attiva→Conferma→codici→«Ho salvato i codici» → fase «Attiva», codici spariti, «10 codici di recupero», **grazia rimossa da sessionStorage**; scenario action-morta → errore visibile e tasto riabilitato.
- ⚠️ **Resta VOLUTO** (spiegato a Eli, FAQ già aggiornata nel giro (4)): il codice 2FA si chiede solo al **login** (dopo «Esci» o su telefono nuovo), mai alla riapertura dell'app — per ogni apertura c'è il blocco impronta. tsc+build+**733** test verdi · scan 0.

### ✅ 17 ago (5) — Il COSTO trasloca nella card Margine (decisione Eli: «procediamo con la tua proposta»)
Chiusa la decisione aperta sul COSTO (feedback collaudatori #3 «non è chiara la differenza tra prezzo, sconto e costo» + istinto di Eli «non ha senso inserirla nel preventivo»). Adottata la proposta raccomandata: **il campo Costo esce dalla card della voce ed entra nella card «Margine · solo tu lo vedi»**.
- **Card della voce alleggerita** (`VociTable`, mobile E desktop): restano solo i campi che riguardano il cliente — Unità · Q.tà · Prezzo · Sconto · IVA. Via `VoceCosto` (desktop) e la cella «🔒 Costo» mobile; via anche lo spacer forfettario (`cc-voce-spacer`, CSS compreso) che serviva solo ad allineare il Costo. ⚠️ **`unit_cost`/`supplier_list_id` restano nei dati e nel salvataggio**: i costi continuano ad arrivare da soli da catalogo, listini e suggerimenti (pickSuggerimento e CatalogPicker intatti), nessun documento perde niente.
- **`MargineBox` ora è il posto del costo**: nuova prop `onUpdateVoce(key, updates)` (passata da PreventivoForm — update per `_key` sull'intera lista, proposte multiple salve — e FatturaForm); aperta, la card mostra intestazione Voce·Costo·Margine e una riga per voce con **campo costo modificabile** (formato it-IT, vuoto = null, «—» sul margine senza costo) + riga spiegazione («Il costo è quanto paghi tu... qui lo correggi»). La regola di comparsa NON cambia: la card esiste solo se **almeno una voce ha un costo** (chi non usa i costi non la incontra); per partire da zero il costo si mette sulla voce del **Catalogo**.
- **Verificato in Chromium sul componente VERO a 390px** (normale + cc-large): chiusa/aperta zero sbordi · «—» sulla voce senza costo · scrivendo 20 nel campo → margine +200,00 e la **%** compare in testata (tutte le voci hanno costo) · svuotando torna «—» e la % sparisce · blur formatta «20,00». ⚠️ Trappola del banco: `document.body.textContent` include il sorgente dello `<script>` inline → i probe testuali vanno fatti su `#root`, non sul body (falsi positivi al primo giro).
- **FAQ «Posso segnare quanto pago io e vedere il margine?» riscritta** (diceva «su ogni voce c'è il campo Costo» — ora falso) + ritocco FAQ Bilancio + voce in /novita. tsc+build+**733** test+smoke 28/28 verdi · scan 0/66.

### ✅ 17 ago (4) — 4 rifiniture serali: pillola «Passa a Pro» solo sul titolo · saluto · spazio mangiato (chunk CLIENT!) · 2FA alla riapertura spiegata
Quattro punti di Eli (2 foto). Il quarto è una spiegazione, non un bug.
- **[UI] «Passa a Pro» comprime SOLO il titolo, mai la descrizione**: nuova prop `hintTitle` in `MenuRow` (pillola sulla riga del titolo; `hint` resta per i badge corti a tutta altezza tipo PRO/conteggi). Usata in Altro›Account e abbonamento e Account›Abbonamento. **Verificato in Chromium a 390px**: normale = titolo intero + pillola sulla stessa riga, descrizione al 100% della colonna; **Testo grande = il titolo va A CAPO** (niente ellissi: troncare nasconderebbe informazione proprio nella modalità per leggere meglio), zero sbordi. La prop `hintBelow` (mai usata) rimossa. ⚠️ Trappola evitata: `display:'block'` inline sul `<span>` della descrizione avrebbe sovrascritto `.cc-desc { display:none }` (le descrizioni facoltative sarebbero comparse sempre).
- **[COPY] Saluto Home**: «Ciao, Elisa» → **«Ciao Elisa,»** (mobile; desktop «Ciao Elisa 👋» senza virgola). L'email `marketplace_richiesta` («Ciao, X ti ha contattato») NON toccata: lì la virgola è giusta, X è il soggetto.
- **[BUG §B.2, scoperta importante] «Al prossimo loginti verrà» — lo spazio mangiato era in un chunk CLIENT.** Lo scan del build (`.next/server/chunks/ssr/*.js`) è **CIECO sui componenti client** (TwoFactorCard sta in `.next/static/chunks/`): lo spazio dopo `</b>` è sparito ANCHE se era sulla stessa riga del sorgente. Fix `{' '}` esplicito; verificato nel chunk compilato (`"login"})," ","ti verrà`). ⚠️ REGOLA estesa: il `{' '}` dopo un elemento inline serve OVUNQUE, anche a metà riga, anche nei client component — lo scan non li copre.
- **[FAQ] La FAQ 2FA ora dice quando il codice NON viene chiesto**: solo al login (dopo «Esci» o su telefono nuovo), «chiudere e riaprire l'app riprende la tua sessione, come nelle altre app»; per ogni apertura c'è il blocco impronta. È la risposta al punto ④ di Eli («esco e rientro, non mi chiede la verifica»): comportamento VOLUTO — riaprire l'app non è un login. ⚠️ Se invece il suo flusso fosse Esci → login → dentro SENZA schermata del codice, quello sarebbe un bug vero (il gate AAL2 in `app/(app)/layout.tsx:74-79` verificato presente): da chiarire con lei.
- ✅ **Decisione COSTO chiusa nel giro (5)** (Eli: «procediamo con la tua proposta» → trasloco nella card Margine).
- tsc+build+**733** test+smoke 28/28 verdi · scan sorgente 0.

### ✅ 17 ago (3) — AUDIT AUTH (2 ALTE + 5 MEDIE chiuse) + 8 FEEDBACK dei collaudatori (2 fiscali con ricerca su fonti)
Eli: «ci sono ancora bug importanti su accesso, impronta, 2fa e login, analizza benissimo» + 8 feedback di collaudatori esterni. Revisore dedicato sull'area auth (ogni finding verificato di persona) + ricerca web su fonti ufficiali per i 2 punti fiscali.
- **[ALTA, 2FA] Lo sblocco con password DEGRADAVA la sessione da AAL2 a AAL1**: `signInWithPassword` dal client del browser (cookie condivisi) sostituiva la sessione con una NUOVA nata aal1 → un account con 2FA veniva rimandato a /mfa subito dopo lo sblocco. Ora la verifica passa da **`unlockWithPasswordAction`** (NUOVA, `lib/actions/sblocco.ts`): client usa-e-getta senza cookie (sessione e AAL2 intatti) + **rate limit** (stesso contatore del login, che prima alla lock screen MANCAVA del tutto — era un oracolo per indovinare la password senza traccia) + eventi `login_ok/failed` con `contesto: 'sblocco'` nel registro.
- **[ALTA, lucchetto] Login e verifica 2FA riuscite non contavano come «attività»** → col timeout «Ad ogni apertura» il lucchetto scattava SUBITO dopo essersi autenticati (è lo scenario A di Eli). Ora `markActive()` dopo il login riuscito e dopo verifica/recovery su /mfa.
- **[MEDIE] 4 «Esci» usavano `signOut()` GLOBALE** (default supabase-js): logoutAction, /mfa, onboarding, fullLogout del lucchetto — uscire dal telefono sloggava anche il computer («accessi richiesti a sorpresa»). Tutti a `scope:'local'` (la decisione del 12 ago era stata applicata a UN solo bottone). · **Guardia sessione-morta su null transitorio**: un 401 in race del refresh RISOLVE con user null → disattivava il blocco per sempre e sloggava (globale!) per un blip → ora ritenta una volta a 1,5s. · **BiometricPrompt non scriveva `cc_biometric_uid`** (il percorso più battuto restava «legacy senza uid», scoperto dal Layer A) → ora lo scrive. · **Loop Google con cerimonia fallita senza 404** (passkey cancellata dal gestore credenziali): nuovo ref `ceremonyFailed` → fullLogout pulisce i flag. · **Grazia `cc_2fa_flow`** (10 min, sessionStorage): passare all'app Authenticator durante l'ENROLL non fa più scattare il lucchetto a metà configurazione — stessa famiglia delle grazie WebAuthn/autofill.
- **[BASSE] `useRecoveryCode` col freno del login (10/15min) · `disableLock` legge gli esiti (niente più «disattivato» con impronte fantasma sul server) · `removeBiometric` con `hasPassword` non risolto va nella direzione sicura (`!== true`) · toast «attiva» dopo «Rigenera codici» → «Codici aggiornati» · copy 2FA: «quando fai il LOGIN (non a ogni apertura: per quella c'è il blocco impronta)» — è la spiegazione dei due scenari di Eli, che erano COMPORTAMENTI VOLUTI ma non spiegati · rotella 2FA centrata · buchi di pagina /onboarding e /reset-password/confirm annotati in PROGETTO_2FA_ENFORCEMENT.**
- **FEEDBACK COLLAUDATORI**: **#1 «è entrato da solo mentre scrivevo la ragione sociale»** = l'Invio della tastiera inviava il form onboarding coi dati a metà (il `required` passa con qualche lettera) → Invio bloccato sui campi di testo. **#4 spunta «Bonus edilizio» TOLTA** da preventivo e fattura (UI; stato+hidden restano: i documenti vecchi conservano il valore). **#7 matita → pillola «✏️ Modifica»** con l'etichetta, su preventivo e fattura. **#5 BOLLO sul REVERSE CHARGE: NON è dovuto** — ricerca su fonti ufficiali (alternatività art. 6 Tab. B DPR 642/1972; circ. 37/E/2006; la guida AdE esclude gli N6.* dall'Elenco B): la correzione dell'11 ago sovracorreggeva («IVA zero = bollo») → motore corretto (`senzaIva = forfettario`, test aggiornati 733, e il flag reverse NON toglie il bollo al forfettario che in uscita resta N2.2), FAQ e ⓘ della spunta corretti, **N17 riscritta** come conferma. **#6 FATTURE alla PA**: FPA12+CUU 6 caratteri+split payment+CIG/CUP = progetto a sé → la trasmissione ora RIFIUTA i codici destinatario a 6 caratteri con messaggio onesto («ente pubblico → dal commercialista»; prima: scarto 00427 inspiegabile). **N20** nuova per il commercialista.
- **Valutazioni SENZA codice (per Eli)**: #2 «non guardano il tutorial» e #3 «prezzo/sconto/costo non chiari» e #8 «reverse → IVA 0 automatica» — proposte nel report in chat, decisione a lei.
- ⚠️ **Da collaudare sul telefono**: sblocco con password su account 2FA (non deve più chiedere il codice), login→nessun lucchetto immediato, enroll 2FA senza lucchetto al ritorno dall'Authenticator, Esci che non slogga gli altri dispositivi. tsc+build+**733** test verdi.

### ✅ 17 ago (2) — VERIFICA PROFONDA (Eli «riparti con verifiche profonde»): 2 revisori + pipeline + 2 collaudi Chromium — 6 MEDIE + 5 BASSE chiuse
Due revisori avversariali freschi sul diff non ancora ricontrollato (15→17 ago: rifiniture tutorial, lotto 13 feedback, fix impronta/pillole), più pipeline completa e collaudo in Chromium dei fix del mattino col codice VERO. Ogni finding verificato di persona prima del fix.
- **Collaudi Chromium (codice vero, non repliche)**: ① lo script INLINE di `LockVeil` estratto dal sorgente — 4/4: senza grazia → velo · grazia fresca → niente velo (il fix del mattino) · grazia di 6 min → velo · timeout «Ad ogni apertura»+grazia → niente velo; ② il VERO `SectionTourController` (esbuild+driver.js) con lucchetto a schermo per 10,5s: a 9s aspetta senza consumare nulla, a 13s (sbloccata) la guida È partita e solo allora consuma richiesta+segno. Il banco ha anche dimostrato la guardia anti-login (path sbagliato → non parte).
- **[MEDIA, tour] La richiesta manuale di UNA guida veniva consumata da un'ALTRA**: `onHighlightStarted` faceva `removeItem` incondizionato sulla chiave unica `cc_guida_richiesta` → la guida Bilancio partita da prima-visita bruciava la richiesta pendente di Altro. Ora si consuma solo se `=== key`.
- **[MEDIA, sicurezza] La grazia `cc_lock_nav` era scrivibile ad app BLOCCATA**: AppLock non ha focus trap → con tastiera fisica un Tab+Invio «alla cieca» su «Rivedi» scriveva la grazia sotto il lucchetto e il documento nuovo si apriva SENZA blocco. Ora `conGraziaLucchetto` non scrive con `[aria-label="App bloccata"]` a schermo (la navigazione parte, il blocco ricompare — com'era prima del fix).
- **[MEDIA, copy] «I documenti che lo usano non verranno modificati» (elimina template) era FALSO per le BOZZE**: update/saveDraft ri-risolvono lo snapshot a ogni salvataggio e su un template cancellato `resolveTemplateSnapshot` ricade sul Classico (`?? classico`) → una bozza riaperta cambia stile in silenzio. Dialog e hint di template/[id] ora dicono il vero («già inviati non cambiano; le bozze passeranno al predefinito»). ⚠️ I due revisori si CONTRADDICEVANO su questo punto: verificato di persona sul codice, aveva ragione quello che lo segnalava. ⚠️ Copy dettata da Eli il 16 ago resa più precisa: da ri-validare con lei.
- **[MEDIA, copy/AGCM] «I profili Pro compaiono in cima ai risultati» senza condizioni**: il Pro-first vale SOLO nell'ordine «Consigliati» senza geolocalizzazione (professionisti/page.tsx) — con «Vicino a me» vince la distanza. Ora «…in cima ai risultati consigliati» (form vetrina ×2) e in Abbonamento il claim diventa «Profilo "In evidenza" nel marketplace» (la pillola vale in OGNI ordinamento). B.0: claim più difendibile.
- **[MEDIA, banner fatture Free] «trasmettere allo SdI resta possibile» sovra-prometteva**: la trasmissione non dipende dal limite 083, ma su Free ha il SUO contatore lifetime (8 e-fatture, `lib/sdi/quota.ts`) spesso già esaurito a quel punto → 403 paywall. Riscritto senza la promessa. + aggiunto il ramo `trial_expired` che al gemello mancava (oggi irraggiungibile, `FREE_TRIAL_ENFORCED=false`, ma al lancio la lista sarebbe rimasta senza avviso).
- **[BASSE]** pannello Font e Posizione logo (mobile, Free) portati alla stessa pillola «🔒 Solo con Pro» della riga Colore (la dicitura 11px «che si legge poco» sopravviveva a una riga dal fix di ieri) · email `marketplace_richiesta` indicava «Altro › Fatti trovare dai clienti» — la voce si chiama «Vetrina» dal 14 ago · descrizione SdI: «(o la segni come pagata)» — la conferma fiscale scatta anche da lì, non solo dall'invio · in cc-large anche «Indietro» delle guide si ingrandisce (prima solo «Avanti») · `{' '}` dopo `</strong>` nel contatore fatture · **il consumo anticipato di RESTART_KEY sul tour principale** (stessa classe del bug della guida) chiuso: si consuma solo quando il tour parte davvero, e col lucchetto si aspetta.
- **Pipeline**: smoke 28/28 · audit: chiusa 1 alta NUOVA (`nanoid`, fix non-breaking solo package-lock) → si torna alle 3 note interne a Next · esiste **Next 16.2.12** (stessa minor): annotato, non applicato in un giro di verifica — decisione a Eli o a Dependabot · `security:check` NON eseguibile da qui (niente .env.local nell'ambiente remoto): da lanciare dal computer di Eli · CLAUDE.md diceva il falso sulle migration («085/086 da applicare» — applicate il 15 ago): corretto, **001-086 tutte applicate, prossima 087**.
- **Accettati e annotati**: «X/8 fatture gratuite» vs «fatture inviate» di Abbonamento (parole dettate da Eli, coerenti col gemello preventivi) · «Completa il profilo in Home» nel tour vs card «Completa il tuo profilo» (testo dettato) · badge desktop del TemplateEditor con la veste vecchia (vista secondaria, sistema visivo suo) · dubbi da device: flip del popover side:top al passo 3, sovrapposizione BiometricPrompt+guida alla primissima visita.
- tsc+build+**732** test verdi · scan spazi puliti · frasi nuove intatte nel build.

### ✅ 17 ago — [BUG] Il rilancio del tutorial chiedeva l'IMPRONTA (e poi la guida non partiva) + 2 rifiniture «Altro»
Eli: «quando clicco su tutorial in Altro, mi chiede l'accesso con impronta ma poi non parte il tutorial. Non deve richiedermi l'accesso!» + due appunti UI sulla pagina Altro.
- **[BUG, causa in due pezzi] ① Perché chiedeva l'impronta**: `ReviewTutorialCard` naviga con `window.location.href` (pagina intera, serve uno stato pulito per driver.js). Ma una navigazione DURA non fa girare i cleanup di React → la grazia **`cc_lock_nav`** (che AppLock scrive solo allo smontaggio client-side, `AppLock.tsx:179`) non veniva MAI scritta → sul documento nuovo `LockVeil`+AppLock (`:126`) vedevano «nessuna navigazione recente» + marker di attività stantio (si aggiorna solo a sblocco/background) → LUCCHETTO in faccia a chi stava già usando l'app sbloccata. **Fix**: `conGraziaLucchetto()` scrive la grazia PRIMA di entrambe le navigazioni (guide di sezione + «Rivedi» del tour principale) — stesso meccanismo già pensato per le navigazioni in-tab (5 min, sessionStorage: l'app chiusa davvero resta bloccata), e scrivibile solo da app già sbloccata. **② Perché poi la guida non partiva**: la guardia sul lucchetto aggiunta ieri consumava il budget degli 8s del tick MENTRE il lucchetto era a schermo — mettere l'impronta richiede più di 8s → la guida rinunciava in silenzio. Ora `t0` riparte finché `appLocked()`: si aspetta lo sblocco e si parte DOPO (polling 400ms, si ferma all'unmount).
- **[UI] Un solo modo di mostrare «Pro»**: la pillola «Passa a Pro» (hintBelow, Altro›Account e Account›Abbonamento) era navy mentre Bilancio ha la pillola PRO oro → ora entrambe con la STESSA veste oro (`#e8d6ad`/`#b0863e`).
- **[UI, MISURATO in Chromium] La descrizione di «Account e abbonamento» si fermava al 70%** della colonna a 390px (la riga 1 finiva a «i tuoi dati,» — «non arriva in fondo a destra come le altre»). Misurate 5 varianti d'ordine a 390 e 360px col font Inter vero: vince **«Accesso, sicurezza, commercialista, i tuoi dati, piano e inviti»** (96% a 390px, 97% a 360px; l'alternativa al 100% a 390 crollava al 90% a 360). In più «commercialista» sale in testa, coerente col punto #10 di ieri.
- ⚠️ **Da collaudare sul telefono**: guida di Altro da Aiuto›Tutorial senza richiesta d'impronta; e il caso legittimo lucchetto→sblocco→guida che parte. tsc+build+**732** test verdi.

### ✅ 16 ago — LOTTO di 13 FEEDBACK di Eli (copy + UI + bug tutorial): tutti chiusi
Eli: 13 punti, strategia approvata («tutto ok»), con copy RIVISTO da lei per #7 e #8. Prima di scrivere le due frasi fiscali ho verificato DI PERSONA sul codice che sono vere: il pilota SdI programma davvero a **+24h** con l'«Annulla» sulla fattura (`conferma-fiscale.ts:61` + cron `sdi-auto` + `SdiCard`), e la card **«Economia del lavoro» esiste** (`lavori/[id]/page.tsx:254`, Preventivato/Speso/Margine).
- **#1 Fatture Free: banner «X/8 fatture gratuite»** (gemello del banner preventivi, `fatture/page.tsx`). ⚠️ Il limite 083 morde sull'**INVIO**, non sulla creazione → l'avviso dice «non puoi inviarne altre (bozze e trasmissione SdI restano)» e **NON** disabilita «Nuova fattura». Contatore da `checkFreeBlock(ws,'fattura')` → `sent_invoice_quota_used`. Coerenza: già in Abbonamento e Preventivi.
- **#2 Calcoli**: tolto «, col tasto «Usa»» (testo esatto di Eli).
- **#3 Template › Colore (Free)**: la dicitura «Pro» era 11px oro tenue, si leggeva poco → pillola bordata **«🔒 Solo con Pro»** 12,5px (mobile).
- **#4 Elimina template**: «I documenti che lo usano — preventivi e fatture — non verranno modificati» (verificato: `deleteTemplateAction` cancella solo la riga template, i documenti non si toccano). Tenuta la riga «non è reversibile».
- **#5 Richieste**: tolto «senza i dettagli».
- **#6 Marketplace**: «I profili Pro compaiono in cima ai risultati» (via «; il tuo è comunque presente») + «modulo sotto al profilo» (via «qui»).
- **#7 SdI (impostazioni)**: riscritta a **DUE stati** come Eli — «**Spunta accesa (consigliato)**» (il giorno dopo parte da sola, 24h per ripensarci, si ferma con un tocco nella fattura) · «**Spunta spenta**» (a mano dal tasto nella fattura + conto alla rovescia dei 12 giorni). Intro «cos'è lo SdI» tenuta.
- **#8 Manodopera (impostazioni)**: copy di Eli — spiega cos'è il **margine** (tra preventivato e speso) a chi non ha mai usato l'app, e rimanda a **«Economia del lavoro»**. (Combacia con la FAQ manodopera che già citava «Economia del lavoro».)
- **#9 Notifiche**: tolta la nota «Sempre attivi: …». I due avvisi restano sempre-attivi in `lib/notifications.ts` (comportamento invariato), non lo spieghiamo più — «non avvisiamo e basta» (Eli).
- **#10 Altro/Account**: «Passa a Pro» spostato **SOTTO** la descrizione (nuova prop `hintBelow` in `MenuRow`, pillola navy), sia in Altro›Account sia in Account›Abbonamento. **«I tuoi dati e commercialista»**: descrizione riscritta per **puntare al collegamento** del commercialista («Collega il tuo commercialista ai tuoi documenti · scarica i tuoi dati»); nella pagina Dati la card **«Invita il commercialista» promossa SOPRA** il pacchetto CSV; idem la descrizione nel **tutorial di Altro**. La feature è reale (`AccountantCard` → area /studio read-only) e la FAQ «Come collego il mio commercialista?» già inquadrava così → ora l'UI combacia.
- **#11 Referral**: «Il tuo beneficio se porti **3 amici**» (era «un amico»; il premio scatta davvero a 3, logica referral §13).
- **#12 Tutorial di Altro (BUG)**: non partiva alla prima visita, e da rilancio manuale con sessione scaduta partiva sulla schermata di **LOGIN**. Tre cause chiuse in `SectionTourController`: ① il segno «già vista» si scriveva **PRIMA** che un passo comparisse → se la guida veniva distrutta (redirect/unmount) restava «vista» senza essersi mostrata → ora si scrive in **`onHighlightStarted`** (solo quando un passo è DAVVERO evidenziato); ② nessuna guardia sul lucchetto → aggiunta come il tour principale (`[aria-label="App bloccata"]`); ③ nessuna guardia sul redirect → `tick` controlla `window.location.pathname.startsWith(tour.path)` (mai su /login). La richiesta manuale si consuma solo quando il passo compare. **`TourCleanup`** (layout auth) ora ripulisce **due volte** (subito + 300ms) per catturare un overlay appeso nell'istante dello scambio di layout. ⚠️ **Da collaudare sul telefono** (i flussi auth/redirect si provano solo su device).
- **#13 Aiuto**: la descrizione in anteprima di «Aiuto e contatti» (e della voce-hub «Aiuto e novità») ora cita i **tutorial**.
- FAQ: rilette le pertinenti (manodopera, SdI auto, commercialista, vetrina, notifiche) — **nessuna toccata**: anzi le modifiche allineano l'UI a ciò che le FAQ già dicevano. tsc+build+**732** test verdi · scan spazi puliti (source 0 · build solo valori tecnici, phrase-check con spazi intatti).

### ✅ 15 ago (12) — Tutorial: 6 rifiniture (collaudo Eli) + piano chiusura 2FA
Feedback di Eli sul giro guidato + richiesta di pianificare la chiusura del limite 2FA.
- **[a] «Testo grande» ora ingrandisce ANCHE le scritte del tutorial.** Il popover di driver.js è **contro-zoomato** a 0.87 in cc-large (per tenere la POSIZIONE corretta: coordinate in px da getBoundingClientRect dentro il body zoomato) → il testo restava a dimensione normale. Il popover ha zoom netto 1.0, quindi in cc-large porto le dimensioni del testo a ×1.15 (titolo 17, descrizione 15, progress 12.5, bottone 15): la posizione non si tocca, il popover cresce solo in altezza. Gli elementi con px inline (badge demo, bottone «testo grande») restano fissi — sono decorativi.
- **[b] Passo 1: solo «Altro» illuminato**, non tutta la barra. `cc-tour-lift` alza l'intera nav sopra l'overlay (per far vedere la tab marcata) → tutta la barra risultava chiara. Nuova regola: `.driver-active nav.cc-tour-lift > div > *:not(.cc-tour-mark) { opacity: .32 }` → le altre celle si attenuano, resta illuminata solo «Altro».
- **[c] Passo 2: il «+» E la scritta «Crea» evidenziati insieme.** Il cerchio «+» sporge ~22px sopra il box del bottone (margine negativo, load-bearing per l'altezza barra), quindi il ritaglio (`stagePadding: 6`) ne tagliava la cima. `startPhase` ora accetta uno `stagePadding` per fase: **Fase A a 24** (copre il + sporgente e «Crea»); Fase B resta 6. Nessun tocco alla geometria della barra.
- **[d] Passo 3: il riquadro non copre più le voci.** Ora si evidenzia la **voce** (col microfono) invece della card Cliente → il popover scende SOTTO la voce; la card Cliente resta segnata in alto con l'anello. ⚠️ **Da collaudare sul telefono** (il giro non è verificabile qui): se lo scroll fosse strano, si torna a evidenziare la card Cliente.
- **[e] Passo 4: tolta «Il numero viene assegnato da solo».**
- **[f] Ultimo passo**: «A ogni documento viene associato un badge di stato, che ti dice a colpo d'occhio com'è andata» + «Per il resto» → «**Per procedere con tutte le funzioni**, segui Completa il profilo».
- **[PIANO] Chiusura del limite 2FA** (`PROGETTO_2FA_ENFORCEMENT.md`): spostare il gate AAL2 dal layout `(app)` al **middleware** (`proxy.ts`), così copre anche le POST delle server action; le API route autenticate restano da gate a parte (Fase 2). Fail-open, `/mfa` escluso, latenza da misurare. **Non implementato**: cambio sicurezza-critico al proxy → dopo l'ok di Eli.
- tsc+build+732 test verdi · scan spazi puliti (il testo del tutorial è in stringhe HTML, non JSX → il bug Turbopack non si applica).

### ✅ 15 ago (11) — RICONTROLLO della sessione (Eli «ricontrolla uno per uno»): 2 revisori, 1 ALTA + 5 MEDIE/BASSE chiuse, 1 limite dichiarato
Due revisori avversariali freschi sull'intero diff della sessione (auth/2FA/loop impronta/signup · lavoro/rapportino/margine/listino), ogni finding verificato di persona prima del fix. Io ho verificato a parte login P1/P4, campanella `listino_scaduto` e `/api/cron/health`: puliti.
- **[ALTA, AppLock — bug mio di stamattina] Un errore TRANSITORIO dell'options passkey disattivava un'impronta VALIDA.** `if (!optRes.ok)` trattava OGNI non-200 come «passkey morta», ma `/api/passkey/auth/options` dà **404 solo** se non ci sono passkey; dà **401** se il refresh token è in race all'apertura (proprio quando parte l'attivazione automatica) e **5xx** su un blip. Scenario: account Google con passkey valida → 401 transitorio → `setBiometricEnabled(false)` (impronta spenta per sempre) + `deadPasskey` → compariva «Rimuovi il blocco e continua» e l'utente toglieva il blocco per un hiccup di rete. **Fix**: solo `optRes.status === 404` entra nel ramo passkey-morta; 401/5xx = transitorio, non tocca i flag (in auto silenzio, in manuale «Riprova tra un istante»).
- **[MEDIA, 2FA] `confirmTotpEnroll` non era atomico**: `challengeAndVerify` accende il 2FA sul server PRIMA di salvare i codici di recupero; se l'insert falliva, il 2FA restava ON con ZERO codici → lockout se perdi il telefono. **Fix**: rollback del fattore (`admin.deleteFactor`) sull'errore d'insert → «tutto o niente».
- **[MEDIA, 2FA] `regenerateRecoveryCodes` ingoiava l'errore dell'insert** → mostrava 10 codici che nel DB non esistono (e cancellava i vecchi). **Fix**: legge l'errore, non restituisce codici fantasma.
- **[MEDIA, rapportino] `saveRapportoAction`: un errore sull'update del flag «mostra ore» faceva credere che l'INTERO salvataggio fosse fallito** (nessun link restituito) mentre il testo era già in DB. **Fix**: l'update del flag è **best-effort** (logga, non fa fallire la risposta) — il default è «ore nascoste», quindi un mancato salvataggio lascia il dato privato (direzione sicura).
- **[BASSE]** `hasLaborHours` era vero anche col solo timer acceso (0 min salvati) → spunta senza effetto per il cliente: ora solo su ore SALVATE · la riga «Ore lavorate … non contate nel margine» compariva anche SENZA costo orario (fuorviante: il toggle non aveva effetto) → ora anche `hourlyCost != null` · `listinoScaduto` compariva sulle note di credito (uno storno non ha margine) → gated su `!isNota` · **evento di sicurezza** `mfa_recovery_used` all'uso di un codice di recupero (traccia: se non sei stato tu, qualcuno con la tua password è entrato aggirando il 2FA) · focus dentro il modale signup (a11y).
- ⚠️ **LIMITE DICHIARATO (non un bug introdotto ora, ma segnalato dal revisore) — l'enforcement 2FA è solo a livello di PAGINA.** Il redirect a `/mfa` vive nel layout `(app)`; le **server action e le API route** non controllano l'AAL, quindi un attaccante con la SOLA password di un account 2FA (sessione aal1) è bloccato dall'interfaccia ma potrebbe invocare direttamente le action. È il limite noto di Supabase MFA. Documentato nell'header di `lib/actions/mfa.ts`: chiuderlo davvero richiede un check `currentLevel==='aal2'` nel **middleware** per i path `(app)` (copre anche i POST delle action) — cambio sicurezza-critico al proxy, **da fare in un giro dedicato** prima di considerare il 2FA una barriera dura. Oggi il 2FA alza comunque l'asticella e il fail-open non chiude fuori nessuno. **Decisione a Eli.**
- **Verificati PULITI dai revisori (con prova)**: `fullLogout` non riduce la sicurezza per account con password (ramo gatato `!hasPassword`) · guardia uid non è un falso positivo per l'utente legittimo · riuso codice di recupero impossibile (`used_at` + delete + unique index) · `remainingCodes` corretto · enforcement fail-open corretto (redirect fuori dal try) · `/mfa` non fa loop · admin client = service_role, nessun IDOR · nessun percorso residuo espone le ore al cliente col flag off (3 superfici + il builder gatati) · la spunta ore è bloccata dopo la firma · sentinella `count_labor_presente` e default corretti · refactor listino senza regressioni sui preventivi · destructuring del `Promise.all` allineato.
- tsc+build+**732** test verdi.

### ✅ 15 ago (10) — Le ORE del rapportino sono un dato interno: nascoste al cliente, spunta per mostrarle (⚠️ migration 086)
Eli: *«il numero vero di ore deve rimanere solo per l'artigiano. Anche nel rapportino non devono comparire, o far scegliere con una spunta se mostrarle»*. Ha ragione — le ore sono un dato interno come costo/ricarico/margine (§B.2): il cliente potrebbe contestare il prezzo o dedurre quanto sei veloce. Finora il rapportino le mostrava **sempre**.
- **⚠️ migration 086** (`lavori.show_labor_to_client BOOLEAN NOT NULL DEFAULT false`, VALIDATA su PG16: default `f`, idempotente, attivabile). **Default nascoste.**
- **Spunta «Mostra le ore al cliente»** in `RapportinoCard` (solo se ci sono ore da mostrare, `hasLaborHours`), salvata da `saveRapportoAction` con **update SEPARATO e tollerante** (pre-086 il salvataggio del rapportino non deve fallire) + guardia `.is('report_signed_at', null)` come il testo. Riscritta la nota vecchia («il cliente vede anche le ore segnate»).
- **Tre superfici del cliente gatate sul flag**: pagina `/r/[token]` (retry-without su 42703), PDF cliente `/r/[token]/pdf`, e — importante — l'**anteprima dell'artigiano** `/api/lavori/[id]/rapportino-pdf`, che è dichiarata «stessa vista del cliente» → rispetta anch'essa la spunta. Le ore vere restano SEMPRE all'artigiano nella **scheda Lavoro** («Economia del lavoro»), dove già vivono.
- ⚠️ **La lettura del flag sulla pagina Lavoro è una query A SÉ tollerante**: metterla nel select condiviso avrebbe fatto fallire l'intera query pre-086, perdendo anche ore e recall. Colonna assente ovunque → `false` (= nascoste, il default voluto).
- **FAQ** del rapportino aggiornata (ore private, spunta per mostrarle).
- ⚠️ **Da applicare da Eli**: la **migration 086** (SQL in chat). tsc+build+**732** test verdi · scan spazi puliti · migration validata su PG16.

### ✅ 15 ago (9) — LISTINO FASE 3, rifiniture: avviso «listino scaduto» sulle fatture + manodopera fuori dal margine (⚠️ migration 085)
Ultime due rifiniture del progetto listini (fase 3), chiuse una per una.
- **[avviso duplica listino scaduto] L'avviso sui costi di un listino SCADUTO ora vale anche sulle FATTURE.** Esisteva solo sui preventivi ed era legato alla validità (logica preventivo). L'ho **separato** in due (`PreventivoForm`): il ramo **«scaduto»** (giorni<0, i costi potrebbero non essere più veri → riguarda il MARGINE) vale su preventivi E fatture — una **fattura duplicata** da un vecchio preventivo eredita quei costi; il ramo **«in scadenza + Allinea validità»** resta solo preventivi. `supplierLists` ora passato anche alla pagina fattura (query tollerante pre-063, gemella di quella dei preventivi).
- **[manodopera nel margine — decisione Eli via AskUserQuestion: «toggle sul Lavoro per escluderla»]** Oggi la scheda Lavoro conta SEMPRE la manodopera (`hourly_cost × ore del timer`) nello «Speso». **⚠️ migration 085** (`workspaces.count_labor_in_margin BOOLEAN NOT NULL DEFAULT true`, VALIDATA su PG16: default `t` sulla riga esistente, idempotente, spegnibile→`f`): interruttore in **Impostazioni › Fiscale** («Conta la manodopera nel margine», default **ON** = comportamento storico). Spento → `laborCost = 0`, e sul Lavoro le ore si mostrano come sola informazione («Ore lavorate … non contate nel margine»), così il dato non si perde. **Perché il toggle**: per un forfettario le sue ore non sono soldi usciti dal conto — contarle fa apparire il margine più basso del guadagno reale in cassa (stesso doppio-binario del Bilancio).
- ⚠️ **Perché NON l'ho fatto sui DOCUMENTI** (preventivo/fattura): lì non ci sono ore tracciate (il timer è solo sul Lavoro), quindi qualunque cifra sarebbe inventata. La manodopera resta contata solo dove le ore sono vere.
- **Il toggle è controllato** → ha l'ascoltatore del `reset` di React 19 (§B.2) e la **sentinella** `count_labor_presente` per non azzerarsi dall'onboarding (stessa action senza il campo). Update tollerante pre-085. **Trappola TDZ presa dal build** (non da tsc-via-head): `countLabor` era referenziato nel ref block prima della sua dichiarazione → spostato in cima. ⚠️ REGOLA confermata: `npx tsc | head` MASCHERA l'exit di tsc — verificare l'exit vero.
- **FAQ**: nuova «Nel margine del lavoro contano anche le mie ore? Posso escluderle?» + aggiornata quella sul timer (rimanda al toggle).
- ⚠️ **Da applicare da Eli**: la **migration 085** (SQL in chat). tsc+build+**732** test verdi · scan spazi puliti · migration validata su PG16.

### ✅ 15 ago (8) — Il LOOP dell'impronta (collaudo Eli) + il «Account creato» come pop-up
Eli, rifacendo il login: era entrata con Google su un account poi cancellato a mano su Supabase, ricreato tutto, e sul telefono restava intrappolata — «tocco per l'impronta, esce *Impronta non disponibile. Esci e rientra con Google.*, esco e rientro, stessa cosa, non me la chiede mai». Loop reale.
- **CAUSA, verificata sul codice**: l'impronta (passkey) è registrata sul SERVER contro un utente preciso; il flag LOCALE `cc_biometric` sopravvive al cambio/cancellazione account. Con un nuovo account Google (senza passkey), il lucchetto compariva, `/api/passkey/auth/options` rispondeva **404** («nessuna impronta per questo utente») → «Impronta non disponibile». E l'uscita **non rompeva il loop**: `fullLogout` puliva i flag solo `if (!hasPassword && !isBiometricEnabled())`, ma `isBiometricEnabled()` era ancora `true` (flag stantio) → flag non puliti → ri-login → lucchetto di nuovo → **loop**.
- **Fix in due strati**. **Layer A (radice, per il futuro)**: l'impronta è ora **legata all'id dell'utente** (`cc_biometric_uid`, scritto in `BiometricToggle.addBiometric` e ripulito alla disattivazione). In AppLock, se l'uid salvato **non combacia** con l'utente collegato, il blocco stantio si toglie da solo prima ancora di comparire — niente schermata da incubo. **Layer B (rete, copre anche i flag legacy senza uid — il caso ATTUALE di Eli)**: quando lo sblocco impronta riceve **404** (passkey inesistente per questo utente), si smette di offrirla e — su un account Google (senza password) — compare **«Rimuovi il blocco e continua»** (sei già connesso: la sessione sotto il lucchetto è valida, e per un account Google il blocco impronta non è comunque una barriera, decisione 21 lug). `fullLogout` ora pulisce i flag anche quando la passkey è morta.
- ⚠️ **`deadPasskey` è un FATTO, non dipende da `hasPassword`**: il test in Chromium ha scoperto che l'attivazione automatica dell'impronta parte PRIMA che `getUser` risolva `hasPassword` → gatare la via d'uscita su `hasPassword` la lasciava spenta. Ora la si imposta sempre sul 404; è il **render**, a `hasPassword` risolto, a scegliere quale uscita mostrare (Google → bottone «Rimuovi il blocco», con password → campo password).
- **Verificato in Chromium sul componente VERO** (esbuild, stub del solo client Supabase + fetch 404, localStorage servito da un'origine http): **Layer B** — lucchetto a schermo, impronta 404, «Rimuovi il blocco e continua» compare, il clic sblocca e azzera `cc_biometric`/`cc_lock`, zero sbordi; **Layer A** — con `cc_biometric_uid` di un altro account il lucchetto sparisce da solo dopo il getUser e i tre flag tornano `null`.
- **[UI] «Account creato! Controlla la tua email» ora è un POP-UP** (`SignupForm`, richiesta di Eli): da banner in linea a **modale in portal su `document.body`** (regola §B.2: gli overlay a schermo intero vanno in portal), chiudibile con la **X**, toccando lo sfondo o con **Esc**. Stesso testo e stesso link a `/verifica-email`.
- **[RISPOSTA, nessun codice] «Non mi arriva la mail di conferma»**: è il comportamento **anti-enumerazione** (audit 24 lug), non un guasto. La sua email risulta **già registrata** in `auth.users` — o perché la cancellazione manuale su Supabase ha tolto una riga applicativa ma NON l'utente di Auth, o perché quell'indirizzo era nato come account **Google** (già confermato). In entrambi i casi Supabase **non manda una seconda conferma** (`signupAction` risponde `verifica-email` senza inviare nulla). Per sbloccarsi: cancellare l'utente **da Supabase → Authentication → Users** (non solo la riga workspace), poi ri-registrarsi; oppure usare un'altra email; oppure, se è un account Google, entrare con **Accedi con Google** (nessuna conferma serve). Il riquadro ambra su `/verifica-email` lo spiega già.
- tsc+build+**732** test verdi · scan spazi puliti. ⚠️ **Da collaudare sul telefono vero**: i flussi auth si provano solo su device. Per uscire ORA dal loop senza aggiornare: cancellare i dati del sito `cartacanta.app` (Impostazioni del browser → dati dei siti), che azzera i flag locali del blocco.

### ✅ 15 ago (7) — 2FA (verifica in due passaggi): TOTP + codici di recupero (⚠️ migration 084 + abilitare MFA su Supabase)
Deciso con Eli: TOTP (app Authenticator) con **codici di recupero**, **proposto al passaggio a Pro**, solo artigiani. Feature grande e auth-critical → costruita con cura, fail-safe.
- **`lib/mfa/recovery-codes.ts`** (PURO, **+7 test**): `generateRecoveryCodes` (10 codici XXXX-XXXX, alfabeto senza caratteri ambigui), `normalizeRecoveryCode`, `hashRecoveryCode` (SHA-256 — si salva SOLO l'impronta, mai il codice in chiaro).
- **⚠️ migration 084** (`mfa_recovery_codes`, **VALIDATA su PG16 reale**: idempotente, RLS attiva SENZA policy come security_events, unique `(user_id, code_hash)`, indice parziale sui non usati). ⚠️ Da applicare da Eli. `types/database.ts` non toccato (le action usano l'admin client `as any`).
- **`lib/actions/mfa.ts`**: `startTotpEnroll` (enroll TOTP → QR+segreto, ripulisce i fattori non verificati), `confirmTotpEnroll` (challengeAndVerify → genera+salva i codici, li mostra una volta), `regenerateRecoveryCodes`/`disableTotp` (richiedono AAL2), `useRecoveryCode` (login a AAL1: verifica l'impronta, marca usato, **rimuove il fattore con l'API ADMIN** `auth.admin.mfa.deleteFactor` — che non richiede AAL2 — così si rientra e il 2FA si disattiva).
- **Enforcement** in `app/(app)/layout.tsx`: se `currentLevel=aal1 && nextLevel=aal2` → `redirect('/mfa')`. ⚠️ **FAIL-OPEN**: la lettura AAL è in try/catch e il `redirect()` sta FUORI (NEXT_REDIRECT non va inghiottito) — un bug qui non chiude fuori nessuno, al massimo non impone il 2FA. Raggio d'azione ai soli opt-in.
- **`/mfa`** (fuori dal gruppo (app) per non fare loop): schermata di verifica (codice a 6 cifre → challengeAndVerify, oppure codice di recupero → `useRecoveryCode`, oppure Esci). Il proxy la lascia passare (utente autenticato).
- **UI** in Account › Sicurezza (`TwoFactorCard`): Attiva → QR → codice → **codici di recupero** (copia/salva) → attivo; da attivo: rigenera / disattiva. **Nudge** (`TwoFactorNudge`) sulla pagina Abbonamento per i piani a pagamento (si nasconde se già attivo o Free). FAQ nuova.
- ⚠️ **PREREQUISITI MANUALI di Eli**: ① applicare la **migration 084**; ② **abilitare MFA/TOTP** nel progetto Supabase (Auth → Multi-Factor). Senza, l'attivazione mostra un errore chiaro e il resto è inerte. ⚠️ **NON collaudabile qui** (rete bloccata, MFA non abilitato, nessuna sessione reale): tsc+build+**732 test** verdi, logica dei codici testata, migration validata su PG16 — ma il **flusso live va provato sul telefono** con un'app Authenticator vera.
- ⏭️ Resta la rifinitura listino fase 3 (manodopera nel margine + avviso duplica).

### ✅ 15 ago (6) — LOGIN/ACCESSO: chiusi i 4 problemi del collaudo di Eli (piano approvato)
Eli, cancellando l'account a mano su Supabase e rifacendo il login, è rimasta **intrappolata** su «Configura la tua attività · Workspace non trovato» senza via d'uscita; il blocco impronta ricompariva ad account inesistente dicendo «usa la password» che un account Google non ha; il tutorial spuntava sopra il blocco. Piano in `PROGETTO_LOGIN_ACCESSO.md`, approvato da Eli, poi implementato.
- **P1 — trappola «Workspace non trovato»** (`updateWorkspaceData`): se l'utente autenticato non ha workspace (cancellato a mano, o mai creato perché la sessione era già viva e non è ripassato dal callback OAuth che chiama `ensureWorkspace`), ora l'onboarding **crea il workspace** invece di rifiutare. + **«Esci e torna al login»** sempre presente sull'onboarding (via d'uscita).
- **P2 — guardia sessione** (`AppLock`): prima di intrappolare nel lucchetto, `getUser()`; se l'account non esiste più (`user` null = sessione morta, non offline) → pulisce i flag locali del blocco e va a `/login`.
- **P3 — copy coerente** (`AppLock`): a un account **Google** non si dice più «usa la password» (non ce l'ha) — ovunque diventa «esci e rientra con Google» (sottotitolo, errori dopo l'impronta, bottone in fondo). **Verificato con Chromium** sui due varianti: Google → nessun campo password, mai «usa la password», errore «…esci e rientra con Google»; email → campo password + «…usa la password». 0 sbordi.
- **P4 — tutorial mai sopra il blocco** (`TourController`): il tour di /dashboard non parte se il lucchetto (`[aria-label="App bloccata"]`) è a schermo. Il difetto: il lucchetto copre /dashboard ma la rotta sotto è /dashboard, quindi il tour partiva sopra.
- ⚠️ **Da collaudare sul telefono vero** (i flussi auth si provano solo su device). tsc+build verdi. Per sbloccarsi ORA Eli: cancella i dati del sito `cartacanta.app` + cancella l'utente in Supabase Auth, poi registrati (§4 del progetto).

### ✅ 15 ago (5) — LISTINO FASE 3, parte 1: campanella «listino scaduto» (guardiano)
Secondo lavoro senza-decisioni dopo l'analisi «cosa manca». Il pilastro D del progetto listini (`PROGETTO_LISTINO_FORNITORE.md`): avvisare quando un preventivo ancora aperto usa i prezzi di un listino fornitore SCADUTO — il cliente potrebbe accettare un prezzo che il fornitore non fa più.
- **Nuovo tipo notifica `listino_scaduto`** in `lib/notifications.ts` (pattern `richiesta`): due query in parallelo nel Promise.all — ① `supplier_lists` con `valid_until < oggi` (063, tollerante) · ② i `supplier_list_id` USATI da documenti sent/viewed (join `document_items`→`documents!inner`). Si avvisa **solo sui listini scaduti effettivamente in uso** (intersezione in JS): un listino scaduto ma non usato non è urgente, la campanella non deve diventare rumore. Chiave `listino_scaduto:{id}` (regex markRead ok), href al dettaglio listino.
- **Wiring completo**: `TYPE_ICON` (Tag, arancio) in NotificationList · toggle **«Listino fornitore scaduto»** in Impostazioni › Notifiche · `inapp_listino_scaduto` nello Zod di `workspace.ts`, in `extractNotifPrefs` e nei DEFAULT_PREFS (tsc totale-record li ha forzati tutti). **Nessuna migration** (il toggle vive nel JSONB dei prefs). FAQ listini estesa con l'avviso.
- ⚠️ **Fail-safe**: entrambe le query sono in `try/catch` → se il join fosse malformato, niente notifica (mai un crash). ⚠️ **Da verificare in collaudo con dati veri**: il join `document_items`→`documents!inner` non è testabile qui senza un DB reale (l'ambiente blocca la rete); degrada in silenzio, ma va provato con un preventivo aperto che usa un listino scaduto.
- ⏭️ **Restano di fase 3** (rifiniture, giro suo): interruttore «conta la manodopera nel margine» (default OFF, `hourly_cost`×ore in `lib/margine/calcolo.ts` — potrebbe servire un flag workspace) · avviso su duplica da listino scaduto.
- tsc+build+**725/725** verdi · scan spazi puliti.

### ✅ 15 ago (4) — HEARTBEAT dei cron: se un lavoro automatico si ferma, lo sappiamo (RISCHI 3.7)
Dopo l'analisi «cosa manca» (confronto coi documenti + checklist app pronta al lancio). Deciso con Eli: solo artigiani (niente ritenuta 20%/cassa), e si procede coi lavori senza decisioni. Primo: il **heartbeat dei cron**.
- **Il problema**: i cron erano silenziosi. Se `sdi-auto` o `expire-documents` smettessero (deploy rotto, env mancante, guasto Vercel) nessuno se ne accorgerebbe finché un artigiano non si lamenta — fallimento silenzioso su roba fiscale = caso peggiore.
- **`lib/cron/heartbeat.ts`** (NUOVO, **+9 test**): `recordCronRun(name, meta)` scrive un «battito» in `security_events` (kind `cron_ok`) — **nessuna migration** (riusa la 071, tollerante se assente). `checkStaleCrons(now)` legge l'ultimo battito di ciascun cron e segnala quelli oltre la soglia (`isCronStale` PURA e testata). `CRON_JOBS`: sdi-auto 3h · expire-documents 30h · referral/orphan 33 giorni.
- **I 4 cron istrumentati**: `recordCronRun('<name>', {…contatori})` prima del return di successo (chiamata non-lanciante, best-effort).
- **`/api/cron/health`** (NUOVO, watchdog, in vercel.json `0 7,19 * * *`): CRON_SECRET fail-closed, legge i battiti (4 query in **parallelo** con `AbortSignal.timeout(8s)` → un guardiano non si blocca mai) e, se qualcuno è fermo, **email a supporto@** (`cron_alert.tsx`). Registra il proprio battito ma **non sorveglia sé stesso** (limite «chi controlla il controllore» dichiarato: un blackout totale lo vede il monitor di uptime).
- ⚠️ **Nessun falso allarme al primo deploy**: un cron che non ha MAI battuto (`lastOk` null) NON è «fermo» — è cold-start. Entro il primo ciclo ogni cron scrive il suo battito e da lì la freschezza è verificabile.
- **Verificato**: 401 senza token · `{"ok":true,"stale":[]}` con token, gracioso anche col DB irraggiungibile (~7s, non si impianta) · 9 test sulla logica pura · tsc+build. Nessuna azione manuale di Eli (i cron si registrano al deploy).

### ✅ 15 ago (3) — LOTTO L3 di 5 feedback (0-4), uno per uno
Eli, altra lista corta dopo il lotto da 12. Chiusi tutti.
- **#0 Onboarding «Configura la tua attività»**: tolto **«Salta per ora»** dal passo dati (la ragione sociale è obbligatoria — senza, i documenti non hanno intestazione e l'app rimanda qui). Ragione sociale ora con **asterisco rosso** e sotto una **legenda** «* Campo obbligatorio. Gli altri puoi aggiungerli ora o più avanti dalle Impostazioni». ⚠️ La domanda di Eli «e la seconda pagina?»: nel flusso mostrato oggi i passi sono **due** — dati (passo 1) e «Tutto pronto!» (passo 2, la festa con «Vai alla dashboard»). Il vecchio passo Logo con un suo «Salta» è **codice morto non montato** (3 ago): non si vede. Quindi non c'è una seconda pagina-dati da cui saltare; «Vai alla dashboard» sul passo 2 fa già da uscita.
- **#1 Card del sopralluogo a SEZIONI collassabili** (`SopralluogoForm`): le tre parti («l3 sezioni non sono divise e chiare, Agenda prende molto spazio») diventano **card apribili/chiudibili come le voci del preventivo**, nuovo componente `Sezione` (intestazione con icona + titolo + **riepilogo** quando chiusa + chevron che ruota). **Cliente e cantiere** e **Appunti e misure** aperte di default; **Foto** chiusa (riepilogo «N foto»). L'**Appuntamento** (l'Agenda che «prende spazio») è un blocco annidato **chiuso di default** dentro «Cliente e cantiere» (riepilogo «GG/MM · HH:MM» o «Nessuno · facoltativo»); resta aperto se l'appuntamento esiste già, e **non si può chiudere finché l'ora manca** (il picker deve restare visibile per correggere — finding M4 rispettato). Verificato con Chromium a 390px: 0 sbordi, chevron sempre dentro la card, riepiloghi lunghi troncati con ellissi. FAQ «appuntamenti e agenda» aggiornata (l'Appuntamento ora si apre dalla sezione «Cliente e cantiere»).
- **#2 Ordinamento liste**: default **«Ultima modifica»** (`updated_at DESC`) su Preventivi e Fatture, memoria **separata per-pagina** già nei cookie di sessione (`cc_sort_preventivi`/`cc_sort_fatture`). `DEFAULT_SORT='recent'` in `SortSelect`; nel branch di query `'oldest'` è ASC esplicito e il default (`else`) è DESC. Niente «flip» (il cookie si legge server-side). §B.2 aggiornata.
- **#3 «Testo grande e leggibile» → «Testo grande»** (toggle `TextSizeToggle`, FAQ, /novita). Il bottone del tour diceva già «Testo grande».
- **#4 Sopralluogo «presi presso il cliente»** invece di «presi dal cliente» (menu «+», hub «Clienti e appuntamenti», ricerca app). «dal cliente» leggeva come «fatte dal cliente»; «presso» = a casa sua.
- tsc+build verdi · scan spazi puliti (build minuscole + sorgente maiuscole).

### ✅ 15 ago (2) — LOTTO DI 12 FEEDBACK di Eli, tutti chiusi e in produzione (uno per uno)
Eli: *«nuovi feedback da elaborare e poi implementare uno per uno in modo impeccabile»*. 12 punti, 3 decisioni prese via AskUserQuestion (unione Altro: **Abbonamento dentro Account**; forma sezioni: **elenco→sotto-pagine**; notifiche: **snellisci**).
- **#1 Parole attaccate** (Turbopack): 2 casi reali corretti con `{' '}` — «dalle<b>note</b>» nel riquadro AI e «Bloccato</b> nella lista» nella FAQ downgrade. Scan build (minuscole) + sorgente (maiuscole) puliti.
- **#6 Barra in basso**: i centri erano già equidistanti (griglia 5 col); il difetto era il ritmo verticale — «Crea» stava 14px più in alto. Ora sporge solo il cerchio (`marginTop` sul cerchio), le 5 etichette allineate (Chromium: bottom 689 identico).
- **#3 Sconto compatto** (`DiscountField`, NUOVO, condiviso preventivo+fattura): un solo campo con interruttore %/€, tra Subtotale e Imponibile. ⚠️ **Motore fiscale intatto** (regola F): applica ancora `discount_pct` E `discount_fixed`, l'interruttore cambia solo QUALE modifichi, l'altro resta in un input nascosto → nessun valore perso.
- **#10 Cestino coi sopralluoghi**: `CestinoInline` passa da `docTypes` a `scope` (all/preventivo/fattura/sopralluogo); nuove azioni `restoreSopralluogoAction`/`purgeSopralluogoAction` (il purge toglie anche le foto dallo storage). Tab «Cestino» anche nella lista Sopralluoghi.
- **#9 «Qualcosa è andato storto» al rientro**: ipotesi = chunk vecchio dopo un deploy (si pubblica a ogni commit). `lib/chunk-error.ts` (NUOVO) + error boundary (app+globale) riconoscono l'errore di chunk e **ricaricano da soli** («Aggiorno l'app…»), con guardia anti-loop (20s → se torna, è un errore vero, si mostra). ⚠️ Non riprodotto sul device di Eli: se ricapita CON un «ID:» è un errore server da tracciare.
- **#7 Notifiche snellite**: «Messaggio dal cliente» e «Fattura scartata SdI» SEMPRE attivi (tolti gli interruttori, `lib/notifications.ts` li ignora) — perderli costa; una riga lo spiega. Il resto resta opzione.
- **#8 Impostazioni + Account a elenco→sotto-pagine** (Eli: «senza pillole»): `HubShell` esteso (`back`, `card`). Impostazioni → 4 sotto-pagine (**Dati dell'attività · Dati fiscali · Coordinate di pagamento · Notifiche**); Account → **Indirizzo e accesso · Sicurezza e blocco app · I tuoi dati e commercialista**. Redirect di compatibilità per i vecchi `?tab=`/`?sez=`; i link con ancora (`#telefono`, `#ateco`) puntano diretti alle sotto-pagine.
- **#11 Abbonamento in Account**: «Account e abbonamento» (Abbonamento+Porta un amico confluiti); in «Altro» una voce in meno. `/altro/abbonamento-inviti` → redirect a `/account`.
- **#2 App più veloce** (`RoutePrefetcher`, NUOVO, in AppShell): precaricamento RSC in background a ondate, SOLO a tempo morto (`requestIdleCallback`), una rotta per volta, una volta per sessione, salta con risparmio-dati/offline. ① barra+Home ② resto di Altro. Senza rallentare la pagina in uso.
- **#4 Tutorial** allineati (guida Altro, mini-tour con pathPrefix preciso, nota «Testo grande»). **#5 FAQ**: revisore su tutte le 52 → nomi/percorsi allineati alla nuova struttura + tono più sobrio (via riempitivi «sorprende molti», «niente panico»). Rimandi (`VaiA`) e cerca funzioni aggiornati.
- **⚠️ #12 auto-save — VALUTAZIONE, nessun refactor rischioso**: i form Impostazioni (Generale/Fiscale/Pagamenti) sono UN form ciascuno che mescola campi pericolosi (ragione sociale, indirizzo, P.IVA, IBAN, regime) con poche tendine → auto-salvarli alla cieca è il rischio già segnalato. Le superfici sicure hanno GIÀ l'auto-save (Notifiche, documenti). Lasciati manuali con validazione = scelta corretta per la regola di Eli. Se serve un campo specifico auto-salvato, si isola su richiesta.
- tsc+build+**716/716** verdi a ogni giro · scan puliti · Chromium su barra, riga sconto, toggle-row. Ogni punto committato e spinto su branch+master separatamente.

### ✅ 15 ago — I MOCKUP APPROVATI IMPLEMENTATI: tasto «+» a due scelte · «Altro» riorganizzato · «Porta un amico» in stile · Cestino nelle liste
Eli: *«perfetto mi piace questa proposta e le ultime, procedi con tutte. Falle una per una in modo che ognuna sia fatta in modo impeccabile»* → i mockup dei giri precedenti (#1 Altro, #4 referral, #11 cestino) + il FAB a due scelte, uno per uno.
- **[#1 + FAB] Tasto «+» in basso a DUE scelte** (`components/mobile/FabCreateMenu.tsx`, NUOVO): al posto del link diretto a `/preventivi/nuovo`, un action-sheet in **portal su body** (backdrop, chiusura su tocco/Esc/cambio rotta, `+` che ruota di 45°) con **Nuovo preventivo** (navy) e **Nuovo sopralluogo** (bianco, HardHat) — i due gesti più frequenti in un tocco. Cablato in `BottomNav` (via `FabCreateMenu`). Tutorial (TourController passo 2) e guida di «Altro» allineati. Verificato con Chromium a 390px: nessuno sbordo, sheet sopra la barra.
- **[#1] «Altro» riorganizzato** (ricerca UX Miller ~7±2 · Hick): da ~16 voci a **9**, raggruppate in voci-CONTENITORE che aprono pagine-hub sotto `/altro/*` (`HubShell` + `MenuRow` condivisi): **Clienti e appuntamenti** (rubrica/agenda/sopralluoghi — Clienti confluito qui, «da solo non veniva cliccato»), **Catalogo e strumenti**, **Abbonamento e inviti**, **Aiuto e novità**. Ogni voce porta un **mini-suggerimento sempre visibile** (`descAlways`) di cosa c'è dentro. `ALTRO_PREFIXES` include già `/altro` → la linguetta resta attiva sugli hub.
- **[#4] «Porta un amico» in stile Carta Canta** (`ReferralPageClient`): dalle card shadcn generiche alle superfici dell'app (testata a filo oro con Georgia, card bianche con ombra morbida, `cc-section-label`, oro/navy/`var(--cc-muted)`). Copy «Il tuo beneficio» → **«Il tuo beneficio se porti un amico»** (già dal giro precedente).
- **[#11] Il CESTINO dentro le liste, accanto all'Archivio** (`CestinoInline` + `CestinoToggle`, NUOVI): tab «Cestino» in Preventivi e Fatture — ognuno mostra gli eliminati del suo tipo (preventivi · fatture+note credito/debito), con ripristino ed eliminazione definitiva. ⚠️ **Una sola logica** (CestinoInline) usata sia dalle liste sia dalla pagina `/cestino` (tutti i tipi) → nessuna divergenza. La lista **salta la query normale** in modalità cestino (`status=cestino` non è un enum valido → altrimenti errore). CestinoToggle NON dipende dalla migration archivio (usa `deleted_at`). Tolta la voce Cestino da «Altro» (come l'Archivio, il cestino si raggiunge dalle liste); FAQ, ricerca funzioni (`app-search` «dove» aggiornato) e /novita allineati; `/cestino` resta raggiungibile da ricerca/FAQ.
- ⚠️ **Restano in attesa di DECISIONE di Eli** (non codice): **#10** sconto dopo il Totale — la ricerca web CONTRADDICE la premessa (lo sconto incondizionato riduce l'imponibile, art. 13 DPR 633/1972; «sconto sul totale ivato» è lo specifico meccanismo bonus-edilizi): **motore fiscale NON toccato** (regola F); il riposizionamento UI dipende dalla decisione fiscale. **#7** auto-save al cambio pagina — i documenti già si auto-salvano; sulle Impostazioni l'auto-save cieco è rischioso (valori parziali/non validi): raccomandato auto-save mirato dove la validazione è banale, manuale dove un valore malformato fa danni.
- tsc+build+**716/716** verdi · scan spazi puliti · Chromium sul FAB e sulla riga dei tasti (Archivio+Cestino+Ordina): nessuno sbordo a 390/360/320px.

### 🔄 14 ago — LISTA FEEDBACK di Eli (12 punti): 6 fatti, 3 a mockup, 2 a decisione, 1 review
Eli ha mandato 12 feedback chiedendo di dividerli per rischio/dimensione e farne il più possibile da solo. **Fatti e in produzione (2 commit, master):**
- **#2** Pop-up tutorial sulla pagina di **login**: era **DOM orfano di driver.js** (overlay/popover appesi a `<body>`, fuori da React) sopravvissuto a un redirect a sessione scaduta con guida aperta. Nuovo `components/tour/TourCleanup.tsx` montato nel layout **(auth)**: all'ingresso di ogni pagina d'accesso strappa i residui `.driver-*` e sblocca lo scroll. Cintura indipendente dai controller.
- **#3** «Fatti trovare dai clienti» → **«Vetrina»** (sottotitolo «Fatti trovare dai clienti · richieste e recensioni»).
- **#5** **Commercialista** in evidenza: voce Altro rinominata **«Account e commercialista»** con sottotitolo sempre visibile (prima il sottotitolo era nascosto fuori dal «Testo grande» → invisibile); la guida di sezione «Altro» ora dice DOVE si trova.
- **#6** Descrizione **trasmissione automatica SdI** riscritta per chi la vede la prima volta (cos'è SdI/Agenzia, cosa fa l'opzione).
- **#8** Card **Voci**: spiegato COSA caricare (foto JPG/PNG/HEIC o note) e A COSA serve (l'AI propone le voci).
- **#9** **Voce nuova → catalogo**: nuovo `salvaVociNelCatalogo` (documents.ts), chiamato da create/update/saveDraft/createInvoice (MAI da duplica/ripristino/conversione/note). Dedup per descrizione normalizzata (voci già dal catalogo e Base/Premium non duplicano), solo voci complete, `unit` sempre valorizzato (NOT NULL), best-effort silenzioso. FAQ nuova.
- **⚠️ #10 (FISCALE) — la ricerca web CONTRADDICE la premessa**: lo sconto commerciale **incondizionato RIDUCE l'imponibile** (art. 13 DPR 633/1972), NON si calcola sul totale ivato — «sconto sul totale ivato senza ridurre l'imponibile» è lo **specifico meccanismo bonus-edilizi** (Provv. AdE 8/8/2020). Per lo sconto in **%** il totale attuale è **già** «totale ivato − sconto%» (l'IVA è proporzionale); per i **forfettari** imponibile=totale, identico. Lo sconto **non entra mai nell'XML SdI** (già rifiutato). → **NON ho toccato il motore fiscale** (regola F); il riposizionamento UI «sconto dopo il Totale» dipende dalla decisione fiscale → in attesa di Eli. **Fonti nel report a Eli.**
- **A MOCKUP (inviato, in attesa di ok)**: **#1** «Altro» raggruppato (Abbonamento+Porta un amico, Aiuto+Novità; da 16 a 13 voci) · **#4** «Porta un amico» ristilizzata in stile Carta Canta (oggi usa token shadcn generici, non la testata a filo oro/Georgia/card dell'app) · **#11** cestino dentro Preventivi/Fatture come interruttore accanto a «Ordina» (il cestino esiste già in `/cestino`, cambia solo DOVE si apre; SdI trasmesse restano non eliminabili).
- **#7 (auto-save al cambio pagina)** — VALUTAZIONE: i **documenti** già si auto-salvano (`autoSaveRef` in PreventivoForm). Sulle **Impostazioni** l'auto-save cieco è **rischioso**: salverebbe campi incompleti/non validi (IBAN a metà, P.IVA parziale) in silenzio, e Next App Router non dà un hook «prima di navigare» affidabile per i server component. Raccomando: auto-save **mirato** dove la validazione è banale (spunte/tendine), **manuale con validazione** dove un valore malformato fa danni (pagamenti, fiscale). In attesa di ok prima di implementare — non «strappo via» tutti i Salva alla cieca.
- **#12** ricontrollo: tsc+build+**716/716**+scan verdi su tutto il lotto; le due parti con logica vera (#9 salvaVociNelCatalogo, #2 TourCleanup) riviste a mano.
- ⚠️ Restano da fare, su ok di Eli: implementare i 3 mockup (#1/#4/#11), decidere #10 (fiscale) e #7 (auto-save).

### ✅ 12 ago (25) — RICONTROLLO downgrade Pro→Free (Eli «chiudi pulito e ricontrolla step per step») — 2 revisori: 1 ALTA + 5 fix
Chiuso il residuo cosmetico e passato tutto il blocco ②/⑥ a due revisori avversariali (server/logica · UI/stato), ogni finding verificato di persona.
- **[residuo chiuso] «Usa come modello» (duplica) SPENTO sui bloccati**: `DocumentRowActions` riceve `locked` → la voce è `disabled` + nota «torna a Pro per duplicarlo», invece del toast d'errore a cose fatte. Passato dalle due liste (`bloccatiIds`).
- **[ALTA, revisore UI] Il form di modifica DESKTOP non era bloccato**: su desktop il form è inline via `hidden lg:block` SENZA `?edit=1`, quindi il redirect mobile non scattava → un documento bloccato mostrava un form editabile (poi il server rifiutava al salvataggio: form morto che contraddiceva il banner). **Fix strutturale**: nuova prop `PreventivoForm forceReadOnly` messa in OR dentro `isReadOnly` → il form diventa `inert` (come sugli accettati), su mobile E desktop, per preventivi e fatture (`forceReadOnly={freeLocked}`).
- **[MEDIA, revisore UI] Voce «Riapri» morta** sul menu stato di un preventivo bloccato rejected/expired: il server ora la 403a. Nuovo export `LOCKED_TRANSITIONS` (DEFAULT meno i target `sent`/`draft`) passato allo `StatusChangeDropdown` quando `freeLocked` → per rejected/expired il menu sparisce, restano solo le registrazioni di esito.
- **[ALTA, revisore server] `restoreToSentVersionAction` senza guardia**: ripristina voci e campi (una modifica) ma aveva solo le guardie accepted/SdI, non il free-lock, e caricava il workspace senza `plan`. Aggiunti `plan` + `isDocFreeLocked`.
- **[robustezza, revisore server] `freeOpenSentIds` inghiottiva l'errore query** → su un blip del DB tornava un Set VUOTO e bloccava TUTTO, primi 8 compresi. Ora legge `error` e torna `null` (fail-OPEN: è un limite di piano, non sicurezza — meglio lasciar passare un #9 che bloccare i legittimi #1-8); `isDocFreeLocked` tratta `null` come «non bloccato». + spareggio d'ordine `created_at ASC, id ASC` (badge e guardia non possono divergere a parità di `created_at`).
- **Altre guardie server aggiunte nel giro** (varchi trovati enumerando i percorsi di scrittura): `resendExpiredAction` (rinvio di uno scaduto = invio) e `sendReminderAction` (sollecito, raggiungibile da Home/scadenze senza veste UI) → `isDocFreeLocked`. Route stato **preventivo**: bloccate le riattivazioni →draft/→sent (Riporta in bozza / Riapri). Copy: banner «scaduto» non dice più «Puoi rinviarlo» sui bloccati.
- ⚠️ **Asimmetria voluta e documentata**: la route stato **fattura** NON ha la guardia free-lock — una «rejected→draft» lì è spesso il recupero di una fattura SCARTATA dallo SdI (correzione fiscale), che deve restare sempre possibile. La UI nasconde comunque «Riattiva» sui bloccati, e il reinvio resta fermato dal contatore. Un test (riattiva scartata) l'ha dimostrato: il primo tentativo di guardia la rompeva.
- **Verificati PULITI dai revisori**: badge/guardia coerenti (stessa query), note credito/debito mai bloccate, Pro e bozze mai toccati, PDF pubblico `/p/[token]` non bloccato, redirect senza loop, ternary multi-proposta bilanciato, FAQ accurata.
- tsc+build+**716/716** verdi · scan 0.

### ✅ 12 ago (24) — Downgrade Pro→Free FASE ⑥ (ULTIMA): multi-proposta su documenti già creati
Chiude il piano downgrade. **Decisione** (proposta del handoff (17), adottata): i **primi 8 restano usabili così come sono, comprese le proposte già fatte**; oltre gli 8 il blocco è già quello di ② (form non si apre).
- **Verificato che i dati non si perdono**: `serializeVoci(voci)` manda l'**intero** array (tutti i tier), non solo la proposta attiva → un Free che modifica la Base NON cancella la Premium. Le linguette proposta (`optionsActive = isPreventivo && optionsOn`) **non sono gated su isProPlan**, quindi un documento a due proposte resta compilabile e i totali si conservano. La creazione di NUOVE multi-proposta resta Pro (lo Switch è solo Pro; su Free «Passa a Pro»).
- **Fix UI (l'unico vero spigolo)**: il toggle «Proponi più opzioni → Passa a Pro» compariva accanto alle linguette proposta ATTIVE — sembrava che le proposte fossero spente. Ora, quando `!isProPlan && optionsActive`, al suo posto una **nota chiara**: «Questo preventivo ha due proposte (Base e Premium): restano modificabili e il cliente può ancora sceglierle. Creare nuove proposte è una funzione Pro — Torna a Pro». Il toggle normale resta per i documenti a proposta singola (dove creare le proposte è davvero Pro).
- **Conversione/accettazione**: già corrette — la conversione oltre gli 8 è bloccata da ② (guardia su converti-fattura), entro gli 8 usa `accepted_tier`/Base come sempre; l'accettazione dal link è azione del cliente, indipendente dal piano.
- ⚠️ Non verificato con Chromium (`PreventivoForm` importa le Server Action, non impacchettabile per il browser): logica di rendering condizionale semplice, coperta da tsc/test/build.
- tsc+build+**716/716** verdi · scan 0.

### ✅ 12 ago (23) — Downgrade Pro→Free FASE 2 (②): preventivi/fatture oltre gli 8 in SOLA LETTURA (la fase più grossa)
Eli (AskUserQuestion): il tetto si conta sugli **8 INVIATI** (non-bozza) più vecchi per tipo, ordinati per `created_at` ASC; **le bozze restano sempre aperte**; i #9+ vanno in **sola lettura** — «si apre e si guarda, niente modifica/invio/PDF/duplica». Le note di credito/debito non si bloccano mai. La trasmissione SdI di una fattura emessa resta sempre possibile (**route SdI NON toccata**, obbligo fiscale).
- **`lib/plan/free-lock.ts`** (NUOVO, PURO+DB): `docLockedDecision(...)` (pura, **+5 test → 716**) · `freeOpenSentIds(supabase, ws, docType)` (gli id dei primi 8 inviati; **null sui piani a pagamento** → nessuna query per i Pro) · `isDocFreeLocked(...)` · `DOC_LOCKED_MESSAGE`. La regola è UNA (stessa query ordinata `created_at ASC limit 8`), quindi il badge in lista e il blocco nel dettaglio **non possono divergere**.
- **Guardie SERVER (non solo UI)**: `updateDocumentAction`, `saveDraftAction`, `duplicateDocumentAction`, `registerManualResendAction` (documents.ts) rifiutano con `DOC_LOCKED_MESSAGE`; route **send-email** (reinvio) → 403; route **converti-fattura** → 403; route **pdf** (anteprima/stampa) → redirect `/abbonamento`. ⚠️ La route **p/[token]/pdf** (link del CLIENTE) NON è bloccata: il cliente ha già ricevuto il documento, sbarrargli il link romperebbe qualcosa di legittimo.
- **UI liste** (preventivi + fatture): badge **🔒 Bloccato/Bloccata** su riga 2, calcolato con `freeOpenSentIds` (1 query in più solo per i Free).
- **UI dettaglio** (preventivi/[id] + fatture/[id]): niente **matita**, `?edit=1` a mano non apre il form (preventivo: redirect alla lettura; fattura: `editing && !freeLocked`), **banner ambra** «Documento bloccato — Torna a Pro per sbloccarlo». Nascosti **Anteprima/PDF, Condividi/Invia, SendEmail, Converti in fattura, Riporta in bozza, Riattiva**. **Restano** StatusChangeDropdown / Segna pagata / Segna accettato-rifiutato / Annulla (registrazione di un esito = contabilità, non funzione Pro — stessa linea delle trasmesse SdI) e la navigazione (Link cliente, Scheda lavoro).
- **FAQ** nuova «Sono tornato da Pro a Free: cosa succede ai documenti in più?» (dati mai cancellati, primi 8 usabili, #9+ sola lettura col badge, tutto torna con Pro).
- ⚠️ Il «Duplica» dei bloccati (allora un toast d'errore) è stato **spento** nel ricontrollo (25). **⑥ chiusa in (24)**, ricontrollo in (25) → il piano downgrade è COMPLETO e verificato.
- tsc+build+**716/716** verdi · scan 67/0.

### ✅ 12 ago (22) — Downgrade Pro→Free FASE 3: listini fornitori visibili ma bloccati (+ AI già ok)
- **⑤ Listini fornitori**: su Free la pagina `catalogo?tab=listini` prima NASCONDEVA i listini (`lists=[]`) dietro un invito a Pro. Ora, se il workspace HA listini (downgrade), li **mostra bloccati** (righe non cliccabili, 🔒, opacità ridotta) con la nota «I tuoi listini sono al sicuro, ma sono una funzione Pro — Torna a Pro per usarli». Se non ne ha, resta l'invito. Il dettaglio `catalogo/fornitori/[id]` redirige già i Free (blocco reale); i suggerimenti voce già non offrono i listini ai Free. Dati intatti.
- **⑦ AI Import**: verificato che le route `/api/ai/extract` e `/api/ai/extract-photos` rifiutano già i Free lato server via `getAiImportQuota` (paywall 403) + flag off in prod → **nessuna modifica necessaria**.
- ⚠️ **Resta la fase più grossa**: ② preventivi/fatture oltre gli 8 in sola lettura. E ⑥ multi-proposta su documenti già creati (minore). tsc+build+711 verdi · scan 67/0.

### ✅ 12 ago (21) — Downgrade Pro→Free FASE 2: template personalizzati bloccati su Free (l'esempio di Eli)
- **Server (rete vera)**: `resolveTemplateSnapshot` — il chokepoint unico che risolve `template_id`→snapshot salvato sul documento — ora riceve `isFree`; su Free ritorna SEMPRE il preset **Classico** (ignora qualunque template personalizzato). Passato dai 4 chiamanti (create, update, saveDraft, createInvoice) con `isFreePlan(workspace.plan)`. Così un documento salvato da un Free non porta mai lo stile di un template Pro, e la filigrana c'è (Classico ha `show_watermark: true`).
- **UI**: nel selettore Template di `PreventivoForm` e `FatturaForm`, su Free i template personalizzati si VEDONO ma sono **disabilitati** (`· 🔒 Pro`) + nota «I template personalizzati sono una funzione Pro. Torna a Pro per usarli» → `/abbonamento`. Solo «Default (Classico)» selezionabile.
- ⚠️ **Dati Pro intatti**: i template restano salvati (tornando Pro riappaiono e tornano usabili). Il `template_snapshot` dei documenti già inviati resta congelato (storico). ⚠️ **Residuo dichiarato**: un documento Free SENZA snapshot che ricadesse sul template `is_default` Pro nella route PDF userebbe quello stile — caso che non si verifica in pratica (i form salvano sempre lo snapshot, ora forzato a Classico). In beta zero impatto.
- tsc+build+**711/711** verdi · scan 67/0.

### ✅ 12 ago (20) — Downgrade Pro→Free FASE 1: fondamenta + filigrana forzata su Free
Eli: «implementa la parte per il blocco da chi passa da Pro a Free». Lavoro grande (10 aree, `PROGETTO_LIMITE_FATTURE_FREE` + handoff (17)) → si fa a FASI verificabili. Questa è la 1.
- **Fondamenta**: nuovo `lib/plan/gate.ts` — `isFreePlan(plan)` + copy unico dei blocchi (`PRO_LOCK_LABEL` «Funzione Pro», `PRO_LOCK_CTA` «Torna a Pro per sbloccare», `PRO_LOCK_HREF` `/abbonamento`). Base per le fasi successive (oggi centralizza il concetto «Free»).
- **④ Filigrana forzata su Free (a RUNTIME)**: `buildPdfHtml` ora accetta `isFree` e, se true, mostra SEMPRE la filigrana «Carta Canta» anche se il template salvato da un Pro ha `show_watermark=false`. Passato dalle 2 route PDF (documento + `/p/[token]` pubblica, che ora seleziona anche `plan`). La rimozione della filigrana è Pro → torna con Free. +2 test (711). ⚠️ Il `template_snapshot` dei documenti già inviati resta congelato (storico); la filigrana è corretta ricompaia sui PDF generati ora.
- ⚠️ **Le PROSSIME fasi** (non ancora fatte, mappate in handoff (17)): ② preventivi/fatture oltre gli 8 in sola lettura (il più invasivo); ③ template personalizzati Pro visibili ma non selezionabili nei documenti (l'esempio esplicito di Eli); ⑤ listini fornitori visibili ma bloccati; ⑥ multi-proposta su documenti già creati; ⑦ guardie server AI import. Ognuna sarà una fase a sé, verificata.
- tsc+build+**711/711** verdi · scan 67/0.

### ✅ 12 ago (19) — IMPLEMENTATO il limite di 8 FATTURE inviate sul piano Free (⚠️ migration 083 DA APPLICARE)
Eli: «procedi a implementare · non ci sono ancora utenti» (→ niente grandfathering, si applica dritto).
- **⚠️ migration 083** (`083_limite_fatture_free.sql`, VALIDATA su PG16: backfill 3 su dati di prova — esclude bozze e cestinate —, RPC → 4, idempotente): `workspaces.sent_invoice_quota_used INT NOT NULL DEFAULT 0` + backfill dalle fatture non-draft + RPC atomica `increment_invoice_quota` (gemella di `increment_sent_quota` 059). `types/database.ts` aggiornato a mano nei 3 blocchi (eccezione B.1.6).
- **Logica** (`lib/free-trial.ts`): `checkFreeBlock(workspace, docType='preventivo')` ora **parametrico** — `'fattura'` usa `sent_invoice_quota_used` e `FREE_INVOICE_LIMIT=8`. Contatori **separati e indipendenti** (8 preventivi + 8 fatture). Firma retrocompatibile (tutti i chiamanti esistenti restano su 'preventivo'). +8 test (709).
- **Il limite morde SOLO sull'INVIO al cliente** (email/WhatsApp/«Copia link»), come deciso: guardie estese al ramo fattura in `sendDocumentAction`, `registerManualSendAction` (il varco WhatsApp/copia-link) e route `send-email` — tutti oggi escludevano le fatture. ⚠️ Nei 2 Server Action il blocco è stato **spostato DOPO il caricamento del documento** (serve il doc_type); prima era pre-load e docType-agnostico (bloccava le fatture col contatore preventivi). Incremento del contatore giusto via helper condiviso `incrementaQuotaFree`.
- **MAI bloccati** (il limite è solo sull'invio): creazione/duplica fattura (`createInvoiceAction` senza free-block, `duplicateDocumentAction` già gated a preventivo), **PDF/anteprima** bozza fattura (route pdf gateata a `doc_type==='preventivo'`), **trasmissione SdI** (route sdi non toccata). Le **note di credito** non consumano quota.
- **UI**: seconda barra d'uso «X di 8 fatture inviate» in Abbonamento (mobile + desktop) + spiegazione «Come vengono conteggiati preventivi e fatture» riscritta.
- **Copy (B.0)**: landing «8 preventivi e 8 fatture gratis» · FAQ «Quanti preventivi e fatture posso fare col piano gratuito?» aggiornata (conta il primo invio; bozza e trasmissione SdI non consumano).
- ⚠️ **Da applicare da Eli**: la migration 083 (SQL in chat). Il codice è tollerante pre-083? NO come le altre — il contatore è nuovo: senza migration, la select del campo darebbe errore. **Applicare la 083 PRIMA o insieme al deploy.**
- tsc+build+**709/709** verdi · scan 67/0.

### 📋 12 ago (18) — PIANO: limite di 8 FATTURE sul piano Free (`PROGETTO_LIMITE_FATTURE_FREE.md`)
Eli: «inizia la pianificazione del limite a 8 fatture inviate o link copiato del piano Free».
- **Deciso il punto chiave**: il limite conta le **fatture inviate/con link copiato** → morde sull'**invio al cliente** (come i preventivi), **NON** sulla creazione e **MAI** sulla trasmissione SdI (l'emissione fiscale resta sempre possibile — il più sicuro su B.0). Al 9° invio → «Torna a Pro».
- **Piano completo in `PROGETTO_LIMITE_FATTURE_FREE.md`**: mirror del meccanismo preventivi (`sent_quota_used` 025 + RPC `increment_sent_quota` 059) → nuovo contatore `sent_invoice_quota_used` (migration + backfill + RPC gemella), `checkFreeBlock` parametrico per doc_type, guardie server sui SOLI punti di invio fattura (send-email ramo fattura, `registerManualSendAction` — oggi escludono le fatture), barra d'uso in Abbonamento, blocco nel pop-up «Invia» (non alla creazione), copy landing/FAQ (B.0).
- **Decisioni ancora aperte (non codice)**: ① grandfathering dei Free ATTUALI con >8 fatture già inviate; ② aggiornamento claim «8 preventivi» → «8 preventivi e 8 fatture» (B.0). In beta l'impatto è ~nullo (pochi/zero utenti).
- **Stato: pianificazione.** Nessun codice. Prossimo passo su ok di Eli: le 2 decisioni aperte, poi la migration (SQL in chat).

### 📋 12 ago (17) — VALUTAZIONE tecnica del downgrade Pro→Free (analisi, NON ancora implementata)
Design di Eli: primi 8 preventivi aperti, tutto il resto Pro VISIBILE ma BLOCCATO e non richiamabile; dati Pro nascosti/bloccati, mai cancellati; ovunque «Torna a Pro per sbloccare». Mappate dal codice le aree e i file:
- **① Fondamenta (da fare per prime)**: nuovo helper `lib/plan/gate.ts` (`isFree(plan)`, `proLocked(...)`) + un componente UI riusabile **`ProLockedOverlay`/`ProLockBadge`** («🔒 Funzione Pro — Torna a Pro per sbloccare», link `/abbonamento`). Oggi il gating è sparso: `plan === 'free'` / `isProPlan` / `isPro` in ~20 punti, `PLAN_FEATURES` quasi non usato. Centralizzarlo.
- **② Preventivi E FATTURE oltre gli 8 (il pezzo nuovo, il più delicato)**: oggi `checkFreeBlock` (sent_quota_used ≥ 8) blocca SOLO la creazione di nuovi PREVENTIVI. **⚠️ NUOVA decisione Eli 12 ago: il limite di 8 vale ANCHE per le FATTURE, e per TUTTI i Free** (non solo i downgrade) → piano Free = 8 preventivi + 8 fatture. Serve, per i Free: calcolare l'insieme «primi 8» (per tipo, ordinati per `created_at` ASC) e per i #9+ → **sola lettura**: niente modifica/invio/PDF/duplica/converti. Guardie SERVER (non solo UI): `updateDocumentAction`, `saveDraftAction`, `sendDocumentAction`/route send-email, route PDF, `registerManualSend*`, `duplicateDocumentAction`, conversione. In UI: badge «Bloccato — Torna a Pro» sulle righe #9+ e overlay sul dettaglio (matita nascosta come per le trasmesse). ⚠️ **Il contatore fatture NON esiste** (`sent_quota_used` è solo preventivi) → serve logica/contatore per le fatture (probabile migration) — a differenza del resto del piano, questo introduce un DB change. ⚠️ Ricadute su utenti Free ATTUALI con >8 fatture (grandfathering?) e sui claim commerciali (landing/FAQ «8 preventivi» → «8 preventivi e 8 fatture», B.0). Dettagli in `DECISIONI_E_FEEDBACK.md §A`.
- **③ Template personalizzati (maxTemplates 1 vs ∞)**: `MobileTemplateList` ha già il lucchetto sul «Nuovo template» per Free. MANCA: se un Pro ha creato N template custom e torna Free, quei template si VEDONO ma vanno **bloccati nella selezione** (`PresetSelector`/`TemplateEditor` e il **selettore template dentro il documento**), e la scelta non deve essere richiamabile: `updateDocumentAction`/`saveDraftAction` devono rifiutare un `template_id` custom Pro su Free e ricadere sul preset base. `template_snapshot` dei documenti già inviati resta congelato (storico, non si tocca).
- **④ Filigrana PDF (watermark)**: `lib/actions/templates.ts` forza già `show_watermark = true` su Free al SALVATAGGIO del template. MANCA: la generazione PDF (`lib/pdf/template.ts`, route pdf/send-email) deve forzare la filigrana per i Free **a runtime** (i template Pro salvati con `show_watermark=false` la ri-mostrerebbero solo risalvando). Regola: `isFree → watermark sempre`.
- **⑤ Listini fornitori (Pro)**: `catalogo/fornitori/[id]` già redirige i Free; `CatalogPicker` mostra il lucchetto sulla linguetta «Listini» e `VoceSuggerimenti` non offre i listini ai Free. Da verificare che la LISTA dei listini (pagina catalogo/fornitori) li **mostri bloccati** invece di nasconderli (Eli: «si vedono ma bloccati»), e che nessun percorso (suggerimenti voce, import) li richiami su Free. I dati restano.
- **⑥ Multi-proposta Base/Premium**: in `PreventivoForm` il toggle «Proponi più opzioni» è già gated su `isProPlan`. MANCA: un preventivo Pro CON due proposte, aperto da Free → va mostrato bloccato in modifica (oggi il form nasconde il toggle ma il documento a due proposte esiste); e la conversione/accettazione non deve poterlo modificare. Rientra nel blocco «preventivo #9+» se è oltre gli 8; se è nei primi 8 va deciso (proposta: i primi 8 restano usabili così come sono, comprese le proposte già fatte).
- **⑦ AI Import (foto/PDF → voci)**: `AiImportButton` già mostra il lucchetto ai Free (`!isProPlan`); route `/api/ai/extract` e `/api/ai/extract-photos` da verificare che rifiutino server-side per i Free (non solo UI). Import listino via AI idem (quota `getAiImportQuota`).
- **⑧ Foto per documento**: Free = 6, Pro = 40 (`PreventivoForm` isProPlan, `lib/actions/sopralluoghi` FREE_PHOTO_LIMIT). È già un limite gestito; su Free resta 6 — nessun blocco «visibile», solo il tetto.
- **⑨ Voce vocale**: quota mensile (Free 300s/Pro 3600s, route `/api/voice/transcribe`). È una QUOTA, non un lucchetto «visibile» → resta com'è.
- **⑩ Bilancio / export**: `/api/bilancio/export` e la pagina hanno già gate `plan === 'free'`. Da verificare la coerenza col nuovo messaggio unico.
- ⚠️ **Nessuna migration prevista** (si gatea su `plan` + dati esistenti; l'insieme «primi 8» è calcolato per query su `created_at`). ⚠️ **Regola trasversale**: ogni blocco va messo SUL SERVER (Server Action / route), la UI è solo il vestito — nascondere un tasto non basta. ⚠️ **Storico intatto**: i documenti già inviati e i loro `template_snapshot` non cambiano aspetto retroattivamente (tranne la filigrana, che è corretta ricompaia su Free).
- **Ordine consigliato**: ① fondamenta → ② preventivi 8 → ③+④ template+filigrana → ⑤+⑥+⑦ le altre Pro → rifinire messaggi/UI. Materia con claim commerciali → B.0 prima del rilascio.

### ✅ 12 ago (16) — «Fino a 8 preventivi» → «8 preventivi» (email) + registrata la decisione sul downgrade Pro→Free
- **Email**: l'unico template con «Fino a 8 preventivi» era `welcome.tsx` → ora «— 8 preventivi». Verificato che nessun altro template email (né UI) contiene «fino a» sugli 8 preventivi: landing, FAQ e pagina Abbonamento dicevano già «8 preventivi».
- **DECISIONE registrata (⏳ da fare, in `DECISIONI_E_FEEDBACK.md §A`)**: chi passa Pro→Free deve avere **bloccati** ① i preventivi oltre la soglia Free già esistenti (non solo la creazione di nuovi, che OGGI è già bloccata da `checkFreeBlock` su `sent_quota_used >= 8`) e ② tutte le funzioni Pro (listini, template personalizzati, multi-proposta, AI Import, no-filigrana…), con un messaggio **«Torna a Pro per sbloccare»** → `/abbonamento`. ⚠️ Da decidere in fase di design: quali 8 preventivi restano accessibili, e i dati Pro si NASCONDONO (non si cancellano). Aggiunto anche al Backlog. Nessun codice di blocco scritto in questo giro (solo l'email + la documentazione).

### ✅ 12 ago (15) — «Codice referral» → «Codice invito» in tutto il testo visibile
Eli: «sostituisci la scritta Codice referral in Codice Invito perché si capisce meglio, ovunque compaia».
- Cambiato SOLO il **testo visibile**: label del campo nel signup (`SignupForm`), e in `ReferralPageClient` la label «Il tuo codice invito», i messaggi («Codice invito non ancora disponibile», «Non hai ancora inviti»), la nota di calcolo («in base agli inviti… Gli inviti…») e tutte le condizioni dei premi («almeno 3 inviti…»). Plurale «inviti» dove la grammatica lo richiede.
- ⚠️ **NON toccati** (sono codice, non testo): la rotta `/referral`, le tabelle `referral_*`, la RPC `get_or_create_referral_code`, import/interfacce/nomi, e la voce di menu che è già «Porta un amico». Allineato anche un commento per coerenza.
- Casing usato: «Codice invito» (sentence case, come il precedente «Codice referral»); se serve «Invito» maiuscolo è una riga.
- **FAQ**: rilette, nessuna toccata (nessuna FAQ cita «referral»). tsc+build+701/701 verdi · scan 67/0.

### ✅ 12 ago (14) — Card voce mobile: Sconto · IVA · Costo su UNA riga, allineata, senza ricarico
Tre richieste di Eli sulla card voce (mobile, voce aperta).
- **① «un'unica riga di sconto, IVA e costo, così non abbiamo tante righe per voce»**: le due righe (Sconto/IVA + Costo a sé) diventano una sola **Sconto · IVA · 🔒 Costo**. Il costo inline sostituisce `VoceCosto` SOLO su mobile; sul **desktop** `VoceCosto` resta (ora dentro `hidden lg:block`). La spunta «bene significativo» continua su mobile-aperta e desktop (estratta dal wrapper di VoceCosto).
- **② «inizino e finiscano sulla stessa verticale di Unità/Q.tà/Prezzo»**: la griglia passa da `grid-cols-3` a **`grid-cols-[96px_1fr_1fr]`**, identica alla riga sopra → Sconto↔Unità, IVA↔Q.tà, Costo↔Prezzo. In **forfettario** (niente IVA) la colonna di mezzo è un `<div aria-hidden/>` vuoto, così il Costo resta sotto il Prezzo. Verificato con Chromium: bordi colonna IDENTICI fra le due righe (`13-109 / 115-243 / 249-377`).
- **③ ricarico %/€ della voce → SCELTA di Eli (AskUserQuestion): «solo nella card Margine»**. Tolto da DUE punti: la pillola sotto i campi (voce aperta) E il `· 🔒 +… €` della riga CHIUSA. Il margine per-voce e il totale vivono ora solo in `MargineBox` (che, aperta, mostra già il dettaglio voce-per-voce). `margineVoce` resta usato in `VoceCosto` (desktop).
- **FAQ**: rilette, nessuna toccata (la card voce non è descritta in nessuna FAQ). tsc+build+701/701 verdi · scan 67/0.

### ✅ 12 ago (13) — Margine privato: la % del totale su una riga propria, leggibile
Eli: «in margine solo tu lo vedi vorrei che oltre alla cifra in euro ci fosse anche il totale in %. Prima c'era ma non si leggeva bene».
- **La % c'era già** (era appiccicata all'euro: `+2.476,60 € · 45,3%`, stesso colore/peso → si leggeva come un blocco unico e la % si perdeva). La % è `margine ÷ prezzo scontato`, mostrata solo se OGNI voce ha un costo (scelta voluta: con una voce senza costo sarebbe una mezza verità).
- **SCELTA di Eli (AskUserQuestion)**: etichetta INVARIATA («Margine · … · solo tu lo vedi»), % su una **seconda riga sotto l'euro**.
- **FIX (`MargineBox.tsx`)**: il blocco a destra diventa una colonna — euro sopra (15px, verde/rosso), «45% di margine» sotto (11,5px, grigio-viola `#6a6488`, rosso se sotto costo). `pctStr` rimpiazza `headerValue`. Vale su preventivo E fattura (componente condiviso).
- **Verificato con Chromium** sul componente vero a 390/360/320px: nessun sbordo di pagina (`scrollWidth == clientWidth`), il titolo va a capo a sinistra e il blocco euro+% resta a destra, altezza 59px. Screenshot: «+1.000,00 €» + «35% di margine».
- **FAQ**: rilette, nessuna toccata (MargineBox non è descritto in nessuna FAQ). tsc+build+701/701 verdi · scan 67/0.

### ✅ 12 ago (12) — I «banner verdi» ora spariscono tutti allo stesso modo (censimento + ✕ globale)
Eli: «i banner verdi (es. link copiato) vorrei avessero tutti lo stesso comportamento di scomparsa. Prima analizziamo quali sono, quanti e che comportamenti hanno».
- **CENSIMENTO**: 94 toast verdi (78 successo + 16 info), tutti da `sonner`, tutti già in fondo a destra. **6 comportamenti di scomparsa diversi**: 4s senza ✕ (~48), 4s con ✕ (~24), 10s+✕ (7), 12s+✕ (1), 30s+✕ (2), Infinity+✕ (1). Verificato che TUTTE le durate lunghe sono **avvisi veri** (12 giorni SdI, acconto, esito SdI, warning logo) — nessuna conferma ha una durata sbagliata: le conferme sono già tutte a 4s. L'**unica** incoerenza reale era la ✕ (48 conferme senza, 24 con).
- **SCELTA di Eli (AskUserQuestion): «due famiglie coerenti»** — conferme tutte 4s+✕, avvisi restano lunghi+✕.
- **FIX minimo e a rischio zero**: `closeButton` **globale** sul `<Toaster>` in `app/layout.tsx` (una riga). Ogni toast ha la ✕; le conferme ereditano i 4s di serie; gli avvisi tengono il loro `duration:` per-chiamata; gli errori idem. **Niente churn su 60 call site**: i `closeButton: true` per-chiamata restano ridondanti ma innocui (per-call === globale). Regola B.2 aggiornata: non aggiungerlo più sulle singole chiamate.
- ⚠️ **Ricaduta voluta**: ora anche gli errori rossi hanno la ✕ ovunque (prima ~metà). È un miglioramento di coerenza, non una regressione.
- **FAQ**: rilette, nessuna toccata (i toast non sono descritti in nessuna FAQ). tsc+build+701/701 verdi · scan spazi invariati.

### 📌 12 ago (11) — DUE INTEGRAZIONI OpenAPI DISTINTE (correzione mia + memoria da fissare)
Eli, guardando la console OpenAPI (token «Playground · Scaduto»): quel token era quello **configurato insieme il 29 lug per la verifica P.IVA** prima di pubblicare il profilo in vetrina — **non** un token «playground» da ignorare, come le avevo detto per assunzione. Correzione registrata.
- **OpenAPI serve a DUE cose diverse, con DUE chiavi diverse** — da non confondere mai più:
  ① **Verifica P.IVA** (vetrina) → `OPENAPI_COMPANY_API_KEY` su `company.openapi.com/IT-start/{piva}` (`lib/marketplace/company-check.ts`). È la **seconda chance dopo il VIES** (decisione Eli 29 lug «opzione 1»): il VIES contiene solo le P.IVA registrate per l'estero, quindi la maggior parte dei forfettari italiani NON c'è → senza il Registro Imprese non passerebbero. A pagamento, pochi centesimi a chiamata, interrogato solo quando il VIES non conferma.
  ② **Trasmissione SdI** (fatture) → `OPENAPI_SDI_API_KEY` su `sdi.openapi.it` (`lib/sdi/providers/openapi.ts`). Materia SEPARATA, ancora bloccata sull'ok dell'avvocato (B.0).
- **⚠️ CORREZIONE (stesso giorno): il token NON era scaduto.** La console OpenAPI lo mostrava «Scaduto», ma **ricaricando la pagina risultava valido** — stato vecchio della console, nessun rinnovo necessario. La voce in `COSE_DA_FARE_ELI.md` è tornata «configurata e valida», con la nota: se ricapita «Scaduto», ricaricare prima di allarmarsi.
- **Cosa succederebbe SE scadesse davvero** (utile saperlo, verificato nel codice): `checkCompanyRegistry` prende 401/403 → ritorna `'unavailable'` → in `runProfileChecks` (`lib/actions/marketplace.ts`) la P.IVA **non risulta verificata** → `allOk` false → il profilo non si pubblica per chi non è nel VIES, e l'artigiano legge *«I registri delle P.IVA non rispondono»* (messaggio fuorviante: sembra un guasto momentaneo). Rimedio: rigenerare il token con scope `GET company.openapi.com/IT-start` su Vercel.
- Env `OPENAPI_COMPANY_API_KEY`/`OPENAPI_COMPANY_BASE_URL` aggiunte al §5 (mancavano del tutto). Nessun codice toccato — solo documentazione.

### ✅ 12 ago (10) — [BUG] «Copia link» su una bozza consegnava un LINK MORTO (Eli: «la pagina non è trovata»)
Eli, aprendo il link di un preventivo «appena inviato con foto e non ancora salvato»: 404.
- **CAUSA, in due pezzi che insieme fanno il buco**: ① la pagina pubblica `/p/[token]` **esclude le bozze** per costruzione (`.in('status', ['sent','viewed',…])` → `notFound()`), ed è giusto così: una bozza non è mai stata condivisa; ② ma «Invia al cliente» dalla CREAZIONE crea il documento **in bozza** e apre il pop-up dei canali — e lì il tasto **«Copia»** copiava il link SUBITO e chiedeva «Segna come inviato?» solo DOPO. Chi non confermava (o apriva il link prima di confermare) aveva in mano un link che porta a «pagina non trovata». WhatsApp e Altre app segnavano già Inviato PRIMA di condividere: Copia era l'unico canale col link morto.
- **FIX (ShareButton)**: su una bozza, **prendere il link È l'invio** — dopo la copia (che resta PRIMA di ogni await lungo: la clipboard vuole il gesto fresco) parte da sé auto-salvataggio + `registerManualSendAction`, stessa strada di WhatsApp/Altre app, con rotella sul tasto Copia e toast unico «Link copiato: preventivo segnato come Inviato» + avviso 12 giorni dove serve. Se salvataggio o registrazione falliscono, l'errore DICE che il link copiato non funziona finché il documento resta in bozza. Il blocco di conferma resta SOLO per il caso «modificato dopo l'invio» (lì il link funziona già; in gioco c'è solo il badge). Footer del pop-up allineato. Le guardie server restano quelle di `registerManualSendAction` (cliente obbligatorio, voci salvate, quota Free).
- ⚠️ **Reversibilità detta**: chi copiava il link solo per guardarselo ora si trova il documento «Inviato» — si torna indietro con «Riporta in bozza», ed è il prezzo giusto per non dare mai più al cliente un link rotto.
- **FAQ**: rilette, nessuna toccata (la meccanica del pop-up non è descritta in nessuna FAQ; la spiegazione vive nel footer del pop-up, aggiornato).
- tsc+build+701/701 verdi · scan spazi invariati (67 build / 0 sorgente).

### ✅ 6 ago — BONIFICA DATI SENSIBILI + PULIZIA DOCUMENTAZIONE (richiesta Eli) — 1 ALTA trovata rivedendo il mio lavoro di ieri
Due richieste di Eli: rileggere tutti i file `.md` per vedere cosa togliere o aggiornare, e cancellare le informazioni sensibili presenti nell'ambiente.
- **[ALTA — bug mio, nel blocco di hardening della 072 scritto ieri sera] Il REVOKE avrebbe SPENTO PER SEMPRE la pulizia automatica dei registri.** `purge_old_security_events()` e `purge_old_stripe_events()` le crea `postgres` (SQL Editor) ma le chiama il **cron notturno come `service_role`**, che non ne è proprietario: il permesso gli arrivava da PUBLIC, quindi `REVOKE ... FROM public` glielo toglieva. Il cron logga un warning e prosegue → nessuno se ne sarebbe accorto, e i due registri sarebbero cresciuti all'infinito. Peggio: poche ore prima ho scritto **nell'informativa privacy** che il registro di sicurezza si cancella dopo 90 giorni — sarebbe diventata una dichiarazione falsa verso gli utenti. Fix: `GRANT EXECUTE ... TO service_role` dopo ogni REVOKE. **Validato su PG16**: senza il GRANT `SET ROLE service_role; SELECT purge_old_security_events();` → *"permission denied for function"*; col GRANT passa, `anon` resta respinto, idempotente al secondo giro. ⚠️ **Eli non aveva ancora applicato quel blocco**: il danno non è mai arrivato in produzione.
- **[ALTA compliance] PostHog attivo ma ASSENTE dall'informativa privacy, e nessuna sezione cookie.** Trovato rileggendo `gdpr/reminder-attivazione-posthog.md`: il punto 4 della sua checklist ("aggiungere PostHog ai fornitori + una sezione Cookie") non era mai stato fatto, ed è rimasto scoperto quando le chiavi sono state messe in produzione. Stessa lacuna per **Sentry** e **Cloudflare Turnstile**. Aggiunti tutti e tre alla tabella dei responsabili, nuova finalità "statistiche d'uso — consenso (art. 6.1.a)", e **nuova §5-bis "Cookie e statistiche d'uso"** (cookie tecnici necessari · PostHog solo col consenso, con "Rifiuta" allo stesso peso di "Accetta" · revoca dal collegamento in fondo alle pagine legali · nessun cookie pubblicitario, nessuna profilazione, nessun pixel). Compilato anche il campo giallo sulla conservazione dei log con i numeri VERI, verificati nel cron: eventi di sicurezza 90 giorni (senza IP in chiaro, solo un'impronta), aperture dei preventivi 12 mesi.
- **[ALTA — nel repo PUBBLICO] La password del demo era ancora in chiaro in due file**, sfuggiti alla bonifica GitGuardian del 15 luglio: `LANCIO.md` e `PLAY_STORE.md`. La password è morta (ruotata il 20 lug), quindi non è un'emergenza, ma violava la regola B.1.2-bis e avrebbe fatto scattare di nuovo l'allarme. Rimossa da entrambi. Rimossa anche l'**email personale di Eli** da 4 file (scheda marchio, un mockup, e due riferimenti nei documenti): in un repository pubblico l'indirizzo di accesso agli account di amministrazione è un regalo a chi prova le password rubate. ⚠️ Restano nella **cronologia git**, che è pubblica: riscriverla per un indirizzo email non vale il rischio, ed è per questo che la regola è "non scriverli mai", non "toglierli dopo".
- **Ambiente ripulito**: cancellati i 27 file caricati in chat (**contratto OpenAPI firmato**, un listino fornitore, 25 screenshot di pannelli Supabase/Vercel/OpenAPI) e i 295 file dello scratchpad (**dossier commercialista PDF + le 7 pagine renderizzate + lo script che lo genera**, mockup, screenshot dell'app), più i file SQL di prova in `/tmp`. Verificato che nel repo non ci sono chiavi, token o IBAN reali.
- **Documentazione: la radice passa da 36 a 19 file `.md`**, `gdpr/` da 10 a 1, la ricerca SdI da 6 a 3. **30 file spostati** in `_archivio-doc/` (17 dalla radice, 1 dai mockup, 9 da `gdpr/`, 3 dalla ricerca SdI) con un README che spiega cosa sono e dove sta invece la verità. ⚠️ Il commit dice "23 file" e "da 42": conteggi sbagliati miei, corretti qui al ricontrollo. Erano attivamente dannosi, non solo inutili: i file `gdpr/` dicevano *"nessun tracciamento attivo, non serve il banner cookie"* (il banner esiste) e *"2FA ancora da fare"* (è fatta su tutti e 5 gli account); `MAPPA_APP.md` elencava le migration "001-034, prossima libera la 035" (siamo alla 072) e non conosceva metà delle pagine dell'app. **Prima di archiviare** ho travasato ciò che era ancora vivo: due regole permanenti in §B.2, i collaudi rimasti aperti (scarto SdI NS col curl, collaboratori Team, verifica CSP) in `TEST_DA_FARE_ELI.md`, i testi Play Store in `PLAY_STORE_SCHEDA.md`.
- **`CLAUDE.md` da 384 KB a ~145 KB** (2.149 → ~1.220 righe): gli handoff dal 2 agosto in giù sono andati in `STORICO_SESSIONI.md` (terzo consolidamento). ⚠️ Prima di spostarli ho estratto le **regole permanenti** che ci stavano annegate dentro — € mai a capo, toast 4s, `var(--cc-muted)`, `cc-portal-float`, overlay in portal, spaziatore `::after`, `ContextHint`, GRANT per colonna, "una misura di sicurezza non è fatta perché il collaudo sembra a posto", "un header sbagliato rompe in silenzio" — che ora vivono in **§B.2 "Regole imparate sul campo"**.
- **Corretti perché dicevano il falso**: `RISCHI_E_PUNTI_DEBOLI.md` (idempotenza Stripe e uptime dati come "da fare" mentre sono chiusi da fine luglio), l'intestazione di `COSE_DA_FARE_ELI.md` ("aggiornato al 19 luglio" su un file che arriva a oggi), lo stack in §2 (Next 16.2.3 → 16.2.11; il PDF non usa più Chromium da ieri), `scripts/README.md` (mancava `security-check.mjs`, l'unico dei tre script non documentato), `DESIGN_TOKENS.md` (sfondo e ombra sbagliati). `gdpr/registro-trattamenti.md` **non** archiviato — è un obbligo di legge — ma marcato in testa con l'elenco preciso di cosa ci manca, da rifare con l'avvocato.
- tsc+build+471/471 verdi · scan spazi pulito.

### 🔥 12 ago (4) — [ALTA, BUG MIO IN PRODUZIONE] «Impossibile salvare le voci del documento»
Eli, provando a inviare un preventivo. **Il difetto l'ho introdotto io stamattina con la 081.**
- **CAUSA, dimostrata su PG16**: `document_items.bene_significativo` è `BOOLEAN NOT NULL DEFAULT false`, e il codice ci scriveva dentro `?? null`. In PostgreSQL **un NULL esplicito NON viene sostituito dal default: viene RIFIUTATO** (`23502 not_null_violation`). Quindi ogni voce NON marcata — cioè quasi tutte — faceva fallire l'insert, e con esso l'intero salvataggio del documento. Provato: `INSERT ... VALUES (NULL)` → *«null value in column "bene_significativo" violates not-null constraint»*; con `false` passa.
- **PERCHÉ LA CASCATA TOLLERANTE NON HA SALVATO NULLA**: `insertDocumentItemsTollerante` ritenta solo su `42703`/`PGRST204`/`23503` (colonna assente, FK). Il `23502` non era in elenco → nessun ripiego, errore secco all'utente.
- **FIX in due strati**: ① si scrive **sempre un booleano** (`=== true`) in tutti e 9 i punti di scrittura; ② il `23502` entra nella cascata come rete — meglio un documento salvato senza la marcatura che un documento perso.
- ⚠️ **REGOLA**: una colonna `NOT NULL DEFAULT x` non tollera il NULL esplicito. Se il codice fa `?? null` su un campo facoltativo, la colonna dev'essere **nullable** — oppure il codice deve scrivere il default, mai `null`. E ogni cascata tollerante che nasce per «colonna assente» va estesa ai vincoli, altrimenti copre solo metà dei modi in cui un insert può fallire.

### 🔎 12 ago (9) — RICONTROLLO, SECONDA PARTE: i due revisori consegnano — 5 ALTE + 7 MEDIE fiscali, 2 MEDIE auth, tutte verificate e chiuse
La radice comune, detta dal revisore fiscale: **ogni punto che copia o re-idrata le voci a colonne esplicite era rimasto indietro rispetto alla 081** — il flag viaggiava bene solo nei percorsi a spread integrale.
- **[ALTA] Il RE-EDIT cancellava la marcatura**: l'init di `voci` in PreventivoForm mappava le colonne a mano senza `bene_significativo` → spunta spenta al riapri, e il **salvataggio automatico** riscriveva le voci senza flag ricalcolando l'IVA senza split (caldaia 2.000+posa 500: da 430 a 250 € di IVA, in silenzio). Aggiunto all'init — stessa classe del bug `option_tier` del 17 lug.
- **[ALTA] Multi-proposta: TRE totali diversi su tre superfici.** ① La select del TierPicker non leggeva il flag (e il mapping lo scartava): il cliente vedeva il totale SENZA split mentre l'accettazione scriveva quello CON → accettava un prezzo diverso da quello registrato. ② Il PDF espandeva le voci sull'INSIEME delle proposte: la caldaia della Base si sommava con quella della Premium e l'eccedenza globale non esisteva in nessuno scenario. Ora: select+mapping col flag, **espansione PER PROPOSTA** nel PDF, e la dicitura di legge **solo su fattura/NC e mai col multi-proposta** (sommava i beni fra proposte, e l'obbligo vale «in fattura»).
- **[ALTA] Flag STANTIO**: cambiando l'IVA della voce da 10 a 22 la casella sparisce dalla UI ma il flag restava nel dato → lo split riconvertiva pezzi di 22% in 10%, e nel caso B ≤ P il PDF stampava una dicitura di legge FALSA («l'intero corrispettivo è al 10%») accanto a un riepilogo al 22%. Difesa su DUE strati: `eBene()` nel modulo puro (un bene conta solo se la sua voce è ancora al 10%, +2 test) e pulizia del flag nei due select IVA di VociTable.
- **[ALTA, già chiusa in prima parte] Conversione senza flag** → migration 082. **[ALTA, già chiusa] NC senza flag nelle voci.**
- **[MEDIA] Il «risalva» di una NC in reverse charge la ricalcolava a IVA PIENA**: fiscalOpts leggeva il reverse dal form (che sulla NC non ha la spunta) → ora sulla NC si legge dal DOCUMENTO (`existingDoc.reverse_charge`, select allargata).
- **[MEDIA] Il tetto dello storno bloccava lo storno pieno della fattura col condominio**: `documents.total` è già netto della ritenuta, la NC è al lordo → NC 1.220 vs base 1.180 = bloccata, e il «rimedio» suggerito produceva una NC fiscalmente sbagliata. La ritenuta è una vicenda di PAGAMENTO, non una riduzione dell'operazione: `baseStornabile` ora la RIAGGIUNGE (nuovo `importoRitenuta()`, ricostruita coi campi del documento perché non è salvata come cifra), nei 3 punti fattura-lato (creazione, trasmissione, pagina).
- **[MEDIA] La pagina del cliente non mostrava la ritenuta**: Subtotale 1.000 + IVA 220 e «Totale 1.180» senza spiegazione — la riga c'era solo nel PDF. Aggiunta a MobilePublicCard (−importo, con la %).
- **[MEDIA] La 081 aveva aperto la strada allo scarto su IVA 0%**: prima la guardia multi-aliquota fermava (con messaggio sbagliato ma fermava) una fattura ordinaria 22%+0%; toglierla l'aveva resa trasmissibile — e una riga a IVA 0 senza «Natura» è scarto certo (00400/00429). Guardia nuova in trasmetti E doc-xml: IVA 0 in ordinario (fuori dal reverse) → 422 con spiegazione; la natura giusta (esente? non imponibile?) non si inventa.
- **[MEDIA] Lo snapshot retroattivo salvava le voci senza flag** (i due select espliciti) → il ripristino versione reinseriva voci al 10% con totali che includono il 22%. Colonna aggiunta a entrambi i select; il ramo condizionale del restore la riporta da sé.
- **[MEDIA] `applyFiscaliExtra` ingoiava QUALSIASI errore**, non solo la colonna assente: un reverse charge perso per un errore di rete lasciava totali a IVA zero col flag spento, senza traccia. Ora tollerante SOLO a `isMissingColumnError`; gli errori veri restano best-effort (il documento è già salvato) ma finiscono nei log.
- **[MEDIA, contratto] Con prestazione a ZERO** il commento prometteva «non fa nulla» ma la formula manda l'intero bene al 22% (`10% = P + min(B,P)` con P=0). La formula è giusta: corretto il COMMENTO, non il codice.
- **[BASSE] `multiVat` della pagina pubblica ora si calcola sulle voci ESPANSE** (con un bene splittato diceva «IVA 10%» accanto a un importo che include il 22%) · base della ritenuta nell'XML ora al netto dello sconto documento (mina disinnescata: oggi gli sconti sono rifiutati nei percorsi SdI) · la riga Ritenuta del PDF arrotonda la base prima di moltiplicare (1 cent di scarto possibile col motore).
- **AUTH (revisore dedicato, nessuna ALTA)**: «Esci» non leggeva l'esito di signOut (che RITORNA `{error}`, non lancia) → su errore di rete portava DENTRO l'app chi voleva uscirne; ora atterra su `/login?error=uscita_non_riuscita` col riquadro ancora visibile · lo stesso fix del recovery mancava sul percorso PKCE (`/auth/callback`) — config-dipendente, ora coperto · il `.catch` sul signOut era codice morto (ora l'`{error}` si logga) · sanitizzazione del «Vai all'app» allineata ai gemelli (`/api/`, `/login`, `/signup` esclusi) · **trade-off dichiarato nel codice**: il signOut pre-verifica gira anche su token non validi (un link consumato da uno scanner slogga il dispositivo; si rientra col login — l'alternativa era il verifyOtp che fallisce e la sessione ereditata).
- **SMENTITI dai revisori (con prova)**: doppio split motore+PDF (idempotenza regge) · path foto arbitrari resi visibili (il set filtra sui path già validati) · loop di redirect proxy↔login · lockout · anti-enumerazione indebolita · XSS da searchParams · posizioni XSD di DatiRitenuta/Ritenuta.
- ⚠️ **Residui dichiarati**: `quotaAccontoBene` è codice morto (la riproporzione del bene sugli acconti/SAL non è cablata — è la domanda N14 ② al commercialista, si cabla dopo la sua risposta) · con P=0 l'artigiano vede «IVA 10» sul campo e il riepilogo addebita il 22 senza un avviso in UI (il ⓘ lo spiega; avviso contestuale = giro suo) · `itemsSignature` non guarda il flag: togliere la SOLA marcatura su un documento inviato non accende il banner «Modificato» quando il totale non cambia.
- tsc+build+**701/701** verdi · scan spazi 67 (la voce nuova è il valore tecnico `uscita_non_riuscita`, verificato col diff del build).

### 🔎 12 ago (8) — RICONTROLLO dei due giorni (Eli: «pieno zeppo di errori») — PRIMA PARTE, 7 errori veri trovati e chiusi (⚠️ migration 082)
Richiesta: rileggere tutto il lavoro dell'11-12 ago da avversario, con attenzione al login. Due revisori esterni ancora in corso; questi sono i finding VERIFICATI DI PERSONA e già chiusi:
- **[GRAVE, fattura] La causale vuota respingeva OGNI fattura in regime ordinario.** Il form manda sempre gli hidden input della ritenuta: con la spunta spenta arriva `ritenuta_causale=''`, e la regex `^[A-Z]{1,2}$` su '' fallisce → l'INTERA validazione Zod del documento falliva. Fix: `z.preprocess('' → null)`. Dimostrato con node sui 4 casi (spente/accese/assenti/sporche).
- **[GRAVE, fiscale] Il reverse charge veniva RIFIUTATO dalla guardia 00421 di doc-xml**: l'imposta salvata è zero per legge, il ricalcolo pretendeva base×aliquota (le voci conservano la loro aliquota). Ora la guardia per il reverse verifica l'opposto: imposta salvata ≈ 0.
- **[FISCALE] Una voce con IVA «predefinita» (campo vuoto) contava come prestazione al 10% anche con default 22%**, gonfiando la quota agevolata del bene. `espandiBeniSignificativi`/`dettaglioBeniSignificativi` ora ricevono `vat_rate_default` (passato in TUTTI e 6 i call site: motore, PDF, pagina pubblica ×2, doc-xml, trasmetti). +2 test (699).
- **[FISCALE, ⚠️ migration 082] La conversione preventivo→fattura PERDEVA la marcatura**: `convert_preventivo_to_fattura` (062) copia le voci colonna per colonna e `bene_significativo` non c'era → la fattura nasceva senza split, con MENO IVA del dovuto, proprio sul documento fiscale. 082 = stessa funzione con la colonna in elenco. **VALIDATA su PG16**: flag `t` sulla voce copiata, idempotente. ⚠️ Da applicare DOPO la 081 (già applicata).
- **[FISCALE] La NC non portava la marcatura nelle voci** (totali calcolati COL split, voci salvate SENZA → la guardia 00421 l'avrebbe bloccata alla trasmissione) e **non ereditava il reverse charge** della fattura stornata (avrebbe stornato un'IVA mai addebitata, XML con aliquota al posto di N6.7). Ora: flag nelle voci NC + `reverse_charge` in fiscalOpts e persistito (applyFiscaliExtra).
- **[SICUREZZA] Open redirect sul «Vai all'app»** del riquadro «Risulti già connesso»: `?redirect=` finiva in un href senza filtro. Sanitizzato con le regole del proxy. E l'eccezione `?error=` del proxy ora vale SOLO per /login (su /signup apriva una pagina che ignora il parametro).
- **[SICUREZZA] «Esci» usava `signOut()` senza scope** — il default è `global`: chiudeva le sessioni su TUTTI i dispositivi. Ora `scope: 'local'`.
- Verificati PULITI di persona: reset password senza campo conferma (il server non validava il campo tolto) · duplica/ripristino/registrazione portano già il flag · update riscrive sempre le voci (la spunta si salva in modifica).

### ✅ 12 ago (7) — Le foto si scelgono GIÀ nel form + nome del catalogo leggibile + «chi ha aggiunto quella barra?»
- **[FEATURE, Eli] La visibilità delle foto si decide GIÀ alla creazione.** Prima ogni foto allegata dal form nasceva nascosta e la scelta esisteva solo nella scheda del documento — cioè DOPO, quando il preventivo magari era già partito («posso inviare subito senza salvare come bozza»). Ora ogni miniatura porta la pillola **Nascosta/Visibile** (occhio, in basso a sinistra — stesso gesto della WorkPhotosCard): l'occhio acceso = la foto compare sul link del cliente. Il form manda `photo_visible_paths` accanto a `photo_paths`; il server scrive `visible_to_client` di conseguenza. **Default: nascosta** — una foto del bagno del cliente non deve finire sul link per una spunta dimenticata; campo assente o spazzatura → tutte nascoste. La copy del giro precedente («il cliente non le vede: aprila dalla scheda…») è stata sostituita: ora la scelta si fa lì. ⚠️ Non verificato con Chromium (PreventivoForm importa le Server Action); logica di stato semplice, coperta dal collaudo di Eli.
- **[FAQ resa vera] «Posso creare il preventivo dalle foto?»** citava ancora «o riusa quelle del sopralluogo» — il tasto tolto nel giro (6). Rimosso l'inciso.
- **[UI] Nel modulo del catalogo il NOME si leggeva a metà** («Raccordo / fittir», foto): Nome e Categoria si dividevano la riga anche a 390px. Su telefono ora ognuno ha la sua riga intera (`flex-col sm:flex-row`); sopra i 640px tornano affiancati.
- **[RISPOSTA, nessun codice] «Adesso mi compare in alto carta canta app, chi l'ha aggiunto?»** — **Nessuno: non è nostro.** La barra scura «Carta Canta · cartacanta.app» è la **finestra del browser di Android** (Custom Tab): compare quando si apre un collegamento in una scheda nuova — «Gestisci catalogo» o «Configura il codice ATECO» (`target="_blank"`) — e resta finché si naviga dentro quella scheda. Il header bianco «× Nuovo preventivo» sotto esiste dal **19 luglio** (verificato con git). ⚠️ Il `_blank` su quei link è il cerotto per non perdere il form in compilazione: quando si farà la **protezione della bozza non salvata** (già proposta, in attesa) quei link potranno navigare in-app e la barra sparirà.
- tsc+build+697/697 verdi · scan spazi invariati (66 build / 0 sorgente).

### ✅ 12 ago (6) — Via il tasto «Usa le N foto già caricate» + verifica del fix delle voci
- **[UI, Eli] Tolto «Usa le N foto già caricate»** dal blocco «Compila le voci con l'AI». Quelle sono le **foto del LAVORO** — lo stato del cantiere, il prima e il dopo — non il materiale da cui ricavare le voci di un preventivo: offrirle lì mescolava due cose diverse e invitava a un'estrazione che non poteva dare un buon risultato. «Dalle foto» resta, perché lì le foto le sceglie l'artigiano sul momento. ⚠️ `handleAiExtractLinkedPhotos` e la prop `linkedPhotoCount` restano nel file, non più usati.
- **[VERIFICA] L'errore di salvataggio che Eli vedeva ancora alle 14:03 era la build VECCHIA**: il fix è stato spinto su master alle **12:05 UTC = 14:05 ora italiana**, due minuti DOPO la sua schermata (14:03), più il minuto o due che Vercel impiega a pubblicare. Il messaggio diverso («Salvataggio delle voci non riuscito: NON chiudere la pagina…») è quello di `saveDraftAction`, cioè lo stesso difetto su un'altra azione — non un secondo problema.
- **Controllo fatto per esserne certi, non per assunzione**: `bene_significativo` è l'**unica** colonna `NOT NULL` aggiunta a `document_items` dopo lo schema iniziale (le altre — `bonus_tipo`, `option_tier`, `unit_cost`, `supplier_list_id` — sono tutte nullable), e i **9 punti di scrittura** ora mandano un booleano. In più la cascata tollerante intercetta il `23502`: anche se un vincolo saltasse fuori altrove, il documento si salva senza la marcatura invece di perdersi.
- ⚠️ Lo scan spazi passa da 67 a **66**: una voce in meno perché è sparito il testo di quel tasto. Non è una violazione nuova.
- tsc+build+697/697 verdi.

### ✅ 12 ago (5) — Il resto del collaudo: password, foto, catalogo, ATECO
- **[DECISIONE Eli] Via il campo «Conferma password»**, in **entrambe** le pagine (registrazione e nuova password dopo il reset). Non aggiunge sicurezza: protegge da un refuso, non da un attacco, e il refuso lo previene già il tasto «mostra password» dentro il campo — è la scelta di Google e GitHub. In più chiude alla radice il difetto per cui i gestori di password di Android riempivano il secondo campo mentre si scriveva nel primo. Se una password sbagliata passasse comunque, resta il recupero via email.
- **[COPY che diceva il FALSO] «Scegli poi quali foto mostrare al cliente»** — verificato sul modello dati: `work_photos.visible_to_client` è `NOT NULL DEFAULT false` e la creazione scrive `false`. Quindi **il cliente non vede NESSUNA foto** finché non la si accende, e la scelta sta nella scheda del documento **dopo** il salvataggio. La riga prometteva un passaggio che nel form non esiste. Ora: *«Vengono collegate al preventivo appena creato. Il cliente non le vede: per mostrargliene qualcuna, aprila dalla scheda del preventivo dopo il salvataggio»*.
- **[UI] «Gestisci catalogo» tagliato dal bordo del pop-up** (foto): stava accanto a «Importa voci suggerite» in una riga che a 390px non ci sta. Tolto — era anche un **doppione**, lo stesso collegamento è nel piè di pagina del pop-up due righe sotto. Il tasto di importazione prende tutta la larghezza.
- **[UX] Il fuoco non andava sul campo ATECO**: l'ancora `#ateco` portava la pagina nel punto giusto ma il cursore restava dov'era. Ora, arrivando con quell'ancora, il blocco scorre a schermo e il **primo campo prende il fuoco** (con un ritardo di 300ms: il pannello si monta dopo il primo disegno).
- ⚠️ **CSP nei log Vercel**: la policy stretta gira in **`Report-Only`** dal 5 agosto, apposta per raccogliere le violazioni senza rompere niente — quindi quelle righe **non indicano un guasto**, sono il registro che serve a decidere cosa stringere. Da leggere prima di attivarla: serve il campo `blocked-uri` delle righe `[csp]`.
- tsc+build+697/697 verdi · scan spazi invariati (67 build / 0 sorgente).

### ✅ 12 ago (3) — «ser» al posto di «servizio», il ricarico tagliato, onboarding a due passi
- **[RICERCA, richiesta di Eli «per essere super sicuri»] Le aliquote IVA italiane sono QUATTRO: 22% · 10% · 5% · 4%**, più lo 0 per esenti e non imponibili. Verificato su più fonti 2026: **invariate** rispetto agli anni precedenti, **nessuna aliquota all'8%**, nessuna al 20% (l'ordinaria è 22%). La tendina dell'app le ha già tutte → **il campo libero non si fa**: non aggiungerebbe casi veri, aggiungerebbe la possibilità di scrivere un'aliquota inesistente.
- **[BUG] L'unità «servizio» si leggeva «ser».** La colonna Unità era **62px**, e le voci più lunghe dell'elenco sono `servizio` e `a corpo`. Ora **96px**: misurato con Chromium, «servizio» è **intero e non troncato a 390, 360 e 320px**, e Q.tà/Prezzo restano larghi (a 390px ne restano ~124 ciascuno, «1.250,00» entra comodo).
- **[BUG] «ricarico 64…»: a essere tagliata era la CIFRA.** La pillola del margine scriveva `ricarico 64,3%` e il taglio partiva da destra, cioè proprio dal numero. Ora **il numero sta in testa**: `643% ricarico` → quando lo spazio manca si mangia la parola (`643% ricar…`) e la percentuale resta sempre leggibile. Via anche i decimali. ⚠️ **Regola**: in un testo che può essere troncato, il dato va PRIMA dell'etichetta.
- **[UI] Card della voce ancora più corta**: il «Cosa vuol dire ⓘ» del bene significativo era su una riga propria, ora sta sotto l'etichetta senza stacco.
- **[ONBOARDING] Da tre passi a DUE: via il logo** (Eli: «forse toglierei il logo»). Non serve per fare un preventivo e si carica in Impostazioni quando si vuole; come terzo schermo prima del primo documento era solo un ostacolo. ⚠️ Il componente `Step2` resta nel file, non più montato: rimetterlo in fila è una riga.
- **[ONBOARDING] Il regime fiscale C'ERA GIÀ** (secondo campo del passo 1) — la preoccupazione di Eli è però giusta: **il valore di partenza è «forfettario»** e chi scorre senza guardare si porta dietro IVA, bollo e diciture sbagliate per sempre. Aggiunta la riga che dice **cosa decide quella scelta** e che si cambia dalle Impostazioni.
- **[ALTA, ipotesi con tutte le prove a favore] Il link di reset «scaduto» su un'email di due minuti prima.** Eli ha smentito la spiegazione del giro precedente (non era un'email vecchia). Il fatto che le combacia tutte: **aveva una sessione Google attiva in quel browser**, e `verifyOtp` di un token di recupero mentre se ne porta un'altra è la combinazione che fallisce. Ora, **solo per `type=recovery`, si chiude prima la sessione locale** (`signOut({ scope: 'local' })` — gli altri dispositivi non si toccano). Lo stesso cambio chiude alla radice anche il «mi ha fatto entrare senza password»: dopo il link non c'è più nessuna sessione da ereditare. ⚠️ **È una diagnosi, non una prova**: la conferma è la riga `[auth/confirm] verifyOtp error:` nei log Vercel, da farsi mandare da Eli se ricapita.
- ⚠️ **Domanda di Eli sul secondo campo password, risposta in chat**: NON dà maggiore sicurezza — protegge da un refuso, non da un attacco, e il refuso lo previene già il tasto «mostra password». Decisione lasciata a lei; nessun codice toccato.
- tsc+build+697/697 verdi · scan spazi invariati (67 build / 0 sorgente).

### ✅ 12 ago (2) — Collaudo di Eli sulla REGISTRAZIONE: 4 punti di accesso + il preventivo perso
- **[ALTA, quella che spaventa] «Torna al login» la faceva entrare SENZA chiedere la password.** Verificato: **non era un buco**. Aveva già una sessione Google valida in quel browser, e il **proxy manda in `/dashboard` chiunque sia autenticato e apra `/login`** — comportamento normale, ma **indistinguibile da un buco** per chi lo vive. ⚠️ Il difetto vero è che quel salto **si mangiava il messaggio d'errore**: `/login?error=link_scaduto` non veniva mai renderizzato, quindi al posto di «il link è scaduto» arrivava l'app. Ora il proxy **non reindirizza quando c'è un `?error=`**, e la pagina mostra un riquadro esplicito: **«Risulti già connesso come {email}»**, con «Vai all'app» ed **«Esci»**. Chi sta recuperando la password su un dispositivo condiviso lo vede prima di entrare.
- **[ALTA, per progetto ma va detto] La registrazione con un'email GIÀ ESISTENTE non manda nessuna email**, e diceva «controlla la posta». È la regola **anti-enumerazione** (audit 24 lug): la risposta dev'essere identica per un'email nuova e per una già registrata, altrimenti la registrazione diventa un oracolo per costruire liste di account veri. Il prezzo lo pagava l'utente. Ora `/verifica-email` porta un riquadro **mostrato SEMPRE, a tutti**: *«Non arriva nulla? Controlla la posta indesiderata. Se hai già un account con questo indirizzo — per esempio creato con Accedi con Google — la conferma non viene inviata una seconda volta: accedi da qui»*. Chi ha l'account capisce, chi non ce l'ha non impara niente sugli indirizzi altrui.
- **[MEDIA] «Link di reset scaduto» su un link appena richiesto.** L'app **non costruisce** quel link: lo genera Supabase, con un token nuovo a ogni richiesta — quindi non è «lo stesso link». Le cause reali sono due: si è aperta **un'email di reset PRECEDENTE** (sono identiche a vedersi), oppure il token monouso è stato **consumato da un antivirus/scanner** che pre-apre i link. Copy riscritta in entrambi i punti: *«Ogni link vale una sola volta e resta valido solo l'ultimo ricevuto: se hai più email di reset in casella, apri la più recente»*.
- **[MEDIA] La password si ricopiava da sola nel campo «Conferma».** Lo stato React è **corretto e separato** (due `useState`): a mirrorare è il **gestore di password di Android**, che tratta due campi `new-password` come una coppia. Applicati i marcatori che chiedono ai gestori di stare fuori dal secondo campo (`autoComplete="off"`, `data-lpignore`, `data-1p-ignore`, `data-bwignore`). ⚠️ **Sono suggerimenti, non garanzie, e non ho potuto riprodurre il caso** (serve quel telefono). La soluzione definitiva è **togliere il campo di conferma**: il tasto «mostra password» rende già visibile ciò che si scrive, ed è quello che fanno Google e GitHub. È una scelta di prodotto — proposta a Eli, non applicata.
- **[MEDIA] Il link «Configura il codice ATECO» portava nella scheda sbagliata**: `/impostazioni` senza parametri atterra su **Generale**, e i codici ATECO stanno in **Fiscale**. Ora `?tab=fiscale#ateco` — l'ancora `id="ateco"` con `scrollMarginTop: 90` esisteva già dal 7 ago, mancava solo di puntarci.
- ⚠️ **Il preventivo perso NON è chiuso, e va detto.** Il link ha `target="_blank"` (ora anche `rel="noopener"`) e il testo lo dichiara — *«Si apre in una scheda nuova: il preventivo resta qui»* — ma **nella PWA/TWA Android il `_blank` può aprirsi nella stessa vista**: si naviga via, si torna indietro e il form in **creazione** è vuoto, perché non esiste ancora nessun documento su cui salvare. **Proteggere la bozza non salvata** (istantanea in sessionStorage + ripristino) è un giro a sé, utile anche per il tasto Indietro premuto per sbaglio e per l'app chiusa da Android. Proposto, non fatto.
- **[COPY] Registro formale** (regola §B.2) sulla riga del termine SdI superato: *«Trasmettila comunque — meglio tardi che mai — e parlane col commercialista…»* → *«Trasmettila comunque: la fattura resta valida. Segnala il ritardo al commercialista — con il ravvedimento operoso la sanzione si riduce»*. Allineata anche la FAQ gemella.
- tsc+build+697/697+smoke 28/28 verdi · scan spazi invariati (67 build / 0 sorgente).

### ✅ 12 ago — La card della voce era «troppo grande e disorganizzata» (foto di Eli) + la domanda sull'IVA
- **[BUG, misurato] Il campo IVA finiva nella colonna dell'UNITÀ, larga 62px.** La griglia dei campi numerici aveva **quattro colonne** (`62px 1.5fr 1.3fr 0.9fr`) ma **cinque campi** quando l'IVA è visibile: il quinto andava a capo da solo e atterrava nella prima colonna, quella pensata per «pz»/«mq». Nella foto di Eli si legge **«22'»** al posto di «22%». **Misurato con Chromium sul componente vero**: larghezza del campo IVA **62px → 169px** a 390px (154 a 360, 134 a 320).
- **[UI] Due righe di campi al posto di quattro colonne più un'orfana**: riga 1 «Unità · Q.tà · Prezzo» (quanto e a che prezzo), riga 2 «Sconto · IVA». Segue il ragionamento invece dello spazio disponibile.
- **[UI] Il tasto «Chiudi» occupava una riga intera in fondo**: ora la chevron sta accanto a «VOCE N» nella testata, che è dove si guarda per capire dove si è. Una riga in meno.
- **Esito misurato**: altezza del blocco voci **454px → 417px** a 390px, zero sbordi a 390/360/320. ⚠️ Il banco di prova riproduce la larghezza sbagliata (62px) ma **non il taglio del testo**: «22%» in 29px ci sta, e sul telefono di Eli no — dipende dal rendering del font del dispositivo. La causa è comunque quella, e a 169px il dubbio non si pone.
- **[RISPOSTA a Eli] Campo IVA libero? No, e il motivo è che le aliquote italiane sono QUATTRO.** 22% · 10% · 5% · 4%, più lo 0 per esenti e non imponibili. **L'8% non esiste** (e nemmeno il 20%, abolito nel 2011). Un campo libero non aggiungerebbe casi veri: aggiungerebbe la possibilità di scrivere un'aliquota che non esiste, e l'errore si scoprirebbe allo scarto SdI o, peggio, mai. La tendina **è già completa** e il 22% è già il default (si eredita dalle Impostazioni). Se un giorno servisse davvero un valore fuori elenco, si aggiunge una voce «Altra…» — è una riga di codice, ma va chiesta.
- ⚠️ **Regola imparata**: una griglia con N colonne e N+1 campi non «va a capo bene» — manda l'ultimo campo nella colonna di un altro, con la sua larghezza. Se i campi cambiano di numero (qui: l'IVA compare solo fuori dal forfettario) le colonne vanno dichiarate per ENTRAMBI i casi.
- tsc+build+697/697 verdi · scan spazi invariati (67 build / 0 sorgente).

### ✅ 11 ago (14) — ⚖️ LE TRE COSE CHE «NELLA PRASSI SI FANNO» (⚠️ migration 081 DA APPLICARE)
Eli: *«prosegui come suggerito dopo aver confermato la strategia con fonti ufficiali sul web»* — le tre aree della ricerca N7-N13, nell'ordine di rischio crescente. Piano confermato: si implementa la prassi trovata sulle fonti, al commercialista resta la **conferma** (domande **N14-N18** in `COSE_DA_FARE_ELI.md`).
- **⚠️ migration 081** (`081_iva_10_ritenuta_reverse_charge.sql`, VALIDATA su PG16: idempotente, default sulle righe esistenti, valori intatti al rilancio, vincolo sulla causale che accetta `W`/`ZO` e respinge minuscole, sigle lunghe, testo libero e stringa vuota): `document_items.bene_significativo` · `documents.ritenuta_causale` · `documents.reverse_charge`. **Una sola migration per tutte e tre**: si applica una volta. Applicabile prima o dopo il deploy (insert delle voci tollerante, scrittura dei due campi del documento tollerante).
- **① IVA 10% e BENI SIGNIFICATIVI** (`lib/fiscal/beni-significativi.ts`, PURO, **+23 test**). La regola del DM 29.12.1999: sui sette beni (ascensori, infissi, caldaie, videocitofoni, condizionatori, sanitari, impianti di sicurezza) il 10% vale **solo fino a concorrenza del valore della prestazione**, l'eccedenza va al 22%. ⚠️ **Il termine di confronto NON è la sola manodopera**: è tutta la prestazione al netto del bene — materiali, e le **parti staccate con autonomia funzionale** (tapparelle, zanzariere, grate). È l'errore più diffuso e c'è un test apposta che lo fissa (infisso 1.000 + posa 300 → 700 al 22%; con le tapparelle da 400 l'eccedenza scende a 300).
  - **COME, senza toccare il motore**: la voce marcata viene **spezzata in due righe** da una funzione pura e **idempotente** (azzera il flag sulle righe che produce) *prima* del calcolo. Nessun ramo nuovo: il passo 4 somma già le basi per aliquota. PDF, pagina pubblica e XML richiamano la **stessa** funzione → per costruzione non possono divergere.
  - ⚠️ **Lo split NON si persiste**: `itemTotals` resta sulle voci GREZZE. Salvare le due righe trasformerebbe «Caldaia» in due voci che l'artigiano non può più correggere, né ricalcolare se domani cambia il prezzo della posa. È una **rappresentazione** del documento, non un dato.
  - **PDF**: oltre alle due righe, la dicitura dell'**art. 1 c.19 L. 205/2017** col valore del bene e il corrispettivo al netto — dovuta **anche quando tutto resta al 10%**, cioè proprio quando le righe restano una sola e lo split da solo non assolverebbe l'obbligo. È l'adempimento che i gestionali dimenticano più spesso.
  - La spunta è **manuale, voce per voce** (solo regime ordinario, solo voci al 10%): l'elenco è tassativo nella sostanza ma non nel nome commerciale (una stufa a pellet che scalda l'impianto = caldaia), e nessun riconoscimento automatico dal testo sarebbe affidabile.
- **② RITENUTA 4% DEL CONDOMINIO** (art. 25-ter DPR 600/1973, **+11 test**). Il flag «ritenuta automatica» era **nascosto dal 25 luglio** proprio perché scollegato dal motore: si salvava e nessun calcolo lo leggeva. Ora il giro è completo — spunta «Il cliente è un condominio» (solo fatture, mai ai forfettari: **esenti**, art. 1 c.67), riga «Ritenuta d'acconto 4% −X €» in **tutti e quattro i preset** del PDF, dicitura che dice **chi la versa**, e nell'XML il blocco **`DatiRitenuta`** con **`<Ritenuta>SI</Ritenuta>` su OGNI riga** (senza, scarto **00415**).
  - ⚠️ **Posizioni dell'XSD, con un test sull'ordine**: `DatiRitenuta` dopo `<Numero>` e prima di `<ImportoTotaleDocumento>`; `<Ritenuta>` dopo `<AliquotaIVA>` e prima di `<Natura>`. Fuori posto è un file invalido (00001).
  - **CausalePagamento `W`** (corrispettivi per contratti d'appalto): la `A` è lavoro autonomo e sarebbe sbagliata; una causale mancante o spazzatura ricade su `W`, **mai** su un valore inventato. `RT01`/`RT02` dedotto dalla ragione sociale, default ditta individuale.
  - Nel ⓘ la cosa che nessuno scrive: **4% e 11% NON si cumulano** — col bonifico parlante la banca trattiene già l'11% e il 4% non si applica (circ. 40/E/2010). È il caso in cui l'artigiano rischia di vedersi trattenere due volte.
  - **Cade il rifiuto** «le fatture con ritenuta non sono trasmissibili» (24 lug).
- **③ INVERSIONE CONTABILE in edilizia** (art. 17 c.6 lett. **a-ter**, **+8 test**): spunta «Lavoro edile per un'altra impresa o professionista» → fattura **senza IVA**, natura **N6.7**, dicitura di legge, e **rifiuto di trasmettere se il cliente non ha la P.IVA** in rubrica (fra impresa e privato l'inversione contabile non esiste). Mai ai forfettari: non la applicano in uscita, restano N2.2 — c'è un test che verifica che col flag acceso un forfettario resti comunque N2.2.
  - ⚠️ **N6.7, MAI N6.3**: quella è il subappalto edile della lett. a, un'altra fattispecie — dichiararla significherebbe raccontare all'Agenzia un'operazione diversa da quella svolta.
  - ⚠️ **Perché MANUALE e non dedotta dall'ATECO**: la circ. 14/E/2015 mappa il reverse charge sui codici **ATECO 2007**, ma dal 2025 la classificazione è cambiata e la mappatura non è stata aggiornata. Dedurre da un codice che non corrisponde più vorrebbe dire togliere l'IVA a una fattura che la deve avere, o il contrario.
- **[DIFETTO LATENTE TROVATO E CHIUSO] Il BOLLO era legato al REGIME, doveva essere legato all'ASSENZA DI IVA.** Il motore applicava i 2 € solo ai forfettari, ma il bollo è dovuto su **ogni documento senza imposta** sopra 77,47 € (art. 13 tariffa DPR 642/1972 · DM 17/06/2014) — e una fattura in reverse charge è a IVA zero esattamente come quella di un forfettario. Ora la condizione è «nessuna IVA addebitata». Emerso costruendo il punto ③: nessun test lo avrebbe scoperto prima, perché il caso non esisteva.
- **[LIMITE FASE 1 RIMOSSO] Multi-aliquota nell'XML.** L'app rifiutava di trasmettere una fattura con aliquote diverse fra le voci: serviva dai beni significativi, che per costruzione ne hanno due. Ora **`DatiRiepilogo` esce con un blocco per aliquota**, con l'imposta calcolata **una volta sola** sulla somma delle basi di quell'aliquota (mai riga per riga: è la causa nota dello scarto **00421**, con un test che la fissa sui 5×10,11 € al 22%).
- **⚠️ Le tre spunte hanno l'ascoltatore del `reset` di React 19** (regola §B.2, quarta e quinta occorrenza): un campo controllato dentro un form con Server Action torna indietro da solo senza. Qui si riscrive sul **nodo del DOM**, non nello stato — lo stato è già giusto, è il DOM ad essere stato riportato indietro.
- **3 FAQ nuove** («perché una parte della caldaia è al 22%» · «fatturo a un condominio: mi trattengono qualcosa?» · «lavoro per un'altra impresa: fattura senza IVA?»), **3 punti in /novita**, **N14-N18** in `COSE_DA_FARE_ELI.md` (con i tre punti tecnici su cui le fonti si dividono: CausalePagamento, TipoRitenuta, ImportoTotaleDocumento lordo/netto).
- ⚠️ **Residui dichiarati**: la spunta dei beni significativi vive nella card della voce, verificata a tsc/test ma **non con Chromium** (VociTable importa le Server Action) · l'app **non qualifica l'intervento** (manutenzione? immobile abitativo?) né deduce il reverse charge: entrambe le scelte sono dell'artigiano, dichiarato nei ⓘ · il caso del **contratto unico d'appalto** misto (parte in reverse charge, parte no) non è gestito: va spezzato a mano, domanda N16 ② al commercialista.
- tsc+build+**697/697** verdi · scan spazi invariati (67 build / 0 sorgente).

### ✅ 11 ago (13) — 🧾 NOTA DI DEBITO TD05 (decisione Eli: «da implementare») + ricerca su acconti e pagamenti
- **`createNotaDebitoAction` + `NotaDebitoButton`**: la gemella OBBLIGATORIA della nota di credito (art. 26 c.1 — quella di credito è una facoltà, questa no). Sta sotto «Crea nota di credito» sulla fattura trasmessa, con 4 motivi (lavoro extra, importo/quantità sbagliati, IVA per difetto, altro). Guardie identiche alla NC (solo da fatture davvero trasmesse, fail-closed sullo stato SdI) **meno il tetto**: lì il vincolo esiste perché non si può stornare più del fatturato, qui si sta INTEGRANDO e quanto lo sa solo l'artigiano.
- ⚠️ **Nasce VUOTA di voci**, al contrario della nota di credito: quella storna ciò che c'è già (copiare ha senso), questa aggiunge ciò che nella fattura NON c'era — copiarne le voci darebbe un documento da svuotare a mano, col rischio di lasciarci righe che fanno **pagare due volte** lo stesso lavoro. Si apre direttamente in modifica (`?edit=1`).
- **Sezionale proprio `ND 001/2026`** (`allocateNotaDebitoNumber` + `formatNotaDebitoNumber`): terza sequenza, chiavata sul doc_type nella RPC esistente. **Nessuna migration**: `documents.doc_type` è TEXT senza vincolo.
- **XML**: `TipoDocumento` **TD05** + `DatiFattureCollegate` con la fattura integrata, importi **positivi** (è il tipo a dire che si integra, mai il segno) — **+3 test**. `SdiInvoice.tipoDocumento` allargato a TD05.
- ⚠️ **Si comporta come una FATTURA, non come una nota di credito**: aumenta il dovuto, si incassa («Segna pagata» ha senso), entra nelle Entrate del Bilancio, segno **PIÙ** nel registro IVA e nel CSV — con la sua etichetta per riconoscerla. È l'esatto opposto della TD04 e vale la pena tenerlo a mente in ogni punto che filtra per tipo.
- **11 filtri `doc_type` allargati** (route stato/esito/reclaim, export CSV, registro, notifiche, Home, liste, pagina fattura, da-trasmettere, doc-xml) · `docTypeLabel`/`docTypePath`/`isFemminile`/`StatusBadge` conoscono il tipo nuovo · **ricerca**: `isNotaDebitoQuery` (nd, td05, debito, integrazione) con la regola che **«nota» e «note» valgono per ENTRAMBE le famiglie** e la lista le unisce — vedere metà delle note cercando «nota» sarebbe peggio che non cercarle (**+6 test**, 656/656 totali).
- **🔎 RICERCA «la carta risolve il problema degli incassi da segnare a mano?»** (domanda di Eli). **Risposta: NO, o meglio solo per una fetta piccola**, e i dati sono netti: sui lavori edili agevolati il **bonifico parlante è OBBLIGATORIO** (con la carta il cliente perde la detrazione) · il contante è ancora al **61% delle transazioni fisiche** in Italia (Banca d'Italia/BCE SPACE 2024) e la carta è lo strumento dello scontrino da **~42 €** · un saldo da 3.000 € **sfonda il plafond** di molte carte e costerebbe **45 € di commissioni** non ribaltabili sul cliente (il sovrapprezzo è vietato). ⚠️ **Stripe Pay by Bank non è disponibile in Italia** e **Nordigen (open banking gratuito) ha chiuso ai nuovi**. L'unico dato SCIENTIFICO trovato dice altro: un **sollecito** sposta la probabilità di pagamento di **~25 punti percentuali** (JEBO). → Ordine consigliato: ① rendere la registrazione manuale quasi gratuita (un tocco dalla campanella/lista) ② promemoria contestuale all'artigiano ③ carta solo per i lavori piccoli, dichiarando la commissione PRIMA ④ open banking più avanti — e attenzione: **l'11% trattenuto sul bonifico parlante rompe l'abbinamento per importo**.
- tsc+build+**656/656** verdi · scan spazi invariati.

### ✅ 11 ago (12) — «Questo PREVENTIVO è scaduto» dentro una FATTURA: due orologi confusi in uno
Eli, foto alla mano: *«qua è sbagliato, la descrizione dice preventivo ma siamo nella fattura… ma soprattutto possiamo farlo per le fatture? se scaduta non può cambiare la data dato che va trasmessa entro tot giorni?»*.
- **[RISPOSTA, verificata sul codice] Sì, si può — sono DUE OROLOGI DIVERSI.** Su un preventivo `expires_at` è la **validità dell'offerta**; su una fattura è il **termine di PAGAMENTO**. Nessuno dei due ha a che vedere col termine dei **12 giorni per lo SdI**, che corre dalla **data del documento** (o dal primo incasso): prorogare il pagamento non sposta di un giorno l'obbligo di trasmettere. ⚠️ Verificato anche il rischio peggiore: la scadenza di pagamento **non entra nell'XML** (nessun `DatiPagamento` in `doc-xml.ts`), quindi cambiarla su una fattura già trasmessa **non fa divergere** l'app da ciò che ha ricevuto l'Agenzia.
- **[COPY] Il pop-up parlava di preventivo dentro una fattura**, in 4 punti: etichetta («Nuova scadenza» → **«Nuovo termine di pagamento»**), voci della tendina («Scade tra 15 giorni» → **«Da pagare entro 15 giorni»**), riquadro di conferma (**«Il termine di pagamento di questa fattura è passato. Vuoi dare al cliente un nuovo termine?»**, stato → «Inviata»), riga in fondo e toast. Con la riga che chiude il dubbio di Eli: *«È solo una proroga commerciale: la data della fattura non cambia, e nemmeno il termine per trasmetterla allo SdI»*.
- **[MEDIA, buco chiuso] `resendExpiredAction` accettava QUALSIASI documento**: nessun filtro su stato o tipo — una **bozza** poteva essere portata a `sent` scavalcando la conferma fiscale (data del documento a NULL), ed era il residuo dichiarato della review dell'11 ago. Ora la guardia sta sul server: **solo `expired`**, con l'update condizionato allo stato letto (due finestre non si sovrascrivono).
- **[MEDIA, bug vero] Rinviando una FATTURA la pagina restava «Scaduta»**: si revalidava solo `/preventivi` — il percorso sbagliato. Ora `docTypePath` sceglie la sezione giusta.
- **[FAQ] Nuova «Una fattura è scaduta: posso dare al cliente più tempo per pagare?»**, che spiega i due orologi ed è il posto dove la confusione va sciolta una volta per tutte.
- tsc+build+648/648 verdi · scan spazi invariati.

### ✅ 11 ago (11) — Terzo giro: un solo link per card, le scartate hanno la loro vista, il flag che non si salvava
- **[BUG] L'interruttore della trasmissione automatica NON si salvava** (Eli: «non mi salva il deflaggamento»). ⚠️ In realtà **il database salvava benissimo**: era la casella a **riaccendersi da sola** subito dopo. È il difetto già visto il 9 ago sulla tendina dell'acconto — React 19 chiama `form.reset()` dopo OGNI submit, e su un campo governato dallo stato il reset riporta il DOM al valore iniziale **senza far ri-renderizzare React**. Stesso rimedio: si ascolta l'evento `reset` del form e si rimette la spunta scelta. ⚠️ REGOLA (terza volta): ogni campo controllato dentro un form con Server Action ha bisogno di quell'ascoltatore.
- **[UI] Un solo collegamento per card in Home** (Eli): il titolo dei riquadri SdI non è più un link — resta quello in fondo, che ora c'è **sempre** («e N altre →» quando ce ne sono di più, «Vedi tutte →» quando ci stanno tutte). E il **vuoto è cliccabile**: «Nessuna fattura →» invece di una riga muta.
- **[UI] Le scartate hanno la loro vista**: `/fatture/da-trasmettere?solo=scartate`, stessa pagina con due **linguette** («Tutte N» · «Scartate N», che compaiono solo se c'è almeno uno scarto), titolo e testo di aiuto che cambiano (per le scartate: i 5 giorni per correggere e ritrasmettere con stesso numero e data). Il riquadro «Scartate» della Home punta lì invece che alla ricerca testuale.
- **[FISCALE] L'incasso di un ACCONTO fa scattare i 12 giorni, e ora l'app lo dice** (domanda di Eli: «se l'acconto fa scattare il conto alla rovescia, bisogna che l'artigiano lo sappia»). ⚠️ Il momento è l'**incasso**, non la richiesta: chiedere un acconto non fa scattare nulla, incassarlo sì (art. 6 DPR 633/1972 — l'operazione si considera effettuata al pagamento). Alla registrazione dell'acconto ora c'è l'avviso esplicito, e sulla card resta un **riquadro col termine** («entro il … · mancano N giorni», ambra ≤3, rosso oltre) finché l'acconto è incassato. **Nessuna fattura viene creata da sola**: quello è il pezzo che aspetta la conferma del commercialista (N11). FAQ nuova.
- **[CORREZIONE MIA, N12] La conservazione a norma la fa OPENAPI**, il nostro provider SdI: era uno dei criteri di scelta (ha escluso Invoicetronic, che non la offriva) — documentato in `ricerca-fatturazione-elettronica/DECISIONE_SDI.md` dal 15 lug. La ricerca di ieri l'aveva presentata come un buco nostro: **imprecisa**. Restano però tre pezzi veri, e la domanda è stata riscritta: ① il servizio **va attivato** ② manca la **designazione del conservatore** da parte dell'artigiano (il DPA non ne parla — annotato il 21 lug, serve l'avvocato) ③ cosa succede alla conservazione se l'artigiano lascia Carta Canta (il contratto dà 3 mesi per i dati, ma l'obbligo è di 10 anni).
- **[FAQ] Nuova «Ho incassato un acconto: devo fare qualcosa entro una data?»** + quella sul Bilancio del giro precedente.
- tsc+build+648/648 verdi · scan spazi invariati.

### ✅ 11 ago (10) — Secondo giro di feedback: schermata d'avvio, doppio messaggio, cliente collegato, elimina pagata
- **[UI] La schermata d'avvio era BASSA** (Eli: «vorrei fosse più centrata»): il marchio era ancorato a metà esatta e nome/motto/rotella gli cadevano tutti SOTTO — il gruppo finiva a circa il **62%** dell'altezza. Ora il **blocco intero** sta al centro (flex). **Misurato con Chromium**: scarto dal centro **0px** a 390×780, 390×844, 360×640 e 390×1200, senza sbordi.
- **[DIFETTO] «Due messaggi diversi, il secondo dopo 2 secondi»** dopo aver aggiornato una fattura già inviata: non erano due toast — era l'**overlay «Modifiche salvate»** seguito dopo 1,5s dal dialog «Fattura aggiornata — vuoi reinviarla?», che ripete *«Le modifiche sono state salvate»*. La stessa notizia data due volte, con un'attesa in mezzo. Ora su un documento già inviato l'overlay **non compare**: arriva subito il dialog, che dice già tutto e in più chiede se rimandarlo.
- **[DECISIONE Eli] Collegando un preventivo con un CLIENTE DIVERSO dalla fattura**: la fattura **tiene il suo** (intestare la fattura al condominio e il preventivo all'amministratore è legittimo, e sovrascrivere in silenzio cancellerebbe una scelta), ma la differenza si **dice**: avviso con i due nomi e il tasto **«Usa quello del preventivo»** (nuova `allineaClienteDaPreventivoAction`). Invariato il caso di prima: se la fattura non ha cliente, lo eredita.
- **[DECISIONE Eli] Una fattura con un INCASSO registrato non si elimina**: il tasto resta **spento e spiegato** («c'è un incasso registrato: è nelle Entrate del Bilancio — prima «Segna come non pagata»»). Stessa linea delle trasmesse SdI. ⚠️ Il dato arriva dalla **query tollerante** già presente per l'esito SdI (`payment_status` non è in types/database.ts: metterlo nella select principale rompeva la tipizzazione dell'intera lista).
- **[FAQ] Nuova «Cosa entra nelle Entrate e nelle Uscite del Bilancio?»** — mancava del tutto: entrate = incassi registrati (non le fatture emesse, non i preventivi accettati; note di credito fuori) · uscite = spese registrate a mano, divise fra costi dei lavori e spese generali · **cosa NON entra e perché**: il costo delle voci (è il margine, non un soldo uscito), le ore del timer, i listini · più le due righe di verità (non è un bilancio contabile; in forfettario le spese non abbassano le tasse).
- **Risposto senza toccare codice**: per **trasmettere a mano** allo SdI dopo aver modificato/inviato una fattura non serve aggiungere niente — il tasto «Invia allo SdI» vive nella card SdI del documento (compare quando lo SdI è acceso: oggi in produzione è spento); col pilota acceso parte da sola dopo 24h, e «Annulla» riporta al manuale.
- ⚠️ **Aperto, da capire con Eli**: l'errore Sentry `TypeError: Failed to fetch` su `/fatture/{id}?edit=1` (11 ago 19:30 UTC). Tutti i `fetch` di quel percorso hanno il loro `try/catch` (invio email, stato, incassi) e non risalirebbero a Sentry; il sospetto è una **richiesta di rete interrotta** (navigazione o schermo spento a metà caricamento di un chunk) — da confermare con la frequenza: se resta un caso isolato è rumore, se si ripete va cercato il chiamante vero.
- tsc+build+648/648 verdi · scan spazi invariati.

### ✅ 11 ago (9) — Feedback dal telefono (6 punti) + 🔎 RICERCA «cosa diamo per scontato» (N7-N13)
Eli, collaudando dal telefono dopo la 080.
- **[BUG, valeva per OGNI casella di spunta dell'app] Toccando il flag nuovo in Impostazioni la BARRA IN FONDO spariva.** Causa: `useHideOnKeyboard` (BottomNav) contava **qualsiasi `<input>`** come campo di testo — ma una casella di spunta non apre nessuna tastiera, quindi la barra si nascondeva e non tornava più finché non si toccava altro. Ora i tipi che non aprono la tastiera (checkbox, radio, button, file, range…) non contano. ⚠️ Il difetto c'era dal 22 luglio su ogni spunta (notifiche, template): l'ha scoperto il flag nuovo.
- **[FEATURE] Pagina dedicata «Fatture da trasmettere»** (`/fatture/da-trasmettere`, richiesta di Eli: «quando in home clicco su da trasmettere mi si deve aprire una pagina dedicata… tipo la pagina in scadenza»): stessa forma di «Fatture da incassare» — riepilogo (quante, quante scartate, quante fuori termine, totale) e una card per documento col conto alla rovescia, **ordinate per urgenza** e con le **scartate in cima** (hanno 5 giorni per essere corrette). Il titolo dei due riquadri della Home ora è un collegamento (chevron): «Da trasmettere» apre la pagina, «Scartate» apre la lista filtrata. Nuova destinazione `daTrasmettere` in `VaiA`, 2 FAQ aggiornate, /novita.
- **[UX] I suggerimenti delle voci finivano SOTTO la tastiera** (Eli: «non si vedono»). La tendina ora conosce il **`visualViewport`** — cioè lo schermo che resta VISIBILE con la tastiera aperta — e si **ribalta sopra il campo** quando sotto non c'è spazio (soglia 140px), riducendo l'altezza a quella disponibile. **Misurato con Chromium sul componente vero** a viewport 390×400 (= tastiera aperta): campo in cima → tendina sotto e tutta visibile · campo a metà → sotto, alta 181px, tutta visibile · campo in fondo → **ribaltata sopra**, tutta visibile, mai sopra il campo. ⚠️ Lo scarto di 16px del primo giro era il banco di prova senza il reset CSS (l'`<ul>` ha margine di default).
- **[UX] Via il fuoco automatico sulla prima voce** in preventivo E fattura (Eli: in nuova fattura «la pagina si sposta in alto e non si vede il tasto importa da preventivo»). Faceva scorrere la pagina appena aperta, nascondendo il cliente da scegliere e «Importa da preventivo» — cioè le prime due cose che si guardano. Ora la pagina si apre dall'inizio e la tastiera compare quando la si chiede.
- **[UI] Lo spazio vuoto in alto di TUTTE le pagine**: `cc-main-safe-top` aveva `max(env(safe-area-inset-top), 16px)` — quei **16px minimi** erano una striscia crema sopra la testata navy della Home e sopra ogni fascia bianca del titolo. Ora è solo `env(safe-area-inset-top, 0px)`: nel browser e nella TWA il padding è **0** (misurato in Chromium: 16px → 0px), e nella PWA a schermo intero resta la safe-area vera del notch.
- **🔎 RICERCA (in `COSE_DA_FARE_ELI.md`, domande N7-N13)** — Eli: «ho paura che anche per altre funzioni abbiamo dato per scontato qualcosa che nella prassi non si fa». Sette aree trovate, nessuna implementata (materia B.0): **reverse charge edilizia** N6.7 (il forfettario ne è escluso in uscita — l'ordinario no) · **IVA 10% e beni significativi** (caldaia+posa: split 10/22, con obbligo di indicare il bene separatamente) · **ritenuta 4% del condominio** · **ritenuta bancaria 11% sul bonifico parlante** (falsa i nostri incassi; le fonti si contraddicono sul forfettario) · **fattura di acconto** (⚠️ il punto più delicato: l'app mette l'acconto nel preventivo, ma incassarlo è un fatto fiscale che fa scattare i 12 giorni) · **conservazione a norma 10 anni** (serve l'adesione esplicita al servizio AdE: il rischio è che l'artigiano si creda a posto perché vede le fatture nell'app) · **nota di debito TD05** (gemella obbligatoria della nostra TD04). Più tre opportunità: **TD24 differita dai rapportini firmati**, contatore della **soglia forfettaria**, termini di pagamento D.Lgs. 231/2002.
- tsc+build+648/648 verdi · scan spazi invariati.

### ✅ 11 ago (8) — RICONTROLLO del pilota SdI (Eli: «ricontrolla quello che hai fatto») — 2 revisori, 2 ALTE + 8 MEDIE vere, tutte chiuse
Eli ha applicato la 080 e chiesto il ricontrollo. Due revisori adversariali freschi sul diff completo (server/fiscale · UI/copy), ogni finding verificato di persona prima del fix. **Un finding SMENTITO**: il link «e N altre → /fatture?q=sdi scartate» funziona (la lista HA il filtro `sdi_status` via `sdiEsitoQuery` — il revisore non l'aveva visto).
- **[ALTA] Il PDF e l'XML dicevano DUE DATE DIVERSE.** `lib/pdf/template.ts` stampava «Emesso: {created_at}» mentre l'XML ora usa `doc_date` (la data di conferma): bozza creata il 3, confermata l'11 → il cliente leggeva «03/08», l'Agenzia riceveva «11/08». Ora PDF e riga «Fattura del …» della pagina usano `doc_date ?? created_at` (stessa fonte dell'XML; preventivi e bozze restano su created_at). ⚠️ Solo la FONTE della data: nessun cambio di layout (regola F rispettata).
- **[ALTA] Il toast «Da oggi hai 12 giorni» partiva anche sul REINVIO** (`confirmMarkResent` di ShareButton): su una fattura modificata e ricondivisa prometteva un termine che NON riparte e un pilota che NON si riprogramma — l'opposto del countdown due riquadri sotto. Tolto (l'handoff (7) diceva «mai sul reinvio»: era l'intento, il codice lo violava).
- **[ALTA] «Non devi fare niente» promesso a chi ha la quota Free ESAURITA**: il pilota si programmava senza guardare la quota → il cron avrebbe rifiutato in silenzio, e la card mostrava il riquadro azzurro SOPRA il paywall. Ora: ① `registraConfermaFiscale` controlla `getSdiQuota` PRIMA di programmare ② l'avviso alla conferma dice 'manuale' se la quota è bloccata (pagina fattura E lista) ③ la card nasconde il riquadro del pilota con la quota bloccata (`pilotaVisibile`).
- **[ALTA] Il fallimento del pilota era SILENZIOSO per ~9 giorni** (campanella solo a ≤3 giorni dal termine): esattamente la lamentela n.1 che il giro doveva evitare. Ora il cron, quando molla una fattura, **manda un'EMAIL all'artigiano** («la trasmissione automatica non è riuscita — trasmettila tu», nuovo template `sdi_auto_fallita.tsx` + `lib/sdi/auto-fallita-email.ts`, best-effort). La FAQ ora lo dice ed è vera.
- **[MEDIA] Il riquadro del pilota SPARIVA (col tasto Annulla dentro) proprio nella finestra fra l'orario programmato e il giro orario del cron** (fino a 59 min): `autoProgrammata` chiedeva la data nel futuro. Ora vale finché `sdi_auto_at` è valorizzato (il cron lo azzera comunque, successo o fallimento), l'ora mostrata è quella VERA («verso le 15:00» — l'ora piena del giro del cron, non le 14:37 spaccate) e a orario passato dice «a minuti». Stessa correzione in Home.
- **[MEDIA] Tre riquadri contraddittori sulla card**: «ricordati di trasmetterla» + «non devi fare niente» + countdown, impilati. Il promemoria giallo ora tace quando il pilota è visibile.
- **[MEDIA] Ripristino dal CESTINO → trasmissione immediata senza preavviso**: `restoreDocumentAction` non azzerava `sdi_auto_at` (ormai scaduto) → al primo giro il cron partiva subito. Ora il ripristino ferma il pilota (`fermaPilotaSdi`), e il cron rimanda al manuale (con email) qualsiasi programmazione **stantia >48h** (cron fermo, flag spento e riacceso: mai trasmettere in blocco un arretrato che nessuno si aspetta più).
- **[MEDIA] SCARTATA + «Segna non pagata» → la data fiscale spariva**: `azzeraConfermaFiscale` azzerava doc_date anche con un esito SdI presente — ma una scartata si ritrasmette con STESSA data e stesso numero. Ora con `sdi_status` valorizzato si azzera solo `sdi_auto_at`; e `registraConfermaFiscale` non programma il pilota su documenti con un esito (il cron li esclude comunque: sarebbe stata una promessa scritta solo a DB).
- **[MEDIA] «Segna pagata» su una bozza confermava SENZA avviso** (la FAQ lo prometteva «nel momento stesso»): `SegnaPagataButton` ora riceve `avvisoSdi`+`wasDraft` e dà l'avviso al saldo pieno da bozza (mai sull'acconto parziale, che non conferma). Anche l'**invio email dalla LISTA fatture** ora porta l'avviso (`DocumentRowActions` → SendEmailDialog, con quota e interruttore calcolati una volta per pagina).
- **[MEDIE/BASSE]**: fallback pre-080 dell'avviso allineato a 'manuale' (pagina diceva 'auto' dove la action non programmava niente) · copy del toast «card SdI del documento» (sulla NC la card non si chiama «Fattura elettronica») · le 3 FAQ SdI ora compaiono **solo col flag acceso** (citano UI che senza flag non esiste — pattern AI_ATTIVA) · il codice errore decide **solo se in TESTA** al messaggio (`00200` in mezzo al testo può essere il CAP di Roma → +2 test, **648/648**) · query Home con `.order(created_at)` (prima le 50 righe erano un campione arbitrario) · ramo «trasmessa senza provider_id» di trasmetti.ts ora azzera anch'esso sdi_auto_at · `force-dynamic` sul cron · helper di conferma SPOSTATI in `lib/documents/conferma-fiscale.ts` (erano export di un file 'use server' = server action esposte col client Supabase come argomento) · «Annulla fattura» ferma il pilota (fermaPilotaSdi — la data resta: annullata ≠ bozza).
- **types/database.ts allineato alla 080** (doc_date, sdi_auto_at, sdi_auto_enabled nei blocchi Row/Insert/Update) + le solite 2 fixture dei test.
- ⚠️ **Residui dichiarati**: il backfill 080 è in Europe/Rome mentre i (soli sandbox) trasmessi pre-080 usavano la data UTC — in produzione non esiste alcun trasmesso, irrilevante · «Segna pagata» da DESKTOP (StatusChangeDropdown) conferma senza avviso — mobile-first, giro suo se serve · un 502 transitorio del provider manda comunque al manuale (deliberato: mai retry, ora con email) · `resendExpiredAction` non chiama la conferma (non raggiungibile da UI fatture) · doc_date scritto da trasmetti prima del claim resta sul giorno del tentativo fallito (innocuo: stessa data del retry).
- tsc+build+**648/648** verdi · scan spazi invariati (67 build / 0 sorgente).

### ✅ 11 ago (7) — 🚁 PILOTA AUTOMATICO SdI + data fiscale alla CONFERMA (⚠️ migration 080 DA APPLICARE → APPLICATA da Eli l'11 ago) + Home SdI + i 10 scarti spiegati
Decisioni di Eli dopo la ricerca sui competitor (lamentela n.1: i **fallimenti silenziosi** — la fattura sembra partita e non lo è; n.2: gli scarti incomprensibili): *«automatico deve essere default e sia chiaro all'artigiano»* · *«la data di creazione documento parte da quando la bozza viene confermata»* · *«in home compaiono sia sdi da mandare che quelli rifiutati affianco»* · *«rafforziamo aiuto artigiano per rifiuti sui 10 errori più comuni»*.
- **⚠️ migration 080** (`080_data_conferma_e_pilota_sdi.sql`, VALIDATA su PG16: 22:30 UTC → giorno dopo a Roma, bozze a NULL, idempotente, valore scritto intatto al rilancio): `documents.doc_date DATE` (la **data FISCALE**, nasce alla conferma; backfill dei non-bozza con `created_at` in Europe/Rome) · `workspaces.sdi_auto_enabled BOOLEAN DEFAULT true` · `documents.sdi_auto_at TIMESTAMPTZ` (quando parte l'invio automatico) + indice parziale. **Applicabile prima o dopo il deploy**: tutto il codice è tollerante pre-080 (letture/scritture separate `.then(ok,ko)`, cascata sulla query Home).
- **La CONFERMA della bozza è il momento fiscale**: nuova `registraConfermaFiscale()` in documents.ts — al primo passaggio fuori bozza (primo «Invia al cliente», invio email, «Segna pagata» da bozza) scrive `doc_date = oggi` (guardia `.is('doc_date', null)`: solo la PRIMA conferma) e, per le fatture con SdI acceso e `sdi_auto_enabled ≠ false`, **programma `sdi_auto_at = +24h`**. Cablata nei 4 percorsi (sendDocumentAction, registerManualSendAction, send-email isFirstSend, status route draft→accepted). Il **ritorno in bozza azzera tutto** (`azzeraConfermaFiscale`: doc_date e sdi_auto_at a null). ⚠️ La trasmissione si auto-risana: se `doc_date` è null al momento dell'invio, scrive oggi.
- **`lib/sdi/trasmetti.ts`** (NUOVO, 544 righe): la trasmissione ESTRATTA dalla route in una funzione condivisa `trasmettiDocumentoSdi()` — trasformazione MECCANICA (`NextResponse.json(X,{status:Y})` → `{status,body}`), **tutte le guardie fiscali intatte** (claim atomico, marker tentativo, rollback verificato, quota, tetto NC in basi, coerenza 00421). La route `/api/fatture/[id]/sdi` è ora un involucro sottile. In più: l'XML usa `doc_date` come Data del documento (fallback legacy created_at, anche in `DatiFattureCollegate`), e il successo azzera `sdi_auto_at`.
- **Cron `/api/cron/sdi-auto`** (NUOVO, ogni ora in vercel.json, Bearer CRON_SECRET fail-closed): trasmette le fatture con `sdi_auto_at` scaduto (mai le NC — quelle partono SOLO a mano), max 25 a giro, ricontrolla l'interruttore del workspace prima di ogni invio. ⚠️ **Su QUALSIASI fallimento: `sdi_auto_at = null` e si torna al manuale** (countdown + campanella come rete) — MAI retry-loop su un documento fiscale, mai fallimenti silenziosi.
- **L'artigiano lo vede e lo comanda**: al momento della conferma, toast «Da oggi hai 12 giorni…» con la variante automatica («fra 24 ore parte da sola») o manuale (prop `avvisoSdi` su ShareButton/SendEmailDialog, 4 punti di montaggio, mai sul reinvio) · sulla card SdI riquadro **«Trasmissione automatica attiva: parte da sola il … alle … Non devi fare niente»** col tasto **Annulla** (`annullaTrasmissioneAutomaticaAction`) · interruttore in **Impostazioni › Fiscale** («Trasmissione automatica allo SdI», default acceso, con la sentinella `sdi_auto_presente` — la trappola dell'onboarding/ATECO evitata).
- **HOME: due riquadri SdI AFFIANCATI** (`SdiHomeCard`, mobile fra «In scadenza» e «Questo mese» + desktop): **«Da trasmettere»** (countdown per documento, i più urgenti in cima, «parte da sola» sugli automatici programmati) e **«Scartate»** (bordo rosso, «da correggere»). Solo con SDI_ENABLED; quando c'è compare SEMPRE («Tutto trasmesso» / «Nessuno scarto» — il vuoto è un'informazione, regola dell'8 ago). Query a cascata tollerante pre-080.
- **`lib/sdi/errori-comuni.ts`** (NUOVO, PURO, **+15 test → 646/646**): i 10 scarti più comuni tradotti in parole semplici (titolo · cos'è successo · cosa fare) — codice destinatario, P.IVA/CF cliente, dati dell'ARTIGIANO (00301 ha lo stesso testo del 00305: li distingue solo il codice), duplicata, cliente senza identificativo, IVA/prezzi che non quadrano, numero senza cifre, formato file. ⚠️ **Decide il CODICE quando c'è** (viene dalla risposta vera dello SdI, tabella dall'elenco controlli UFFICIALE AdE — i blog si contraddicono sui numeri); le parole fanno da ripiego; sconosciuto → null, MAI una spiegazione inventata. Cablato in SdiCard sotto il riquadro rosso dello scarto.
- **FAQ**: aggiornata «Quando è davvero emessa» (data alla conferma + pilota) + 2 NUOVE («La fattura parte da sola? Come funziona la trasmissione automatica?» · «La fattura è stata scartata: cosa faccio?») · 3 punti in /novita · collaudi **T10-T13** · decisione registrata in DECISIONI_E_FEEDBACK (bloccata: automatico default ON, 24h, niente retry, NC mai automatiche).
- ⚠️ **Residui dichiarati**: le NC non hanno pilota automatico (DELIBERATO: documento delicato e raro) · pre-080 le notifiche del termine usano created_at (degradazione onesta; SdI è comunque spento in produzione) · niente verifica Chromium su SdiCard/Home (harness costoso, coperti da T10-T13).
- tsc+build+**646/646** verdi · scan spazi puliti (build 67, i 2 nuovi sono testo dopo icona in contenitori a gap, verificato che nessuno segue un elemento inline).

### ✅ 11 ago (6) — ⏱️ IL CONTO ALLA ROVESCIA DEI 12 GIORNI (Eli: «voglio che abbia sotto controllo la situazione e sia guidato»)
Richiesta in tre parti: ricerca su cosa significa «emessa» · timer visibile · spiegazione nel ⓘ.
- **[RICERCA, fonti in chat] «Emessa» ha UNA definizione** (art. 21 c.1 DPR 633/1972): la fattura elettronica si ha per emessa **solo quando è trasmessa allo SdI**. Una BOZZA non è emessa; il PDF/link mandato al cliente è **copia di cortesia** (per i privati vale ai fini fiscali solo se coincide con l'elettronica trasmessa; fra P.IVA non vale niente). I **12 giorni** (art. 21 c.4) corrono dalla **data di effettuazione**: per i servizi è l'INCASSO, oppure la data della fattura se viene prima (principio di anticipazione, art. 6 c.4). Oltre il termine: la fattura vale, ma è emissione tardiva sanzionabile (sanzione fissa per i forfettari, riducibile col ravvedimento).
- **`lib/sdi/termini.ts`** (NUOVO, PURO, **+10 test, 631/631**): `riferimentoTrasmissione` (la più vecchia fra data documento e primo incasso — mai un countdown inventato: senza date valide → null) · `termineTrasmissione` (scadenza = rif+12, giorniRimasti, fuoriTermine) · `scadenzaLabel`. ⚠️ Conteggio per giorni di calendario nel fuso **Europe/Rome**: una fattura creata alle 23:50 ha già consumato il primo giorno dieci minuti dopo (test apposta sul cavallo di mezzanotte UTC).
- **Card SdI**: su ogni fattura/nota NON trasmessa, riquadro col **conto alla rovescia** — «Da trasmettere entro il {data} · mancano N giorni» (neutro >3gg · ambra ≤3 · «entro OGGI» · rosso «termine superato da N giorni» con l'invito al ravvedimento) — e accanto il **ⓘ dedicato** che spiega bozza/copia di cortesia/emessa e i 12 giorni. Nel **dialog di trasmissione**, se fuori termine, avviso ambra SEMPRE visibile (regola dei ⓘ: gli avvisi fiscali non si nascondono) — avviso, NON blocco: trasmettere tardi è meglio che mai.
- **Campanella**: il tipo `sdi_da_trasmettere` ora suona anche per il termine — query allargata alle non trasmesse fuori bozza (prima solo le pagate) e alle note di credito; notifica `sdi_termine:{id}` quando mancano ≤3 giorni o il termine è passato. Stesso interruttore «Promemoria di trasmissione» nelle Impostazioni.
- FAQ NUOVA «Quando una fattura è davvero emessa? Cosa sono i 12 giorni?» + punto in /novita + collaudo **T9** + D13-D14 marcata implementata in COSE_DA_FARE_ELI (al commercialista resta la conferma).
- ⚠️ Non verificato con Chromium (SdiCard importa router/toast/Dialog — harness costoso); markup identico ai riquadri esistenti della card, coperto dal collaudo T9.
- tsc+build+**631/631** verdi · scan spazi puliti.

### ✅ 11 ago (5) — ⚖️ BOLLO AL POSTO GIUSTO: via dai preventivi, automatico sulla nota di credito
Risposte di Eli al report fiscale: «punto 1 ok» (bollo NC) · «punto 3: se non è prassi, non facciamolo» (bollo sui preventivi — la ricerca dice che NON è prassi: i gestionali non lo espongono sull'offerta) · punto 2 (12 giorni) da rispiegare, NON implementato.
- **Il motore conosce il tipo di documento**: `FiscalOptions.doc_type` — bollo forfettario sopra 77,47 € SOLO su fattura e nota di credito, MAI sul preventivo (art. 13 tariffa DPR 642/1972: il preventivo non è un documento fiscale). Default assente = fattura (compatibilità). **+6 test (621/621)**, sentinella delle proposte riscritta (prima sanciva «bollo su OGNI proposta», ora «mai sulle proposte» — dentro `totaliPerProposta` il tipo è FORZATO a preventivo, nessun chiamante può sbagliare).
- **Cablato in TUTTI i chiamanti**: 5 builder in documents.ts (create=preventivo · update/saveDraft=tipo vero · createInvoice=fattura · createNotaCredito=nota) · status route ×2 · accept pubblico · converti-fattura · pagina pubblica per-tier · PreventivoForm/FatturaForm · template per-tier. Via i due rami «bollo NC forzato a 0» (era l'attesa di N4).
- ⚠️ **CONVERSIONE: ricalcolo SEMPRE, non solo col tier.** La funzione SQL copia i totali del preventivo — che ora sono SENZA bollo: senza il ricalcolo la fattura forfettaria sopra soglia nasceva con 2 € in meno. Il ricalcolo (doc_type fattura) risana anche i totali storici in stile 00421.
- ⚠️ **TETTO DELLO STORNO IN BASI**: la nota ora porta il SUO bollo → `sommaNoteAttive` sottrae il bollo di ogni nota, la trasmissione confronta base-nota vs base-fattura, la pagina idem. Senza, una nota piena da 102 (100+2) sembrava sfondare il tetto di una fattura da 102 (base 100). Fattura 102 stornata da nota 102 → residuo ZERO esatto (+3 test).
- **XML**: già pronto — la route passa `doc.bollo_amount` e `buildXml` emette `DatiBollo` sopra zero; per la NC ora arriva 2 € vero. **Duplica** di un preventivo storico: bollo tolto (la copia non deve nascere col totale vecchio).
- **Copy**: nota sotto «Perché la storni?» riscritta (bollo automatico, non più «resta a zero in attesa del commercialista») · FAQ NC + FAQ NUOVA «Perché la fattura ha 2 € in più del preventivo?» · punto in /novita · N4/N2 marcate implementate in COSE_DA_FARE_ELI (al commercialista resta la conferma) · decisione in DECISIONI_E_FEEDBACK.
- ⚠️ **Residuo dichiarato**: i preventivi GIÀ SALVATI conservano il bollo nel totale finché non vengono risalvati/accettati (liste e Home leggono il totale memorizzato; PDF e riepiloghi lo ricalcolano) — pre-lancio, solo documenti di prova. Il punto 2 (avviso 12 giorni) resta in attesa della risposta di Eli.
- tsc+build+**621/621** verdi · scan spazi puliti.

### ✅ 11 ago (4) — Decisione B sui blocchi di prova · il form della NC parla da nota · RICERCA FISCALE (N4, N2, D13-D14)
Tre risposte di Eli: «B» sui blocchi PROVA/COLLAUDO · «possiamo mettere nota invece di fattura?» sul form · «procedi con punto 5 facendo la prima parte di ricerca fonti ufficiali».
- **[DECISIONE B, registrata]** Le fatture trasmesse in prova/collaudo restano bloccate come le vere: i collaudi si fanno su fatture usa-e-getta in un account di prova (in `DECISIONI_E_FEEDBACK.md` + avvertenza in `TEST_DA_FARE_ELI.md §A-bis`). L'opzione A (ambiente ricordato) resta sul tavolo se al lancio il problema si ripresentasse.
- **[RESIDUO CHIUSO] Il `PreventivoForm` conosce la nota di credito.** Il tipo passa da `'preventivo'|'fattura'` a tre valori; dentro, DUE flag: `isPreventivo` (i rami solo-preventivo: acconto, proposte, foto AI, avviso listini — prima erano `!== 'fattura'`, cioè PER ESCLUSIONE: passare il tipo vero senza questo giro avrebbe REGALATO alla nota le funzioni del preventivo) e `isNota` (solo parole: «Aggiorna nota di credito», «Voci nota di credito», «salvare la nota di credito», aria-label, banner di sola lettura, popup di salvataggio). Allargati anche **FiscalSummary** («Totale della nota», MAI «da pagare»: è denaro che torna) e **ResendReminderDialog**. Il callsite in `fatture/[id]` passa il tipo VERO → sparisce anche il popup col numero «Fatt. NC 001/2026» (bug latente di formatDocNumber col tipo a mano). ⚠️ Ricascato nella trappola del commento JSX (stavolta in posizione ATTRIBUTO): `{/* */}` fra le prop non è valido — il commento `//` fra gli attributi sì.
- **[RICERCA FISCALE — prima parte del punto 5, esiti in `COSE_DA_FARE_ELI.md`]** Il piano di Eli: implementare la prassi trovata sulle fonti, al commercialista resta la CONFERMA. Esiti: **N4** il bollo sulla NC forfettaria sopra 77,47 € **è dovuto** (art. 13 tariffa DPR 642/1972: «fatture, note… recanti addebitamenti o accreditamenti»; la guida AdE esclude dal calcolo automatico solo TD16-TD19 → una TD04 sopra soglia finisce nell'**Elenco A** e i 2 € arrivano comunque: il nostro «bollo 0» creerebbe uno scarto con l'Agenzia) · confermato che il bollo della fattura originaria NON si recupera (già così: `baseStornabile`) · **D13-D14** (circ. 14/E 2019): campo Data = data di effettuazione, trasmissione entro **12 giorni** da quella data · **N2**: il preventivo non è documento fiscale ex art. 13 → nessun bollo dovuto sul preventivo; i 2 € mostrati sono anteprima legittima della futura fattura.
- ⏭️ **Implementazioni decise per il prossimo giro (fiscali → dopo l'ok di Eli sul report)**: ① bollo 2 € automatico sulla NC forfettaria sopra 77,47 € (oggi forzato a 0 — va tolto il ramo in updateDocumentAction/saveDraftAction e nella create, più XML e FAQ); ② avviso alla trasmissione SdI se la data del documento è più vecchia di 12 giorni.
- tsc+build+615/615 verdi · scan spazi puliti.

### ✅ 11 ago (3) — DEPLOY FALLITO: la build scaricava i font da Google + residui tecnici del punto 4
Eli: *"il deploy di prima ha dato errore"* (+ ok ai punti 3 e 4 del menu).
- **[CAUSA DEL DEPLOY] `app/layout.tsx` scaricava Inter, Geist e Geist Mono da Google Fonts A OGNI BUILD** (`next/font/google`): un timeout su quel download fa fallire il deploy — successo oggi su Vercel e **riprodotto anche in locale** nello stesso pomeriggio (build rossa al primo giro, verde al secondo, stesso codice). I log Vercel non sono leggibili da qui (il progetto non è nel team collegato all'MCP), ma la diagnosi combacia. **FIX: build ERMETICA** — Inter da `next/font/local` sul file **già self-hosted** per il PDF (`public/fonts/inter-latin-400-800.woff2`, subset latin = italiano coperto) · Geist Mono dal pacchetto npm **`geist`** (font impacchettati, stessa variabile `--font-geist-mono`) · **Geist Sans TOLTO**: la sua variabile non era usata in nessun file. Verificato: `next/font/google` sparito, i due woff2 stanno in `.next/static/media` precaricati, vulnerabilità di produzione invariate (3 alte note). ⚠️ REGOLA: **niente rete nella build** — un deploy non deve poter fallire per un timeout verso un servizio di terzi.
- **[PUNTO 3, richiesto] `TEST_DA_FARE_ELI.md` sezione nuova A-bis**: collaudi T1-T8 delle funzioni del 9-11 ago (multi-nota col residuo e il tetto · NC che parla da nota ovunque · matita assente · suggerimenti voce · punti ⓘ · passo finale del tutorial). Con l'avvertenza che i test NC richiedono una fattura trasmessa (sandbox).
- **[PUNTO 4, richiesto] Tre residui tecnici chiusi**: ① campanella — i messaggi del cliente **senza risposta** portano «· da rispondere» nel titolo (l'helper `unansweredClientMessages` era pronto dal 5 ago; il confronto è con l'ultimo `owner_message` nel log); ② i **conteggi dei tab** dei preventivi passano da `fetchAllRows` (oltre 1.000 documenti la select veniva troncata in silenzio e i numeri dicevano meno del vero — follow-up del 4 ago); ③ via il `limit(50)` sulle aperture in `preventivi/[id]` (oltre le 50 la cronologia numerava «1ª» quella che era la 51ª; il gemello fatture era già senza limite).
- ⏭️ **Resta UN residuo tecnico**: l'append del `document_log` non è atomico (RPC + migration, giro suo). E le risposte di Eli al menu: punto 1 (blocchi PROVA/COLLAUDO) da rispiegare — non aveva capito la domanda; punto 2 (PreventivoForm su NC) chiarito, si fa su suo ok; punto 5 rimandato a dopo, con ricerca su fonti ufficiali prima di implementare.
- tsc+build+615/615 verdi · scan spazi puliti.

### ✅ 11 ago (2) — FAQ RILETTE E CORRETTE + LE NOTE ENTRANO NEL PUNTO ⓘ + il tutorial lo spiega
Tre richieste di Eli: rileggere FAQ e note («alcune sono scritte male»), spostare le note esplicative dentro il tasto tondo ⓘ («tranne le informazioni davvero importanti o che potrebbero creare problemi fiscali o legali»), e spiegare i tasti ⓘ nel tutorial.
- **FAQ: rilette tutte e 37, corrette 7**. La peggiore: **due FAQ sui dati erano quasi la stessa domanda con risposte diverse** («I miei dati dove sono?» / «I miei dati restano miei?») → unite. Poi: frase-rompicapo della NC spezzata (tre incisi annidati) · «Ordina: Scadenza vicina» raccontava **com'era prima** («Prima guardava solo la data…» — storia da /novita, non da FAQ) → riscritta al presente · «è come funziona oggi» (invecchia male) → «è l'impostazione di partenza» · «c'è di quanto costa in più» sgrammaticata · doppio «:» nella FAQ messaggi · «segui il cantiere per stati» → «passo passo».
- **CENSIMENTO COMPLETO con 2 agent paralleli** (~200 note in tutta l'app), poi **11 conversioni in `SpiegaCampo`**: Impostazioni › Fiscale (costo orario) · Impostazioni › Pagamenti ×3 (intro sezione, QR IBAN, note cliente) · CatalogItemForm (costo, col 🔒 rimasto nell'etichetta) · NuovoListinoForm (ricarico/scadenza) · Bilancio ×2 (righe lavori, confronto anno) · Vetrina (servizi) · RichiamoCard · ChiediRecensioneButton.
- ⚠️ **Criterio applicato (da mantenere)**: nel ⓘ vanno le note **secondarie** (la funzione è già chiara dall'etichetta). Restano SEMPRE visibili: ① le fiscali/legali (regola di Eli: bollo, IVA, SdI, NC, 10 anni, GDPR, «non sostituisce il commercialista», note legali referral) ② le note che **prevengono un errore** (intestatario IBAN, «controlla prima di salvare» AI, «qui i numeri sono i COSTI», email/telefono obbligatori) ③ le **condizionali** legate a uno stato (già contestuali) ④ i testi dei **dialog** (già a comparsa) ⑤ empty state e sottotitoli di riga/pagina (struttura, non note).
- **Tutorial**: il passo finale del tour principale ora **disegna il tondino ⓘ** (come i badge demo) e dice «toccalo: spiega a cosa serve la funzione che gli sta accanto» — DENTRO il 5° passo, mai un 6° (regola: oltre 5 l'abbandono raddoppia). Stessa riga nella guida di «Altro» (passo Impostazioni e dati). FAQ nuova «Cosa sono i tondini con la i?» + punto in /novita.
- **Verificato con Chromium** SpiegaCampo nei 2 contesti nuovi (etichetta di sezione · etichetta di campo): 7 controlli — apre/chiude al tocco, zero sbordi a 390px anche aperta e in «Testo grande».
- ⚠️ **Scoperte dei censimenti, annotate**: `impostazioni/tabs/team.tsx` è codice vivo ma NON raggiungibile (non è in NAV_ITEMS) · `ReviewTutorialCard` vive solo in /aiuto (il commento in /account è storia) · 3 note già dietro ⓘ prima di questo giro (card SdI, ScadenzeHomeCard, ViewHistorySection).
- tsc+build+615/615 verdi · scan spazi puliti.

### ✅ 11 ago — SUGGERIMENTI MENTRE SCRIVI LA VOCE (richiesta Eli: "come le grandi app fatte bene")
Eli: *"quando inserisco una nuova voce e questa esiste già nel catalogo o nei listini, vorrei che mi comparisse come suggerimento… alla prima lettera i primi dieci, poi sempre più mirati. Non voglio una spatafiata di voci."*
- **`lib/documents/suggerimenti-voce.ts`** (NUOVO, PURO, **+11 test, 615/615**): `normalizzaTesto` (minuscole + accenti NFD + spazi) · `suggerisciVoci(query, fonti, max=10)` con tre livelli di pertinenza — inizia-con > **ogni parola della query è prefisso di una parola del testo** («caldaia cond» → «Caldaia a condensazione») > contiene tutte le parole. A parità vince la descrizione più corta. Dedupe su descrizione+prezzo: la stessa voce in catalogo E listino compare una volta, **dal catalogo** (le fonti si passano catalogo-prima, il sort JS è stabile). Si cerca anche su **nome catalogo e codice articolo** (`alias`).
- **`VoceSuggerimenti.tsx`** (NUOVO): `useFontiVoci()` carica UNA volta al primo focus (catalogo + listini; filtro per-lettera in memoria, istantaneo — schema FIX-18 del ClientAutocomplete) · `SuggerimentiVociDropdown` in **portal su body con `cc-portal-float`** (regola B.2), ancorata al riquadro della descrizione, stessa larghezza. ⚠️ **Listini solo Pro**, come la linguetta del CatalogPicker: a un Free non si offrono nemmeno di sponda. Listino senza ricarico → «prezzo da fare», mai inventato.
- **Cablata in `VociTable`** (desktop + mobile, quindi preventivi E fatture): il tocco riempie descrizione/unità/prezzo/IVA/`unit_cost`/`supplier_list_id` (stessi campi del CatalogPicker); **quantità 0 → 1**, una quantità scritta a mano non si tocca. Tastiera: frecce+Invio (Invio ruba l'a-capo SOLO con una voce evidenziata), Esc chiude. ⚠️ Tre accorgimenti da autocomplete vero: ① dopo una scelta la tendina NON ricompare con la stessa voce (`suggChiusaPer`, si riapre al testo nuovo); ② l'unico risultato **identico** al testo già scritto non si mostra; ③ i tocchi sulla tendina usano `onMouseDown`+preventDefault — il campo non perde mai il fuoco, il blur non uccide il click (schema ClientAutocomplete). L'altezza auto-grow della textarea si sistema a mano dopo la scelta (l'onChange lì non scatta).
- **Verificato con Chromium a 390px sui componenti VERI** (esbuild, stub del solo client Supabase): 11 controlli — campo vuoto muto · tetto 10 · «cald» mirato · due parole restringono · zero sbordi · tendina sotto il campo a pari larghezza · tocco compila tutto e chiude · niente ri-comparsa · prezzo 0 da listino · testo nuovo riapre · blur chiude.
- FAQ nuova in /aiuto («Mentre scrivo una voce compaiono dei suggerimenti: cosa sono?») + punto in /novita «Metà agosto 2026».
- tsc+build+**615/615** verdi · scan spazi puliti (build 65 tecniche, sorgente 0).

### ✅ 10 ago (11) — «SdI» ovunque + la nota parla da nota + niente matita sulle trasmesse
Tre cose: la domanda di Eli sulla grafia, e i due residui annotati nei giri precedenti.
- **[DOMANDA ELI] «SDI o SdI?» → SdI**, la grafia ufficiale (Sistema di Interscambio: la «d» è la preposizione). La domanda ha scoperto che **l'app era incoerente**: liste e FAQ dicevano «SdI», ma card SdI, errori di trasmissione, notifiche e email dicevano «SDI». Uniformato in **18 file** (perl con guardia `\bSDI\b(?!_)`: gli identificatori tecnici `SDI_*` restano intatti).
- **[RESIDUO ①, CHIUSO] La pagina della nota passava `docType="fattura"` a tutti i comandi**: ora **8 componenti** conoscono la nota di credito — ShareButton (pop-up «Invia al cliente», testo di condivisione «la nota di credito n. …», toast «Nota di credito segnata come Inviata»), SendEmailDialog+Controller, PdfActions, ArchivioBanner, RestoreVersionButton, DocumentTimeline (genere femminile con `femm`, MAI per esclusione: senza, passare il tipo vero avrebbe fatto REGREDIRE la nota alle parole del preventivo), DocumentRowActions. ⚠️ In `registerManualSendAction` l'hint del tipo sceglie la SEQUENZA del numero: aggiunto il ramo `nota_credito` → `allocateNotaCreditoNumber` (il fallback avrebbe dato a una nota un numero di FATTURA). **Resta UN solo residuo dichiarato**: il `PreventivoForm` in modifica riceve ancora `docType="fattura"` (i suoi rami sono decine — giro suo se serve).
- **[RESIDUO ②, CHIUSO] La matita Modifica spariva solo al salvataggio**: su una fattura TRASMESSA il server rifiuta di salvare, ma la matita c'era e il form si apriva — il divieto si scopriva a lavoro fatto. Ora: niente matita sulle trasmesse, `?edit=1` a mano non apre il form, e su desktop al posto del form c'è la spiegazione (nota di credito). FAQ della modifica aggiornata con la riga sulla matita assente.
- tsc+build+604/604 verdi · scan puliti.

### ✅ 10 ago (10) — RICONTROLLO del multi-nota (Eli: "ricontrolla che sia corretto e tutto legale") — 2 difetti miei trovati e chiusi
Legalità verificata sulle fonti: **più note parziali sulla stessa fattura sono ammesse** (art. 26; ogni nota con `DatiFattureCollegate`, numero e data propri, «per la differenza dell'importo oggetto di modifica»). Ma rileggendo il MIO codice da avversario:
- **[FISCALE, CHIUSO] Il tetto usava il totale COL BOLLO.** Su una fattura forfettaria da 100 € + 2 € di bollo, la prima nota «piena» (100 €, bollo forzato a 0) lasciava un **residuo fantasma di 2 €**: il tasto restava acceso a fattura già stornata per intero, e una seconda nota avrebbe stornato **102 di operazioni contro 100 fatturate**. Il bollo NON è un'operazione stornabile: è un'imposta (la sua sorte è la domanda N4). Nuova **`baseStornabile(totale, bollo)`** usata in tutti e 4 i punti (creazione, fattore di riduzione, trasmissione, pagina) — dimostrato con `node` prima del fix, **+3 test (604/604)**.
- **[COPY, CHIUSO] L'avviso ambra «la trasmissione verrà bloccata» sarebbe comparso anche su una NC GIÀ TRASMESSA** (caso legacy oltre-residuo): tempo futuro su una cosa già avvenuta → aggiunto `!sdiTransmitted`.
- **Verificati puliti al ricontrollo**: insert delle voci con campi espliciti (lo spread non trapela nel DB) · 23505 pre-079 → si atterra sulla nota esistente · cestinate e annullate fuori dal tetto (le annullate trasmesse non esistono: la trasmissione le blocca) · progressivo SdI distinto per nota · segno meno e € nei template literal (gli escape `\u` non funzionano nel testo JSX, lì sarebbero letterali) · FAQ e /novita dicono esattamente ciò che il codice fa.
- tsc+build+**604/604** verdi · scan spazi puliti.

### ✅ 10 ago (9) — MULTI-NOTA DI CREDITO col TETTO (decisione Eli: "procedi con la proposta e i tre punti come dici tu") — ⚠️ migration 079
Più note parziali sulla stessa fattura, con l'invariante nuovo: **«Σ note attive ≤ totale fattura»** — che prima non esisteva nemmeno per la nota singola (si poteva stornare più del fatturato alzando gli importi a mano).
- **`lib/documents/storno.ts`** (NUOVO, PURO, **+13 test, 601/601**): `sommaNoteAttive` (annullate escluse) · `residuoStornabile` · `superaIlTetto` (tolleranza ±1 cent, la stessa dello SdI) · `scalaPrezzo` (riduzione in proporzione, arrotondata **per difetto**: la nota nuova nasce DENTRO il tetto — con l'epsilon assoluto in scala centesimi, perché `33.3×100` in float fa 3329,999…).
- **Creazione** (`createNotaCreditoAction`): via il «una sola nota» (redirect all'esistente); ora carica le note attive, calcola il residuo, e **a residuo zero rifiuta** con la spiegazione; le note successive alla prima nascono con le **voci ridotte in proporzione al residuo**. ⚠️ La gestione 23505 resta: PRIMA della 079 l'indice unico della 078 fa da rete e il comportamento è quello vecchio (deploy-prima-della-migration coperto).
- **Trasmissione** (`sdi/route.ts`): il tetto **BLOCCANTE e fail-closed** — questa nota + le sorelle GIÀ TRASMESSE ≤ totale fattura (le bozze non contano: verranno ricontrollate alla loro trasmissione); se sorelle o totale non si leggono, non si trasmette. Messaggio con le cifre e il residuo.
- **Pagina fattura** (mobile+desktop): riquadro «Note di credito di questa fattura» (numero · −importo · Annullata) + riga **«Residuo stornabile»**; a residuo zero il tasto «Crea nota di credito» è **spento e spiegato** (annulla quella sbagliata e il residuo si riapre). **Pagina nota**: avviso ambra se gli importi superano il residuo — in bozza si lavora liberi, il blocco vero è alla trasmissione.
- **FAQ** della nota di credito e voce **/novita** aggiornate (più note parziali, residuo, tetto). Decisioni registrate in `DECISIONI_E_FEEDBACK.md`.
- **079 VALIDATA su PG16**: drop dell'indice idempotente, seconda nota sulla stessa fattura accettata dopo il drop.
- tsc+build+**601/601** verdi · scan spazi puliti.

### ✅ 10 ago (8) — Il REGIME DEI MINIMI è stato TOLTO (decisione Eli) + ricognizione per il multi-nota
Eli: *"assolutamente d'accordo a togliere il regime dei minimi se fatto male… Possiamo strutturare bene il processo per permettere più note?"*.
- **MINIMI TOLTO**: l'opzione non si offre più (onboarding: via; Impostazioni: la voce resta visibile **solo** a chi la avesse già selezionata, così la tendina non mostra il vuoto); via anche «e minimi» dalla pagina di presentazione. ⚠️ Lo Zod server **continua ad accettare** `minimi` (un workspace legacy deve poter salvare il resto delle impostazioni); `REGIME_MAP` e i tipi restano — rami morti innocui, l'enum del DB non si tocca. N6 aggiornata: era una domanda, ora registra la decisione (al commercialista si dice come informazione).
- **RICOGNIZIONE «una sola nota» per il multi-nota** (consegnata in chat, decisioni attese da Eli): oggi il vincolo vive in 3 punti — indice 078, maybeSingle+redirect nella create, 23505→redirect. Registri/CSV/Bilancio/XML/numerazione sono GIÀ pronti per N note (una riga/file per nota). ⚠️ **Scoperta della ricognizione: NON esiste un tetto allo storno nemmeno oggi** — la nota nasce a importo pieno e il form permette di ALZARE gli importi; la trasmissione verifica solo che l'origine sia trasmessa, mai le cifre. L'invariante vera da costruire col multi-nota è «Σ note attive ≤ totale fattura», che oggi manca anche per la singola.
- ⏭️ Proposta multi-nota mandata in chat (migration 079 DROP dell'indice + tetto server + residuo in UI); si implementa quando Eli decide i 3 punti aperti (dove blocca il tetto · come nasce la seconda nota · tasto a residuo zero).
- tsc+build+588/588 verdi · scan puliti (la voce nuova «minimi» nello scan è il valore tecnico dell'enum).

### ✅ 10 ago (7) — AUDIT NC+IVA sulle FONTI UFFICIALI (richiesta Eli: "scoviamo se ci sono errori nel processo") — 1 errore vero + 1 finding da decisione
Eli: *"controlla con fonti ufficiali se la gestione nota di credito e IVA che stiamo facendo è corretta"*. Il processo è stato scomposto in AFFERMAZIONI VERIFICABILI, ognuna contro il tracciato/XSD o i controlli SdI. Esito: l'impianto regge (termini art. 26, TD04 positivi, DatiFattureCollegate, 00421 per aliquota, sconto→base imponibile, arrotondamento mezzo-in-su, String20Type, N2.2+riferimento normativo, bollo XML, causale, progressivo) — ma due cose NON reggevano:
- **[ERRORE VERO, CHIUSO] `Quantita` e `PrezzoUnitario` nell'XML erano `toFixed(2)`**, ma il tracciato ammette **2-8 decimali** (`[0-9]{1,12}\.[0-9]{2,8}`) e lo SdI ricontrolla `PrezzoTotale = PrezzoUnitario × Quantita` con tolleranza 1-2 centesimi (**controllo 00423**). Una quantità scritta a mano come **«0,125 ore × 80 €»** veniva dichiarata `0.13` → il ricalcolo dava 10,40 contro 10,00 → **SCARTO**. Il righello arrotonda a 2 decimali, ma a mano (virgola) si scrivono 3+ decimali. Nuova `dec28()`: decimali VERI fra 2 e 8, il `toFixed(8)` iniziale assorbe il rumore binario dei float. **+2 test (588/588)**. Il collaudo sandbox non lo vedeva: quantità intere.
- **[FINDING, DECISIONE A ELI+COMMERCIALISTA — N6] Il «Regime dei Minimi» è offerto nelle Impostazioni ma gestito da ordinario**: addebita IVA 22% (i minimi NON addebitano IVA, art. 27 DL 98/2011), niente bollo sopra 77,47 €, niente dicitura. Tre errori per chi lo selezionasse. Regime chiuso ai nuovi dal 2016 → probabile che l'opzione vada TOLTA, ma è una decisione di prodotto: **scritta come N6**, codice NON toccato (B.0).
- **Trasparenza annotata nel report**: «una sola NC per fattura» è una restrizione di PRODOTTO (la legge ammette più note parziali) — deliberata e documentata; la Data del documento = `created_at` e la regola dei 12 giorni restano materia D13-D14 già aperta.
- tsc+build+588/588 verdi · scan spazi puliti · ✅ **078 APPLICATA da Eli il 10 ago**.

### ✅ 10 ago (6) — CONTROLLO GENERALE DI BUG (2 revisori paralleli sul diff 8→10 ago): 3 ALTE + 7 MEDIE, tutte chiuse (078, poi applicata)
Richiesta Eli: *"procediamo con un controllo generale di bug"*. Due revisori adversariali freschi (logica server/fiscale · UI/stati/copy), ogni finding verificato di persona prima del fix.
- **[ALTA, entrambi i revisori] «Annulla la nota di credito» non poteva funzionare MAI**: la route degli stati caricava il documento con `.eq('doc_type','fattura')` → su una NC rispondeva **404 «Fattura non trovata»**. L'unico comando di stato offerto sulla nota falliva sempre. Ora la route accetta anche `nota_credito`, con la guardia nuova: **«pagata» e gli incassi restano VIETATI sulla NC** (nel Bilancio entrerebbe col segno opposto) — +2 test.
- **[ALTA] La riga «IVA x%» del PDF era calcolata sull'imponibile PIENO**: `vatGroups` sommava `total × rate` per voce senza lo sconto di documento — con sconto 10% su 100 € il cliente leggeva «IVA 22,00» accanto a un totale che ne addebitava 19,80, e le righe non sommavano. Nasce **`riepilogoIva()`** in `lib/fiscal/calcoli.ts`: la FONTE UNICA delle righe IVA, usata dal motore per il `taxAmount` E dal PDF (riepilogo documento + mini-riepiloghi per proposta) — divergenza impossibile per costruzione, +3 test.
- **[MEDIA] Il bollo della NC (deliberatamente ZERO, domanda N4) veniva riscritto a 2 € dal PRIMO salvataggio** — auto-save compreso: bastava APRIRE la nota. Ora `updateDocumentAction` e `saveDraftAction` tengono bollo 0 e totale senza bollo sulle note.
- **[MEDIA] Una NC trasmessa non poteva né controllare l'esito né essere sbloccata**: le route `sdi/esito` e `sdi/reclaim` filtravano `doc_type='fattura'` → 404; la nota restava «inviata» per sempre se il webhook mancava. Allargate.
- **[MEDIA] `createNotaCreditoAction` senza guardie server**: la decisione «NC solo su fatture trasmesse» viveva solo nella UI e nella trasmissione → ora l'action rifiuta origini non trasmesse (**fail-closed**) e fatture annullate. E l'unicità «una nota per fattura» era solo un maybeSingle: **⚠️ migration 078** (indice unico parziale su `origin_document_id` per NC attive, validato su PG16: doppio submit bloccato, cestinata+nuova ok, ripristino con attiva respinto) + gestione 23505 → redirect alla nota esistente.
- **[MEDIA] Mina 00421 sui documenti STORICI**: una fattura multi-riga salvata col vecchio motore per-voce conserva il `tax_amount` divergente — trasmessa oggi, scartata. Ora `doc-xml` **verifica la coerenza** (±1 cent) e rifiuta con l'istruzione «apri e risalva» invece di produrre un XML che lo SdI respingerebbe.
- **[MEDIE UI, tutte chiuse]**: il paragrafo «trasmessa allo SdI» compariva anche sulla NC chiamandola fattura e suggerendo di stornarla con un'altra NC (→ `!isNotaCredito`); su DESKTOP un preventivo multi-proposta non si poteva segnare accettato (il gestore del 422 con la scelta esisteva solo su mobile → dialog «Quale proposta ha accettato?» anche in `StatusChangeDropdown`); con più proposte il riquadro **acconto/saldo** restava calcolato sulla Base senza dirlo (il «terzo prezzo» rientrato → gated su `!tierPicker`, con il doppio filetto); il cestino desktop mostrava l'enum grezzo «**Nota_credito**» con l'icona del preventivo (→ `docTypeLabel` + icona per tipo); dialog/toast dell'annullamento dicevano «fattura» su una nota (→ `StatusChangeDropdown` conosce `nota_credito`); il menu ⋯ di una NC trasmessa consigliava «si storna con una nota di credito»; i due riquadri ambra contraddittori su firmata+trasmessa (resta solo quello vero).
- **[BASSE chiuse]**: `DOC_NUMBER_RE` accettava « 001/2026» con lo spazio orfano e sezionali oltre i 20 caratteri dello String20Type (→ `(?:[A-Za-z]{1,8} ?)?`); `stripPrefissoLegacy` lasciava lo spazio di «Prev 001/2026»; l'eliminazione di una NC reindirizzava a `/preventivi` (tipo per esclusione → `docTypePath`); la pagina «Grazie» renderizzava «Preventivo accettato» anche su una fattura (URL costruito a mano → filtro `doc_type`); `TierPicker` confrontava le voci con un **Set invece che un multiset** (due righe identiche nella stessa proposta si spegnevano entrambe anche se l'altra ne aveva una sola → conteggio per occorrenza); tre `{' '}` mancanti in righe nuove; «Fattura creata il» sulla NC; StatusBadge e menu ⋯ delle liste col tipo vero.
- **Accettati e annotati** (non fixati, con motivo): la matita Modifica resta offerta su una fattura trasmessa (il server rifiuta al salvataggio — pre-esistente, giro suo); `badgeLabel` con genere misto sulla stessa pillola (ereditato, questione di copy di prodotto); unaccept su documento senza voci `base` lascia i totali della proposta scelta (caso senza percorso UI); la NC di una fattura legacy può stornare 1-2 cent di IVA in più del dichiarato (stessa radice della mina 00421, si sistema risalvando la fattura).
- tsc+build+**586/586** verdi · scan spazi puliti · migration 078 validata su PG16.

### ✅ 10 ago (5) — REVISIONE A COPPIE, CHIUSA: le 14 funzioni rimanenti in un giro solo
Eli: *"fai controllo di tutti i punti rimanenti"*. Controllate le funzioni 3-7, 9-15, 17, 21 contro FAQ, /novita, guide e comportamento vero. **10 pulite, 4 correzioni**:
- **[/novita DICEVA IL FALSO] Le guide di sezione**: la voce diceva *"le rivedi da Altro › Account e sicurezza"*, ma il 7 ago «Rivedi il tutorial» (con le guide) è stato spostato in **Aiuto › scheda Tutorial**. Chi seguiva l'indicazione non trovava niente → corretta.
- **[FAQ] L'acconto di default** citava le voci vecchie della tendina («**Una** percentuale» / «**Una** cifra fissa») — Eli le aveva fatte accorciare il 9 ago → allineata parola per parola.
- **[FAQ] Il richiamo cliente** non diceva del tasto «Prepara il preventivo per la manutenzione» (4 ago): la campanella suona ma la FAQ si fermava lì → aggiunta la frase (+ parole chiave).
- **[FAQ NUOVA] «Come chiedo una recensione a un cliente?»**: la funzione del 7 ago (card sulla fattura saldata, messaggio pronto, solo con vetrina pubblicata) era SOLO in /novita — che è un annuncio, non un posto dove si torna a cercare.
- **Verificati puliti**: listini PDF (~50 pagine = MAX_CHUNKS 10 vero; avviso «fino a un minuto» presente) · richieste (pillola «Preferisce», «Apri il preventivo» 076, cellulare nella nota) · conversazione sul link (FAQ combacia) · foto ingrandibili (copy «Tocca per ingrandirla») · «perso il telefono» (esci da tutti i dispositivi + avvisi email, testo esatto) · sicurezza · cerca in Altro (passo del tour presente) · preavviso scadenze (ⓘ nelle Impostazioni) · pillole/VaiA rinominati coerenti · archivio/posticipa (già verificate in coppia 1).
- ⚠️ **Scelta detta**: nessuna FAQ sui recapiti SdI del cliente (codice destinatario/PEC) — deliberato, lo SdI in produzione è spento; si scrive quando si accende.
- tsc+build+580/580 verdi · scan spazi puliti.

### ✅ 10 ago (4) — «Voglio che quella parte sia perfetta»: NC e IVA rilette sulle FONTI — 2 errori sostanziali trovati
Eli: *"ricontrolla bene il ciclo di vita della nota di credito e cosa dicono le fonti ufficiali. Voglio che quella parte sia perfetta. Stessa cosa per l'IVA"*. Aveva ragione a insistere: **entrambe le parti avevano un errore vero**, e tutti e due erano nel punto «verificato a memoria» invece che sulle fonti.
- **[FISCALE, GRAVE] I TERMINI dell'art. 26 erano scritti AL CONTRARIO.** L'interfaccia del motivo diceva *«Errore nella fattura → nessun termine»*: è l'opposto — la rettifica di importi indicati in misura **superiore al reale** (art. 21 c.7) va fatta **ENTRO UN ANNO** (art. 26 c.3; **AdE risposte 663/2021 e 762/2021**). Il «senza limite» (c.2) è per il contratto che viene meno (nullità, annullamento, risoluzione, rescissione), gli sconti **già previsti dal contratto**, il mancato pagamento con procedure infruttuose. Un artigiano che si fidava del nostro testo poteva **perdere il diritto alla detrazione** aspettando. Corretti: i 3 hint dei motivi in `NotaCreditoButton`, il commento del file, `PROGETTO_NOTE_CREDITO.md` §3 (stesso errore), e la FAQ ora dice «entro un anno, non rimandare». **Nuova domanda N5** al commercialista per conferma del riassunto.
- **[FISCALE, GRAVE] L'IVA si calcolava PER VOCE: fatture multi-riga a rischio SCARTO 00421.** Lo SdI ricalcola l'imposta del riepilogo come `ImponibileImporto × Aliquota` (arrotondata al centesimo, tolleranza **±1 centesimo** — controllo **00421**; lo 00422, citato nei commenti, è sull'imponibile con tolleranza ±1 euro). La somma delle IVA arrotondate riga per riga — che era il nostro calcolo, e perfino un test lo sanciva — è la **causa nota** di quello scarto: **dimostrato con 5 voci da 10,11 € al 22% → per voce 11,10, ricalcolo SdI 11,12, differenza 0,02 → fattura RESPINTA**. Ora `calcolaDocumento` somma le basi (scontate) **per aliquota** e moltiplica **una volta per aliquota**: lo scarto è impossibile per costruzione e il PDF coincide con l'XML. **+3 test** (il caso dello scarto, due aliquote che quadrano col riepilogo, la sentinella riscritta), **580/580**. ⚠️ Impatto: sui documenti multi-riga in ordinario il totale può muoversi di **1-2 centesimi** (nella direzione che lo SdI considera giusta). Il collaudo sandbox di luglio non lo vedeva: fatture con poche voci, deriva sotto il centesimo.
- **CICLO DI VITA NC riverificato passo per passo, PULITO**: creazione (solo da fatture emesse, mai bozze; una nota per fattura; voci copiate positive; bollo 0 per N4) → bozza (numero «NC 001/2026» che sopravvive al salvataggio automatico) → invio (pagina cliente senza Accetta/IBAN, PDF «NOTA DI CREDITO» con «Totale della nota») → trasmissione (TD04, `DatiFattureCollegate` con la **stessa fonte data** della fattura, rifiuto della nota orfana, progressivo distinto) → dopo (bloccata ovunque, menu nascosti) → registri (segno meno, annullate escluse) → Bilancio (fuori dalla cassa).
- **[PICCOLO] Il riferimento «Storno della fattura …» usava il numero grezzo**: su una fattura storica avrebbe scritto «Fatt014/2026» dentro il documento e nell'XML → `stripPrefissoLegacy`.
- ⚠️ **REGOLA confermata due volte in un giro**: le affermazioni fiscali si verificano sulle FONTI al momento di scriverle, non si ereditano dagli appunti. Entrambi gli errori erano «noti» da giorni e nessun test poteva scoprirli: erano sbagliate le premesse, non il codice rispetto alle premesse.
- tsc+build+580/580 verdi · scan spazi puliti.

### ✅ 10 ago (3) — REVISIONE A COPPIE delle funzioni della settimana (richiesta Eli) — poi CHIUSA nel giro (5)
Eli: *"crea una lista di tutte le funzioni aggiunte nell'ultima settimana e poi le ricontrolliamo due a due… non voglio che abbiamo dimenticato di aggiornare le cose collegate, tipo le FAQ"*. Lista di **22 funzioni** (3→10 ago) mandata in chat. **Ordine cambiato su sua conferma**: prima i più delicati — 20+19 (✅ fatta), poi 18+16, poi il resto. ✅ Giro COMPLETATO il 10 ago (tutte e 22 le funzioni). ✅ **Voce /novita «Metà agosto 2026» SCRITTA** a giro chiuso (note di credito, proposte, conferma di accettazione, acconto default, ordina per urgenza, ricerca).
- **Coppia 20+19 — Note di credito · IVA sull'imponibile scontato + ordina per urgenza** (i due più delicati): le 3 FAQ sull'eliminazione e quella sulla NC sono **coerenti col comportamento vero** (tasto Elimina spento, «Crea nota di credito» al posto di «Annulla», scartata eliminabile, numerazione col buco); FAQ «Ordina: Scadenza vicina» **combacia con `GRUPPO`** (scadute→attesa→bozze→chiuse→annullate) e le due liste usano lo stesso `ordinaPerUrgenza`+`fetchAllRows`; test IVA-su-scontato presenti (%, fisso, due aliquote, residuo sull'ultima voce) e le proposte passano dallo stesso motore.
- **[BUCO CHIUSO] Il menu di stato DESKTOP offriva «Annulla fattura» / «Annulla la nota di credito» anche sui documenti TRASMESSI allo SdI**: il server rifiuta (409), ma il divieto si scopriva DOPO la conferma — la regola dell'8 ago («se non si dovrebbe fare, non lo permettiamo») era applicata solo su mobile. Ora `FATTURA_TRANSITIONS_TRASMESSA` (senza `rejected`/`draft`) e sulla NC trasmessa il menu sparisce del tutto; «Segna come pagata» resta — una fattura trasmessa si incassa eccome.
- **Coppia 18+16 — Guardie fiscali SdI + PROVA/COLLAUDO · Proposte Base/Premium**: verificati Elimina spento in lista (`sdiTransmitted` nel menu ⋯) · eventi SdI derivati in cronologia · pillole PROVA/COLLAUDO col toast allineato · rifiuto della TD04 orfana · conversione che sfoltisce le voci della proposta non scelta · `unaccepted` col tier nel log e cronologia che legge la VOCE, non lo stato · FAQ delle due proposte **giusta parola per parola** (perfino «Segna accettato», che è l'etichetta esatta del chip mobile).
- **Coppia 8+22 — Bilancio · email di conferma + pagina «Grazie»**: verificati NC esclusa dalle **3 query di cassa** (pagina ×2 + CSV) · FAQ dell'incasso sbagliato e della vista per lavoro **giuste parola per parola** (reset nel mese d'origine, riga «Non collegato», anno a parità di periodo, ore fuori dai conti) · la pagina pubblica mostra davvero «Preventivo accettato il …» come promette la FAQ della conferma · `replyTo` all'artigiano e esito email letto e loggato.
- **[PICCOLO, CHIUSO] L'email di conferma al cliente usava il `doc_number` GREZZO**: su un documento storico la ricevuta avrebbe mostrato «Prev001/2026» — il marcatore interno nel numero che il cliente conserva. Ora `stripPrefissoLegacy` su subject, titolo e riga del riepilogo (era esattamente uno dei «17 punti» del 9 ago, nato dopo quella bonifica).
- **[COLLEGATO NON-FAQ, CHIUSO] La riga per l'AVVOCATO mancava**: l'email di conferma è materia B.0 (email automatiche ai clienti finali) e in `COSE_DA_FARE_ELI.md §2` non c'era → aggiunta con il perché è difendibile (ricevuta di un gesto appena compiuto, una sola volta, niente inviti) e le 2 domande da fargli (base giuridica art. 6.1.b · quale informativa citare nel piè di pagina).
- **[BUCO CHIUSO] Il CESTINO offriva «Elimina per sempre» su una fattura trasmessa, con un avviso che diceva il falso** (*«parlane col commercialista prima di procedere»* — procedere non si può: il server rifiuta dall'8 ago, il tasto falliva DOPO la conferma). Stessa classe del menu desktop. Ora il dialog dice **«Questa fattura non si può eliminare»**, spiega la nota di credito e i dieci anni, suggerisce il recupero dal cestino, e il tasto rosso **non c'è** — spento e spiegato. ⚠️ Caso raggiungibile solo da fatture cestinate PRIMA delle guardie dell'8 ago (oggi una trasmessa non si cestina proprio), ma il copy falso era lì per chiunque l'avesse.
- **Coppia 1 — Ricerca nelle liste** (diciture di stato · sdi+esito · fattura collegata · archiviati · nota di credito · varianti NC): FAQ su SdI, scaduti, archivio e NC **già giuste**. **Due buchi chiusi**: la ricerca **«modificati»** e la ricerca **per fattura collegata** dai Preventivi («bozza fattura», «fatture pagate») non erano scritte da nessuna parte → aggiunte alla FAQ «Come trovo i preventivi scaduti?» (+ parole chiave per il cerca delle FAQ).
- **Coppia 2 — Cronologia completa + «Salva e invia» in modifica**: «Salva e invia» era già nella FAQ della bozza. **Buco chiuso**: nessuna FAQ diceva DOVE si vede se/quando il cliente ha aperto il documento (le aperture stanno in cronologia dal 3 ago, con data e ora) → nuova FAQ **«Come vedo se il cliente ha aperto il preventivo?»**, che dice anche che la cronologia sopravvive al ritorno in bozza.
- ⚠️ Nota per le prossime coppie: **/novita è ferma all'8 agosto** — niente su note di credito, proposte C, acconto default, ordina per urgenza, email di conferma. Da valutare con Eli se accodare una voce «metà agosto» quando il giro di revisione è finito.
- tsc+build+578/578 verdi · scan spazi puliti.

### ✅ 10 ago (2) — Il sezionale si scrive STACCATO: «NC 001/2026» (Eli) — e la regex che l'avrebbe rifiutato
Eli: *"preferito che NC abbia uno spazio di separazione dal numero, ovunque. Lo possiamo fare? è consentito?"*. **Sì**, e la verifica è stata fatta sulle fonti, non a memoria.
- **È CONSENTITO, con la prova**: nel tracciato FatturaPA il campo `Numero` è **String20Type** — `xs:normalizedString` con pattern `(\p{IsBasicLatin}{1,20})`, e lo spazio (U+0020) sta **dentro** il blocco Basic Latin. L'unico vincolo di contenuto è il controllo **00425** («il numero deve contenere almeno un carattere numerico»): le cifre ci sono sempre. Le guide dei provider portano perfino esempi validi **con lo spazio** (`AF01 12/26`). Sul piano fiscale il formato è libero (art. 21 DPR 633/1972: basta che identifichi il documento in modo univoco).
- ⚠️ **IL PEZZO CHE L'AVREBBE FATTO FALLIRE IN SILENZIO**: `DOC_NUMBER_RE = /^[A-Za-z]*\d{1,6}\/\d{4}$/` **non ammette lo spazio**, ed era scritta a mano in **due copie** (il form e la Server Action). La nota sarebbe nata con «NC 001/2026» e poi il form l'avrebbe rifiutata come *«formato non valido»* al primo salvataggio — anche a quello automatico. Trovato cercando, non provando.
- **`lib/documents/numero.ts`** (NUOVO, PURO, **+14 test**): `DOC_NUMBER_RE` (una copia sola, ora con lo spazio facoltativo) · `formatNotaCreditoNumber` · `docNumberSlug` · `numeroVarianti`. C'è un test che verifica che **ciò che il server genera sia accettato dalla validazione del form**: è esattamente il ponte che mancava.
- **VALIDATO SU PG16 REALE** — è il rischio vero, perché `doc_seq` e `doc_year` sono **colonne generate** che leggono il numero: con «NC 001/2026» danno `doc_seq = 1` e `doc_year = 2026` (lo spazio lo mangia già il `regexp_replace('[^0-9]')` della 027), l'ordinamento della lista resta corretto e la ricerca `ilike` trova entrambe le grafie. Nessuna migration necessaria.
- **`progressivoInvio` non cambia**: «NC 001/2026» e «NC001/2026» danno lo stesso valore (toglie i non alfanumerici) — quindi il nome del file trasmesso allo SdI resta univoco e distinto da quello della fattura pari numero.
- ⚠️ **Le due grafie CONVIVONO** (le note create prima di oggi restano «NC001/2026»), quindi la ricerca cerca **entrambe**: `numeroVarianti` aggiunge la variante staccata/attaccata agli `ilike` delle due liste. Senza, cercare «NC001» avrebbe risposto «nessun risultato» su una nota che esiste — la regola dell'8 agosto sull'archivio, applicata al numero.
- **Nomi dei file**: `docNumberSlug` toglie ora anche lo spazio (PDF e XML) — «NC-001-2026.pdf», non «NC 001-2026.pdf», che si spezza fra client di posta e sistemi operativi.
- **FAQ**: aggiornata quella sulla nota di credito, che scriveva ancora «NC001/2026». ⚠️ Con `&nbsp;`: «NC» e il numero non devono finire su due righe diverse.
- tsc+build+578/578 verdi · scan spazi puliti · colonne generate validate su PG16.

### ✅ 10 ago — [DIFETTO] In Home la NOTA DI CREDITO si spacciava per una fattura («Fatt. NC001/2026»)
Eli: *"in home attività recenti, la NC ha Fatt davanti al nome, corretto?"*. **No, e non era solo il nome.**
- **CAUSA**: nel feed dell'attività recente il numero si costruiva con **`formatDocNumber(doc.doc_number, 'fattura')` scritto a mano** — il tipo passato a mano invece di quello del documento. Quella query **non filtra il `doc_type`** (prende tutto ciò che è stato toccato di recente), quindi la nota di credito prendeva il marcatore delle fatture: **«Fatt. NC001/2026»**, cioè marcata come fattura proprio nel numero che serve a tenere le due sequenze **distinte**. La versione desktop lo faceva già giusto: sbagliava solo mobile, che è dove l'app si usa.
- ⚠️ **Tirando il filo, sotto c'erano le stesse due funzioni sbagliate**: `getEventLabel` e `getMobileBadgeLabel` decidevano il tipo con `docType === 'fattura'` → la nota finiva nel ramo «tutto il resto» e prendeva **le parole del preventivo**: una nota annullata si leggeva **«Rifiutato»**, una inviata **«Preventivo inviato»**. È la regola del 9 agosto — *mai dedurre un tipo per esclusione* — violata in un file che non era stato toccato in quel giro.
- **`lib/documents/etichette.ts`** (NUOVO, PURO, **+10 test**): `isFemminile` · `eventoLabel` · `badgeLabel`. Le due funzioni **escono dalla pagina della Home** e vengono da qui, con i test sotto: erano scritte lì dentro, e una regola scritta dentro una pagina non ha modo di essere verificata. ⚠️ **«Pagata» resta solo sulla fattura**: su una nota il denaro **torna** al cliente, e infatti «Segna pagata» lì non esiste (9 ago) — c'è un test apposta.
- **`StatusBadge` non conosceva la nota di credito**: il tipo della prop era letteralmente `'preventivo' | 'fattura'`, e senza il suo ramo la nota prendeva le etichette del preventivo. Aggiunto, e il feed desktop ora **gli passa il tipo** — prima non glielo passava affatto, quindi anche una FATTURA lì mostrava «Accettato» accanto alla riga che diceva «Fattura pagata». Due parole diverse per lo stesso fatto, sulla stessa riga.
- **[MEDIA] Nella scheda CLIENTE la nota di credito portava a una pagina «non trovato»**: `href = isFattura ? '/fatture/…' : '/preventivi/…'` — sempre per esclusione. Quella query non filtra il tipo, quindi la nota c'era, si chiamava «Preventivo» e il tocco portava a un **404**. Ora rotta e nome vengono da `docTypePath`/`docTypeLabel`.
- ⚠️ **Residuo detto, non nascosto**: la pagina della nota di credito passa `docType="fattura"` a tutti i suoi comandi (condividi, email, elimina, PDF), quindi in quei pop-up si legge ancora la parola **«fattura»** su una nota. Non è pericoloso — le etichette di stato al femminile sono le stesse — ma è impreciso; toccarlo vuol dire allargare la prop a sei componenti e va fatto in un giro suo.
- **FAQ**: rilette, **nessuna toccata**. Quella sulla nota di credito diceva già *«ha una numerazione tutta sua (NC001/2026)»* — era l'app a non mantenere la promessa, non il testo a essere vecchio.
- tsc+build+563/563 verdi · scan spazi puliti.

### ✅ 9 ago (15) — Dopo l'accettazione il cliente non era più padrone di niente (+ email di conferma)
Tre richieste di Eli.
- **[UI, Impostazioni] Valore dell'acconto AFFIANCATO alla tendina** (*"percentuale non è affianco alla scelta ma è ancora sotto"*), con `flexWrap`: quando non ci stanno — schermo stretto o «Testo grande» — il valore scende su una riga propria **invece di far troncare la tendina**. ⚠️ Misurato: affiancati e basta, a 320px e in «Testo grande» la tendina si tagliava; con la base a **185px** non si tronca in nessuna delle 6 combinazioni.
- **[UI, pagina cliente] La pagina «Grazie» era un vicolo cieco.** Diceva solo «grazie»: chi la riapriva non ritrovava **né il numero, né la cifra, né QUANDO** aveva accettato, e l'unico modo per tornare al documento era il tasto Indietro del telefono. Ora c'è il **riepilogo** (numero · proposta scelta · totale · **accettato il … alle …** · firmato da) e il tasto **«Rivedi il preventivo»**. ⚠️ La proposta scelta si legge con una **query a sé e tollerante**: `accepted_tier` non è nei tipi generati, e metterla nella select principale avrebbe fatto fallire l'intera pagina invece di far mancare una riga.
- **[EMAIL] Conferma al CLIENTE** (nuovo `preventivo_accettato_cliente.tsx`): stesso riepilogo, più il collegamento per rileggere il preventivo. ⚠️ **`replyTo` all'artigiano**: il testo dice «può rispondere a questa email» e senza quel campo la risposta sarebbe arrivata a noi. Best-effort come quella all'artigiano — se l'email non parte il preventivo resta accettato — ma l'esito si **legge e si logga**: `sendEmail` non lancia mai, e senza controllarlo un mancato recapito sparirebbe nel silenzio (lezione del 5 agosto).
- ⚠️ **Nota su B.0**: le email automatiche verso i clienti finali sono fra le cose bloccate. Questa è il caso più difendibile che esista — è la **ricevuta di un gesto che il cliente ha appena compiuto**, non una comunicazione commerciale: nessun invito, nessuna offerta, parte una volta sola perché un preventivo si accetta una volta sola. Dà del **Lei**, come le altre email dirette al cliente finale.
- **FAQ**: aggiunta *«Il cliente riceve una conferma quando accetta?»*, con il caso in cui il cliente **non ha l'email in rubrica** (l'avviso non parte, la conferma resta solo sullo schermo).
- Misurato con Chromium: riepilogo e tasto dentro il riquadro su 5 combinazioni di larghezza e zoom.
- tsc+build+553/553 verdi · scan spazi puliti.

### ✅ 9 ago (14) — La NOTA DI CREDITO si riconosce nella lista: dicitura, riferimento, ricerca
Tre richieste di Eli sulla lista Fatture.
- **[UI] «Nota di credito» da pillola a DICITURA**, a sinistra sulla stessa riga dell'esito SdI e con la stessa forma (11px, semigrassetto, iconcina, niente sfondo). ⚠️ Non è solo gusto: una pillola in più sulla riga dei badge ruba spazio al **nome del cliente** — è il difetto misurato l'8 agosto, e la riga 3 esiste apposta per i rimandi a un altro documento.
- **[UI] «…· storna Fatt. 014/2026»** accanto alla dicitura (Eli: *"non la vedo come documento diviso dalla fattura da cui viene creata"*). Il numero da solo dice **che** è una nota; questa riga dice **cosa** storna, ed è il pezzo che la rende un documento a sé invece di una copia della fattura. Query a parte e tollerante, come le due gemelle SdI e archivio.
- **[RICERCA] «nota di credito» si cerca intera o a pezzi** (`isNotaCreditoQuery`, **+5 test**): «nota», «note», «credito», «cred», «not», «nc», «storno», «td04». ⚠️ Le parole si controllano **una per una** e devono TUTTE appartenere al vocabolario della nota: senza, «nota caldaia» filtrerebbe le note di credito invece di cercare «caldaia» — la ricerca ruberebbe una parola d'uso comune. «nc» si confronta **per intero** perché è di due lettere.
- ⚠️ **Sul numero**: `formatDocNumber` mostra già «NC001/2026», e la nota nasce così da `allocateNotaCreditoNumber`. Se sulla nota di Eli l'«NC» non si vede è perché è **quella creata prima del fix di stamattina**, quando il form glielo cancellava a ogni salvataggio: va riscritto a mano una volta nel campo Numero.
- **Misurato con Chromium** su 6 combinazioni (390/360/320px × normale e «Testo grande»), col caso peggiore «nota + esito SdI + due badge + cliente lungo»: a 320px in «Testo grande» la dicitura **sbordava** perché era `nowrap` → ora va a capo (`flex:1 1 auto` + `minWidth:0`). Riverificato: tutto dentro.
- ⚠️ **Ricaduta nella trappola già annotata**: commento JSX dentro `{cond && (…)}` → errore di parse. È scritto in CLAUDE.md dal 3 agosto e l'ho rifatto lo stesso.
- **FAQ** aggiornata: dove si legge la dicitura e come si cercano le note.
- tsc+build+553/553 verdi · scan spazi puliti.

### ✅ 9 ago (13) — PROPOSTA C sulla pagina del cliente + [DIFETTO] la tendina dell'acconto tornava indietro
- **[C, scelta di Eli] Le proposte dicono COSA cambia, non solo quanto.** ⚠️ Il difetto non era estetico: le due card elencavano le stesse voci con lo stesso aspetto, e l'unica differenza vera (manodopera 1h/2h) era una riga come tutte le altre — il cliente vedeva due prezzi senza capire cosa cambia, e a quel punto sceglie il più basso. Ora in `TierPicker`: le voci **uguali in tutte le proposte** vanno in grigio, quelle **diverse** restano in evidenza su fondo crema, e la proposta più cara porta la pillola **«+ € 45,00»** — il numero che il cliente sta davvero decidendo se pagare. Via le spunte verdi da ogni riga: erano rumore su righe che sono semplicemente importi.
- ⚠️ **Il confronto guarda descrizione + IMPORTO**, non la sola descrizione: «Manodopera 45» e «Manodopera 90» hanno lo stesso nome ma sono proprio la differenza da mostrare — confrontando i soli nomi le avrei spente entrambe.
- ⚠️ **Se le proposte non hanno NIENTE in comune** le card restano come prima: spegnere non aiuterebbe, sarebbe tutto in evidenza (cioè niente in evidenza).
- **Via il terzo prezzo**: con più proposte il riepilogo in cima non mostra più Subtotale/bollo/«Totale proposta Base». Era un prezzo mostrato **prima che una scelta esistesse**, e i conti di ciascuna proposta stanno già dentro la sua card. Al suo posto una riga che dice che le proposte sono più d'una.
- **Verificato** sul componente vero (esbuild+Chromium) a 390/360/320px × normale e «Testo grande»: nessuno sbordo in 5 combinazioni, e il testo reso è quello atteso.
- **[DIFETTO] La tendina dell'acconto tornava da sola su «Nessun acconto» dopo il salvataggio.** Eli: *"quando salvo percentuale poi torna da solo… invece deve memorizzare e mantenere la scelta"*. **CAUSA: React 19 chiama `form.reset()` dopo OGNI submit** — è annotato nello stesso file per il campo del logo. Su un campo governato dallo stato il reset riporta il DOM al valore iniziale **senza cambiare nessuno stato**: non c'è un nuovo render che lo rimetta a posto, e la tendina mostrava «Nessun acconto» pur avendo **salvato bene**. Il componente ora **ascolta l'evento `reset` del proprio form** e rimette i valori scelti.
- **[UI] Voci più corte** («Percentuale» · «Cifra fissa», senza «Una») e **unità alla DESTRA del campo**, fuori dal riquadro; tolto dal ⓘ il paragrafo che Eli non voleva.
- **FAQ**: aggiunta *«Come vede il cliente le due proposte?»*.
- tsc+build+548/548 verdi · scan spazi puliti.

### ✅ 9 ago (12) — [DIFETTO] La freccia del Margine usciva dal riquadro + mockup delle proposte al cliente
- **[UI] La freccia a tendina del «Margine» sbordava.** Eli: *"la sezione margine ha la freccia per aprire il menu a tendina che esce dalla sezione"*. **CAUSA**: l'intestazione era una fila di quattro elementi in cui il titolo aveva `whiteSpace: nowrap` e **nessun permesso di restringersi**; col nome della proposta diventa «Margine · **Premium** · solo tu lo vedi» e spingeva cifra e freccia fuori dal bordo. **Misurato: 54px fuori a 390px, fino a 191px a 320px in «Testo grande».** Ora sono **due blocchi**: a sinistra il titolo che **va a capo** (`flex:1, minWidth:0`), a destra cifra e freccia che non si restringono mai. Riverificato su 5 combinazioni: freccia sempre dentro.
- **[MOCKUP] Le due proposte sulla pagina del CLIENTE** (Eli: *"è strutturata male, non si vedono bene le voci ed è confusionaria"*). Mandate 3 proposte a confronto con l'attuale. ⚠️ **Il difetto vero non è estetico**: le due card elencano le stesse voci con lo stesso aspetto, e l'unica differenza reale (manodopera 1h/2h) è una riga come tutte le altre — il cliente vede due prezzi ma **non capisce cosa cambia**. In più il riepilogo in cima mostra «Totale proposta Base», cioè un **terzo prezzo** prima ancora che ci sia una scelta.
  · **A «Cosa cambia»**: selettore Base/Premium in cima, poi le voci COMUNI una volta sola e un riquadro «Quello che cambia» con le due alternative e il delta esplicito. · **B Confronto affiancato**: due colonne con le righe allineate. · **C Card di oggi con le differenze marcate**: uguale in grigio, diverso in evidenza, pillola «+ 45,00 €».
- ⏸️ In attesa della scelta di Eli prima di implementare.
- tsc+build+548/548 verdi · scan spazi puliti.

### ✅ 9 ago (11) — La scelta della proposta è REVERSIBILE + acconto di default leggibile
Quattro punti di Eli, e il primo ribalta una mia decisione di stamattina.
- **[ALTA, mio] «Riporta in bozza» non poteva ridare le due proposte, perché le voci dell'altra le avevo CANCELLATE.** Eli: *"se seleziono Base e poi riporto in bozza, devono tornare disponibili entrambe le opzioni"*. Aveva ragione, e il testo del selettore prometteva già *«se sbagli puoi riportarlo in bozza»* — una promessa che una cancellazione non può mantenere. **Ora**: accettando una proposta si scrivono solo `accepted_tier` e i totali, le voci restano tutte; **«Riporta in bozza» azzera l'etichetta e rimette i totali della Base**; a tenere una sola proposta è la **conversione in fattura**, che sfoltisce le voci della fattura NUOVA (l'`option_tier` viene copiato dalla funzione SQL, quindi si può filtrare lì). ⚠️ Senza quel pezzo la fattura sarebbe nata con **Base + Premium sommate**. L'accettazione dal LINK PUBBLICO continua a cancellare: lì l'annullamento è già vietato (firma/IP = prova), quindi non c'è nulla da ripristinare.
- **[CRONOLOGIA] Ogni scelta lascia traccia** (Eli: *"ogni movimento o scelta per un documento deve essere registrata"*): `appendLog` accetta ora dei dettagli, e le voci `marked_accepted` / `unaccepted` portano **quale proposta**. La cronologia legge il `tier` dalla VOCE DI LOG, non dallo stato corrente: dopo un ritorno in bozza l'etichetta non c'è più, ma la storia di quel giorno resta vera.
- **[UI] Acconto in Impostazioni rifatto** (Eli: *"le selezioni non si vedono per intero… se seleziono importo fisso, cosa significa? affianco c'è un numero ma cos'è?"*). Nuovo `AccontoDefaultField`: tendina su una **riga tutta sua** con voci corte («Nessun acconto» · «Una percentuale» · «Una cifra fissa»), **unità visibile dentro il campo** (**%** / **€**) che cambia con la scelta, e il campo del valore che **sparisce** con «Nessun acconto». ⚠️ Misurato: «Percentuale del totale» non ci stava **nemmeno su una riga intera** a 320px in «Testo grande» (−31px) — le voci corte hanno 56px di margine nel caso peggiore.
- **[RISPOSTA] «Se metto 100 € fisso e faccio un preventivo da 50?»** L'acconto **si ferma al totale**: `Math.min(valore, totale)`, già applicato in tutti e tre i punti che lo mostrano (form, PDF, pagina del cliente) — quindi 50 € di acconto e saldo zero, al cliente non viene mai chiesto più del dovuto. Non era scritto da nessuna parte: ora lo dice un riquadro ambra sotto il campo (solo quando scegli la cifra fissa), il punto ⓘ e la FAQ.
- **[UI] Le spiegazioni di Impostazioni › Generale ora stanno in un punto ⓘ** (richiesta sua): nuovo `SpiegaCampo`, stessa grafica del ⓘ della card SdI approvato il 2 agosto. ⚠️ Si apre al **tocco**: il `title` di un elemento non esiste sul telefono.
- **[VERIFICATO] «Ordina per scadenza» è già identico** fra preventivi e fatture: stesso `SortSelect`, stesse voci, stesso `ordinaPerUrgenza`. Nella foto delle Impostazioni si vede il banner *«È disponibile una versione aggiornata»* → stava collaudando la build precedente.
- tsc+build+548/548 verdi · scan spazi puliti.

### ✅ 9 ago (10) — «Scadenza vicina» ordina per URGENZA, non per data (ordine dettato da Eli)
Eli: *"dobbiamo capire come gestire ORDINA PER SCADENZA PIÙ VICINA… altrimenti ad oggi guarda la data di creazione delle fatture e non le mette in senso logico di utilità"*.
- **PRIMA**: `expires_at ASC` e basta. Quindi una fattura **già pagata** con scadenza vicina finiva **sopra** una ancora da incassare con scadenza più lontana: una lista ordinata che metteva in cima ciò che non devi più guardare. C'è un test apposta su quel caso.
- **ORA, l'ordine che ha dettato lei**: **scadute** (le più in ritardo per prime) → **in attesa** (`sent`/`viewed`, per scadenza più vicina) → **bozze** → **pagate/accettate** → **annullate**. Dentro le fasce chiuse conta il più recente, non una scadenza che non significa più nulla. ⚠️ Chi non ha scadenza va **in fondo alla sua fascia**, non in cima: `null` non è «scade subito».
- ⚠️ **Le BOZZE non erano nel suo elenco**: le ho messe al 3° posto perché sono l'unica cosa che richiede ancora un'azione *tua*, ma non hanno scadenza e quindi non possono stare fra i documenti in ritardo. È l'unica scelta non sua: si sposta cambiando un numero in `GRUPPO`.
- **`lib/documents/ordina-scadenza.ts`** (NUOVO, PURO, **+10 test**): `gruppoUrgenza` · `confrontaPerUrgenza` · `ordinaPerUrgenza`. Uno stato sconosciuto finisce in fondo, mai fra le cose urgenti. Ordinamento **stabile**: due caricamenti danno la stessa lista.
- ⚠️ **La paginazione è la parte delicata**: PostgREST non sa ordinare per un'espressione, e riordinare in JS *dopo* aver preso 20 righe riordinerebbe solo la finestra che stai guardando — è il difetto dell'8 agosto, e non è un ordinamento. Quindi **solo per questo ordinamento** si leggono tutte le righe filtrate (`fetchAllRows`), si ordina, e **poi** si taglia la pagina. Gli altri ordinamenti restano paginati dal database. Costo: qualche lettura in più su una sola voce del menu; correttezza in cambio.
- Applicato a **entrambe** le liste (fatture e preventivi): sono gemelle da sempre e un ordinamento che si comporta in due modi diversi sarebbe peggio del difetto di partenza.
- **[UI] Spaziatura in Fatture** (Eli: *"la distanza tra la sezione cerca e da preventivo è meno rispetto alla distanza tra cerca e le sezioni"*). **Misurata con Chromium a 390px: 8px contro 16px** — due stacchi diversi fra blocchi dello stesso livello, che l'occhio legge come un raggruppamento che non esiste. Ora **16px in entrambi i punti**, riverificato.
- **FAQ**: aggiunta *«Cosa fa "Ordina: Scadenza vicina"?»* con l'ordine per esteso e il perché — l'etichetta da sola non lo direbbe.
- tsc+build+543/543 verdi · scan spazi puliti.

### ✅ 9 ago (9) — [ALTA] Il numero della nota di credito PERDEVA l'«NC» aprendo la pagina (⚠️ migration 077)
Quattro punti di Eli. Il primo è una corruzione di dato su un documento fiscale.
- **[ALTA] `NC001/2026` diventava `001/2026` ricaricando la pagina.** Eli: *"ho ricaricato e aggiornato la pagina della NC due volte e il «NC» davanti al numero è scomparso"*. **CAUSA**: il campo Numero del form si inizializzava con `defaultValues?.doc_number?.replace(/^[A-Za-z]+/, '')` — il taglio generico che mangia anche «NC» — e quel campo **viene RISALVATO nel database a ogni salvataggio, automatico compreso**. Quindi bastava aprire la nota perché l'auto-salvataggio le togliesse il sezionale. ⚠️ Il danno non è estetico: `001/2026` **è il numero di una fattura che esiste già**, e il sezionale separato serve esattamente a impedire quella collisione (che si porta dietro anche il `ProgressivoInvio` dello SdI). Nuovo **`stripPrefissoLegacy()`** in `lib/utils` (toglie solo `Prev`/`Fatt`), usato ora nei **17 punti** che facevano il taglio a mano — fra cui il **PDF** e l'**email al cliente**, che sulla nota mostravano il numero sbagliato. **+3 test**.
- ⚠️ **La stessa riga sbagliata era in tre posti diversi il 9 agosto** (`formatDocNumber`, `numeroFiscale` per lo SdI, e questo): quando una regola si scrive a mano in più punti, prima o poi uno di quei punti scrive nel database.
- **[UI] Archivio e Ordina di nuovo SEPARATI** (Eli: *"perché la sezione archivio è diventata un tutt'uno con l'Ordina? erano e devono essere separate"*). L'8 agosto le avevo unite in una barra sola per togliere una superficie bianca dalla pila prima della lista. Sono due cose diverse: **«Archivio» cambia COSA vedi, «Ordina» in che ORDINE lo vedi** — dentro lo stesso riquadro sembravano un comando solo. Restano sulla stessa riga (`flexWrap` + `marginLeft:auto`: su schermi stretti «Ordina» scende su una riga propria).
- **[RISPOSTA] La nota di credito è un documento NUOVO e autonomo**, la fattura di origine resta esattamente com'è. Le fonti sono concordi: numerazione **progressiva propria e distinta** da quella delle fatture (da noi il sezionale «NC»), data di emissione propria, **TD04**, trasmissione autonoma allo SdI, riferimento alla fattura originale in `DatiFattureCollegate` — ed **entrambi** i documenti si conservano **10 anni**. Non esiste alcuna riscrittura della fattura: è il collegamento fra i due che dice all'Agenzia che la prima è stata rettificata. È esattamente ciò che l'app fa già.
- **[FEATURE, ⚠️ migration 077] Acconto di default nelle Impostazioni** (Eli: *"vorrei che la richiesta di acconto e la percentuale siano settate anche di default nelle impostazioni"*): `workspaces.deposit_default_type` ('percent'|'fixed') + `deposit_default_value`. In **Impostazioni › Generale**, accanto alla validità; ogni preventivo **nuovo** nasce con quell'acconto già scritto e lo si cambia (o toglie) sul singolo documento. ⚠️ **Solo sui documenti NUOVI**: `mode === 'create'`. Su un documento esistente comanda sempre ciò che è scritto SUL DOCUMENTO, anche quando è «nessun acconto» — cambiare un'impostazione non deve riscrivere un preventivo già mandato a un cliente.
- ⚠️ **Due trappole già note, evitate**: la scrittura è condizionata a `formData.get('deposit_default_type') !== null` (l'**onboarding** usa la stessa action senza quei campi, e senza la guardia ogni salvataggio di lì azzererebbe l'acconto in silenzio — identico al bug degli ATECO e a quello del preavviso); e l'UPDATE è **tollerante pre-077**, così senza migration si salva comunque tutto il resto.
- ⚠️ **077 VALIDATA su PG16, e il collaudo ha trovato DUE buchi nel mio vincolo**: un `CHECK` in SQL passa quando l'espressione è TRUE **oppure NULL**, quindi `type='fixed' AND value > 0` con valore NULL valeva NULL → passava un **tipo senza valore**; e `NULL = 'percent'` → passava un **valore senza tipo**. Servono gli `IS NOT NULL` espliciti in ogni ramo. **Trovati eseguendo la migration, non rileggendola.** Verificato al terzo giro: 30% e importo fisso accettati · 150%, 0, tipo senza valore, valore senza tipo e tipo inventato respinti · idempotente · riga esistente intatta.
- **FAQ**: aggiunta *«Posso far comparire l'acconto già impostato su ogni preventivo?»* (dove si imposta · che vale solo sui nuovi · come si toglie).
- tsc+build+533/533 verdi · scan spazi puliti · 077 validata su PG16.

### ✅ 9 ago (8) — [DIFETTO, terza volta] La rotella si accendeva su Salva E su Invia
Eli: *"quando invio o salvo una nota di credito, lo spinner parte sia sul salva che sull'invia"*.
- **CAUSA**: `PreventivoForm` teneva **un interruttore solo** (`saving`, booleano) e i quattro tasti di modifica lo leggevano tutti allo stesso modo. Toccando «Invia al cliente» la rotella si accendeva sul tasto **Salva** — cioè sul tasto che NON avevi premuto.
- **FIX**: nuovo stato **`azione: 'salva' | 'invia' | null`** — dice *quale* tasto è stato toccato, non *se* si sta salvando. La rotella compare solo lì; gli altri restano **disabilitati** (un secondo tocco durante la scrittura scriverebbe due volte) ma fermi. Reset con lo stesso schema del `pendingIntent` di create mode (`if (!saving) setAzione(null)`).
- ⚠️ **Il salvataggio automatico non passa da nessun tasto** (`azione === null`): lì la rotella resta su «Salva», che è ciò che sta davvero accadendo — senza quel ramo i tasti sarebbero rimasti disabilitati **senza spiegazione** durante l'auto-salvataggio.
- **Verificato** l'invariante «mai due rotelle insieme» sulle condizioni vere del componente, nei 4 casi (riposo · tocco Salva · tocco Invia · auto-salvataggio). ⚠️ Non con Chromium sul componente reale: `PreventivoForm` importa le Server Action e non è impacchettabile per il browser — detto, non nascosto.
- ⚠️ **È la TERZA volta**: 8 ago su «Posticipa il sollecito», 9 ago sul selettore delle proposte, oggi qui. La regola §B.2 c'era già; mancava di cercarla dove uno stato di caricamento è **condiviso da tasti che fanno cose diverse**. Vale per ogni gruppo di tasti che scrive.
- **FAQ**: rilette, nessuna toccata — è un difetto di comportamento, non una funzione da spiegare.
- tsc+build+530/530 verdi · scan spazi puliti.

### ✅ 9 ago (7) — [ALTA] La pillola «PROVA» spariva con la chiave SANDBOX: sembrava produzione
Eli, accendendo lo SdI: *"è accesa ma non c'è la pillola PROVA anche se su openapi è in ambiente sandbox"*. Segnalazione giusta, ed era il caso peggiore.
- **CAUSA**: la pillola guardava `!process.env.OPENAPI_SDI_API_KEY`, cioè **SE la chiave c'è — non DOVE punta**. Con la chiave di sandbox configurata la pillola spariva e la card diventava **identica a quella di produzione**, mentre `OPENAPI_SDI_BASE_URL` puntava a `test.sdi.openapi.it`. Anche il toast di successo diceva *"Riceverai l'esito del Sistema di Interscambio"* come su una trasmissione vera.
- ⚠️ **Perché è la peggiore delle informazioni**: non è una funzione che non parte, è una funzione che **sembra riuscita**. L'artigiano preme «Invia allo SdI», legge la conferma e considera la fattura **emessa** — quando all'Agenzia non è arrivato niente. Se ne accorgerebbe mesi dopo, dal commercialista.
- **`sdiAmbiente()`** (NUOVO, in `lib/sdi/index.ts`, **+8 test**): `prova` (nessuna chiave: provider finto) · `collaudo` (chiave presente ma indirizzo non di produzione) · `reale` (chiave + `sdi.openapi.it`). ⚠️ **Un host sconosciuto vale `collaudo`, mai `reale`**: se non possiamo dimostrare che è produzione, non lo dichiariamo.
- **Nella card**: pillola **«COLLAUDO»** accanto a «PROVA», e — poiché l'app si usa dal telefono, dove il `title` di un elemento **non esiste** — una riga scritta per esteso: *«le trasmissioni partono davvero, ma NON arrivano all'Agenzia delle Entrate. Servono a provare, non a emettere»*. Toast allineato.
- **Misurato con Chromium** sulla riga vera del titolo (390/360/320px × normale/Testo grande, titolo lungo «Nota di credito elettronica (SDI)» × entrambe le pillole): **nessuno sbordo in 20 combinazioni**, pillola mai tagliata, nessuna sovrapposizione — nei casi stretti il titolo va a capo, che è la degradazione giusta.
- **FAQ**: rilette, nessuna toccata. La spiegazione vive dentro la card, e l'etichetta sparisce da sé al passaggio in produzione: una domanda frequente su uno stato pre-lancio sarebbe solo rumore.
- ⏭️ **Detto a Eli, non ancora deciso**: una trasmissione di **prova o collaudo scrive `sdi_status` per davvero** → la fattura si blocca (non modificabile, non eliminabile, non annullabile) per un invio mai avvenuto. Da collaudare su fatture usa e getta, oppure si distingue l'ambiente anche nei blocchi — serve la sua decisione.
- tsc+build+530/530 verdi · scan spazi puliti.

### ✅ 9 ago (6) — «Se crea rischio non facciamolo»: la nota di credito resta legata allo SdI
Due domande di Eli e una decisione che vale oltre il caso.
- **Domanda 1, *"come creo una nota di credito?"*** — risposta onesta: **oggi non puoi**. Il tasto compare solo sulle fatture **trasmesse allo SdI**, e lo SdI in app è spento (`NEXT_PUBLIC_SDI_ENABLED` non impostata) → nessuna fattura risulta trasmessa. Non è un difetto della regola: è il pezzo che manca per attivarla. ⚠️ Conseguenza da dire: i collaudi **A5.8–A5.10** che le avevo messo in lista **non sono eseguibili** finché il flag resta spento. Per provarla: `NEXT_PUBLIC_SDI_ENABLED=true` su Vercel — senza chiavi OpenAPI resta in **modalità PROVA** (pillola «PROVA», nessuna trasmissione reale), come il collaudo sandbox di luglio.
- **[DIFETTO mio] «Crea nota di credito» esisteva SOLO su mobile** (`lg:hidden`): da computer una fattura trasmessa non aveva alcun modo di essere stornata. Aggiunto anche su desktop.
- **Domanda 2, *"ha senso la nota di credito su una fattura non trasmessa ma solo inviata al cliente?"*** — **no**, e la sua risposta è stata netta: *"rendiamo le cose più lineari e semplici possibile e cerchiamo di ridurre i fraintendimenti, quindi se crea rischio non facciamolo"*.
- ⚠️ **Il perché, in una riga**: una nota di credito non corregge un *documento*, rettifica un'**operazione che l'Agenzia ha già registrato**. Su una fattura mai trasmessa la TD04 chiederebbe indietro un'IVA mai dichiarata — e sarebbe **irreversibile**, perché una nota trasmessa si compensa solo con una nota di *debito*. Sarebbe un secondo buco al posto del primo. Per quel caso l'app ha già tre strumenti reversibili: **correggi e rimanda** (badge «Modificato»), **«Annulla fattura»**, **elimina** (cestino 15 giorni).
- **Rete sotto la porta**: la route di trasmissione ora **rifiuta** una TD04 la cui fattura d'origine non risulta trasmessa, e **fallisce chiusa** se lo stato non si riesce a leggere («su una dichiarazione IVA il dubbio non è un via libera»). Oggi non può scattare — il tasto già non compare — ma impedisce che una scorciatoia futura in UI aggiri la decisione.
- **Copy, che è dove nascono i fraintendimenti**: nuova FAQ **«Come faccio una nota di credito?»** (quando compare · cosa compila da sola · che è la *trasmissione* a far avvenire lo storno · **perché** sulle non trasmesse il tasto non c'è, e cosa fare invece · numerazione NC e niente «Segna pagata»). Corretta la FAQ sull'eliminazione, che diceva ancora *"al posto di «Annulla» trovi la spiegazione"*: adesso lì c'è il tasto che la crea.
- **[PRINCIPIO, in `DECISIONI_E_FEEDBACK.md`]** Davanti a una funzione che *potrebbe* servire ma apre a un uso sbagliato: **non farla** e spiegare bene l'alternativa, invece di farla con un avviso sopra. Un interruttore in più, un'eccezione in più, una regola con un «però» sono modi di spostare il rischio addosso all'artigiano.
- tsc+build+522/522 verdi · scan spazi puliti.

### ✅ 9 ago (5) — QUALE PROPOSTA È STATA CONFERMATA (Eli) — e il bug che ci stava sotto
Eli: *"quando clicco su accettato preventivo e seleziono la proposta base poi non si capisce che è stato confermato quello. Vorrei fosse più chiaro quale dei due tra base e premium è stato confermato, sia manualmente, sia dal cliente"*.
- **[ALTA, trovata guardando il perché] L'accettazione MANUALE non applicava affatto la scelta.** Salvava solo l'etichetta `accepted_tier` e si fermava lì: il documento restava con le voci di **tutte** le proposte e col totale della sola **Base**. Due conseguenze vere: ① accettando la Premium, Home, liste e riepilogo continuavano a mostrare la cifra della Base — cioè l'app non dava **mai** atto della scelta, ed è esattamente ciò che Eli ha visto; ② **convertendo in fattura**, la conversione copia TUTTE le voci → la fattura nasceva con **Base + Premium sommate**, un importo che non esiste in nessuno scenario. Dal link pubblico non succedeva: lì le voci dell'altra proposta vengono rimosse e i totali ricalcolati. ⚠️ Le due strade portavano allo stesso stato lasciando il documento **diverso** — la regola dell'8 agosto, violata dal codice scritto lo stesso giorno. Ora il percorso manuale fa esattamente ciò che fa quello pubblico (stesso motore fiscale), con la cancellazione delle voci **dopo** la scrittura dei totali: se fallisse, resta il totale giusto.
- **Dove ora si legge la scelta** (mobile e desktop): ① nella **riga di stato** sotto l'intestazione — «Accettato il 9 ago **· proposta Premium**», la prima riga che si legge aprendo il documento; ② nel **banner verde**, che sull'accettazione manuale **non compariva affatto** (era condizionato a firma o IP) e ora dice «Proposta Premium — confermata da te» / «scelta dal cliente»; ③ nel **riepilogo per proposta**, dove quella scelta prende filetto verde e pillola «Scelta dal cliente»/«Confermata da te» e l'altra resta leggibile ma spenta con «Non scelta»; ④ in **cronologia**, come dettaglio dell'evento di accettazione.
- **Copy del selettore reso VERO**: prometteva già *"da lì in poi il totale del documento e la fattura useranno quella"* — una promessa che il server non manteneva. Ora dice anche che le voci dell'altra proposta vengono tolte, e che si può tornare indietro con «Riporta in bozza».
- ⚠️ **Lo scan degli spazi ha guadagnato il suo posto**: in una riga scritta in questo giro Turbopack si era mangiato lo spazio dopo `</b>` («diventaquella»). Risolto col `{' '}` esplicito, come da regola.
- ⏭️ **Non fatto, e va detto**: nella **lista** dei preventivi la proposta scelta non compare — la riga è già a tre livelli dal redesign dell'8 agosto e un'etichetta in più la riempirebbe. Se serve, si valuta dove.
- tsc+build+522/522 verdi · scan spazi puliti (dopo il fix).

### ✅ 9 ago (4) — SECONDO RICONTROLLO (Eli "ricontrolla ulteriormente"): 3 ALTE, e la causa è UNA SOLA
Guardato le superfici **intorno** alla nota di credito, non più il suo XML. Tutte e tre le ALTE nascono dallo stesso difetto: mezzo repo scriveva **`doc_type === 'fattura' ? … : 'Preventivo'`**. Finché i tipi erano due funzionava; introducendo il terzo, la nota di credito è finita nel ramo «preventivo» **per esclusione**, senza che nessun compilatore potesse accorgersene.
- **[ALTA, lato CLIENTE] Sul link pubblico la nota di credito era un PREVENTIVO da accettare.** `isPreventivo = doc_type !== 'fattura'` → al cliente comparivano i tasti **«Accetta» / «Rifiuta»**, la firma e la validità. Stessa cosa nell'email (il pulsante «Accetta il preventivo») e nelle pagine /scaduto e /rifiutato. Ora i controlli sono **positivi** (`=== 'preventivo'`), e la nota ha il suo nome.
- **[ALTA, lato CLIENTE] «Come pagare» con IBAN e QR su una nota di credito** — sia sulla pagina pubblica sia **nel PDF**. È denaro che TORNA al cliente: chiedergli l'IBAN sotto lo storno è chiedergli di pagare due volte. Tolto in entrambi; nel PDF anche «Totale da pagare» → «Totale della nota».
- **[ALTA, fiscale] Una nota di credito TRASMESSA restava modificabile ed eliminabile.** `isSdiTransmitted` usciva subito con `if (docType !== 'fattura') return false`, e le due guardie di eliminazione controllavano `doc_type === 'fattura'`. Una TD04 trasmessa è un documento emesso quanto una fattura. Tutte e tre estese.
- **[MEDIA] Sul piano Free l'invio di una nota bruciava uno degli 8 slot dei preventivi**, e poteva perfino essere **bloccato dal paywall**: un artigiano Free non avrebbe potuto correggere una fattura sbagliata. Tre punti passati a `=== 'preventivo'`.
- **[MEDIA] «Collega a un preventivo» compariva sulla nota di credito**, e la card mostrava la fattura stornata sotto l'etichetta «Preventivo collegato» con un «Apri» che portava a **404**. ⚠️ Il server reggeva già (`linkDocumentAction` ha `.eq('doc_type','fattura')`): il collegamento fiscale non era in pericolo, ma il tasto era un vicolo cieco. Ora la card dice **«Fattura stornata»**, l'«Apri» va su `/fatture/…`, e il tasto sparisce — `origin_document_id` è ciò che finisce in `DatiFattureCollegate`, non si cambia a mano.
- **[MEDIE] Rotte che portavano a 404**: campanella (messaggio del cliente), attività recente della Home ×2, `revalidatePath` dopo una risposta, etichette nel cestino. Nati due helper in `lib/utils`: **`docTypeLabel()`** e **`docTypePath()`**, con **+6 test** — così il prossimo tipo di documento non ripete il giro.
- ⚠️ **REGOLA: mai dedurre un tipo per esclusione.** `!== 'fattura'` non vuol dire «preventivo»: vuol dire «tutto il resto», e il resto un giorno esiste.
- tsc+build+522/522 verdi · scan spazi puliti.

### ✅ 9 ago (3) — RICONTROLLO del giro TD04 (Eli "ricontrolla… se in linea con le ricerche"): 1 ALTA + 3 MEDIE, tutte mie
Riletto il mio stesso lavoro contro l'**XSD 1.2.2 vero** (scaricato, non ricordato) e contro il resto dell'app. La struttura XML regge su tutti e quattro i punti: `ProgressivoInvio` è **String10Type** `(\p{IsBasicLatin}{1,10})` → il mio alfanumerico ≤10 è valido · `DatiFattureCollegate` è il **6° figlio** di `DatiGenerali`, dopo `DatiGeneraliDocumento` → posizione giusta · dentro il blocco l'ordine è `IdDocumento` poi `Data` → giusto · `Causale` è l'**11° elemento**, dopo `ImportoTotaleDocumento` → lo spostamento di ieri era corretto. Ma nell'app avevo lasciato quattro buchi.
- **[ALTA] Sulla nota di credito l'app offriva «Segna pagata».** Su mobile era il tasto **navy**, il più vistoso della pagina. Una nota di credito non si incassa: è denaro che **torna** al cliente. E lo stato «pagata» non era solo una parola sbagliata — il Bilancio raccoglie le entrate con `payment_status.in.(partial,paid)`, un ramo che **non guarda il tipo di documento** (serve agli acconti sui preventivi): una nota segnata pagata sarebbe entrata nei conti come **entrata**, cioè col segno opposto al suo. Ora sulla nota resta solo «Annulla la nota», e solo finché non è partita. Aggiunto anche `.neq('doc_type','nota_credito')` alle tre query di cassa (Bilancio pagina + export): difesa in profondità su un numero che sono soldi.
- **[MEDIA, bug che ho introdotto ieri] Una nota di credito ANNULLATA rientrava nei totali del registro.** Avevo scritto l'etichetta «Nota di credito» **al posto** dello stato, e la riga che esclude le annullate legge proprio quello (`stato === 'Annullata'`) → l'esclusione non scattava più e la nota stornava **due volte**. Ora lo stato reale si calcola **prima**, l'esclusione si decide su quello, e l'etichetta diventa «Nota di credito annullata». Stesso trattamento nell'export CSV.
- **[MEDIA] Il segno dell'«incassato» era incoerente**: negativo nel CSV, positivo nel registro. Su una nota un incasso è un **rimborso**: va sottratto in entrambi. Allineati.
- **[MEDIA] Sul desktop il numero usciva «Fatt. NC001/2026»**: tre chiamate a `formatDocNumber` passavano `'fattura'` a mano invece del tipo vero. Ora passano `doc.doc_type`.
- **[COPY] Il testo sotto la fattura trasmessa diceva ancora *"Carta Canta oggi non la prepara ancora: falla emettere dal commercialista"*** — falso da ieri, e stava **due righe sotto il tasto che la prepara**. Riscritto.
- tsc+build+516/516 verdi · scan spazi puliti.

### ✅ 9 ago (2) — LA NOTA DI CREDITO ESISTE ANCHE FUORI DALL'APP: TD04 allo SdI, registro e CSV
Eli, sul «cosa non c'è ancora» del giro precedente: *"perché non c'è? fai ricerca web su fonti ufficiali di quello che ti serve sapere prima di implementarla"*. Aveva ragione a insistere: **una nota di credito che resta dentro l'app non storna niente** — per l'Agenzia quella fattura è ancora intera. Costruite le tre uscite che mancavano.
- **RICERCA (fonti in chat, tracciato XSD FatturaPA 1.2.2 + istruzioni AdE)** — tre regole, tutte applicate: ① il tipo è **TD04**; ② gli **importi restano POSITIVI** («è il tipo di documento a identificare la partita a debito per il cedente»), quindi nessun meno nell'XML; ③ serve **`DatiFattureCollegate`** con `IdDocumento` e `Data` della fattura stornata — senza, la nota è formalmente valida ma **fiscalmente orfana** e apre a contestazioni. Nel **registro IVA vendite** la nota si annota **col segno meno** (o su un sezionale dedicato).
- **[ALTA, bug trovato costruendo] Il progressivo di invio faceva collidere nota e fattura.** `progressivoInvio` toglieva le lettere: `NC001/2026` e `001/2026` producevano **lo stesso** valore, e quel valore finisce nel **nome del file** trasmesso (`IT{piva}_{progressivo}.xml`), che lo SdI pretende univoco per trasmittente → la seconda trasmissione sarebbe stata respinta come duplicato. Ora le lettere si tengono (max 10 caratteri alfanumerici, come da tracciato).
- **[ALTA, bug pre-esistente] `<Causale>` stava nel posto sbagliato**, fra `<Numero>` e `<ImportoTotaleDocumento>`. La sequenza dell'XSD è *… ScontoMaggiorazione · ImportoTotaleDocumento · Arrotondamento · **Causale***, e `xs:sequence` impone l'ordine: era un file **XSD-invalido**, cioè scarto 00001 — e la causale c'è **su ogni fattura di un forfettario**, che è il nostro utente tipo. Spostata.
- **Trasmissione**: la route SdI accetta ora anche `nota_credito`, carica la fattura d'origine per il riferimento e **rifiuta di trasmettere una nota orfana** invece di produrre un file inutilizzabile. Stessa cosa per lo **scarico dell'XML** (artigiano e area commercialista). La card SdI compare sulla nota con le sue parole («la nota storna solo dopo l'invio»).
- **Registro fatture ed export CSV**: le note ci sono, **col segno meno**. ⚠️ Ometterle è peggio che sbagliarle: chi somma la colonna «Totale» leggerebbe un fatturato **più alto del vero**, che è esattamente l'errore che la nota di credito serve a correggere.
- **+9 test** (`tests/unit/sdi/xml-nota-credito.test.ts`): TD04 vs TD01, riferimento presente e **nella posizione giusta dentro `DatiGenerali`**, importi senza meno, «NC» conservato nel numero, e i tre casi del progressivo. **516/516.**
- ⚠️ **Resta fuori**, e va detto: lo **storno parziale** guidato (oggi la nota nasce a importo pieno e si modifica a mano) e i limiti dell'XML di fase 1 (sconti, aliquote diverse, ritenuta) — che valgono per le note esattamente come per le fatture, perché la nota copia la fattura.
- tsc+build+516/516 verdi · scan spazi puliti.

### ✅ 9 ago — NOTE DI CREDITO (TD04): primo pezzo, la creazione precompilata
Eli: *"procedi"*. Costruito il documento; la trasmissione allo SdI resta alla fase SdI.
- **Sezionale «NC»** (sua decisione): `allocateNotaCreditoNumber` usa la RPC con `p_doc_type = 'nota_credito'`, quindi la sequenza è **separata** da quella delle fatture — `NC001/2026`. ⚠️ Il prefisso sta DENTRO il numero, non è decorazione: è ciò che tiene distinte le due sequenze anche per il commercialista. Per questo `formatDocNumber` ora toglie **solo** i prefissi legacy `Prev`/`Fatt` invece di un generico `^[A-Za-z]+`, che si sarebbe mangiato l'NC.
- **`createNotaCreditoAction`**: dalla fattura copia cliente, voci, importi, sconti, aliquote, regime, e scrive il **riferimento al documento stornato** («Storno della fattura 014/2026 del 3/8/2026») più il motivo scelto. ⚠️ **Importi POSITIVI**: nella fattura elettronica la natura in diminuzione la dà SOLO il tipo TD04 — col meno lo SdI leggerebbe una nota di DEBITO e le liquidazioni IVA sballerebbero.
- **Il motivo si sceglie e conta**: errore nella fattura (nessun termine) · accordo col cliente (un anno per recuperare l'IVA) · altro. È l'unica cosa che l'app non può sapere, insieme allo storno parziale.
- ⚠️ **Bollo a ZERO** e detto nell'interfaccia: sulle note in forfettario le fonti si contraddicono → **domanda N4** al commercialista. Non decidiamo noi una regola che non conosciamo.
- **Una sola nota per fattura**: se esiste già si apre quella invece di crearne una seconda che stornerebbe due volte lo stesso importo.
- **Dove vive**: nella lista **Fatture** (stessa famiglia, cercarla altrove non verrebbe in mente), con la pillola viola «Nota di credito» e il numero senza il marcatore «Fatt.». Si apre nella pagina della fattura, che ora accetta entrambi i tipi. Nel PDF la testata dice **NOTA DI CREDITO**.
- ⚠️ **Cosa NON c'era ancora**: trasmissione allo SdI, registro fatture, export CSV. ✅ **Fatte nel giro (2)**, qui sopra. Resta fuori solo lo **storno parziale** guidato.
- tsc+build+507/507 verdi · scan spazi puliti.

### ✅ 8 ago (16) — ⚖️ MOTORE FISCALE: l'IVA si calcola sull'imponibile SCONTATO (decisione Eli)
Eli, dopo la ricerca del giro precedente: *"per l'IVA non credo cambi la risposta del commercialista da quella che hai trovato sul web, quindi applichiamo"* — con l'istruzione di confermare su **fonti ufficiali** prima di toccare qualcosa.
- **CONFERMA CERCATA E TROVATA**: uno sconto incondizionato indicato in fattura fa parte del corrispettivo pattuito e abbassa la **base imponibile** (art. 13 DPR 633/1972). Sul piano tecnico lo dice il tracciato **FatturaPA**: nei `DatiRiepilogo` l'`ImponibileImporto` dev'essere al netto dello sconto di documento, e lo SdI ha un controllo apposta — **errore 00422** — per chi sbaglia quel calcolo.
- **PRIMA**: lo sconto globale abbassava l'imponibile (100 → 90) ma l'IVA restava calcolata per voce sull'importo **pieno** (22) → totale **112**. **ORA**: imponibile 90, IVA **19,80**, totale **109,80**.
- **COME**: lo sconto di documento si **ripartisce sulle voci in proporzione** al loro importo, poi l'IVA si calcola per voce sulle basi ridotte. ⚠️ Il residuo di arrotondamento va sull'**ultima** voce, altrimenti la somma delle basi non tornerebbe con `afterDiscount` e il riepilogo per aliquota non quadrerebbe al centesimo. Regime forfettario invariato (IVA zero).
- ⚠️ **Il danno vero NON era lo scarto SdI**, e vale la pena averlo chiaro: `lib/sdi/doc-xml.ts` **rifiuta da sempre** le fatture con sconti (non ancora rappresentabili nell'XML), quindi allo SdI non ci arrivavano. Il danno era che **il totale mostrato al cliente** — PDF, link pubblico, riepilogo del form — era gonfiato dell'IVA calcolata sull'importo pieno.
- **+5 test** in `tests/unit/fiscal/calcoli.test.ts` (sconto %, sconto fisso, **due aliquote diverse**, quadratura degli arrotondamenti su 33,33+33,33+33,34, e il controcaso senza sconto), **507/507 verdi**. Aggiornato anche il test-sentinella delle proposte, che esisteva apposta per segnalare questo cambio.
- **[DECISIONE] Note di credito: sezionale «NC»** (Eli). Formato `NC/{NNN}/{YYYY}`, progressivo e separato dalle fatture. Le fonti dicono che entrambe le strade sono legittime; il sezionale è il più leggibile. Scritto in `PROGETTO_NOTE_CREDITO.md` §3-bis — la struttura c'è già, `invoice_sequences` è chiavata per `doc_type`.
- ⚠️ **Da dire comunque al commercialista quando risponde**: non come domanda ma come conferma. Se avesse un'opinione diversa si torna indietro cambiando un solo test.
- tsc+build+507/507 verdi · scan spazi puliti.

### ✅ 8 ago (15) — «Se non si dovrebbe fare, non lo permettiamo»: tasto spento, non errore dopo
Eli, su due FAQ: *"non voglio assolutamente questa cosa"*.
- **[COPY, diceva il FALSO] La FAQ «Posso eliminare una fattura che ho già mandato al cliente?»** era ferma a prima delle guardie di oggi: *"tecnicamente l'app te lo lascia fare, ma non dovresti"*, e prometteva che le fatture SdI *"restano nel cestino finché non decidi tu"*. Da stamattina non è più vero: non ci arrivano proprio. Riscritta sul confine reale, che è uno solo — **è passata dallo SdI o no**: trasmessa → non si elimina e non si annulla, si storna con nota di credito, dieci anni · mandata al cliente ma mai trasmessa → **non è ancora emessa**, si può eliminare (cestino, 15 giorni) · scartata → è come non fosse mai partita.
- **[COPY] Tolta la frase sull'«emessa con un altro programma»** dalla FAQ nuova (decisione di Eli: non la vogliamo dire). Tolto anche l'avviso ambra nel dialog di eliminazione, che diceva la stessa cosa: adesso non serve più spiegare a parole ciò che il codice impedisce.
- **[UI] Il tasto Elimina è SPENTO sulle fatture trasmesse**, non più attivo con l'errore dopo la conferma (*"se non si dovrebbe fare allora non permettiamo"*). ⚠️ **Spento e spiegato, non nascosto**: sotto la voce disabilitata c'è il motivo in una riga. Un comando che sparisce lascia il dubbio di non aver capito dove sta; uno spento dice che esiste e perché oggi non si usa. L'esito SdI la lista ce l'ha già (mappa `sdiById`): nessuna query in più.
- ⚠️ **«Crea nota di credito» NON è stato costruito**, ed è deliberato: il TD04 è un documento fiscale e la sua **numerazione** (stessa serie o sezionale) è una delle domande ancora aperte col commercialista, oltre a richiedere lo SdI live. Costruirlo adesso è esattamente ciò che la regola B.0 vieta. La richiesta di Eli è stata **scritta nella specifica** (`PROGETTO_NOTE_CREDITO.md` §3-bis): al posto di «Annulla» il tasto «Crea nota di credito», nota **precompilata** con cliente, voci, regime e riferimento alla fattura stornata; a mano restano causale ed eventuale storno parziale.
- tsc+build+502/502 verdi · scan spazi puliti.

### ✅ 8 ago (14) — La sezione «In scadenza» della Home c'è SEMPRE
Eli: *"ho aperto la Home e non vedo la card in scadenza, deve comparire sempre e se non ci sono documenti, dire che non ci sono"*.
- **CAUSA**: c'era una guardia `if (!preventivo && !fattura) return null` — quando **entrambi** i tipi erano vuoti spariva l'intera sezione. Era una mia scelta del 7 agosto ("a chi ha appena aperto l'app due riquadri che dicono niente non servono"), e con l'app quasi vuota funzionava. Non funziona più adesso: **archiviare** un documento o **spegnere i solleciti** può svuotare la sezione da un momento all'altro, e allora la sparizione non si legge come «nessuna scadenza» ma come «dov'è finita?».
- **Fatto**: la guardia è stata tolta. Le due card ci sono sempre, e quando non c'è niente lo dicono («Nessun preventivo in scadenza» · «Nessuna fattura in scadenza») col collegamento alla lista, che è la via per andare a controllare. Il `VuotoBlock` esisteva già dal 7 agosto: mancava solo il permesso di comparire.
- ⚠️ **Regola**: una sezione che sparisce non comunica «vuoto», comunica «rotto». Se il vuoto è un'informazione utile, va scritto.
- tsc+build+502/502 verdi · scan spazi puliti.

### ✅ 8 ago (13) — «Cosa posso buttare e cosa devo tenere»: la regola detta dove serve
Eli: *"deve sapere cosa deve tenere sott'occhio e cosa invece può eliminare"*. Le guardie del giro precedente proteggono da sole; qui si aggiunge quello che il codice **non può** proteggere.
- ⚠️ **Il limite onesto dell'app, ed è il punto centrale**: blocchiamo l'eliminazione delle fatture **trasmesse da noi**. Se l'artigiano emette la fattura con **un altro programma** (Aruba, il gestionale del commercialista) e qui tiene solo la copia, **non possiamo saperlo**: il blocco non scatta. L'unica difesa è dirglielo **prima**, nel momento in cui sta per eliminare.
- **Avviso ambra nel dialog di eliminazione** di ogni fattura non-bozza: *"se è già stata trasmessa allo SdI — anche da un altro programma — per l'Agenzia è emessa e non va eliminata: si annulla con una nota di credito. Se invece è rimasta solo qui, o è stata scartata, puoi eliminarla."*
- **FAQ «Cosa posso eliminare e cosa devo tenere?»** con le tre colonne vere: **si può buttare** (bozze, preventivi rifiutati o scaduti, fatture mai partite, fatture **scartate** — non sono mai state emesse) · **non si butta** (fatture trasmesse: dieci anni e nota di credito) · **si tiene anche se non è fiscale** (preventivi accettati e firmati: è la prova dell'accordo). Con il suggerimento di **archiviare** invece di eliminare quando il fastidio è solo visivo.
- **`COSE_DA_FARE_ELI.md`**: N1 aggiornata (il punto ① si è chiuso da sé con la ricerca: restano ② e ③) e nuova **N3** con le due situazioni limite che il codice non copre — «Segna annullata» su una fattura trasmessa (bloccarlo o tenerlo come segnalibro interno?) e l'interruttore *"questa l'ho già emessa altrove"* da valutare.
- tsc+build+502/502 verdi · scan spazi puliti.

### ✅ 8 ago (12) — SdI: due guardie fiscali, cronologia della trasmissione, scelta della proposta
Cinque punti di Eli, due dei quali decisi da una **ricerca web** sulle regole della fattura elettronica.
- **Cosa dice la norma** (fonti in chat): una fattura **trasmessa e accettata** dallo SdI è EMESSA — non si elimina e non si modifica, si storna con una **nota di credito TD04**. Una fattura **SCARTATA** è invece considerata **non emessa**: si corregge e si ritrasmette **entro 5 giorni**, con lo **stesso numero e la stessa data**. Da qui le due guardie.
- **[ALTA, bug fiscale] «Segna non pagata» riportava in BOZZA una fattura già trasmessa.** Causa: la regola «se non è mai stata inviata torna in bozza» guardava `sent_at`, che è l'invio **email al cliente** — una fattura trasmessa allo SdI senza email aveva `sent_at` nullo e retrocedeva. L'app dichiarava «non ancora emessa» un documento che per l'Agenzia è emesso, e **la card SdI spariva** (è nascosta sulle bozze) portandosi via la storia della trasmissione. È esattamente il flusso che Eli ha descritto. Fix: la retrocessione non si applica se `sdi_status` è valorizzato e diverso da `scartata`.
- **[ALTA, bug fiscale] Si poteva ELIMINARE una fattura trasmessa**, dalla lista e dal cestino: sparivano il documento e lo **snapshot XML**, cioè la prova di cosa è stato trasmesso. Il cron di purge le salta dal 25 luglio, ma il tocco manuale passava. Ora `deleteDocumentAction` e `purgeDeletedDocumentAction` rifiutano, con la spiegazione della nota di credito. ⚠️ **`scartata` resta eliminabile**: non è mai stata emessa.
- **[UI] La card SdI non sparisce più**: il gate sullo stato vale solo per l'OFFERTA di trasmettere; se la fattura è già partita la card resta in qualsiasi stato — è il registro di ciò che è successo.
- **[FEATURE] Cronologia della fattura elettronica**: «Inviata allo SdI» e l'esito («Consegnata dallo SdI» · «Emessa, non recapitata» · «Scartata dallo SdI», ognuno con cosa comporta). ⚠️ **DERIVATI** da `sdi_sent_at`/`sdi_status`/`sdi_updated_at`, che la trasmissione scrive già: nessun percorso di invio è stato toccato e la cronologia non può divergere dallo stato reale.
- **[FEATURE] Più proposte: ora si può segnare accettato scegliendo QUALE.** Prima ci si fermava («falla scegliere al cliente dal link») — ma il cliente può aver risposto a voce. Il server risponde 422 con l'**elenco vero** delle proposte del documento, l'app chiede «Quale proposta ha accettato?» e scrive `accepted_tier`; da lì la conversione in fattura non è più bloccata. Scrittura della colonna **a sé e tollerante**: senza la 041 l'accettazione resta valida.
- **[UI] Separatori della Home visibili**: da `0.5px #eee`/`#efeee9` (quasi invisibili) a **`1px #e4e2dc`**, in tutti e 4 i punti (attività recente ×2, piede delle card, agenda di oggi).
- tsc+build+502/502 verdi · scan spazi puliti.

### ✅ 8 ago (11) — LOTTO DI SEI: disposizione delle liste, 2 bug, cerca nelle FAQ (⚠️ migration 076)
- **[DISPOSIZIONE, dopo ricerca web] Le due liste riordinate.** La ricerca dice una cosa netta: **il cerca sta in alto** (NN/g, Baymard, Algolia — è la posizione che l'occhio cerca per prima; metterlo in fondo è classificato come "posizione inaspettata"), le sezioni **subito sotto**, l'ordinamento **accanto ai filtri**. Quindi NON ho spostato il cerca in fondo come chiesto, e l'ho spiegato. Ma su Fatture Eli aveva ragione: i due tasti «Da preventivo / Nuova fattura» stavano **in mezzo** fra cerca e sezioni, spezzando la sequenza «cerco → filtro → guardo» — sono l'**azione** della pagina e ora stanno in cima. Da lì in giù le due pagine sono **identiche**.
- ⚠️ **La causa vera del «confuse»**, trovata misurando: prima della lista c'erano **quattro superfici bianche impilate** di forme diverse (cerca · tasti · pillole · e DUE riquadri separati per Archivio e Ordina). Ora Archivio e Ordina sono **una barra sola** — comandi della stessa famiglia, una superficie in meno. `flexWrap` interno: su schermi stretti «Ordina» scende sotto RESTANDO nella barra. Verificato: nessuno sbordo su 390/360/320 × normale/Testo grande × archivio acceso/spento (12 combinazioni).
- **[BUG, ALTA] Da Richieste toccando «Altro» usciva la pagina d'errore.** Causa: aprire una richiesta lancia da sola `markRequestStatusAction`, che faceva `revalidatePath('/altro')` — la revalidation della rotta di **destinazione** arrivava mentre la navigazione era in corso e la uccideva. **È lo stesso inciampo della campanella del 18 luglio.** ⚠️ Era l'UNICO punto del repo che revalidava `/altro`, ed è esattamente per questo che il difetto si vedeva solo partendo da Richieste. Tolto: il badge resta corretto perché le rotte dinamiche vivono in cache client 30 secondi.
- **[BUG] Catalogo, suggerimento illeggibile**: la spiegazione del campo Costo stava nel **segnaposto**, che non va a capo e si tagliava a metà frase («Solo per te: serve a vedere il margine ne…»). Ora è una riga sotto l'etichetta, e il segnaposto è un esempio di importo. ⚠️ Regola: una spiegazione non va mai in un placeholder — non va a capo e sparisce appena scrivi.
- **[FEATURE, ⚠️ migration 076] La richiesta ricorda il preventivo che ne è nato**: `marketplace_requests.document_id`. In alto a destra la richiesta mostra **«Preventivo 014/2026»** al posto dello stato di lettura, e il tasto diventa **«Apri il preventivo»** invece di crearne un secondo. ⚠️ Il collegamento si scrive quando il documento **esiste davvero**, non all'apertura del form: aprire e cambiare idea non deve lasciare una richiesta marcata come fatta. `ON DELETE SET NULL` — se il preventivo viene cancellato per sempre la richiesta torna onestamente «da fare». **076 VALIDATA su PG16**: idempotente, GRANT per colonna esteso (senza, l'UPDATE sarebbe fallito con 42501 facendo fallire l'intera scrittura — il bug latente di giugno), FK che azzera il collegamento.
- **[FEATURE] Cerca dentro le FAQ di /aiuto**: sono più di trenta domande, e scorrerle tutte è il motivo per cui uno rinuncia. Stesse due regole del cerca di «Altro»: **più parole restringono** e si cerca **nel titolo + parole chiave scritte a mano** (14 domande ne hanno: *impronta, bonifico, mq, testo grande, cestino, timer…*), **mai nel testo della risposta** — una parola persa in fondo a una risposta lunga porterebbe a galla domande che non c'entrano. Con ≤3 risultati si aprono da sole.
- **[UI] Pillole di sezione simmetriche** (Eli: *"Aiuto e Tutorial hanno la pillola nera di dimensioni diverse e distanze dal bordo diverse"*): nuova classe `cc-tabs-equal` — le pillole si dividono la riga in parti **uguali** e lo spaziatore finale sparisce. Misurato: da «158 · 166» a «171 · 171», e il margine passa da 4px a sinistra / 22px a destra a **4px da entrambe le parti**. Applicata anche ad Account e Impostazioni. ⚠️ NON ai filtri di stato, dove le etichette hanno lunghezze molto diverse e pareggiarle sprecherebbe spazio.
- tsc+build+502/502 verdi · scan spazi puliti · 076 validata su PG16.

### ✅ 8 ago (10) — LA RIGA DELLE LISTE RIFATTA (mockup B, scelta di Eli): il cliente non sparisce più
Eli, con due foto delle liste vere: *"già oggi se ci sono due badge poi non si vede il nome del cliente… fammi delle proposte mockup che conciliano tutto"*. Aveva ragione, e non era colpa dell'archivio: **il difetto c'era già**.
- **CAUSA**: nella riga 1 il blocco di sinistra (numero + cliente) era `flex:1, min-width:0` e quello dei badge `flex-shrink:0` — i badge non si restringono **mai**, quindi si servono per primi. Con due badge al nome del cliente restavano **0px**: spariva. Nelle sue foto si vede su «Fatt. 008/2026» (Scaduta + Modificata, nessun nome) e su «006/2026» (troncato a metà parola).
- **Tre proposte misurate** sulle sue righe vere (A: in alto solo lo stato · B: numero e nome su una riga tutta loro · C: via la pillola, striscia colorata + lo stato detto dalla riga della data). **Eli sceglie B.**
- **Fatto, su preventivi e fatture**: **riga 1** numero · cliente a tutta larghezza · **riga 2** stato + «Modificato» + «Archiviato» a sinistra, data e importo a destra (`flexWrap` + `marginLeft:auto`) · **riga 3** la fattura collegata / l'esito SdI, allineati a destra — sono rimandi a un ALTRO documento, non dati di questo.
- **Misurato dopo**: il nome passa da **0 a 156px** a 390px, e regge fino a **72px a 320px in «Testo grande»** (prima: 0 ovunque). Nessuno sbordo di card o pagina in **6 combinazioni** di larghezza e zoom.
- **[dal secondo ricontrollo] Indirizzo dell'archivio senza migration**: `?status=archiviati` (da un segnalibro o dalle due voci del cerca) non applicava nessun filtro e mostrava **la lista intera spacciata per archivio** — il tasto era già nascosto, ma l'indirizzo restava raggiungibile. Ora in quel caso si torna alla lista, che almeno dice il vero.
- **[dal secondo ricontrollo] Verificato che il tasto ⋯ non finisce sopra le righe nuove** (era il rischio della riga 3, allineata a destra, col ⋯ in basso a destra): controllo di sovrapposizione su tutte e quattro le card di prova, zero collisioni, zero sbordi.
- ⚠️ **Scoperta lasciata sul tavolo (proposta C, non scelta)**: la riga della data **dice già lo stato** — «Scaduta» compare due volte sulla stessa card, badge in alto e «Scaduta il 10 lug» sotto. Vale per scadute, accettate, pagate, rifiutate e bozze (4 stati su 6). È lo stesso doppione che Eli aveva trovato nella card della Home il 7 agosto. Se un giorno la riga tornerà stretta, la pillola di stato è il candidato giusto da togliere.
- tsc+build+502/502 verdi · scan spazi puliti.

### ✅ 8 ago (9) — Badge «Archiviato» sulle righe delle liste (mockup del caso peggiore)
Eli: *"voglio che i documenti archiviati abbiano il badge archiviato nella card dove ci sono tutti i preventivi. Fammi un mockup della situazione peggiore dove ci sono più di due badge e se è possibile"*.
- **MISURATO sul markup vero a 390px, non a occhio**: la riga 1 ha a sinistra numero + cliente (`flex:1, min-width:0`) e a destra i badge (`flex-shrink:0`). Con **tre** badge — Accettato + Modificato + Archiviato — al blocco di sinistra restano **0px**: **sparisce il nome del cliente E si taglia il numero** (si legge «014» al posto di «014/2026»). ⚠️ Succede **anche con un nome corto**: i badge non si restringono, quindi non è questione di quanto è lungo il cliente. Già oggi, con due badge e un nome lungo, al cliente restano 27px.
- **Mockup con 5 casi** mandato a Eli (oggi · 3 badge nome lungo · 3 badge nome corto · badge sulla riga 2 · solo icona). ⚠️ **Correzione fatta prima di mandarlo**: la prima stesura diceva *"il numero e i badge si leggono"* — falso, si vedeva «014» nella figura stessa. Rimisurato con un controllo apposta (il numero non è troncato da sé: lo **ritaglia il contenitore**, quindi `scrollWidth` non basta a scoprirlo).
- **Fatto: il badge sta sulla RIGA 2**, accanto a data e importo, prima dell'etichetta della fattura collegata / dell'esito SdI. Riga 1 intatta. Compare **sempre** su un documento archiviato: dentro l'archivio e nei risultati del cerca (prima, dentro l'archivio, l'avevo tolto come ridondante — Eli lo rivuole, ed è giusto: è l'unico segnale che dice *cos'è* quella riga).
- **Nessuna query in più**: `soloArchiviati || archiviatiIds.has(id)` copre tutti i casi — dentro l'archivio lo sono tutti, fuori compaiono solo cercando.
- Verificata la riga 2 nel suo caso peggiore (data lunga + importo a 5 cifre + «Archiviata» + «SdI · Consegnata») su 390/360/320px × normale/Testo grande: **nessuno sbordo in nessuna delle 6 combinazioni**, va a capo come deve.
- tsc+build+502/502 verdi · scan spazi puliti.

### ✅ 8 ago (8) — RICONTROLLO dell'archivio (Eli "ricontrolla tutto"): 5 difetti veri + 1 pulizia
Rilettura critica di tutto il lavoro sull'archivio (075, cerca, tasto fuori dalla barra), cercando i casi non coperti.
- **[ALTA — la causa che non avevo visto] `documents` ha un trigger `BEFORE UPDATE` che riscrive `updated_at`.** Quindi **archiviare un documento lo faceva SALIRE IN CIMA ad «Attività recente»** della Home: lo metti via e te lo ritrovi primo, l'esatto contrario di quello che hai chiesto. Fix: query tollerante degli archiviati toccati nella finestra del feed, e filtro **sul FEED, non su `docs`** — ⚠️ da `docs` arrivano anche i KPI del mese, e toglierli di lì avrebbe cambiato i **numeri** della Home. Archiviare tocca dove vedi un documento, mai quanto vale.
- **[MEDIA] «Non ricordarmelo più» valeva solo su mobile**: le due card desktop dei solleciti (`stale` e `expiringSoon`) leggevano `pending` grezzo, senza escludere rinviati/spenti/archiviati. Anche quelle sono promemoria → ora partono da `daSollecitare`.
- **[MEDIA] Il badge di /scadenze poteva dire MENO del vero**: sottraevo tutti i preventivi fuori dai promemoria, ma quel conteggio conta solo `sent`/`viewed` — un preventivo **scaduto** e archiviato veniva sottratto da un numero in cui non era mai entrato (fino a «0» sopra una pagina con una riga). Ora la sottrazione guarda gli stessi stati, oltre alla stessa finestra.
- **[BASSA] Il tasto «Archivio» compariva anche senza la migration**, e lì il filtro non si applica: avrebbe mostrato **la lista intera** spacciandola per l'archivio. Ora il tasto esiste solo se la colonna c'è.
- **[BASSA] Etichetta «Archiviato» ridondante** su ogni riga *dentro* l'archivio: serve solo quando un archiviato compare fuori dal suo posto, cioè nei risultati del cerca.
- **[PULIZIA] Due query inutili**: sulle pagine di dettaglio la select principale è un `select('*')` — la colonna arriva già, e se la migration mancasse arriverebbe `undefined`. Tolleranza gratis e due round trip in meno per apertura.
- ⚠️ **Difetto creato e chiuso DENTRO la revisione, mai arrivato in produzione**: sistemando le card desktop avevo usato `idRinviati` **prima della sua dichiarazione** (riga 346 contro 404). TypeScript non lo segnala — l'uso è dentro la callback di un `.filter`, e il compilatore non sa quando gira — e il `build` nemmeno, perché la Home è dinamica: sarebbe esplosa in faccia all'utente con *"Cannot access before initialization"*. Trovato con un controllo di ordine scritto apposta. ⚠️ **REGOLA: `npx tsc` e `npm run build` verdi NON provano che una pagina dinamica parta.**
- **Verificati PULITI, con prova**: Bilancio, export CSV, registro fatture e scheda cliente non filtrano su `archived_at` (grep a zero risultati) · la duplicazione di un documento non copia i tre flag · l'ordine dei rami del cerca (SdI → archivio → modificate → stato → testo) · l'ordine dei destructuring nei due `Promise.all` toccati · i KPI della Home invariati.
- **Accettato e annotato**: le notifiche diverse da «preventivo fermo» (visto, messaggio del cliente, esito SdI) **continuano a suonare** anche sui documenti archiviati — un messaggio o uno scarto SdI non vanno zittiti perché hai messo via il documento.
- tsc+build+502/502 verdi · scan spazi puliti.

### ✅ 8 ago (7) — L'ARCHIVIO ESCE DALLA BARRA DELLE PILLOLE (mockup, opzione C di Eli)
Eli: *"per leggere ARCHIVIATE bisogna scorrere lateralmente la barra. Non possiamo far stare tutte le sezioni senza scorrere, ad esempio avvicinando i nomi? fai un mockup"*.
- **MISURATO, non stimato, sul CSS vero**: le sei pillole dei Preventivi chiedono **409px** su **358** disponibili a 390px. Stringendo a 12,5px ci stanno — ma **solo a 390px e solo a testo normale**: a 360px ne mancano ancora 27, in «Testo grande» 48. Cioè avrebbe risolto il fastidio per Eli lasciandolo a chi ha lo schermo piccolo o gli occhi stanchi.
- **Mockup con tre strade** (A stringere · B due righe · C archivio fuori dalla barra): **Eli sceglie C**, col tasto **a sinistra** della riga «Ordina» (*"lì c'è già l'ordina"*).
- ⚠️ **Il motivo vero non è di spazio: «Archiviati» NON è uno stato del documento.** «Rifiutati» e «Accettati» dicono com'è andata col cliente; l'archivio dice dove l'hai messo tu. Nella stessa fila sembrava un esito del preventivo — mescolare le due cose è ciò che ha fatto sbordare la riga.
- **`app/(app)/_components/ArchivioToggle.tsx`** (NUOVO): tasto che entra e (da acceso, navy) esce dall'archivio, su mobile e desktop. Conserva `q` e `sort` — una ricerca in corso non si azzera entrando nell'archivio — ma non `page`, che nell'altra lista non esiste.
- ⚠️ **[REGRESSIONE MIA, trovata misurando] La riga nuova faceva SBORDARE la pagina** a 360px in «Testo grande» e a 320px: due riquadri affiancati con `justify-between` non hanno dove andare. Fix: `flexWrap` + `marginLeft: auto` sul riquadro «Ordina» — quando ci stanno restano ai due capi, quando non ci stanno «Ordina» scende su una riga propria allineata a destra. Verificato: **nessuno sbordo su nessuna delle 12 combinazioni** (390/360/320 × normale/Testo grande × preventivi/fatture).
- **Esito sulle pillole**: una riga sola a 390px (il telefono di Eli) e a 360px per le fatture; nei casi estremi (320px, «Testo grande») scorrono ancora — ma è **esattamente il comportamento di prima dell'archivio**, previsto dal commento del CSS di luglio, non una regressione.
- Copy allineata ovunque il posto fosse citato: FAQ, /novita, il pannello di «Posticipa il sollecito» (*"lo trovi in Preventivi › Archivio"*), il dizionario del cerca.
- tsc+build+502/502 verdi · scan spazi puliti.

### ✅ 8 ago (6) — [BUCO MIO] Il cerca non trovava più i documenti archiviati
Eli, subito dopo il rilascio: *"considera che ora i documenti archiviati non compaiono come risultati del cerca dei preventivi e fatture. È corretto?"*. **No, e il buco era mio**: avevo applicato il filtro dell'archivio a OGNI lettura della lista, ricerca compresa.
- **CAUSA**: `.is('archived_at', null)` stava sempre nella query. Cercando «Mario Rossi» con quel preventivo archiviato, la lista rispondeva *«Nessun risultato»* — cioè negava l'esistenza di una cosa che esiste, ed è lo stesso difetto che avevo evitato con cura nel dizionario del cerca di «Altro».
- ⚠️ **REGOLA: l'archivio nasconde dalla NAVIGAZIONE, non dalla RICERCA.** Sfogliando le pillole gli archiviati non compaiono (è tutto il senso dell'archivio); con una ricerca in corso sì, **con l'etichetta «Archiviato»/«Archiviata»** sulla riga — senza, sembrerebbero tornati nella lista. È il modello della posta elettronica: archiviare toglie dalla posta in arrivo, mai dal cerca.
- Il menu **⋯** di quelle righe mostra **«Togli dall'archivio»**, non «Archivia»: fuori dalla loro pillola il comando giusto è l'altro.
- **Cercando la parola «archiviati»** (o archiviate/archivio, anche troncata) si filtra sull'archivio, come già succede con «sdi» e «scaduti».
- ⚠️ **Come NON l'ho fatto**: mettere `archived_at` nella select principale rompeva la tipizzazione (il parser dei tipi Supabase non digerisce una select costruita con un ternario) e avrebbe tolto la tolleranza pre-migration. Gli id archiviati della pagina corrente arrivano da una **query a sé, tollerante**, che parte **solo quando c'è una ricerca** — stessa forma del blocco SdI che sta due righe sopra.
- FAQ di /aiuto e voce di /novita aggiornate: la riga «il cerca li trova lo stesso» va detta, altrimenti chi archivia teme di aver perso qualcosa.
- tsc+build+502/502 verdi · scan spazi puliti.

### ✅ 8 ago (5) — ARCHIVIO dei documenti + «Non ricordarmelo più» (⚠️ migration 075)
Eli: *"aggiungiamo anche l'opzione per non sollecitare più, e archiviare il documento… magari una sezione tipo archiviati, un pulsante che archivia e disarchivia. Come pensi potremmo gestirlo al meglio?"*. Due decisioni sue, prese sul mio consiglio: **due comandi distinti** (non uno solo) e **archivio come pillola dentro le liste** (non una pagina a parte).
- **⚠️ migration 075 — due colonne, non una**: `documents.reminders_off_at` («Non ricordarmelo più»: il documento resta in tutte le liste ma esce dai promemoria — è il rinvio della 074 senza data di ritorno) e `documents.archived_at` («Archivia»: esce dalle liste attive e va nella pillola «Archiviati»).
- ⚠️ **ARCHIVIARE NON È CANCELLARE, ed è la regola che tiene in piedi il resto**: Bilancio, export CSV, registro fatture e scheda cliente **non filtrano** su queste colonne e non devono iniziare a farlo. Un archivio che toglie soldi dai conti fa sbagliare i conti senza dire perché. Il posto dove un documento sparisce davvero resta il **cestino** (`deleted_at`, 15 giorni); l'archivio non ha conto alla rovescia. Nessun effetto fiscale: `expires_at`, `status` e gli importi non si toccano — verificato su PG16.
- **Dove si comanda**: menu **⋯** della riga nelle liste (accanto a Duplica/Elimina, **fuori** dalla zona rossa: non è una cancellazione) · **orologio** nelle pagine delle scadenze, dove sotto un filetto c'è «Archivia il preventivo» con scritto cosa comporta · **banner** sulla pagina del documento archiviato con «Togli dall'archivio» (senza, chi ci finisce dentro dall'archivio non ha via d'uscita).
- **`lib/documents/archivio.ts`** (NUOVO): `documentiSenzaPromemoria()` — **una sola** query tollerante che raccoglie rinviati + solleciti spenti + archiviati, usata da Home, due pagine scadenze, hub /scadenze e **campanella**. ⚠️ Limitata agli stati `sent/viewed/expired`: senza quel filtro un archivio pieno di documenti chiusi gonfierebbe la lista e i conteggi che la sottraggono sbaglierebbero **per eccesso**. Nell'hub /scadenze la sottrazione è anche **intersecata con la finestra di scadenza**, altrimenti un rinviato che scade fra due mesi abbasserebbe un numero in cui non era mai entrato.
- ⚠️ **Nelle LISTE il filtro va in SQL, non in memoria**: la paginazione conta le righe lato database, e un filtro applicato dopo darebbe pagine di lunghezza diversa e un pager che promette pagine vuote. Ma un filtro su una colonna assente farebbe fallire l'INTERA lista (pagina principale dell'app, errore di caricamento) → **sonda** `archivioDisponibile()` memoizzata per richiesta: finché la 075 non è applicata, le liste si comportano esattamente come prima.
- **I conteggi dei tab escludono gli archiviati** (altrimenti «Tutti: 40» sopra una lista di 32) e la campanella tace sui documenti messi via — se suonasse, «non ricordarmelo più» non manterrebbe la promessa che fa.
- Voce in **cronologia** per archiviazione e ripristino (best-effort): ritrovare un documento nell'archivio senza sapere quando ci è finito non aiuta nessuno.
- **075 VALIDATA su PG16 reale**: idempotente al secondo giro · colonne a NULL sulle righe esistenti · la query di esclusione (stessa `OR` del codice) trova entrambi i casi · lista attiva e pillola archiviati si dividono le righe · `total`/`expires_at`/`status` intatti · ripristino riporta il documento nella lista · indici parziali creati.
- Verificato con Chromium sul componente vero a 390px, anche in «Testo grande»: menu completo senza sbordi, **1 sola rotella** sul tasto toccato, i due stati «rinviato» e «solleciti spenti» con il loro tasto di ritorno. ⚠️ Trovato e corretto lì: sulla fattura il testo diceva *"lo trovi in Fatture › Archiviati"* — concordanza sbagliata su due parole, ora «la trovi in Fatture › **Archiviate**».
- 2 FAQ in /aiuto (come non sollecitare più · cosa vuol dire archiviare, con la differenza dal cestino detta esplicitamente), voce in /novita, 2 voci nel dizionario del cerca.
- ✅ **075 APPLICATA da Eli l'8 ago**, subito dopo il deploy. `types/database.ts`: le due colonne erano già state aggiunte **a mano** nei tre blocchi `documents` (la generazione remota richiede il token Supabase, non disponibile qui — eccezione prevista dalla B.1.6), e due fixture dei test (`privacy-pdf`, `pdf/generate`) sono state allineate come sempre.
- tsc+build+502/502 verdi · scan spazi puliti · 075 validata su PG16.

### ✅ 8 ago (4) — [DIFETTO] La rotella si accendeva su TUTTI e tre i tasti del rinvio
Eli: *"quando clicco su posticipa sollecito e clicco 1 settimana, poi mi mostra lo spinner su tutte le opzioni: 1, 2 settimane e 3 giorni"*.
- **CAUSA**: `PosticipaSollecito` teneva **un interruttore solo** (`inCorso`, booleano) e ogni tasto lo leggeva allo stesso modo (`{inCorso ? <Loader2/> : null}`) → toccandone uno si accendevano tutte e tre le rotelle, e per un istante sembrava che l'app stesse facendo tre cose insieme.
- **FIX**: lo stato ora dice **QUALE** azione è in corso (`attesa: number | 'riprendi' | null`) — i giorni scelti, oppure `'riprendi'`. La rotella compare **solo sul tasto toccato**; gli altri restano **disabilitati** (un secondo tocco durante la scrittura scriverebbe due volte) ma fermi. Stesso trattamento per «Riprendi».
- ⚠️ **Regola**: uno stato di caricamento condiviso fra più tasti deve dire quale, non se — altrimenti l'interfaccia racconta un'azione che non è stata chiesta.
- Verificato con Chromium sul componente vero (azione finta, 1,5 s di ritardo): toccando «1 settimana» → **1 sola rotella accesa**, quella giusta, e tutti e tre i tasti disabilitati.
- tsc+build+502/502 verdi · scan spazi puliti.

### ✅ 8 ago (3) — [INCOERENZA] Il numero accanto ai collegamenti non contava quello che apri
Eli: *"in Home i preventivi in scadenza non hanno davanti il numero di quanti ce ne sono, come invece fa la parte di fatture"*.
- **CAUSA**: i due numeretti contavano i documenti **dentro la finestra di preavviso** (073), mentre le due pagine che aprono elencano **tutto ciò che è ancora in attesa**. Nel suo caso: un solo preventivo in attesa, con scadenza il 6 settembre — fuori dai 10 giorni → conteggio **0** → il badge non compariva affatto, mentre la pagina «Preventivi in scadenza» quel preventivo ce l'ha. Le fatture invece ne avevano due dentro la finestra, e il numero si vedeva: da qui l'asimmetria.
- **FIX**: adesso i due numeri contano **esattamente i documenti della pagina di destinazione** (preventivi in attesa · fatture non incassate), meno quelli col sollecito posticipato. ⚠️ Era anche il "residuo pre-esistente" annotato il 7 ago: badge e pagina che dicevano numeri diversi. **Regola**: un numero accanto a un collegamento promette quante cose ci sono dietro — se non torna, tanto vale toglierlo.
- ⚠️ **La finestra di preavviso NON è stata toccata**: continua a decidere quale documento compare nella card (è tutto il senso della 073). Cambia solo il significato del numeretto, che ora è "quanti ne trovi in quella lista".
- tsc+build+502/502 verdi.

### ✅ 8 ago (2) — [DIFETTO] Il badge «Modificato» non spariva condividendo il link
Eli: *"ho fatto «Invia al cliente» copiando il link di un preventivo che aveva il badge modificato, ma il badge non è scomparso. Quando clicco mi deve chiedere se segnarlo come inviato"*.
- **CAUSA**: `updated_after_send_at` (il badge) si azzera **solo** quando l'invio passa dall'app — la route email, il primo invio manuale di una bozza, il rinvio di uno scaduto. Su un documento **già inviato e poi modificato**, il pop-up «Invia al cliente» apriva WhatsApp o copiava il link e **non faceva altro**: per l'app non era partito niente, e il badge restava lì per sempre. Il caso non era coperto perché i due rami esistenti guardano `isDraft` e `isExpired`, e questo non è né l'uno né l'altro.
- **FIX**: dopo aver usato **Copia link / WhatsApp / Altre app** su un documento in quello stato, il pop-up **resta aperto** e chiede di segnarlo come Inviato. ⚠️ Prima il pop-up si chiudeva PRIMA di aprire il canale: ora si chiude solo quando non c'è niente da chiedere, così tornando da WhatsApp si trova la domanda.
- ⚠️ **UN SOLO riquadro di conferma per due casi** (Eli, subito dopo: *"abbiamo già una cosa del genere che chiede se segnarlo come Inviato, teniamo la stessa linea, non voglio cose troppo diverse dentro la app"*). La prima versione era un riquadro **viola** con bottoni «Sì, l'ho mandato / Non ancora»: un secondo modo di chiedere la stessa cosa. Ora il blocco è **lo stesso** della bozza — stesso grigio, stessi bottoni «Non ora / Segna come inviato», stesso toast — e cambia solo la riga che spiega cosa comporta (*«Sparirà l'avviso Modificato»*). Verificato che i colori del riquadro sono identici (`#f7f7f8` / `#e6e6e6`).
- **`registerManualResendAction`** (NUOVA): fa **esattamente** ciò che fa il reinvio via email, meno l'email — scadenza che riparte, eccezione della fattura pagata (copia di cortesia, la scadenza di pagamento non riparte), fattura scaduta che torna `sent`, evento **`resent` in cronologia**. ⚠️ Due strade che portano allo stesso stato devono lasciare il documento identico, altrimenti la cronologia mente su come è andata.
- La domanda compare **solo** se il badge c'è davvero (`isModified`), su preventivi e fatture, mobile e desktop: senza quella condizione si sarebbe chiesto «l'hai mandato?» anche a chi condivide un documento che non ha toccato.
- Verificato con Chromium a 390px sul componente vero: pop-up aperto → «Copia» → la domanda compare col testo giusto, zero sbordi.
- tsc+build+502/502 verdi · scan spazi puliti.

### ✅ 8 ago — POSTICIPA IL SOLLECITO (⚠️ migration 074) + [BUG] l'ordinamento «Scadenza vicina» era rotto dalla paginazione
- **[BUG, causa trovata] «Ordina: Scadenza vicina» dava un ordine senza senso** (Eli, screenshot di tutte e due le pagine): la pagina 1 finiva con documenti *accettati di maggio* e la pagina 2 ricominciava da *scadenze di agosto*. **Causa**: il database ordinava per `expires_at` e paginava a 20, poi un sort in **JavaScript** rimetteva davanti i documenti in attesa e in fondo gli altri — ma agiva **solo sulle 20 righe della pagina corrente**. Era un residuo di quando la lista era unica; la paginazione (4 ago) l'ha reso incoerente, ed era già annotato come "sort di nicchia, accettato" — sbagliato, si vede al primo utilizzo. **Fix**: il riordino JS è stato **rimosso** da entrambe le liste (preventivi e fatture); ordina il database su TUTTO l'archivio. ⚠️ **Regola**: un ordinamento calcolato dopo la paginazione non è un ordinamento — riordina solo la finestra che stai guardando.
- **[FEATURE, ⚠️ migration 074] «Posticipa il sollecito»** (Eli: *"se un preventivo è in scadenza e lo vedo nella Home ma per il momento non voglio mandare il sollecito… altrimenti continuo a vedere sempre e solo quello in Home"*). Nuova colonna `documents.snooze_until`: il documento sparisce dalla sezione «In scadenza» della Home **e dai due conteggi** fino alla data scelta, poi torna da solo. Comando con l'orologio nelle pagine **Preventivi/Fatture in scadenza** (dove Eli l'ha chiesto), con 3 giorni · 1 settimana · 2 settimane, e quando è attivo la card dice *«Sollecito rimandato al 11 ago»* col tasto **Riprendi**.
- ⚠️ **Non tocca `expires_at` e non ha effetti fiscali** — è scritto anche nell'interfaccia (*"La scadenza del documento non cambia: rimandi solo il promemoria"*): il documento resta in tutte le liste, a essere rimandato è il promemoria.
- ⚠️ **La colonna NON è nelle select principali della Home.** Metterla lì avrebbe fatto fallire l'**intera** query prima che la migration fosse applicata, lasciando la Home vuota. C'è invece una **query a sé, tollerante** (`.then(ok, () => [])`): senza colonna torna una lista vuota e l'app si comporta esattamente come prima. Stesso schema nelle due pagine delle scadenze.
- ⚠️ Le due query del documento «più urgente» passano da `limit(1)` a **`limit(10)`**: se il primo è posticipato serve il successivo, e con un solo risultato la sezione sarebbe rimasta vuota.
- ✅ **074 APPLICATA da Eli l'8 ago.** `types/database.ts`: colonna aggiunta **a mano** nei tre blocchi `documents` (la generazione remota richiede il token Supabase, non disponibile qui — eccezione prevista dalla B.1.6). Tolti tutti i client non tipizzati introdotti per aggirarla: azione, query della Home e delle due pagine scadenze sono di nuovo tipizzate. ⚠️ **Due fixture dei test andavano aggiornate** (`privacy-pdf`, `pdf/generate`): costruiscono una riga `documents` completa, e una colonna nuova obbligatoria le rompe — è la stessa cosa che sarebbe successa rigenerando i tipi col CLI.
- **074 VALIDATA su PG16 reale**: colonna a NULL sulle righe esistenti · idempotente al secondo giro (colonna e indice) · posticipando di 3 giorni il filtro della Home restituisce 0 documenti, a rinvio scaduto torna 1 · `expires_at` intatto · indice parziale creato.
- tsc+build+502/502+smoke 28/28 verdi · scan spazi puliti · card verificata con Chromium a 390px nei due stati (chiuso, aperto, rinvio attivo).

### ✅ 7 ago (16) — CERCA UNA FUNZIONE in Altro (decisione Eli: solo funzioni e pagine)
Domanda di Eli (*"avrebbe senso un cerca che aiuti l'artigiano a trovare una funzione?"*) → sua decisione: **solo in Altro**, **solo funzioni e pagine**, spiegato nel tutorial.
- **`lib/app-search.ts`** (NUOVO, PURO, **13 test**, totale 502): dizionario di **33 voci** + `cercaFunzioni()`. ⚠️ **Dizionario scritto a mano, nessuna magia**: i sinonimi sono le parole dell'artigiano — *iban, bonifico, buttato, per sbaglio, impronta, piastrelle, non mi hanno pagato* — non i nostri nomi interni. Un cerca che risponde "niente" alla parola giusta perde la fiducia di chi lo usa e non viene più riaperto: meglio una lista curata che si allarga quando qualcuno dice "ho cercato X e non l'ho trovato".
- ⚠️ **Più parole RESTRINGONO, non allargano**: ogni parola digitata deve trovare riscontro, altrimenti "costo orario" restituirebbe tutto ciò che contiene "costo" — l'opposto di ciò che ci si aspetta. C'è un test che lo verifica confrontando i due insiemi.
- **Niente documenti né clienti** (scelta di Eli): per quelli ci sono già le ricerche dentro Preventivi e Fatture, che sanno filtrare anche per stato. Quando non trova nulla il messaggio **lo dice** e rimanda a quelle ricerche invece di restare muto.
- **Passo nuovo nella guida di «Altro»** (è il primo, prima delle tre card) e voce in /novita. ⚠️ `type="text"` + `inputMode="search"`, non `type="search"`: quest'ultimo fa comparire la X **nativa** del browser accanto alla nostra — due croci affiancate, viste in Chromium.
- **[HOME, richiesta a metà lavoro] «Da incassare» → «Fatture da incassare»**, anche nella card vuota. ⚠️ Ieri l'avevo accorciato proprio perché con «fra 13 giorni · 20 ago» il titoletto andava a capo: ora la riga è `flexWrap` con `marginLeft: auto` sulla scadenza — quando ci stanno restano affiancati («Scaduta»), quando l'etichetta è lunga la scadenza **scende su una riga propria allineata a destra** invece di spezzare il titoletto. Verificato in entrambi i casi, anche in «Testo grande».
- **[SCHEDA PREVENTIVO] «Subtotale» e «Marca da bollo» sembravano DUE VOCI in più** (Eli, foto alla mano): stessa dimensione e stesso colore delle voci, senza nessuno stacco. Ora ci sono **tre livelli**: le voci (scure, 14px), il conteggio (grigio, 13px, sotto un filetto sottile), il totale (nero, grassetto, sopra il filetto forte). Verificato a 390px sui valori reali.
- tsc+build+502/502+smoke 28/28 verdi · scan spazi puliti · verificato con Chromium a 390px.

### ✅ 7 ago (15) — Domande ai professionisti: due liste diverse perché sono a punti diversi
Chiarimento di Eli: il dossier al **commercialista è già partito** (5 ago, con la mail preparata insieme); l'**avvocato non è ancora stato contattato**.
- **`COSE_DA_FARE_ELI.md` §2 riorganizzata di conseguenza.** Commercialista: il dossier è spuntato come **inviato**, e le domande nate dopo NON diventano un nuovo PDF — vanno in una sezione **«Nuove domande» numerate N1, N2…**, da mandare di seguito nella conversazione già aperta (stessa logica delle D1-D40, così può rispondere citando il numero). Avvocato: **lista unica**, tutto quello che si accumula entra nel PDF di settembre — niente distinzione fra dossier e addendum, che non servirebbe a nessuno.
- **Due domande nuove registrate**: **N1** cancellazione di una fattura già emessa (dalla FAQ di stamattina, con i tre sotto-punti); **N2** marca da bollo **sui preventivi** e con **due proposte** — nel forfettario l'app espone i 2 € già sul preventivo che vede il cliente, e da oggi li conta dentro **ciascuna** proposta. Da verificare se il dossier del 5 ago copriva già il primo punto.
- ⚠️ **Regola che vale d'ora in poi**: quando emerge una domanda fiscale, si accoda a §2 come **N-numero** invece di rigenerare il PDF. Un secondo PDF a chi ha già il primo aperto crea solo confusione su quale sia quello buono.
- Nessun codice toccato in questo giro.

### ✅ 7 ago (14) — I collegamenti della Home dicono DOVE portano + Aiuto in due schede
- **[HOME] «Vedi tutti i preventivi» → «Preventivi in scadenza»**, «Vedi tutte le fatture» → **«Fatture in scadenza»**, «Vedi tutta l'agenda» → **«Agenda»** (Eli). ⚠️ Il vantaggio non è di lunghezza: le nuove etichette sono **il titolo della pagina di destinazione** (`/preventivi/scadenze` si chiama davvero «Preventivi in scadenza»), quindi il collegamento promette esattamente ciò che si trova dopo il tocco. Misurato a 390px: tutti e tre su **una riga sola**, anche in «Testo grande», zero sbordi.
- **[AIUTO] Due schede separate** (Eli: "mi piace ci sia il tutorial ma facciamo due schede"): **Aiuto** (contatto diretto + domande frequenti + collegamenti legali) e **Tutorial** (giro guidato del primo accesso + guide delle sezioni). Stesse pillole di Impostazioni e Account, con `replace` sui link così Indietro torna in Altro invece di ripercorrere le schede.
- tsc+build+489/489+smoke 28/28 verdi · scan spazi puliti.

### ✅ 7 ago (13) — FAQ sull'eliminazione dei documenti + una domanda fiscale aperta
- **Due FAQ nuove in `/aiuto`** (richiesta Eli, non c'era nulla sul tema): *«Cosa succede se elimino un preventivo o una fattura?»* (cestino → 15 giorni → cancellazione definitiva; il numero non si riusa e il buco è un'irregolarità solo formale, risposta AdE 505/2020) e *«Posso eliminare una fattura che ho già mandato al cliente?»*. Aggiunta la destinazione `cestino` a `VaiA`.
- **Risposta alla domanda di Eli («le fatture non possono essere eliminate in tutti i casi, giusto?»)**: giusto sul piano fiscale — una fattura **emessa** si corregge con una **nota di credito**, non si cancella, e va conservata 10 anni. ⚠️ **Ma l'app oggi NON lo impedisce**: `deleteDocumentAction` non guarda lo stato, e dal cestino `purgeDeletedDocumentAction` distrugge anche una fattura trasmessa allo SdI, snapshot XML compreso. L'unica protezione è **asimmetrica**: il cron NON purga mai le fatture con `sdi_status` valorizzato (scelta del 25 lug), ma il tocco manuale sì — c'è solo un avviso ambra nel dialog che dice "parlane col commercialista".
- ⚠️ **NON ho cambiato il comportamento**: bloccare la cancellazione di una fattura emessa è una decisione **fiscale**, non un dettaglio di interfaccia, e la regola B.0 dice di non muoversi da soli su queste. Domanda aggiunta a `COSE_DA_FARE_ELI.md` per la prossima consegna al commercialista, con tre punti: bloccare del tutto o basta l'avviso · vale anche senza SdI · conservazione se il cliente rifiuta o non paga.
- La FAQ è scritta di conseguenza: dice che **tecnicamente si può ma non si dovrebbe**, spiega la nota di credito e distingue la **bozza mai inviata** (eliminabile senza pensieri) dal documento emesso.
- tsc+build+489/489 verdi · scan spazi puliti.

### ✅ 7 ago (12) — I due mockup delle proposte + riordino di Account e sicurezza
Entrambi i mockup approvati da Eli ("procedi con entrambi"), più cinque punti suoi.
- **[FORM] La barra Base/Premium non dichiarava fin dove arriva** (Eli: *"non si capisce che cliccando su premium anche la parte sotto cambia"*). Era **dentro** la card delle voci — sembrava comandare quelle — e scorrendo usciva dallo schermo, così margine e riepilogo arrivavano senza sapere di chi fossero. Tre segnali insieme: ① la barra è una **fascia propria** che DICE cosa fa (*«Stai compilando la proposta» · «Voci, margine e totali qui sotto sono quelli della Base»*); ② è **`position: sticky`**, resta a schermo mentre si scorre — il comando non sparisce mai dal campo visivo; ③ ogni sezione governata **si firma**: «Riepilogo · Base», «Margine · Base · solo tu lo vedi». ⚠️ Lo `sticky` va sul contenitore e vuole uno sfondo pieno, altrimenti il testo che scorre si legge attraverso.
- **[SCHEDA] Un blocco chiuso per proposta** (Eli: *"prima deve esserci tutto quello legato alla proposta base, dopo tutto quello della premium"*). ⚠️ **Difetto mio di stamattina**: avevo raggruppato le voci ma lasciato i **due riepiloghi tutti in fondo** → i totali della Base cadevano DOPO le voci della Premium. Ora: voci Base + totali Base, poi voci Premium + totali Premium, ognuno con un filetto colorato a sinistra (oro/viola). **Scelta motivata contro le linguette anche qui**: nel form si *compila* una proposta per volta, sulla scheda si *controlla* — nascondere metà documento costringerebbe a due passaggi proprio quando si confrontano i prezzi.
- **[BUG] Indietro dalle Impostazioni ripercorreva le sezioni** invece di tornare in Altro: le pillole di ieri sono collegamenti, e ogni sezione impilava una voce nella cronologia. Fix: **`replace`** sui link (Impostazioni e Account) — la voce corrente viene sostituita, Indietro torna da dove si è entrati.
- **[ACCOUNT] Tre sezioni al posto di due** (Eli: *"farei una sezione ulteriore account… come è meglio organizzarla?"*): **Account** (indirizzo di accesso · elimina account) · **Sicurezza** (blocco con impronta · esci da tutti i dispositivi) · **Dati** (scarica i tuoi dati · pacchetto e invito commercialista). Ognuna risponde a una domanda diversa — *chi sono*, *come mi proteggo*, *dove sono i miei dati*. ⚠️ **L'email di accesso è uscita da Impostazioni › Generale**: stava fra ragione sociale e indirizzo, ma non è un dato dell'attività. ⚠️ **«Rivedi il tutorial» è andato in cima ad `/aiuto`**: chi cerca un tutorial cerca aiuto, e le due guide restano insieme com'era stato chiesto — da segnalare a Eli, è l'unica scelta che non aveva chiesto esplicitamente.
- **[HOME] Giorni mancanti accanto alla data**: «fra 13 giorni · 20 ago». ⚠️ **Prima i giorni, poi la data, e senza «Scade il»**: quell'etichetta divide la riga col titoletto e con la forma lunga il titoletto andava **a capo su due righe** — misurato a 390px, non dedotto. Per lo stesso motivo «Fattura da incassare» → **«Da incassare»** (che sia una fattura lo dice il numero, «Fatt. 014/2026»). Sulla pagina delle scadenze, dove la riga è tutta sua, resta la forma lunga e ora i giorni compaiono **anche oltre i 7** (prima solo sotto quella soglia).
- **[HOME] La card resta anche quando non c'è nulla in scadenza**: «Nessun preventivo in scadenza» + il collegamento alla lista. Prima spariva e sembrava che i preventivi fossero scomparsi. Se **entrambi** i tipi sono vuoti la sezione non compare: a chi ha appena aperto l'app due riquadri che dicono "niente" non servono.
- **[SCADENZE] Ordine dei canali allineato alla Home**: Email → WhatsApp → Chiama (era Chiama → WhatsApp → Email). Due superfici con gli stessi tre canali in ordine diverso costringono a rileggerli ogni volta.
- tsc+build+489/489+smoke 28/28 verdi · scan spazi puliti · Home e card verificate con Chromium a 390px, anche in «Testo grande», zero sbordi.

### ✅ 7 ago (11) — Impostazioni a pillole, Sicurezza fuori da «Generale», card scadenza ripulita
Cinque punti di Eli in un giro (foto della pagina «Fatture in scadenza»).
- **[IMPOSTAZIONI] Le sezioni sono PILLOLE**, le stesse dei filtri di stato dei preventivi (classi `cc-tabs`/`cc-tab`/`cc-tab-active`), al posto della barra sottolineata su mobile + sidebar su desktop. ⚠️ Non è solo estetica: da `Tabs` di Radix (stato del browser) si passa a **collegamenti veri** `?tab=` → la sezione finisce nell'indirizzo (condivisibile, Indietro coerente) e si carica **solo la sezione aperta** invece di montarle tutte e quattro.
- **[IMPOSTAZIONI] Via la tab «Piano»** (Eli: "c'è già Abbonamento in Altro"): duplicava la pagina vera. `?tab=piano` **reindirizza a `/abbonamento`**, così i vecchi collegamenti non si rompono; `tabs/piano.tsx` eliminato. Corretto anche il sottotitolo desktop, che prometteva "e il piano".
- **[ACCOUNT] «Sicurezza e accesso» spostata da Impostazioni › Generale a `/account`**, che diventa **«Account e sicurezza»** con due sezioni a pillole: **Dati** (scarica dati · commercialista · tutorial · elimina account) e **Sicurezza** (blocco con impronta · esci da tutti i dispositivi). ⚠️ Il motivo non è di gusto: in Generale stanno i dati dell'**attività** (ragione sociale, indirizzo, validità); impronta e sessioni riguardano l'**account**. Rinominati tutti i rimandi (Altro, /aiuto, /novita, /studio, cancella-account, `VaiA`) e aggiunta la destinazione `sicurezza` a `VaiA`.
- **[CARD SCADENZA] «Scaduta» compariva TRE volte** nella stessa card (pillola a sinistra, badge di stato a destra, riga dei giorni sotto). Tolta la pillola: al suo posto **il numero del documento**, e sotto **il cliente** (Eli). L'urgenza resta leggibile dal bordo colorato a sinistra e dal colore della riga di scadenza — nessuna informazione persa. Verificato: da 3 occorrenze a 1 per card.
- ⚠️ **Trappola evitata**: passando `docType` a `formatDocNumber` per l'intestazione («Fatt. 008/2026»), lo stesso valore finiva nel messaggio di sollecito → *"le ricordo il pagamento della fattura **Fatt.** 008/2026"*. Ora ci sono **due forme**: `numLabel` (col marcatore, per l'intestazione) e `numClean` (nudo, dentro i testi dove la parola "fattura" c'è già) — è esattamente il caso descritto in B.3.
- **[COPY] «resta da avere» → «saldo residuo»** (Eli: "è bruttissimo").
- ⚠️ **Domanda aperta di Eli — «metto i giorni e in Home vedo solo le fatture, non i preventivi»**: verificato il codice, **non è un difetto della finestra**. La query dei preventivi della Home filtra `status in (sent, viewed)`, quella delle fatture include anche `expired`. È deliberato: una fattura scaduta va comunque incassata, un preventivo scaduto **non è più accettabile dal cliente** (serve «Riapri»), quindi sollecitarlo non servirebbe. Se i suoi preventivi sono già oltre la data, sono in stato `expired` e non compaiono. **Da confermare con lei** guardando lo stato reale dei suoi preventivi prima di cambiare qualcosa.
- tsc+build+489/489 verdi · scan spazi puliti · card e pillole verificate con Chromium a 390px, zero sbordi.

### ✅ 7 ago (10) — Con più proposte, un totale PER PROPOSTA (Base e Premium separate)
Eli: *"non si capisce se il totale è della proposta base o premium, dovrebbero avere due calcoli separati"*. Aveva ragione, e la causa è di struttura.
- **CAUSA**: con «Proponi più opzioni» attivo il documento porta le voci di **tutte** le proposte, ma i totali salvati in `documents` (`subtotal`/`tax_amount`/`total`) seguono **una sola** — la Base — perché finché il cliente non sceglie è quella che fa fede (decisione del 19 lug, la ★ Consigliata è stata rimossa). Il risultato era **un numero senza etichetta**: nella scheda del preventivo le voci erano già raggruppate per proposta, ma sotto c'era un unico blocco Subtotale/IVA/Totale e una nota che diceva *"i totali qui sotto si riferiscono alla proposta Base"* — cioè si chiedeva al lettore di ricordarselo.
- **`lib/documents/proposte.ts`** (NUOVO, PURO, **11 test**, totale 489): `totaliPerProposta(voci, fiscalOpts)` calcola **una proposta alla volta** con lo stesso motore fiscale del resto dell'app. ⚠️ Mai la somma Base+Premium: sarebbe una cifra che non esiste in nessuno dei due scenari — c'è un test apposta che verifica che quel numero non compaia.
- **Scheda preventivo**: al posto del blocco anonimo, **un riepilogo per proposta** (Subtotale · IVA · Marca da bollo · **Totale Base** / **Totale Premium**), e sotto la riga onesta su cosa succede nel frattempo: *"Il cliente sceglie la proposta dalla sua pagina. Fino ad allora il preventivo vale come **Base**: è la cifra che vedi in Home, nelle liste e nel calcolo dell'acconto"*. Con una proposta sola non cambia nulla (restano i totali salvati sul documento).
- **Form, mentre scrivi**: il riepilogo seguiva già la linguetta aperta ma non lo diceva → ora il titolo è **«Riepilogo — proposta Base»**, il totale **«Totale Base»**, e sotto compare in grigio **«Totale Premium € …»**. Senza, per sapere quanto costa l'altra proposta bisogna cambiare scheda, e il confronto — che è il motivo per cui le proposte esistono — si perde.
- ⚠️ **Due cose trovate dai test, entrambe vere e lasciate come sono**: ① nel **forfettario la marca da bollo va contata su OGNI proposta** (è il documento che il cliente accetterà, non una tassa da dividere) — verificato sopra e sotto la soglia di 77,47 €; ② lo **sconto globale** abbassa entrambe le proposte, ma l'**IVA si calcola per voce sugli importi PRIMA dello sconto** (100 → imponibile 90, IVA 22, totale 112). È esattamente la **domanda D9 aperta col commercialista** ("IVA sullo sconto"): il motore NON si tocca senza quella risposta, e ora c'è un test che fa da campanello se la regola cambia.
- Verificato con Chromium sul componente vero a 390px: «RIEPILOGO — PROPOSTA BASE», «Totale Base € 2.476,60», «Totale Premium € 4.148,90», zero sbordi.
- tsc+build+489/489 verdi · scan spazi puliti.

### ✅ 7 ago (9) — Preavviso scadenze scelto dall'artigiano (⚠️ migration 073) + email al cliente in registro formale
Quattro punti di Eli in un giro.
- **[FEATURE, ⚠️ migration 073] La sezione «In scadenza» non guardava affatto la scadenza.** Eli: *"ho un preventivo che scade tra un mese e compare nella card in scadenza"*. Verificato: la Home prendeva il documento **più urgente** (order by `expires_at`, limit 1) senza chiedersi quanto mancasse — la sezione si chiamava «In scadenza» ma mostrava sempre qualcosa. Ora c'è **`workspaces.scadenza_alert_days`** (default **10**, scelta di Eli; vincolo 1-90) con il campo in **Impostazioni › Generale**, accanto alla validità dei preventivi perché sono la stessa materia. La finestra governa la card, **i due badge di conteggio** e la query DB delle fatture: prima il badge usava 7 giorni fissi. Un documento **senza** data di scadenza non entra più nella sezione (non sta scadendo); resta nelle liste e, su desktop, nella card dei solleciti — che è un'altra cosa (documento *in attesa*, non *in scadenza*) e infatti NON è stata toccata.
- ⚠️ **Due trappole già viste, evitate qui**: ① la scrittura del nuovo campo è condizionata a `formData.get(...) !== null` — l'**onboarding** usa la stessa action senza quel campo e senza la guardia ogni salvataggio di lì avrebbe riportato il preavviso al default *in silenzio* (identico al bug degli ATECO documentato due righe sopra nel file, e al mio dei recapiti SdI di ieri); ② UPDATE **tollerante pre-073** (`isMissingColumnError`): senza colonna si salva comunque tutto il resto — perdere l'indirizzo perché manca una migration sarebbe peggio del non poter cambiare il preavviso.
- **073 VALIDATA su PG16 reale**: default 10 su riga esistente · idempotente al secondo e terzo giro · `0` e `91` respinti dal vincolo, `5` accettato · **il valore scelto sopravvive al rilancio della migration**.
- **[COPY] L'email al cliente dava del LEI e del TU nello stesso messaggio.** Il testo scritto dall'artigiano è formale ("Le faccio avere il link…"), ma le parti del modello no: *"Puoi visualizzare il preventivo online… Da lì puoi anche accettarlo… Per qualsiasi domanda scrivimi a…"*. Tutte portate al Lei. Stessa bonifica sulle **altre due email che arrivano al cliente finale** — `sollecito_cliente` (quella del tasto «Sollecita per mail», che Eli usa dalla Home: diceva *"ti scriviamo per ricordarti… è ancora in attesa di una tua risposta"*) e `preventivo_in_scadenza_cliente` — comprese le righe di piè di pagina. **Non toccate** le email della vetrina (`marketplace_*`): lì chi scrive è Carta Canta a un consumatore, non l'artigiano al suo cliente.
- **[DIFETTO trovato mentre ci lavoravo] «Cordiali saluti» compariva DUE volte** nella stessa email: una nel testo suggerito (che finisce con la firma) e una aggiunta dal modello in fondo. Tolta quella del modello — la firma è di chi scrive. Verificato renderizzando il componente vero: da 2 occorrenze a 1.
- **[UI] Numero e cliente nella card «In scadenza» più chiari** (Eli: "meno vistosi"): passano a `var(--cc-muted)`, l'importo resta più scuro. La **variabile** e non il letterale, così in "Testo grande" si scurisce da sola.
- ✅ **073 APPLICATA da Eli il 7 ago.** `types/database.ts`: la generazione remota (`npx supabase gen types`) **non è disponibile nell'ambiente di lavoro** (serve il token di accesso Supabase) → colonna aggiunta **a mano** nei tre blocchi `workspaces` (Row/Insert/Update), che è l'eccezione prevista dalla B.1.6. Tolto il client non tipizzato: l'UPDATE è di nuovo tipizzato. ⚠️ Alla prossima rigenerazione vera l'aggiunta manuale sparisce da sé (è identica a ciò che genererebbe il CLI).
- ⚠️ **Residuo pre-esistente annotato**: `/preventivi/scadenze` elenca **tutti** i preventivi in attesa, non solo quelli dentro la finestra → il badge può dire "3" e la pagina mostrarne 10. Non è una regressione (il badge era a 7 giorni fissi e la pagina già faceva così), ma ora che la finestra è configurabile lo scarto si nota di più.
- tsc+build+478/478+smoke 28/28 verdi · scan spazi puliti · 073 validata su PG16.

### ✅ 7 ago (8) — [ALTA, sicurezza] La HOME era RAGGIUNGIBILE per qualche secondo prima dell'impronta
Segnalazione di Eli da un telefono con connessione lenta: *"mi è apparsa la schermata di accesso con impronta ma non mi ha chiesto l'impronta, è andato diretto alla home dove ho potuto scorrere su e giù la pagina. Dopo poco (3/4 secondi) la app ha caricato da sola la pagina di accesso e me l'ha chiesta"*. **Bug vero, ed era mio**: causa trovata, riprodotta e chiusa.
- **CAUSA: il velo anti-lampo si toglieva DA SOLO dopo 8 secondi.** `LockVeil` (4 ago) copre la pagina con uno script inline prima del primo disegno, perché `AppLock` decide in `useLayoutEffect` — cioè dopo l'idratazione, quando l'HTML della Home è già dipinto. Ci avevo messo un "paracadute": dopo 8s toglieva la classe `cc-locked` *"se React non parte, l'app non resta dietro un velo navy per sempre"*. Ma **`AppLock` è un FRATELLO di `{children}`, non il loro contenitore**: l'HTML della Home sta sempre nel DOM, quindi togliere il velo non "libera l'app", la **SCOPRE**. Su rete lenta il pacchetto JS arriva dopo gli 8 secondi → finestra in cui la Home è visibile e scorrevole **senza che nessuno abbia chiesto l'impronta**.
- **Riprodotto in Chromium** (script inline VERO estratto da `LockVeil.tsx` + regole CSS VERE da `globals.css`, idratazione simulata a 12s): `t=9s → velo:no lucchetto:no HOME VISIBILE: ⚠️ SÌ` — esattamente il racconto di Eli.
- **FIX: il paracadute ora FALLISCE CHIUSO.** Dopo 10s, se il vero lucchetto non è ancora arrivato, l'app **resta coperta** e dentro il velo compare *"Connessione lenta — Sto ancora caricando il blocco dell'app. I tuoi dati restano coperti"* con il tasto **Riprova** (`location.reload()`). Il velo lo toglie **solo `AppLock`**, quando prende il suo posto. `AppLock` ora rimuove anche il nodo dell'avviso, altrimenti resterebbe sopra il lucchetto appena montato.
- Riverificato: `t=1/5/9s → HOME VISIBILE: no` · `t=11s` avviso presente e leggibile (unico figlio del body visibile sotto `cc-locked`), bottone realmente cliccabile (nessun velo sopra) · `t=13s` lucchetto vero.
- ⚠️ **REGOLA: un velo di sicurezza non si toglie mai da solo.** Se il timer scade, si spiega all'utente perché e gli si dà un modo per riprovare: meglio un utente che ricarica di un utente che si trova scoperti i propri dati e quelli dei suoi clienti. Vale per qualunque schermo protettivo, non solo per questo.
- Verificato che velo, `AppLock` e `lib/biometric/local.ts` sono ancora **gemelli** (chiavi `cc_lock`/`cc_biometric`/`cc_biometric_timeout`/`cc_biometric_active`, default 15 min, valori ammessi `[0,15,60,1440]`, grazia `cc_lock_nav` 5 min): la divergenza era l'altro modo noto di far comparire il lampo, e non c'è.
- tsc+build+478/478+smoke 28/28 verdi · scan spazi pulito.

### ✅ 7 ago (7) — Riscritto l'avviso «Modificato» + collegamenti sotto la propria card
- **[COPY] L'avviso era un rompicapo in tre proposizioni** (Eli: "questa frase è fatta male"): *"Modificato dopo l'invio — non ancora reinviato / Aggiornato il 19 luglio 2026 alle ore 08:15. Chi riapre il link vede già la versione nuova, ma il cliente non è stato avvisato: se l'aveva letto prima, ha in mente i numeri vecchi. Reinvialo per essere sicuro."* Difetti: il titolo diceva due volte la stessa cosa; la data burocratica con "alle ore" e l'anno; tre subordinate con un'ipotesi in mezzo; e la chiusa "per essere sicuro" non diceva sicuro di cosa. Riscritto in **fatto → conseguenza → azione**: titolo **«Modificato — il cliente non lo sa»**, corpo *"L'hai aggiornato il 19 luglio alle 08:15, dopo averglielo mandato. Se riapre il link trova già i numeri nuovi, ma nessuno l'ha avvisato: **rimandaglielo**."* Da ~45 a ~30 parole. ⚠️ Cambiato **in tutti e tre i punti insieme** (preventivo mobile, preventivo desktop, fattura, con la concordanza al femminile) — è la regola imparata due giri fa.
- **[HOME] Ogni collegamento sotto LA SUA card** (richiesta Eli): «Vedi tutti i preventivi» sotto la card del preventivo, «Vedi tutte le fatture» sotto quella della fattura. Prima erano tutti e due in fondo, staccati dai documenti a cui si riferiscono: per capire quale portava dove bisognava leggerli. Verificato con Chromium a 390px l'ordine reale sullo schermo.
- tsc+build+478/478 verdi · scan spazi pulito.

### ✅ 7 ago (6) — HOME a sezioni riconoscibili + GUIDE DI SEZIONE (mini-tutorial per pagina)
Due richieste di Eli nello stesso giro.
- **[HOME, mockup approvato] «In scadenza» non si distingueva dalle KPI.** Dopo la card scendevano **quattro riquadri bianchi a due a due** (i tasti Preventivi/Fatture, poi le due KPI): stessa forma, stesso colore, nessun segnale di dove finisse la sezione. E le KPI erano **l'unica sezione della Home senza titoletto**, quindi si leggevano come la coda di quella sopra. Fix: i due tasti diventano **collegamenti leggeri** ("Vedi tutti i preventivi →") perché sono navigazione, non contenuto; le KPI prendono il titoletto **«Questo mese»** e il mese sparisce da dentro le due card (lo diceva due volte).
- **[FEATURE] Guide di sezione** (Eli: *"mini tutorial per ogni parte più importante tipo per Altro… e poi lo può rivedere insieme all'altro tutorial"*). Il tour di primo accesso insegna UNA cosa (fare e mandare un preventivo) e si ferma lì, ma metà dell'app vive dietro «Altro» e chi ci entra trova 18 voci senza sapere quali gli servano. **`components/tour/section-tours.ts`** (definizioni) + **`SectionTourController`/`SectionTourLoader`**: la guida si apre **da sola alla prima visita** della sezione, **una volta sola per dispositivo** (localStorage, sopravvive alla chiusura dell'app), e si rivede da **Account e dati** dentro la stessa card di «Rivedi il tutorial» — insieme, perché chi cerca aiuto cerca "il tutorial" e non sa che ce n'è più d'uno.
- Fatte **Altro** (3 passi: il lavoro di ogni giorno · gli strumenti · impostazioni e dati) e **Bilancio** (2 passi: i KPI sono movimenti VERI di cassa · Mese/Anno). Aggiungerne altre = una voce nel file più un `data-tour` sull'elemento.
- ⚠️ **Tre paracadute**: mai sopra un altro tour (`driver-active` sul body); il segno "già vista" si scrive **solo quando la guida parte davvero**, così se la pagina non si è caricata ci riprova invece di darla per vista; driver.js si scarica **solo se la guida serve** (il controllo sta nel Loader, non nel Controller, altrimenti il pacchetto arriverebbe a ogni cambio pagina).
- Verificato con Chromium sul controller vero, 6 controlli: prima visita parte da sola · i 3 passi scorrono con "1 di 3" · alla fine si chiude · **seconda visita NON riparte** · il rilancio esplicito riparte · la richiesta si consuma. ⚠️ Il clic sul bottone sembrava intercettato dall'overlay: era il **banco di prova senza il CSS di driver.js** (esbuild lo emette in un file a parte) — col foglio di stile il clic reale funziona.
- tsc+build+478/478 verdi · scan spazi pulito · voce in /novita.

### ✅ 7 ago (5) — Il preventivo MODIFICATO non lo diceva su MOBILE + due testi che dicevano il falso
Eli: *"nella Home c'era un preventivo modificato, l'ho aperto e c'era solo il badge Visto, nessun riferimento alla modifica"*. Segnalazione giusta, e tirando il filo ne sono usciti tre problemi.
- **[DIFETTO] Il banner «modificato» del PREVENTIVO era `hidden lg:flex`, cioè solo desktop.** L'app si usa dal telefono: la Home avvisava, il documento no. La fattura invece ce l'aveva già su entrambi (spostato in alto il 3 ago). Aggiunto il banner mobile, nella riga di stato sotto il badge.
- **[TESTO FALSO, fattura] "Il cliente ha ancora la versione precedente"** — è il contrario del vero. Verificato: la pagina pubblica `/p/[token]` legge il documento **VIVO** e non esiste alcuno snapshot del contenuto (`template_snapshot` congela solo l'aspetto). Chi riapre il link vede subito i numeri nuovi.
- **[TESTO FALSO, mio di stamattina] Il pannellino ⓘ in Home** diceva *"Il cliente vede ancora la versione vecchia"*: stesso errore, scritto da me poche ore prima. ⚠️ **La verità è più sottile e va detta così**: chi riapre il link vede già la versione nuova, ma il cliente **non è stato avvisato** — se l'aveva letto prima sta ragionando sui numeri vecchi. È questo il motivo per cui va reinviato, non il fatto che veda una copia stantia.
- ⚠️ REGOLA: quando lo stesso concetto compare in più punti (Home, preventivo, fattura), i testi vanno verificati **insieme** — qui tre superfici dicevano tre cose diverse e due erano sbagliate.

### ✅ 7 ago (4) — CARD "IN SCADENZA" ridisegnata (Eli: "poco elegante, confusionario")
Mockup di confronto mandato in chat e approvato ("vai"). Il problema non era l'oro (già ridotto nel giro precedente) ma la **struttura**: una card sola con **tre divisori interni** = quattro zone impilate, che si legge come un elenco denso invece che come una card.
- **Due card SEPARATE, una per documento**, al posto dei divisori. ⚠️ Il punto vero: i due blocchi hanno per forza forma diversa — chi non ha l'email del cliente non ha il bottone «Sollecita» — e dentro un unico riquadro quella differenza **sembrava un errore** (nella schermata di Eli il blocco preventivo finiva col riquadro viola e senza bottoni). Separati, sono semplicemente due cose distinte.
- **Etichetta e scadenza sulla STESSA riga** (titoletto grigio a sinistra, scadenza oro a destra): una riga in meno e la scadenza — l'informazione per cui la card esiste — si legge subito invece di finire terza sotto l'importo.
- **L'avviso «Modificato» da blocco pieno a riga sottile**: il riquadro viola a tutta larghezza pesava più della scadenza e portava un terzo colore in una card che ne ha già due.
- **Etichette di scadenza accorciate** (`scadenzaLabel` in dashboard/page.tsx): "Oltre la scadenza — da incassare" → **"Scaduta"**, "Da incassare entro domani" → "Scade domani". ⚠️ Ora stanno su una riga condivisa e allineate a destra senza andare a capo: una etichetta lunga schiaccerebbe il titoletto. Il tipo di documento lo dice già il titoletto a sinistra.
- Verificato con Chromium a 390px sul componente vero: zero sbordi, sezione da 322px (prima ~470), il caso "preventivo senza recapiti" non sembra più monco.
- **[7 ago, secondo giro] «Modificato — cliente non aggiornato» → «Modificato» + punto ⓘ.** Eli: *"per un nuovo utente non è chiaro"*. Aveva ragione: quella frase presuppone di sapere che il cliente vede una COPIA del documento al momento dell'invio. Ora resta la parola corta e la spiegazione si apre col tocco sul ⓘ, **stesso schema della card SdI** (che Eli aveva già approvato il 2 ago): cosa vuol dire, cosa vede il cliente adesso, e cosa fare (rimandarglielo). ⚠️ `stopPropagation` sul contenitore: il blocco è cliccabile e senza quello il tocco sul ⓘ avrebbe aperto il documento invece della spiegazione — verificato con Chromium (6 controlli: c'è, parte chiusa, si apre, non naviga via, si richiude, zero sbordi).

### ✅ 7 ago (3) — Numeri STRANIERI su WhatsApp + meno oro nella card "In scadenza"
- **[DIFETTO] WhatsApp con un cliente straniero.** `wa.me` legge SEMPRE il numero come internazionale: un mobile svizzero salvato all'italiana ("079 123 45 67") diventa un indirizzo inesistente e il bottone porta a una pagina d'errore **davanti al cliente**. La regola giusta esisteva già dal 3 ago ma era **inline dentro `RequestRow`**, e la card «Chiedi una recensione» usava un controllo più debole. Estratta in **`whatsappUtilizzabile()`** (`lib/whatsapp.ts`), ora usata da entrambe: passa solo chi ha il **prefisso internazionale esplicito** (`+41`, `0041` — quindi qualsiasi paese è coperto) o un **mobile italiano** `3xx`. Fissi italiani e stranieri senza prefisso: niente bottone WhatsApp, restano Chiama/Email/Copia. **+7 test** (`tests/unit/shared/whatsapp.test.ts`, 478 totali) con i casi CH/FR/DE.
- **[UI, richiesta Eli] Troppo oro nella card "In scadenza"**: erano in oro l'etichetta di categoria, la scadenza E la pillola col conteggio — tre accenti che si contendevano l'occhio. Ridotto a **due, con una gerarchia**: resta oro la **scadenza** (è l'urgenza, la ragione per cui la card esiste) e il **bordo di «Sollecita per mail»** (è l'azione). L'etichetta di categoria passa al grigio dei titoletti, la pillola del conteggio diventa neutra. ⚠️ REGOLA: l'oro segnala **urgenza o azione**, mai un'etichetta o un dato neutro. Verificato con Chromium censendo tutti i colori calcolati della card.

### ✅ 7 ago (2) — «CHIEDI UNA RECENSIONE» + il branch che non arrivava in produzione
- **⚠️ LA CAUSA di "non vedo le modifiche": 10 commit erano fermi sul branch.** `master` era ancora a `ada654d` (verifica P.IVA, 5 ago): Vercel pubblica da master, quindi niente di quanto fatto il 6-7 agosto era online — Eli stava collaudando la versione vecchia. **Decisione di Eli (7 ago): "quando fai modifiche mandale sempre su master"** → da ora il lavoro si fonde e si pubblica su master a fine di ogni giro, non resta sul branch.
- **[ALTA — bug mio di ieri, trovato ricontrollando] Il recapito elettronico del cliente si cancellava da solo.** La sezione "Fattura elettronica" della scheda cliente compare solo con la P.IVA valorizzata, e la condizione legge il campo MENTRE si scrive; i due input erano `defaultValue` (non controllati). Appena la sezione spariva — bastava correggere una cifra della P.IVA, o un cliente col solo codice fiscale — il form non mandava più `codice_destinatario`/`pec` e l'update li scriveva `null`. Salvare la scheda per cambiare un telefono cancellava il recapito, in silenzio; si sarebbe scoperto alla fattura non recapitata. Fix: stato controllato + campi nascosti a sezione chiusa (stesso schema dello sconto nel FatturaForm).
- **[FEATURE] «Chiedi una recensione»** sulla fattura saldata: card con WhatsApp / Email / Copia testo e il messaggio già scritto col link dentro. **Perché serviva**: il riquadro per recensire compare sul link pubblico solo DOPO il saldo, quando il cliente quel link l'ha già chiuso, e **nessuna email lo avvisava** (verificato: nessun template parla di recensioni) → funzione viva nel codice e morta nella realtà. **Perché MANUALE**: la ricerca dice che WhatsApp converte molto più dell'email e che l'invito va mandato subito dopo il lavoro, ma un'email automatica al cliente FINALE è fra le cose bloccate dalla regola B.0 → il testo lo scrive l'app, a mandarlo è l'artigiano. Compare solo con **vetrina pubblicata** (senza, la recensione la leggerebbe solo lui). Verificato con Chromium a 390px: numero italiano normalizzato (3331234567 → 393331234567), tre bottoni su una riga, caso senza recapiti = solo "Copia testo", zero sbordi.
- tsc+build+471/471+smoke 28/28 verdi · scan spazi pulito · voce in /novita.

### ✅ 7 ago — COLLAUDO DI ELI (test A1) + 4 feedback: 1 difetto, 1 falso allarme, 2 rifiniture
Dai passi 1-4 del test A1 fatti da Eli dal telefono e dai suoi screenshot.
- **[DIFETTO] Messaggio da programmatore in faccia all'utente**: "Segna pagata" su una fattura già pagata rispondeva `Transizione da "accepted" a "accepted" non consentita` — nomi interni degli stati e la parola "transizione". La causa più comune è banale (doppio tocco, o pagina rimasta indietro) e si risolve ricaricando, ma il messaggio non lo diceva. Nuovo **`lib/documents/transizioni.ts`**: traduce ogni rifiuto, con un caso dedicato per "risulta già pagata / già annullata" e il rimando all'azione giusta. Cablato su entrambe le route di stato. ⚠️ **REGOLA: nessun messaggio mostrato all'utente contiene i nomi tecnici degli stati.**
- **[DOPPIONE in cronologia] Al saldo comparivano DUE righe** nello stesso minuto: "Pagata — fattura saldata" (derivata dallo stato) e "Saldo ricevuto di 312,50 €" (dal log). Ora sulle fatture l'evento derivato si sopprime se il log ha già un `payment` di kind `saldo` — si tiene quello del log, che porta anche l'importo. **Verificato con Chromium sul componente vero**, compreso il controcaso: una fattura VECCHIA senza log incassi mantiene la riga derivata (non perde il saldo).
- **[FALSO ANNUNCIO] "Il cliente può lasciarti una recensione" compariva anche a vetrina SPENTA.** La recensione si può lasciare comunque, ma finché il profilo non è pubblicato non la vede nessuno: era una promessa vuota. Ora l'hint compare **solo con `enabled && published_at`** (le stesse due condizioni di `/professionisti/[id]`), accorciato e con il **collegamento** a `/recensioni` al posto delle istruzioni scritte (Eli: "non mi piacciono frasi così lunghe, piuttosto mettiamo il link").
- **[DOMANDA→FEATURE] "Dove vedo l'incasso effettivamente azzerato?"** Da nessuna parte: sulla fattura saldata l'importo incassato non compariva (solo la pillola verde "Pagata"), quindi azzerandolo non spariva niente di visibile. Aggiunta la riga **"Incassato € X il GG/MM/AAAA"** sulle fatture pagate: c'è finché l'incasso c'è, sparisce quando lo azzeri.
- **[FEEDBACK] Percentuale totale del ricarico nel riepilogo**: il riquadro esisteva (`MargineBox`, euro + % complessiva) ma era montato solo sul preventivo → aggiunto anche al **FatturaForm**. 🔒 Resta privato.
- **[SdI, passo (a) dei due proposti] Codice destinatario e PEC anche nella scheda del cliente in rubrica**, non solo dalla card SdI a fattura già pronta. Compaiono solo se il cliente ha una P.IVA. Un valore malformato viene **scartato con avviso** invece che salvato: un codice sbagliato fa accettare la fattura senza recapitarla, e l'errore si scopre solo quando il cliente si lamenta. ⚠️ Le due scritture passano da un client non tipizzato: **`types/database.ts` va rigenerato dopo la 044** (regola B.1.6).
- **Non era un bug**: dopo il salvataggio di una bozza si torna alla lista (il pop-up mostra il numero assegnato) — è voluto e il preventivo fa lo stesso. Corretta la riga A1.3 della checklist, che diceva di restare sulla bozza.
- **Risposte date**: l'addebito OpenAI di 6,10 $ = 5 $ di credito + 22% IVA (ricarica minima del 9 lug, non un abbonamento) · i **buchi di numerazione** sono una violazione meramente formale non sanzionabile e non vanno comunicati a nessuno (risposta AdE 505/2020) · **Aruba** non manda la copia di cortesia in automatico per forza: è una spunta per cliente in anagrafica.
- tsc+build+471/471 verdi · scan spazi pulito.

### ✅ 6 ago (3) — FOTO INGRANDIBILI OVUNQUE (richiesta Eli): un solo comportamento in 5 superfici
Eli: *"ogni volta che ci sono delle foto allegate, lato artigiano o cliente, voglio che siano cliccabili, che si ingrandiscano in un pop-up e poi tornino piccole dopo aver ricliccato sopra"*. Prima l'ingrandimento esisteva **solo** sulla pagina pubblica del documento (4 ago): in tutti gli altri posti le foto erano miniature morte — comprese quelle del **rapportino che il cliente FIRMA**, dove servono da prova.
- **`components/shared/PhotoLightbox.tsx`** (NUOVO): hook `usePhotoLightbox(photos)` → `{ openPhoto, lightbox }` + `<ZoomHotspot>`. ⚠️ Il comportamento vive in UN posto solo: cinque copie sarebbero diventate cinque comportamenti diversi entro tre mesi. Si chiude in tutti i modi che una persona prova d'istinto: tocco sulla foto, tocco sullo sfondo, ✕, Esc. Portal su `document.body` (regola: `position: fixed` non basta, un antenato con transform/zoom lo ritaglierebbe), scroll di fondo bloccato, e `maxHeight: calc(86dvh / var(--cc-zoom,1))` perché in "Testo grande" un 86dvh secco varrebbe il 15% in più dello schermo vero.
- **`components/public/PhotoGallery.tsx`**: la card "Il lavoro in foto" del cliente, spostata da `app/p/[token]/_components/` e ora **condivisa da `/p` e `/r`** — è la stessa persona che guarda le stesse foto, non devono comportarsi in modo diverso.
- **5 superfici coperte**: card «Foto lavoro» (`WorkPhotosCard` — da sola vale preventivo, fattura, lavoro, sopralluogo e LavoroForm) · foto allegate dal form del preventivo · foto del sopralluogo · pagina pubblica del documento · **rapportino da firmare**.
- ⚠️ **`ZoomHotspot` è un FRATELLO dei controlli sovrapposti, non il loro contenitore**: un `<button>` dentro un altro `<button>` è HTML non valido. Sta come primo figlio della miniatura a `zIndex 1`; etichetta/✕/occhio salgono a `zIndex 2` e restano cliccabili al loro posto.
- **Verificato con Chromium sui componenti VERI a 390px** (9 controlli su `WorkPhotosCard` + 4 sulla card del cliente): la foto toccata è quella che si apre (indice giusto, non sempre la prima), il ri-tocco chiude, Esc chiude, il tocco sull'etichetta cambia PRIMA→DOPO **senza** ingrandire, il tocco sull'occhio non ingrandisce, scroll di fondo bloccato, zero sbordi. In **Testo grande**: velo 390×780 esatto sul viewport, foto dentro lo schermo.
- Non toccate le **firme** (`signature_image`, `report_signature_image`): non sono foto allegate ma prove già leggibili a dimensione piena. Si può aggiungere se Eli lo chiede.
- tsc+build+471/471 verdi · scan spazi pulito · voce in /novita.

### ✅ 6 ago (2) — RICONTROLLO del giro di pulizia (Eli "ricontrolla tutto"): revisore fresco, 7 finding, tutti chiusi
Eli ha applicato il blocco di hardening corretto → **migration 001-072 ora TUTTE applicate per intero**. Il revisore adversariale sul diff completo ha confermato pulite le parti che contavano (i "90 giorni" e i "12 mesi" della privacy VERI end-to-end fino al cron col service_role; PostHog davvero gated sul consenso, banner con Rifiuta pari ad Accetta, `CookiePreferencesLink` davvero montato nel layout delle legali; migration 072 corretta e idempotente; travaso CLAUDE→STORICO senza perdite, verificato riga-per-riga con `comm`; zero pixel pubblicitari; zero dati sensibili residui) e ha trovato 7 cose vere, tutte sistemate:
- **[MEDIA] "Sentry — UE" nell'informativa era un'affermazione NON verificabile**, e il codice suggerisce il contrario (`next.config.ts` allarga la CSP proprio per coprire l'ingest `*.us.sentry.io`; la sede di Sentry è USA). Regola B.0: a parità di alternative la più difendibile → **Sentry dichiarato USA** in via prudenziale + verifica chiesta a Eli. **Esito della verifica (stesso giorno): il pannello dice "Data Storage Region: EU"** → informativa aggiornata a "UE (server in Europa; società USA)", con la precisazione in §6 che le garanzie coprono l'eventuale accesso dalla casa madre. ⚠️ Il DSN su Vercel non mostra la sigla `de`: fa fede il pannello, ma se un giorno gli errori non arrivassero più, ricontrollare che il DSN sia quello dell'org EU (nota in COSE_DA_FARE_ELI §2).
- **[MEDIA] "Stato migration" indicava "righe 61-71" della 072** — sbagliate (il blocco vero era a 71-83) e comunque fragili: un riferimento a righe invecchia al primo edit. ⚠️ REGOLA: per rilanciare una migration si rilancia **il file intero** (sono tutte idempotenti), mai un intervallo di righe.
- **[MEDIA] Il "Backlog residuo" era sopravvissuto al taglio con dentro il falso**: "migration 056 da applicare" (applicata dal 20 lug — contraddiceva la sezione migration 20 righe sopra), "SdI: registrazione+chiavi sandbox da fare" (sandbox collaudata il 22-23 lug), un rimando a un handoff che il consolidamento stesso aveva spostato. Riscritto: ora rimanda a `COSE_DA_FARE_ELI.md` come lista viva.
- **[BASSE]** Numeri del handoff imprecisi (righe finali ~1.220, non 1.212; file spostati **30** — 17 radice + 1 mockup + 9 gdpr + 3 sdi — non 23: il commit resta col numero sbagliato, la correzione è qui); footer di `DESIGN_TOKENS.md` che ancora diceva "il mockup è la verità al pixel" citando un file archiviato (in contraddizione con l'header appena riscritto); commento in `dashboard/page.tsx` che citava `REVISIONE_UI.md` archiviato; privacy §4 "stesso dispositivo" → "stessa provenienza" (l'impronta è dell'IP: stessa rete ≠ stesso dispositivo) e "cifrata" → "non reversibile" (è un hash salato).
- Nella sezione migration ora ci sono anche le **date di applicazione** di 069-072 (finding: vivevano solo nella chat).
- tsc+build+471/471+smoke 28/28 verdi · scan spazi pulito.

### ✅ 5 ago (13) — RI-REVIEW dell'archivio privato foto (richiesta Eli "ricontrolla"): 2 bug dei TEAM chiusi
Rilettura del mio stesso lavoro sulla 068, cercando il caso limite che avevo coperto solo a metà.
- **[ALTA nei team] Le miniature nell'app sarebbero state VUOTE per i collaboratori**: `WorkPhotosCard` e `SopralluogoForm` firmavano le foto dal CLIENT del browser, ma la policy 068 dà accesso solo alla PROPRIA cartella — un collaboratore che apre un documento del titolare non può firmare foto nella cartella `{titolare_id}/`. Fix: le pagine (preventivi/[id], fatture/[id], lavori/[id], sopralluoghi/[id]) firmano le foto GIÀ presenti con l'**admin** e le passano come **seed** a `useSignedPhotos(paths, seed)`; il client firma solo i percorsi NON nel seed (= le foto appena caricate, nella propria cartella). Verificato con Chromium sull'hook reale: foto `owner/` dal seed server, foto `me/` dal client.
- **[MEDIA nei team] Estrazione AI dalle foto MUTA per i collaboratori**: `/api/ai/extract-photos` scaricava le foto col client di sessione → con l'archivio privato un collaboratore non poteva leggere le foto del titolare (`download` → null → `continue` silenzioso → "tutte voci a 0"). Fix: download con l'**admin** (l'accesso al documento è già verificato = no IDOR).
- **Verificati PULITI**: cron purge (`expire-documents`) e cancellazione account usano già l'admin (remove funziona su bucket privato); `PreventivoForm` create firma dal client ma sono sempre foto proprie (create mode); i due PDF e le pagine pubbliche `/p`,`/r` già firmano con admin; nessun `object/public/work-photos` residuo.
- tsc+build+456/456+smoke 28/28 verdi.

### ✅ 5 ago (14) — QUARTO GIRO (Eli "ricontrolla tutto") sul lavoro serale: 2 ALTE + 3 MEDIE, tutte fixate
Due revisori freschi su registro eventi/export guard e job file orfani/privacy. **La modalità di prova ha salvato i loghi.**
- **[ALTA] Il job orfani avrebbe cancellato TUTTI i loghi in uso**: `logo_url` porta il cache-buster `?v=timestamp` (uploadLogo) e l'estrazione del percorso se lo teneva attaccato → nessun logo combaciava mai col file nel bucket → ogni logo attivo = orfano maturo. Il test era verde perché usava un URL SENZA `?v=` (formato inesistente in produzione). Fix: `logoPathFromUrl` (strip query/fragment + decodeURIComponent) + test sull'URL reale. **Gemello pre-esistente in account.ts**: la cancellazione account rimuoveva il logo col nome sporco di `?v=` → remove non rimuoveva nulla, in silenzio. ⚠️ REGOLA: i test sui formati devono usare il formato REALE di produzione, non uno idealizzato.
- **[ALTA] Il cron orfani non sarebbe MAI partito**: leggeva `?secret=` in query, ma Vercel Cron manda `Authorization: Bearer` (come gli altri due cron). Ogni giro → 401, e zero eventi nel registro si sarebbe letto come "zero orfani" invece che "job morto". Fix: header come i gemelli.
- **[MEDIA] Punto cieco del captcha nel registro**: oltre la soglia, ogni tentativo senza captcha usciva PRIMA di logSecurityEvent → un attacco insistito spariva dal registro dopo i primi 3 fallimenti. Ora anche quel ramo scrive `login_failed` con `motivo: 'captcha'`.
- **[MEDIA] Esfiltrazione dalla porta accanto**: le route XML PER-DOCUMENTO (studio + artigiano) non avevano né freno né traccia — iterando gli id si scaricava l'intero archivio fiscale un XML alla volta aggirando il tetto export. Ora `guardExport` con limit 60/h e contatore separato (`keyPrefix: 'xmldoc'` — un tetto diverso non deve condividere il conteggio col 10/h degli export).
- **[MEDIA] Sale muto**: senza SECURITY_EVENT_SALT l'impronta IP non si salva ma nessuno lo diceva → console.warn una-tantum in produzione + riga in COSE_DA_FARE_ELI §0-ter.
- **Cablati `sdi_sent` (route SdI, dopo recordSdiUse) e `studio_access` (pagina /studio/[workspaceId])** che erano dichiarati ma mai emessi; hardening appeso alla 072 (REVOKE EXECUTE sulle 2 purge da public/anon/authenticated + `pg_temp` nel search_path — validato su PG16: anon negato, owner ok, idempotente); `login_ok` usa l'utente della risposta di signInWithPassword (via un giro di rete dal percorso più caldo).
- **Verificati PULITI dai revisori**: regex 072 vs OGNI meta scritto (nessun valore legittimo bloccato); GRANT 071 = pattern stripe_webhook_events (service_role sui default privileges); FK e cancellazione account (workspace scrubbed, non deleted → eventi sopravvivono); posizione login_failed vs rate limit; nessun evento doppio; path foto identici all'upload in tutti i punti di scrittura; fail-closed reale dei riferimenti; created_at/id null confermati nei tipi del SDK; grazia 7gg regge la concorrenza; timeout a metà non lascia stato incoerente.
- **Accettati/annotati**: registro senza tetto proprio sotto flood (bounded dai 90 giorni); guard bilancio prima del gate di piano (si vede anche il tentativo di un Free); listing sequenziale >60s verso i 1000 utenti (limite di crescita annotato nel modulo); test guardExport/logSecurityEvent deferred.
- tsc+build+471/471+smoke 28/28 verdi · scan puliti · 072 rivalidata su PG16 con l'hardening.

### ✅ 5 ago (13) — TERZO GIRO di revisione (Eli "ricontrolla ancora una volta"): 1 ALTA vera + 9 fix (⚠️ migration 069 e 070 DA APPLICARE)
Due revisori freschi su tutto il lavoro di sicurezza della giornata. **Il finding principale ribalta l'esito del giro precedente.**
- **[ALTA — la 068 NON aveva chiuso l'archivio foto] La policy della 041 (`"Work photos are publicly readable"`, `FOR SELECT TO public`) non era mai stata rimossa.** In PostgreSQL le policy permissive si sommano in **OR**: finché quella c'era, la policy "solo la tua cartella" della 068 non restringeva NULLA. Il flag `public = false` chiude solo `/object/public` (ed è per questo che il collaudo sembrava a posto); gli altri canali dello storage autorizzano via **RLS col JWT del chiamante**, e la anon key è pubblica per costruzione → con quella si poteva `/object/list` (**sfogliare l'elenco di tutte le cartelle**), `/object/sign` (**farsi firmare** qualsiasi foto) e scaricare. Cioè le foto di cantiere di TUTTI gli artigiani, senza account — e peggio di prima, perché prima serviva indovinare il path casuale. **⚠️ migration 069** (VALIDATA su PG16: prima anon vede 2 foto su 2, dopo 0; ogni utente solo la propria; idempotente). Verificato che nessun percorso client legge foto altrui (il seed lo firma il server con l'admin; upload/delete passano da INSERT/DELETE della 045, non toccate).
- **⚠️ REGOLA: una misura di sicurezza non è "fatta" perché il collaudo dal telefono sembra a posto.** Qui il collaudo passava perché toccava l'unico canale davvero chiuso. `npm run security:check` ora prova ANCHE `/object/list` e `/object/sign` ed è **assertivo**; il controllo RLS ora fallisce anche su **200 con array vuoto** (una tabella con RLS dimenticata ma momentaneamente vuota prendeva la spunta verde) e distingue il 404 ("non verificata") da "protetta"; aggiunta la tabella **`passkeys`** che mancava dall'elenco.
- **[ALTA] Il registro CSP non sarebbe MAI rimasto pulito** (quindi la policy stretta non sarebbe mai stata attivabile): `lib/pdf/template.ts` caricava **Inter da fonts.googleapis.com** con un `<link>`, e Inter è il font del preset classico = il default → 2 violazioni a OGNI apertura di documento, con le vere annegate in mezzo; una volta attivata la CSP avrebbe spento il font sui documenti. Era anche **l'ultima chiamata a Google del prodotto, fatta dal browser del CLIENTE** (IP a Google senza sua scelta — il caso delle sanzioni tedesche), in contraddizione con la riga "font self-hosted, zero chiamate a Google" del 18 lug. **Inter ora è self-hosted** (`public/fonts/inter-latin-400-800.woff2` + `-latin-ext-`, variabile 400-800, OFL); `googleFontsTag` ELIMINATO. Verificato con Chromium sull'HTML reale: unica richiesta di font al nostro server, `document.fonts` → `Inter:loaded`, documento identico.
- **[ALTA/anti-frode] ⚠️ migration 070 — le coordinate di pagamento si cambiano SOLO dal server.** La policy `ws_update` (001) permette l'UPDATE di TUTTE le colonne a ogni membro: con un token rubato si cambiava l'IBAN via PostgREST **senza far partire l'avviso email** (il rimedio si aggirava proprio nello scenario per cui esiste), e un COLLABORATORE poteva toccare le coordinate del titolare (cosa che l'app gli vieta). Trigger `protect_payment_details` sulle 5 colonne (schema della 057) + `updateWorkspacePayments` ora scrive con l'**admin client** (autorizzazione già fatta: `owner_id = utente`). VALIDATA su PG16, 6 scenari (IBAN bloccato, note bloccate, ragione sociale libera, riscrittura degli stessi valori libera, service_role passa, idempotente). ⚠️ **ORDINE: la 070 si applica DOPO il deploy** (prima, il salvataggio pagamenti risponderebbe "non riuscito").
- **[MEDIA] "Esci da tutti i dispositivi" falliva in SILENZIO** — stessa classe del bug RichiamoCard del 4 ago, ricomparsa: l'action **ritorna** `{error}`, ma `runActionVoid` legge solo le eccezioni → nessun toast, spinner che si spegne, e l'utente convinto di aver chiuso le sessioni **proprio mentre teme di essere stato violato**. Ora `runAction` + `res.error`. Aggiunta la conferma su `/login?uscito=1` (il parametro non lo leggeva nessuno) e la nota onesta sulla card (i token già emessi decadono entro un'ora: `signOut` revoca i refresh token, non i JWT in corso).
- **[MEDIA] L'avviso IBAN non guardava tutto il riquadro "Come pagare"**: `payment_notes` e `payment_iban_holder` erano fuori dal confronto → si poteva lasciare l'IBAN intatto e scrivere nelle note *"nuovo conto: IT60X…"* (300 caratteri) dirottando il bonifico **senza che partisse nulla**. Ora il confronto copre tutte e 5 le colonne. Inoltre il fallback pre-038 scattava su un errore QUALSIASI (un blip di rete → valori precedenti letti come vuoti → avviso non mandato): ora solo su colonna assente (`isMissingColumnError`), altrimenti errore onesto.
- **[MEDIA] Avvisi di sicurezza seppellibili e non tracciabili**: nessun limite → 200 salvataggi alternati = 200 email identiche, quella vera annegata (+ rischio spam del dominio). Ora `secalert:{email}` **6/h**. E il `try/catch` era codice morto (`sendEmail` non lancia mai, ritorna `{success,error}`): ora l'esito si legge e un avviso non recapitato finisce nei log come **errore**, non nel silenzio.
- **[MEDIA] Foto perse in silenzio sul documento che il cliente FIRMA**: una firma URL fallita faceva sparire le foto dal rapportino senza dirlo a nessuno (prova mancante su un documento con valore probatorio). Ora `signPhotoPaths` **ritenta una volta** e logga in `console.error` quante foto mancano; la pagina `/r/[token]` mostra un avviso ambra *"N foto non si sono caricate: ricarica prima di firmare"*. Tolto `loading="lazy"` dalle due gallerie del cliente: con la scadenza a 1 ora una foto sotto la piega, chiesta il giorno dopo su una scheda lasciata aperta, arriverebbe con l'indirizzo scaduto.
- **[MEDIA] "Elimina definitivamente" non cancellava i file di un collaboratore**: `purgeDeletedDocumentAction` e `deleteWorkPhotoAction` rimuovevano dallo storage col client di SESSIONE, ma la policy DELETE (045) copre solo la propria cartella → in un team il file restava nel bucket per sempre, senza più nessuna riga che lo colleghi a qualcosa (dato personale sopravvissuto a una cancellazione che il copy promette definitiva). Ora **admin client** in entrambi, con l'errore loggato.
- **[BASSE]** `/api/csp-report`: il taglio a 8 KB avveniva PRIMA di `JSON.parse` → i report legittimi grossi diventavano JSON invalido e sparivano in silenzio (ora si loggano come "troppo grande"); il campo `line` passava grezzo → ora `String()`+taglio come gli altri. Messaggi dal link: aggiunto il limite **per IP** (`msgip:` 10/h) prima di quello per token — chi ha più documenti dello stesso artigiano moltiplicava le email restando nei limiti di ogni link — e il limite per token ora scatta DOPO aver trovato il documento (martellare token inventati non crea più una chiave Redis a ogni tentativo). Rimosso l'export morto `signWorkPhotoUrl` (duplicava la logica con un TTL letterale); `signWorkPhotoUrls` usa `PHOTO_URL_TTL`. Corretto il commento del rollback nella 068: rimettere `public = true` NON riporta indietro niente (il codice che costruiva gli indirizzi pubblici non esiste più → serve il revert del deploy).
- **Card MESSAGGI dell'artigiano a TENDINA (richiesta di Eli)**: header toccabile con conteggio, badge ambra "da rispondere", conversazione+campo dentro. ⚠️ **Aperta di default SOLO quando l'ultimo messaggio è del cliente**: se hai già risposto è storia e non deve occupare spazio. Verificato con Chromium a 390px sul componente reale (aperta→chiusa→riaperta, 0 overflow; già risposto → chiusa e senza badge). FAQ /aiuto allineata.
- **Verificati PULITI dai revisori (con prova)**: nessuna superficie foto dimenticata (18 query `work_photos` enumerate); nessun residuo `object/public/work-photos` (l'unico `getPublicUrl` è il bucket `logos`, che resta pubblico ed è giusto); seed presente in tutti e 6 i punti server e in entrambe le istanze (mobile+desktop) per pagina; nessun IDOR introdotto dalla firma con l'admin; nessuna cache pubblica può memorizzare un indirizzo firmato (`force-dynamic`, niente `Cache-Control`, router cache 30s ≪ 1h); `document_log` grezzo mai nel payload del cliente; XSS nei messaggi impossibile (JSX); Permissions-Policy allineata alle capacità realmente usate; `X-Frame-Options` non rompe l'anteprima.
- **DEFERRED annotati**: `payment=()` collide col futuro pagamento con carta (Apple/Google Pay dentro l'iframe Stripe si spegnerebbero **in silenzio** — stessa trappola di `geolocation=()`); append non atomico del `document_log` (finestra più larga perché include il rate limit); rate-limit fail-open se Redis è giù.
- tsc+build+456/456+smoke 28/28 verdi · scan spazi puliti · migration 069 e 070 validate su PG16 reale.

### ✅ 5 ago (12) — FOTO IN ARCHIVIO PRIVATO con link a scadenza (⚠️ migration 068 DA APPLICARE)
Eli: *"ad oggi ancora nessuno usa la app quindi potrebbe essere il momento buono per farlo"* — ed è il ragionamento giusto: senza utenti reali il rischio di rompere costa quasi nulla. Chiuso il rischio 🟡6 di `SICUREZZA.md`.
- **PRIMA**: bucket `work-photos` PUBBLICO, foto protette solo dall'indirizzo casuale (`{user_id}/{uuid}.jpg`) — non enumerabile ma **permanente**: un indirizzo inoltrato o finito in una cronologia restava valido per sempre. **DOPO**: bucket privato + **URL firmate con scadenza 1 ora** (`lib/photos/signed-url.ts` server, `signWorkPhotoUrls` + hook `useSignedPhotos` client).
- **7 punti convertiti**: pagina cliente `/p/[token]`, rapportino `/r/[token]`, PDF rapportino pubblico e autenticato, e le 3 anteprime in app (WorkPhotosCard, SopralluogoForm, PreventivoForm).
- ⚠️ **Chi firma cosa**: lato server SEMPRE con l'**admin client** (l'autorizzazione è già stata verificata da token/sessione) — così funziona anche per i **COLLABORATORI**, che non sono proprietari della cartella dove stanno le foto caricate dal titolare. Lato client si firma solo ciò che l'utente ha **appena caricato**, e per quello basta la policy "propria cartella" della 068.
- **⚠️ migration 068** (`068_foto_archivio_privato.sql`, VALIDATA su PG16 reale: idempotente, bucket → private, policy SELECT che mostra solo la propria cartella): **si applica DOPO il deploy del codice**. Se qualcosa non si vedesse, si torna indietro con `UPDATE storage.buckets SET public = true` (riga commentata in fondo alla migration).
- Nessun `object/public/work-photos` residuo nel codice (grep pulito). tsc+build+456/456+smoke 28/28 verdi.

### ✅ 5 ago (11) — SICUREZZA parte 3: avvisi sui cambi che toccano i soldi + "Esci da tutti i dispositivi"
Domanda di Eli ("cosa puoi implementare per mettere in sicurezza i dati? cosa dice il web?"): 4 ricerche + implementazione delle misure che proteggono DAVVERO nel nostro modello di minaccia.
- **Avviso email sui cambi sensibili** (`lib/security/alert.ts` + template `security_alert.tsx`): parte quando cambiano **IBAN / link di pagamento** (`updateWorkspacePayments`, confronto coi valori precedenti — select tollerante pre-038) e quando cambia la **password** (`confirmResetPasswordAction`). Testo con "sei stato tu / non sei stato tu" e cosa fare. **Non disattivabile** (è il fatto di arrivare SEMPRE che la rende utile) e **best-effort**: se l'email non parte, il salvataggio resta valido. ⚠️ È la contromisura diretta al rischio n.1 identificato dalla ricerca (frode BEC: cambiano l'IBAN e aspettano il bonifico).
- **"Esci da tutti i dispositivi"** (`lib/actions/sessions.ts` + card in /account): `signOut({scope:'global'})` revoca ogni sessione aperta — cambiare la password NON lo fa. Conferma in due passi, redirect a /login. Verificato con Chromium a 390px (0 overflow chiuso e aperto).
- **⚠️ Misure valutate e SCARTATE, con motivo, in `SICUREZZA.md` §2-bis**: cifratura per colonna (Supabase sconsiglia pgsodium, in deprecazione — ma soprattutto **non protegge nel nostro modello**: l'app deve leggere l'IBAN per stamparlo, quindi la chiave è sul nostro server; servirebbe solo contro il furto di un backup grezzo, e i backup non li abbiamo nemmeno); cifratura lato client (romperebbe ricerca, PDF, pagina pubblica, recupero password); mascheramento in UI (teatro: l'artigiano deve vedere i suoi dati, e chi è dentro li vede comunque).
- **⏭️ Valutata e RIMANDATA, non scartata**: foto in bucket **privato con URL firmate a scadenza** (pratica standard confermata dalla ricerca; oggi bucket pubblico con path casuale non enumerabile). Tocca 7 punti (pagina cliente, rapportino, 2 PDF, 3 anteprime in app) → giro dedicato, col passaggio a privato come ultimo passo reversibile.
- Verificato che nessun log contiene dati personali. FAQ /aiuto "Ho perso il telefono…" + 2 voci /novita.
- tsc+build+456/456+smoke 28/28 verdi.

### ✅ 5 ago (10) — RICERCA "perché ci attaccherebbero" → `SICUREZZA.md` §1-bis
Domanda di Eli ("motivi di hackeraggio e furto dati, pericoli per un'app"): 6 ricerche web, sintesi nel documento di sicurezza perché orienta le priorità future.
- **Movente**: quasi sempre denaro (Verizon DBIR 2026; spionaggio 12%). Sei vie di monetizzazione, in ordine di quanto ci riguardano: **① frode sul pagamento** (BEC: 3,05 mld $ nel 2025, ~123k $ a caso — cambiano l'IBAN su una fattura VERA) ② estorsione senza cifratura (rubano e minacciano di pubblicare; i dati ora vengono indicizzati per alzare il prezzo) ③ rivendita (il nostro archivio vale come *lista verificata di P.IVA*, non per il singolo nome) ④ riuso credenziali altrove (2,86 mld in circolazione) ⑤ uso della nostra reputazione email ⑥ rivendita dell'accesso.
- **Vettori in ordine reale**: vulnerabilità non aggiornate **31%** (+55%, primo vettore per la prima volta — era esattamente il nostro caso di stamattina), credenziali **39%**, controllo accessi rotto (**94%** delle app testate secondo OWASP), configurazioni (RLS dimenticata = causa n.1 delle fughe su Supabase), catena npm (1,23 M pacchetti malevoli, +75%; nel 2026 compromessi axios e keyv da 100M+ download/settimana), inganno dell'amministratore.
- **⚠️ Conclusione operativa**: per un'app di FATTURE il danno peggiore non è "i dati rubati" ma **un bonifico dirottato** → la difesa più utile è rendere VISIBILE al titolare ogni cambio che tocca il denaro (IBAN, email, sessioni). Proposto a Eli come prossimo passo, non implementato senza sua decisione.
- Nessun codice toccato in questo giro.

### ✅ 5 ago (9) — SECONDO GIRO di ri-review (Eli "ricontrolla nuovamente"): 2 fix + verifiche pulite
Occhi freschi sul diff completo, classi di difetti diverse dal giro precedente.
- **[MEDIA] Fattura SCADUTA: "Come pagare" sì, "Scrivi un messaggio" no** — il gate client era `sent|viewed` mentre la pagina mostra il riquadro di pagamento anche su `expired` (review 25 lug B1): proprio il cliente che arriva a saldare in ritardo — quello che più ha bisogno di scrivere ("posso pagare la settimana prossima?") — non aveva il bottone. Il server era già allineato (blocca solo le bozze). Fix: `canWriteMessages` include `expired`; i preventivi scaduti non passano di qui (redirect a /scaduto).
- **[BASSA] Riga "Lavoro eliminato" cliccabile** nella vista per lavoro del Bilancio: il link portava su `/lavori/{id}` di un lavoro soft-deleted → "non trovato". Ora `href` solo se il lavoro esiste (`lavoroById.has`).
- **Verificati PULITI**: nessun riferimento residuo a `ClientMessageButton` (file cancellato); `@react-email/components` resta nelle dependencies di runtime (era `react-email` — CLI dev — a trascinare socket.io/ws, lo spostamento non rompe le email); hook di `ClientMessages` tutti PRIMA dell'early-return `!canWrite && !hasMessages` (nessuna violazione rules-of-hooks); wildcard CSP `*.posthog.com` copre anche i sottodomini annidati (lo standard CSP, a differenza dei certificati TLS, matcha più livelli); route messaggio pubblica che blocca solo le bozze = deliberato e coerente (un cliente che ha accettato può ancora scrivere; l'artigiano risponde dalla card, che compare perché la conversazione esiste).
- `unansweredClientMessages` (lib/documents/messaggi.ts) esportata e testata ma non ancora cablata in UI — pronta per un futuro badge in campanella, annotato qui.
- tsc+build+456/456+smoke 28/28 verdi.

### ✅ 5 ago (8) — RI-REVIEW del lavoro di giornata (richiesta Eli "correggi se ci sono errori"): 5 fix
Rilettura critica delle 7 PR di oggi (#284-#295), ogni finding verificato sul codice prima di toccarlo.
- **[MEDIA] La conversazione SPARIVA dal link appena il documento si chiudeva**: `ClientMessages` era dentro il gate `status === 'sent' || 'viewed'` → accettato il preventivo (o pagata la fattura), il cliente perdeva tutte le risposte — proprio quelle che l'email gli aveva promesso "sempre lì sul link". Ora la conversazione resta **leggibile sempre** (nuova prop `canWrite`); a sparire è solo la possibilità di SCRIVERE (bottone + mailto), che resta ai documenti attivi. Documento chiuso senza messaggi → il componente non rende nulla. Verificato con Chromium sul componente reale: `canWrite=false` → solo la tendina, 2 bolle, 0 overflow.
- **[MEDIA] "Lavoro eliminato" BUGIARDO**: la mappa dei lavori nel Bilancio ha `limit(200)` e nel CSV nessuna paginazione → una spesa collegata a un lavoro vecchio (fuori dai 200, o oltre le 1.000 righe dell'API) usciva etichettata "Lavoro eliminato" pur esistendo. Fix: nella pagina una **query mirata sugli id mancanti** (`.in(...)`, parte solo se serve davvero); nel CSV `fetchAllRows`. Ora l'etichetta compare solo per i lavori cancellati sul serio.
- **[BASSA] CSP report-only con origini troppo strette**: `*.ingest.sentry.io` NON copre `o123.ingest.us.sentry.io` (wildcard su un solo livello di suffisso) e `api.stripe.com` non copre le chiamate di Stripe.js a m./q.stripe.com → il registro delle violazioni si sarebbe riempito di falsi allarmi e non avremmo capito cosa stringere. Ora `*.sentry.io`, `*.stripe.com`, `*.stripe.network`.
- **[BASSA] `SUPABASE_ORIGIN` con barra finale** avrebbe prodotto una CSP malformata (quindi ignorata dal browser proprio dove serve) → `.replace(/\/+$/, '')`.
- **[BASSA] chiave rate-limit `csp:null`** quando l'IP non è determinabile → `'sconosciuto'`.
- **Verificato PULITO**: la somma della vista per lavoro quadra coi KPI (stessi eventi, stesso filtro di periodo); confronto anno su anno con base 0/negativa → "—"; tracciato CSV a 6 colonne in tutte le righe (intestazione, dettaglio, vuote, totali); endpoint `/api/csp-report` provato dal vivo (204 su report valido e su corpo spazzatura, 405 su GET, log corretto); `dependabot.yml` con sintassi valida; nessun testo attaccato (scan Turbopack pulito).
- tsc+build+456/456+smoke 28/28 verdi.

### ✅ 5 ago (7) — SICUREZZA parte 2 (Eli: "procediamo con tutta la sicurezza possibile")
- **[BUG in produzione da luglio, VERIFICATO con Chromium] `Permissions-Policy: geolocation=()` negava la posizione ANCHE a noi**: "Vicino a me" riceveva *"Geolocation has been disabled in this document by permissions policy"* pur col permesso concesso, e la UI lo raccontava come "permesso negato" (è il caso che Eli segnalava il 29 lug e per cui avevo costruito il pop-up guidato — curava il sintomo sbagliato). Prova empirica con due server e due header: `geolocation=()` → ERR 1, `geolocation=(self)` → OK. Fix: `geolocation=(self), microphone=(self), camera=(self)` + negati a chiunque payment/usb/sensori/bluetooth/midi/serial/idle-detection/local-fonts/display-capture. ⚠️ REGOLA: un header di sicurezza sbagliato rompe le funzioni IN SILENZIO.
- **CSP stretta in `Report-Only`** accanto a quella attiva: script solo da noi + Cloudflare/Stripe/PostHog/Supabase, niente `https:` generico e niente `unsafe-eval` in produzione; violazioni raccolte da **`/api/csp-report`** (nuovo, pubblico, rate-limit 30/h per IP, log troncato `[csp]`, 204 sempre). Scelta deliberata: stringere al buio significherebbe scoprire in produzione che il login non funziona. Quando i log restano puliti si scambiano le due chiavi in next.config.
- **`npm run security:check`** (`scripts/security-check.mjs`, nuovo): controlla il sito VERO — header di sicurezza, **ogni tabella interrogata con la sola anon key** (il test che smaschera una RLS dimenticata), bucket foto non sfogliabile. Legge le chiavi da `.env.local`, usa SOLO la anon key.
- **Smoke esteso a 28 controlli**: gli 8 header di sicurezza sono ora verificati a ogni giro (la regressione della geolocalizzazione si sarebbe vista subito).
- `SICUREZZA.md` aggiornato; **`COSE_DA_FARE_ELI.md` §0 nuovo: 2FA sui 5 account di Eli** (Supabase, Vercel, GitHub, registrar, email) con app di autenticazione, mai SMS, codici di recupero al sicuro — promemoria richiesto esplicitamente da Eli.
- tsc+build+456/456+smoke 28/28 verdi.

### ✅ 5 ago (6) — SICUREZZA: Next fermo a una versione VULNERABILE (9 CVE) + superficie ridotta + Dependabot
Richiesta Eli "come evitiamo gli attacchi informatici? siamo coperti su dati sensibili e frodi?" — ricerca web + audit del repo.
- **[ALTA, trovata dalla ricerca] Eravamo su Next 16.2.3, le patch di sicurezza sono in 16.2.11** (release del 20 lug 2026, **9 CVE**: middleware/proxy bypass CVE-2026-64642 su App Router, bypass di rotte protette via URL `.rsc`/segment-prefetch CVE-2026-44575, SSRF, cache poisoning, DoS). **Aggiornato a 16.2.11** (patch della stessa minor; NON 16.3.0 proposto da npm audit: minor nuova = più rischio di regressioni). tsc+build+456/456+smoke 20/20 verdi dopo l'aggiornamento.
- **⚠️ Perché NON eravamo bucabili comunque** (verificato, non assunto): l'auth non vive nel middleware — ogni pagina `(app)/` e ogni route ricontrolla la sessione (`getSessionWorkspace`/`auth.getUser`), le uniche due senza check sono /aiuto e /novita che non hanno dati. Le CVE bypassano il proxy, non i controlli sottostanti. **REGOLA: il middleware NON è un confine di sicurezza — ogni route protetta deve avere il proprio controllo.**
- **Superficie ridotta**: rimossi 3 pacchetti in `dependencies` non più importati da nessuna parte (`@sparticuz/chromium`, `playwright-core`, `puppeteer-core` — residui dell'era PDF-con-Chromium) e `react-email` spostato in devDependencies (trascinava socket.io/ws vulnerabili nel runtime). **Vulnerabilità di produzione da 27 (1 critica, 8 alte) a 3 alte**, tutte interne a Next (`postcss` = build-time, `sharp` = non elabora immagini utente, tutte le foto arrivano da Supabase e i 3 `next/image` sono `unoptimized`).
- **`.github/dependabot.yml`** (nuovo): PR automatiche per gli aggiornamenti di sicurezza, lunedì, max 5, major esclusi. Senza, la prossima patch di Next resta fuori per settimane come questa.
- **`SICUREZZA.md`** (nuovo): stato reale verificato fronte per fronte, 7 rischi residui in ordine di danno (① nessun backup DB = il peggiore ② 2FA sugli account di Eli = la vera chiave del regno ③ niente 2FA artigiani ④ nessun rilevamento di anomalie ⑤ CSP permissiva ⑥ bucket foto pubblico con path random ⑦ le 3 CVE interne a Next), **piano di risposta agli incidenti con le 72 ore GDPR** e manutenzione ordinaria (Dependabot il lunedì, Security Advisor di Supabase una volta al mese).
- Verificato inoltre: **RLS attiva su tutte e 28 le tabelle** delle migration; path foto = `{user_id}/{uuid}` (non enumerabile); nessun segreto nel repo.

### ✅ 5 ago (5) — CONVERSAZIONE col cliente sul link (l'artigiano risponde) — nessuna migration
Domande di Eli: "sotto il link voglio la conversazione a tendina · come fa il cliente a sapere che ha ricevuto un messaggio · l'artigiano riesce a rispondere · ha senso questa feature?". Risposta data: **sì, ma solo se il cliente viene avvisato** — non ha l'app e non è registrato, quindi l'UNICO canale è l'email; senza quella sarebbe una chat che nessuno riapre. Implementata così.
- **`lib/documents/messaggi.ts`** (PURO, **8 test**): `conversationFromLog` estrae `client_message` + `owner_message` dal document_log, ordina per data, scarta le voci malformate, tiene i 100 più recenti; `unansweredClientMessages` conta i messaggi del cliente dopo l'ultima risposta. ⚠️ **Il log grezzo NON va mai passato alla pagina pubblica** (contiene gli incassi): si passa solo il risultato dell'helper — test dedicato che gli eventi `payment` non entrano nella conversazione.
- **`lib/actions/messaggi.ts`** — `sendOwnerMessageAction`: workspace via `resolveWorkspaceForUser`, documento non in bozza (senza link il cliente non ha dove leggere), voce `owner_message` nel log, **rate-limit `ownermsg:{docId}` 20/h** (ogni risposta può far partire un'email verso un terzo), poi email al cliente **col TESTO dentro** (`owner_message.tsx`) — chi legge dalla posta ha già l'informazione.
- **Pagina cliente** (`ClientMessages`, sostituisce ClientMessageButton): card **"Conversazione · N messaggi"** a tendina sopra il bottone; bolle Tu/artigiano con data e ora. ⚠️ La tendina è **aperta di default quando l'ultimo messaggio è dell'artigiano**: è il modo per accorgersi della risposta tornando sul link. Il messaggio appena inviato compare subito (stato locale).
- **App artigiano** (`MessaggiCard` in preventivi/[id] e fatture/[id], mobile+desktop): conversazione + campo risposta + badge ambra "da rispondere". **Compare SOLO se il cliente ha già scritto**: non è un canale per iniziare a scrivere ai clienti (per quello ci sono email e WhatsApp, che il cliente legge davvero) — scelta deliberata anti-spam. **Se il cliente non ha email in rubrica lo dice PRIMA** ("vedrà la risposta solo riaprendo il link, avvisalo tu") invece di far credere che arrivi da sola.
- Cronologia: nuovo evento "Risposta inviata al cliente". Campanella invariata (conta solo i messaggi DEL cliente). FAQ /aiuto riscritta + voce /novita.
- Verificato con Chromium a 390px sui componenti REALI (esbuild): tendina aperta→chiusa, 0 overflow, bolla nuova subito dopo l'invio, textarea svuotata. tsc+build+**456/456**+smoke 20/20 verdi · scan spazi pulito.

### ✅ 5 ago (4) — DOSSIER UNICO COMMERCIALISTA rigenerato (5 ago 2026, 17 aree · 40 domande)
Richiesta Eli "procedi con il dossier commercialista aggiornato". Nuovo file **`CartaCanta_Commercialista_DOSSIER_UNICO_5ago2026.pdf`** (7 pagine, generato con reportlab, inviato in chat via SendUserFile — ⚠️ **MAI nel repo**, regola 19 lug: un solo file per professionista, si ri-manda tutto, mai addendum). Sostituisce il dossier del 19 lug.
- **Struttura**: ogni sezione dice prima "come funziona oggi nell'app" e poi le domande numerate **D1-D40** (il commercialista può rispondere col solo numero); le sezioni che bloccano il lancio o una funzione hanno l'etichetta **PUNTO BLOCCANTE**; in fondo "cosa non facciamo finché non ci risponde" + le 4 risposte più urgenti (D13-D14 data fattura · D17-D19 note di credito · D9 IVA sullo sconto · D2-D3 P.IVA/forma giuridica).
- **Aree NUOVE rispetto al 19 lug**: §11 pagina Bilancio col testo di avvertenza forfettari (validazione del copy 4 ago) e la vista per lavoro · §12 storia degli incassi e correzioni (⚠️ un CSV esportato oggi può NON coincidere con uno esportato mesi fa: domanda esplicita) · §13 tracciato export a 6 colonne con "Lavoro" · §15 incasso con carta via Stripe Connect (commissione = costo dell'artigiano, incasso lordo?) · §16 categoria "Collaboratori e manodopera" e ore del titolare fuori dalle uscite.
- Aree riportate dal dossier precedente: cosa fa/non fa l'app, posizione fiscale frontaliera+P.IVA, regimi e ordine dei calcoli, sconto documento vs base IVA, numerazione, data fattura/12 giorni, SdI, note di credito TD04, ritenuta d'acconto (le 4 domande di `RITENUTA_DACCONTO_TODO.md`), bonus edilizi, file per lo studio + area /studio, conservazione/cancellazione, documenti firmati.
- ⚠️ Glifi: i font PDF base non hanno ⚠ né −; sostituiti con etichetta testuale e "meno" (verificato: zero caratteri fuori Latin-1 oltre a — … €). `keepWithNext` su titoli ed etichette (senza, un titolo restava orfano a fine pagina). Impaginazione verificata pagina per pagina (render pypdfium2).
- `COSE_DA_FARE_ELI.md` §2 aggiornato: manda QUESTO file, non quello del 19 luglio.

### ✅ 5 ago (3) — [BUG] PAGINA CLIENTE: mezzo schermo vuoto prima delle foto
Foto di Eli: tra "Vedi il documento completo" e la card delle foto c'era un vuoto enorme (e un cambio di tono dello sfondo a metà pagina). CAUSA: il root di `MobilePublicCard` aveva **`minHeight: '100vh'`** (+ fondo `#fafafa`) → il blocco si allungava a tutta la finestra anche a contenuto breve e spingeva giù tutto ciò che la pagina aggiunge dopo (foto, Come pagare, recensione); il fondo diverso da quello della pagina (`#eceae4`) creava il gradino visibile.
- Rimossi `minHeight` e `background` dal componente: lo sfondo continuo lo mette già il wrapper della pagina. **Misurato sul componente REALE** (esbuild+Chromium 390×780, fattura corta): vuoto **307px → 0** (restano i 12px di stacco standard), pagina 964→780px, 0 overflow.
- Sezioni sotto la card (foto/pagamento/recensione/contatti) allineate a **15px** di padding orizzontale come le card sopra (prima 12px: risultavano più larghe).
- ⚠️ REGOLA: nella pagina pubblica nessun blocco intermedio usa `100vh`/`min-h-screen` — l'altezza piena la garantisce SOLO il wrapper di `p/[token]/page.tsx`.

### ✅ 5 ago (2) — BILANCIO passo 3: confronto con l'anno prima + colonna LAVORO nell'export + FAQ
Chiude il piano Bilancio (passi 1-3).
- **Confronto anno su anno** (solo in modalità ANNO, card sotto i KPI): Entrate/Uscite/Utile con la cifra dell'anno precedente in grigio e la variazione % a destra. ⚠️ **Sull'anno IN CORSO il confronto è a parità di periodo** (1° gen → oggi dell'anno prima) e il titolo lo dice ("Stesso periodo del 2025"): paragonare 7 mesi con 12 mostrerebbe un crollo che non esiste. `chartStart` in modalità anno parte dal 1° gennaio dell'anno PRECEDENTE (finestra doppia, già paginata da `fetchAllRows`); le 12 barre restano quelle dell'anno scelto. **Le uscite hanno il delta in colore NEUTRO** (entrate e utile verde/rosso): spendere di più non è di per sé un male — più lavoro = più materiali; colorarlo di rosso darebbe un giudizio falso. Base ≤ 0 (anno prima senza dati, o utile in perdita) → "—" invece di una percentuale senza senso.
- **Colonna "Lavoro" nell'export CSV** (artigiano E area /studio): stessa attribuzione della pagina (preventivo→fattura via `origin_document_id`, spese via `lavoro_id`), spese di un lavoro cancellato = "Lavoro eliminato". ⚠️ Il tracciato passa da **5 a 6 colonne**: righe vuote e totali aggiornati a `;;;;;` (con un ";" in meno Excel disallinea gli importi). La select expenses con `lavoro_id` ha il **retry senza la colonna** (pre-049): un export senza uscite sarebbe peggio di un export senza quella colonna. 🔒 Tracciato export da rivedere col commercialista alla prossima consegna del dossier.
- **FAQ in /aiuto**: "Nel Bilancio posso vedere quanto ho guadagnato su un singolo lavoro? E l'anno intero?" (card Lavori, riga Non collegato, Mese/Anno, ore fuori dai conti).
- Verificato con Chromium a 390px (importi a 6 cifre, riga "—"): 0 overflow. tsc+build+448/448 verdi · scan spazi pulito.

### ✅ 5 ago — BILANCIO passo 2: vista PER LAVORO ("quale lavoro ha portato X entrate e Y uscite")
Il pezzo che Eli chiedeva davvero. Card **"Lavori di {mese}" / "Lavori del {anno}"** sotto il grafico: una riga per lavoro con **Incassato · Speso** e, a destra, **quanto resta** (rosso se negativo); la riga apre la scheda del lavoro.
- **Attribuzione SENZA migration**: il lavoro nasce dal preventivo accettato (`lavori.document_id`) e la fattura porta `origin_document_id` = quel preventivo → l'incasso della fattura risale al lavoro (`lavoroByDoc.get(doc.id) ?? lavoroByDoc.get(doc.origin_document_id)`); le spese hanno già `lavoro_id` (049). Query lavori: `select id, title, document_id, status`, senza filtro di stato (servono anche i **fatturati**), limit 200; `origin_document_id` aggiunto alle due select delle entrate.
- **⚠️ Riga "Non collegato a un lavoro" OBBLIGATORIA**: senza, la somma delle righe non tornerebbe con i KPI del periodo e il quadro sembrerebbe sbagliato. Stesso principio per le spese di un lavoro **cancellato**: restano nei conti con l'etichetta onesta "Lavoro eliminato" (non spariscono né si mescolano al non-collegato).
- **Nessun tetto silenzioso**: oltre i primi 12 lavori (ordinati per volume incassato+speso) le righe restano nei conti raggruppate in "Altri N lavori".
- **Ore fuori dai conti, detto in chiaro**: nota sotto la card ("non sono soldi usciti dal conto: le trovi nella scheda del lavoro") — coerente col doppio binario del passo 1.
- `lavoriAttivi` per `AddExpenseDialog` ora derivato in JS (status in da_iniziare/in_corso/finito, primi 30) dalla stessa query: nessuna query in più.
- ⚠️ Riga secondaria con **nowrap per segmento** ("Incassato X" · "Speso Y"): l'a capo cade TRA le due parti, mai tra "Speso" e il suo importo (stessa regola del € mai a capo). Verificato con Chromium a 390px: 0 overflow, titoli lunghi troncati con ellissi.
- tsc+build+448/448 verdi · scan spazi pulito.

### ✅ 4 ago (14) — BILANCIO passo 1: Mese/Anno, uscite in due blocchi, righe di verità
Dalla ricerca+analisi (agent) sulla domanda di Eli "nel bilancio non si dovrebbe tener conto di TUTTE le spese?". **Esito controintuitivo, confermato dal codice**: quasi tutti i costi citati NON devono entrare come uscite — i materiali comprati ci sono già (spese manuali), `unit_cost` delle voci sarebbe **doppio conteggio** con la spesa reale (errore n.1 documentato nel job costing), i listini sono cataloghi di prezzi. **L'unico buco vero era la mancata distinzione tra costi dei lavori e spese generali.**
- **Selettore MESE / ANNO** (`?y=YYYY`): in modalità anno KPI sul periodo, grafico a **12 barre**, spese **raggruppate per categoria** (elencarne 300 non serve), swipe tra anni. ⚠️ In modalità anno entrambe le query passano da **`fetchAllRows`**: un anno di dati supera il tetto righe e verrebbe troncato in silenzio.
- **Uscite in due blocchi** (mese): **Costi dei lavori** (spese con `lavoro_id`, colonna 049 finalmente usata — prima non era nemmeno nella select) e **Spese generali**, ciascuno col proprio totale. Riga di spesa estratta in `ExpenseRowView`.
- **Categoria nuova "Collaboratori e manodopera"** (👷): chi paga un aiutante ha una spesa VERA che finiva in "Altro".
- **⚠️ La MANODOPERA (ore) resta FUORI dai totali e non ha una riga "del mese"**: verificato sul modello dati — `lavori.labor_minutes` è un **totale cumulativo senza data** (il timer non registra quando), quindi attribuirlo a un mese sarebbe un numero inventato. E le ore del titolare non sono denaro uscito dal conto: sommarle farebbe scendere l'"Utile" sotto i soldi realmente in tasca. Il posto giusto resta la scheda Lavoro (dove il perimetro è il lavoro, non il mese) → **doppio binario esplicito**: Bilancio = soldi veri · Lavoro = quanto vale il tuo tempo.
- **Righe di verità** in fondo: "è il quadro della tua cassa, non un bilancio contabile, non sostituisce il commercialista" + per i FORFETTARI "le spese registrate qui non abbassano le tasse (si paga sul fatturato per coefficiente ATECO)". 🔒 Testo **da far validare al commercialista** (B.0) — dalla ricerca: né Fatture in Cloud (che parla di "prima nota") né Danea (che dichiara di non stampare bilanci) usano la parola "bilancio". **Nome "Bilancio" MANTENUTO** + riga di chiarimento (rinominarlo toccherebbe menu/aiuto/tutorial: rapporto costo/beneficio sfavorevole; decisione riapribile).
- Verificato con Chromium a 390px: 0 overflow, gerarchia leggibile. tsc+build+448/448 verdi.
- ⏭️ **Passo 2 (vista per LAVORO del mese: incassato/speso/margine per lavoro + riga "Non collegato")** e **passo 3 (anno con confronto)**: progettati, da fare su richiesta. Il collegamento incasso→fattura→preventivo→lavoro è già percorribile senza migration.

### ✅ 4 ago (13) — VELO ANTI-LAMPO: niente più Home per un istante prima del lucchetto
Eli: "si vede la pagina di accesso impronta ma per un secondo prima si vede la Home". CAUSA: `useLayoutEffect` (fix 2 ago) gira dopo l'IDRATAZIONE di React — ma il browser ha già dipinto l'HTML della Home arrivato dal server. Nessun hook può prevenire quel primo frame.
- **`components/security/LockVeil.tsx`** (NUOVO, server component che emette uno `<script>` INLINE come primo figlio del layout (app)): gira mentre il browser legge la pagina (blocca il parser, prima di qualsiasi paint), replica la decisione di AppLock e mette `cc-locked` su `<html>`. CSS in globals.css: fondo `#1a1a2e` + `visibility: hidden` sui figli del body → si vede solo il navy, identico al lucchetto.
- **AppLock rimuove la classe** nel suo useLayoutEffect (sia che blocchi sia che non blocchi) → il passaggio velo→lucchetto è invisibile (stesso fondo).
- ⚠️ **REGOLA: la logica dello script e quella del useLayoutEffect di AppLock devono restare GEMELLE** (chiavi cc_lock/cc_biometric/cc_biometric_timeout/cc_biometric_active, grazia `cc_lock_nav` 5 min): se divergono si vede il velo navy e POI la Home — lo stesso lampo al contrario. Paracadute nello script: la classe si toglie da sola dopo 8s (se React non parte, l'app non resta dietro un velo).
- Verificato con Chromium sui 3 scenari REALI: blocco attivo+attività vecchia → velo navy e Home nascosta; attività recente (entro il timeout) → nessun velo; blocco spento → nessun velo. tsc+build+448/448+smoke 20/20 verdi.

### ✅ 4 ago (12) — MESSAGGIO DEL CLIENTE dal link (in app, non solo email) — nessuna migration
Richiesta Eli ("un tasto per le richieste tramite app… o finiscono nella sezione richieste o in una nuova. Cosa dici?"). **Scelta motivata: il messaggio riguarda QUEL documento → vive nella CRONOLOGIA del documento + campanella**; `/richieste` resta per i contatti di sconosciuti dalla vetrina (mischiarli confonderebbe due flussi diversi).
- **`POST /api/p/[token]/messaggio`** (pubblica, `/api/` è già in PUBLIC_PREFIXES): rate-limit `msg:{token}` 5/h (un link condiviso non deve diventare un canale di spam), testo 3-1000 char, rifiuta le bozze; scrive la voce **`client_message`** (`{type, at, text}`) nel `document_log` con admin client — **zero migration** (log dalla 034); email di avviso all'artigiano best-effort (nuovo template `client_message.tsx`, contiene il testo: il destinatario è la persona a cui è indirizzato).
- **`ClientMessageButton`** (nuovo, client) in fondo alla pagina cliente: bottone "Scrivi un messaggio" → bottom-sheet con textarea (font 16 anti-zoom iOS), stato inviato, errori per stato. Sotto, l'email classica come alternativa secondaria ("oppure scrivi un'email a …").
- **Cronologia**: tipo `client_message` con icona MessageSquare viola e il TESTO nel dettaglio dell'evento. **Campanella**: tipo `messaggio` (query documenti aggiornati negli ultimi 60 gg, limit 60, scansione JS del log — nessun indice su jsonb; chiave `msg:{docId}:{at}` compatibile con la regex di markRead), toggle `inapp_messaggio` (default ON) in Impostazioni › Notifiche + icona in NotificationList.
- Copy: FAQ in /aiuto + voce in /novita. tsc+build+448/448 verdi · scan pulito.

### ✅ 4 ago (11) — [BUG] righello a "striscia verticale" + PAGINA CLIENTE riordinata + foto ingrandibili
- **[BUG, causa CSS provata] Il pop-up del righello (📐 dentro Q.tà) si apriva come una striscia sottile verticale**: in modalità `iconOnly` il bottone vive dentro uno `<span>` con `-translate-y-1/2` — **un antenato con `transform` diventa il containing block dei figli `position: fixed`** → l'overlay `inset: 0` si dimensionava su quello span (~23px) invece che sul viewport. Fix: **`createPortal(…, document.body)`** in `CalcQuantitaButton` (+ guardia `mounted` per l'SSR). Verificato sul componente REALE nel suo contesto reale (esbuild+Chromium 390px): overlay **390×780 con parent BODY**, pannello 366px; controprova isolata del meccanismo (fixed dentro transform → 0×0). ⚠️ REGOLA: gli overlay fullscreen vanno in portal su body — `position: fixed` non basta se un antenato ha transform/filter/zoom.
- **Pagina pubblica /p/[token] mobile riordinata** (Eli: "foto e come pagare troppo in fondo"): ora **Foto → Come pagare → Recensione → "Scrivi a {artigiano}" → footer** ("… generata con Carta Canta" + "L'apertura di questa pagina viene registrata · Privacy"). Footer e blocco contatti ESTRATTI da `MobilePublicCard` (dov'erano prima delle sezioni, col contatto perfino DOPO il footer) e ricomposti in fondo a `page.tsx`. Il contatto ora c'è anche sui PREVENTIVI attivi (prima solo fatture).
- **Foto ingrandibili** (richiesta Eli): nuovo `app/p/[token]/_components/PhotoGallery.tsx` (client) — miniature toccabili (cursor zoom-in, aria-label), foto a schermo pieno in **portal su body** (sfondo scuro, X, tocco ovunque o Esc per chiudere, scroll di fondo bloccato), etichetta PRIMA/DOPO sotto. Copy "Tocca una foto per ingrandirla".
- tsc+build+448/448 verdi.

### ✅ 4 ago (10) — TIPOGRAFIA HOME UNIFICATA (mockup approvato da Eli "mi piace, procedi")
Da 9 dimensioni miste (10,11,12,13,14,15,16,18,24) a **4 livelli fissi**: **12** etichette/titoletti · **13** dettagli · **14 semibold** riga principale · **24** numeri KPI (+ 18 saluto in testata, badge numerici 10-11 fuori scala perché elementi grafici).
- **`.cc-section-label` è ora l'UNICO livello titoletto** (globals.css: 13px→**12px**, letterSpacing .07→.06em) e gli override `fontSize: 11` nei call site sono RIMOSSI (dashboard, ScadenzeHomeCard, TodayAgendaCard, **Altro** — tenuto allineato perché è il riferimento del pattern). ⚠️ REGOLA: i titoletti di sezione usano la classe SENZA override di fontSize.
- **dashboard/page.tsx**: mese KPI 11→12; attività recente fontWeight 500→**600** (riga principale semibold); sottotitolo workspace 12→13. KPI label restano "Preventivi accettati"/"Fatturato" a 12 NON uppercase (dentro card centrate; l'uppercase resta firma dei titoletti di sezione — scelta rispetto al mockup, spiegata a Eli).
- **ScadenzeHomeCard**: titoletto interno 10→12 (stile label, fontWeight 700→600); numero+cliente 15→14 semibold; importo 16→14 bold. **TodayAgendaCard**: righe 500→600. **CompleteProfileCard**: titolo 15→14 semibold; nota 12→13.
- Verificato con Chromium a 390px sulla replica dei valori NUOVI: **0 overflow** (scrollWidth 390 = clientWidth), gerarchia leggibile.
- tsc+build+448/448 verdi · scan pulito.

### ✅ 4 ago (9) — DOPPIO LUCCHETTO RISOLTO (C→B identificato da Eli) + pager su una riga + mockup tipografia Home
Eli ha identificato dal mockup: "blocco con password" per un secondo, poi "blocco con impronta". CAUSA: AppLock al primo paint assume `hasPassword=true` (default) e il check identità asincrono lo ribalta per gli account Google → la pagina cambiava faccia. Richiesta Eli: "pagina stabile, l'impronta come pop-up".
- **AppLock**: ① `hasPassword` inizializzato dall'ultimo esito MEMORIZZATO sul dispositivo (`cc_has_pw` in localStorage, aggiornato a ogni verifica) → dal secondo blocco in poi la lock screen nasce con la faccia giusta, nessun cambio a metà (primo avvio assoluto post-deploy: possibile flash una tantum, poi mai più); ② **impronta come POP-UP automatico**: all'apparire del lucchetto la cerimonia WebAuthn parte DA SOLA (una volta per blocco, solo con app in primo piano) — la tendina di sistema è il "pop-up" sopra la pagina ferma; annullata/non disponibile → SILENZIO (resta il bottone), i messaggi d'errore restano per il tocco manuale (`unlockBiometric(auto)`; ⚠️ `onClick={() => unlockBiometric()}` — passare la reference diretta renderebbe `auto`=MouseEvent truthy). Il fix race del 2 ago (hiddenAt azzerato allo sblocco) copre anche l'auto-trigger. Nessun rischio hydration (lock screen = null finché non bloccata, gli initializer localStorage sono sicuri).
- **ListPager su UNA riga** (Eli: "Pagina 1 di 2 non rimane su una riga"): frecce quadrate 44px (solo icona, aria-label) + "Pagina X di Y" centrale nowrap, layout centrato gap 16 — non può più andare a capo a nessuna larghezza.
- **Mockup tipografia Home** inviato (PNG): oggi 9 dimensioni (10-24), proposta 4 livelli fissi (titoletti 12 / riga principale 14 semibold / dettagli 13 grigio / numeri 24; saluto 18 invariato). IN ATTESA di ok Eli prima di implementare.
- **Risposta a Eli su archiviazione/cancellazione documenti** (in chat): fatture = conservazione 10 anni (2220 c.c.), mai cancellarle; trasmesse SdI già escluse dal purge; preventivi accettati = prova contrattuale, tenerli; proposta futura filtro/archivio per ANNO nelle liste (visivo, non cancellazione).
- tsc+build+448/448 verdi · scan pulito.

### ✅ 4 ago (8) — FEEDBACK SERALE: FAQ correzione incasso, campanella che non si aggiornava, mockup "due pagine di accesso"
4 punti di Eli. ① **FAQ nuova in /aiuto** "Ho registrato un incasso sbagliato: come lo correggo? E il Bilancio?" (Azzera e reinserisci, l'incasso sbagliato sparisce dal mese d'origine, mai negativi). ② **[BUG] Campanella col conteggio vecchio al ritorno**: il markRead sul tocco usa `revalidate: false` (necessario: la revalidation concorrente uccideva la navigazione, fix 18 lug) → la Home in router cache non veniva MAI invalidata. Fix: seconda chiamata IDENTICA (upsert idempotente) con revalidation dopo 1,5s, a navigazione avvenuta → al back la Home è fresca. ③ **Timeout lock senza impronta**: per account CON password già funziona (blocco+timeout restano); per account GOOGLE la rimozione dell'ultima impronta spegne il blocco (anti-lockout deliberato 21 lug: non resterebbe NESSUN modo di sbloccare; il "riaccedi con Google" non protegge — con la sessione Google attiva rientra da solo senza chiedere nulla). Proposta a Eli: **PIN di sblocco locale** (coerente col modello "blocco di cortesia") — in attesa di decisione. ④ **Mockup 4 schermate di accesso** (A avvio / B lucchetto impronta / C lucchetto password / D login) inviato come PNG — Eli deve dire QUALI DUE vede in sequenza per capire il "doppio accesso" (sospetto: A+B sarebbe normale; B doppia = race; D = scollegamento). tsc+build+448/448 verdi.

### ✅ 4 ago (7) — RI-REVIEW dell'intera giornata (richiesta Eli "verifica che sia corretto"): 2 agent, 1 ALTA + 5 MEDIE + basse, tutte fixate
Due revisori adversariali freschi sul diff delle 10 PR del 4 ago (logica server/soldi + UI/casi limite), findings verificati di persona e FIXATI:
- **[ALTA, regressione della PR #272] Bilancio: l'acconto "pre-log" SPARIVA al saldo.** `incassiFromDoc` con ≥1 voce `payment` ignorava del tutto i denormalizzati; ma l'acconto TRASFERITO in conversione (converti-fattura copia i campi SENZA voce log) e gli incassi pre-26-lug non hanno voce nel log → al saldo (che logga solo il residuo) il totale perdeva l'acconto (600 contati su 1000 incassati). Fix doppio: **rete di sicurezza** in `incassiFromDoc` (se `paid_amount` > netto eventi → reintegro della differenza, datata come la vecchia logica: mese approssimato, totale GIUSTO; mai correzioni negative) + **converti-fattura ora scrive la voce `payment` kind acconto** nel log della fattura con la data VERA dell'incasso (retry tollerante pre-034). **+4 test (447/447)**.
- **[MEDIA] Export Bilancio CSV divergente dalla pagina**: usava ancora la vecchia logica one-event-per-doc → ora passa da `incassiFromDoc` (una riga per incasso, righe negative "Storno incasso" per i reset, filtro `!== 0`); `IncassoEvent` esteso con `kind` ('acconto'|'saldo'|'reset').
- **[MEDIA×2, trovata da ENTRAMBI] RichiamoCard "Prepara il preventivo" MUTO sugli errori**: `runActionVoid` scarta il `{error}` RITORNATO da duplicateDocumentAction (Free alla quota, origine nel cestino…) → bottone che "non fa nulla". Fix: `runAction` + toast su `.error` + **guardia sincrona anti doppio-tap con ref** (due tap = due bozze e due numeri consumati; `creating` della transition aggiorna solo al re-render).
- **[MEDIA] preventivo_fermo con riferimento stantio**: il REINVIO aggiorna sent_at ma non azzera last_reminder_at → `ref = last_reminder_at ?? sent_at` dava "fermo da 200 giorni" con chiave già letta (promemoria invisibile). Fix: `ref = max(sent_at, last_reminder_at)`; query in ASC (i più fermi nei 20 slot, prima i DESC li tagliava). Residuo accettato: "Riapri" di uno scaduto senza reinvio mostra giorni grandi (veri: il cliente non risponde da allora).
- **[MEDIA] Cronologia, dedupe troppo aggressivo**: ① rifiuto del CLIENTE (con motivazione, pagina pubblica che non scrive log) nascosto per sempre da un vecchio `marked_rejected` manuale → scappatoia `!!rejectionReason ||` (specchio di acceptedByClient); ② scadenza NATURALE post-Riapri nascosta da un vecchio `marked_expired` → il derivato si sopprime solo se `lastLogAt('marked_expired') > lastLogAt('reopened')`.
- **[MEDIA] "Salva e invia" su preventivo RIFIUTATO** condivideva un link che il cliente vede come rifiutato e NON può accettare (accept route `.in(sent,viewed)`) → il bottone non compare più su rejected (resta "Aggiorna"; prima si riapre con "Riapri", transizione esistente).
- **[BASSE fixate]**: errore della query lista (range) scambiato per archivio vuoto → ora throw all'error boundary con "Riprova" (prima empty state bugiardo); `appendLog` rilegge il log FRESCO prima dell'append (finestra di race da secondi a ms; append atomico RPC = follow-up); data nel PASSATO nel form vetrina ignorata (min è solo hint UI); ListPager h40→44 (tap target).
- **Verificati PULITI dai revisori (con prova)**: chiave `fermo:` vs regex markRead; loop redirect paginazione impossibile; `.range()` oltre il count = 200 con array vuoto (niente 416); cascata 066→065→base col destructuring corretto; withLog cumulativo fatture; ShareButton montato su mobile ?edit=1 (hidden = CSS, portal su body); public_token mai null (default DB); ordinamento timeline; dedupe accepted corretto in tutte le combinazioni; TYPE_ICON unico Record sul tipo; KPI invariati; zero violazioni spazi/€ nelle righe nuove.
- **Annotati NON fixati (accettati/deferred)**: append log atomico via RPC (cross-request vero); cronologia con >50 aperture numera dalla 51ª (limit pre-esistente); riporta-in-bozza del preventivo senza voce `payment_reset` (coerente finché registerDeposit non logga `payment`; diventerà obbligatorio se si loggano gli acconti dei preventivi); cron scadenze e decline pubblico non scrivono log (i derivati ora coprono).
- **DECISIONE Eli (4 ago, "dà fastidio")**: mesi a entrate NEGATIVE eliminati — un `payment_reset` ora ANNULLA gli incassi che cancella NEL LORO MESE D'ORIGINE ("mai esistiti"), non sottrae nel mese della correzione. `incassiFromDoc` rilegge il log in ordine cronologico (reset = azzera il cumulato fino a lì); kind 'reset' rimosso; CSV senza righe "Storno" (gli incassi azzerati semplicemente non compaiono). Rete di sicurezza invariata sul netto dei sopravvissuti. +1 test (448/448).
- tsc+build+**447/447** verdi · scan spazi pulito · smoke 20/20.

### ✅ 4 ago (6) — CONGELAMENTO FOTO del rapportino a livello DB (⚠️ migration 067) — chiude l'ultimo buco prove FES
Punto tecnico finale del piano (deferred noto: "trigger DB work_photos", gemello mancante della 057). PRIMA: il blocco post-firma delle foto era solo APP-level (`documentHasSignedReport`) → un titolare con PostgREST diretta poteva alterare le foto che il cliente ha firmato.
- **⚠️ migration 067** (`067_congela_foto_rapportino.sql`, VALIDATA su PG16 reale — 7 scenari): trigger `protect_signed_report_photos` su work_photos. Blocca per gli utenti (service_role bypassa) quando il `document_id` della foto ha un lavoro con `report_signed_at` valorizzato: **INSERT** (aggiunta prove post-firma) e **UPDATE** di `visible_to_client`/`label`/`storage_path` (alterazione in loco di ciò che il cliente ha visto).
- **NON blocca** (design attento — il punto che rendeva delicato il trigger): **DELETE** (filosofia 057: cancellazione libera/recuperabile; e il purge del cestino `purgeDeletedDocumentAction` gira col CLIENT UTENTE e cancella le foto orfane → un blocco lo romperebbe) e l'**UPDATE del solo `document_id`→NULL** (FK `ON DELETE SET NULL` durante il purge del documento). Validato: purge documento firmato → foto sopralluogo sopravvive con document_id NULL e visibilità intatta; cancellazione account (admin client) bypassa.
- Idempotente, tollerante pre-053 (senza report_signed_at il trigger non si crea). Nessun codice app cambiato (la guardia app-level resta come primo strato con messaggio pulito; il trigger è difesa in profondità). Residuo noto: lo scollegamento manuale via PostgREST (solo document_id→NULL) non è bloccato — non altera contenuto né visibilità, gap minimo accettato.
- tsc+build+443/443 verdi.

### ✅ 4 ago (5) — PAGINAZIONE VERA delle liste (preventivi + fatture)
Punto 5 del piano migliorie. PRIMA: tetto `.limit(500)` → oltre 500 documenti i più recenti (col default "Meno recenti" ASC) sparivano dalla lista senza segnale.
- **Paginazione a livello DB**: `.select(..., { count: 'exact' })` + `.range(offset, offset+PAGE_SIZE-1)` con `PAGE_SIZE=20` e `?page=` (1-based). Il totale filtrato (`count`) costruisce il pager.
- **`app/(app)/_components/ListPager.tsx`** (NUOVO, server component, solo `<Link>` con prefetch): "‹ Precedente / Pagina X di Y / Successiva ›"; nascosto con una sola pagina (`totalPages<=1` → null, quindi per gli utenti con <20 documenti NON cambia nulla). Preserva tutti i searchParams tranne `page` (pagina 1 = URL pulito).
- **Reset a pagina 1 al cambio contesto**: SearchBar (condivisa), SortSelect e AdvancedFilters ora fanno `params.delete('page')`; i tab di stato hanno già href puliti. **Link stantio** a una pagina inesistente (dopo cancellazioni) → `redirect` all'ultima pagina valida invece di lista vuota.
- Applicato a `preventivi/page.tsx` e `fatture/page.tsx` (gemelli). Ricerca per cliente/voce/fattura-collegata, filtri e ordinamento invariati (il conteggio è esatto sull'insieme filtrato). L'ordinamento "expiry" ha un re-sort JS che ora agisce entro la pagina (niente global grouping — accettato, sort di nicchia).
- ⚠️ NOTA follow-up: le query KPI dei conteggi (tab/valore) restano senza limite → su account >1000 documenti i badge dei tab possono troncare (serve RPC aggregato); la LISTA però ora è completa. tsc+build+443/443 verdi · scan pulito.

### ✅ 4 ago (4) — STORIA DEGLI INCASSI nel Bilancio (l'acconto non "migra" più di mese)
Punto 4 del piano migliorie (difetto DEFERRED noto). PRIMA: il Bilancio attribuiva ogni fattura a UN mese (quello di `paid_at`) con l'intero `paid_amount` → incassando il saldo, `paid_at` veniva sovrascritto e l'acconto di gennaio "migrava" a febbraio, falsando le entrate mensili.
- **Scoperta chiave**: il `document_log` è append-only e registra GIÀ ogni incasso come voce propria — `payment` (kind acconto/saldo) con data e importo del SINGOLO incasso, `payment_reset` con l'importo azzerato. La storia esiste già → **nessuna tabella nuova, nessuna migration, flusso di registrazione INTATTO**.
- **`lib/bilancio/incassi.ts`** (PURO, 8 test): `incassiFromDoc(doc)` → eventi `{ when, amount }`, uno per incasso nel suo mese; i reset sottraggono; fallback ai campi denormalizzati (`paid_at`/`paid_amount`) per i documenti storici senza voci payment nel log (replica esatta della vecchia logica → zero regressioni sui vecchi).
- **bilancio/page.tsx**: `document_log` aggiunto al select (rich); `incassi = entrateDocs.flatMap(incassiFromDoc)` al posto del map one-per-doc. Il resto (filtro mese, somma, grafico 6 mesi) invariato. Fallback pre-migration invariato.
- Il Bilancio era l'UNICO punto col difetto (dashboard "Fatturato" è accepted_at/total, altra grandezza). tsc+build+443/443 verdi · scan pulito.

### ✅ 4 ago (3) — PRENOTAZIONE DALLA VETRINA: preferenza appuntamento nel form richiesta (⚠️ migration 066)
Punto 3 del piano migliorie. Il cliente sul profilo pubblico può indicare QUANDO preferirebbe il sopralluogo — è solo una preferenza (l'artigiano conferma, nessun impegno automatico).
- **⚠️ migration 066** (`066_richieste_preferenza_orario.sql`): `marketplace_requests.preferred_slot TEXT`. GRANT non necessari (insert admin-only 045, select a tutta tabella). Idempotente.
- **Form** (`RequestForm`): sezione "Quando preferiresti?" — chips fascia (Mattina/Pomeriggio/Sera, single-select con deseleziona) + data facoltativa → composte in una stringa leggibile ("12/03/2027 · pomeriggio") inviata in `preferred_slot`. Nota "è solo una preferenza".
- **API** (`/api/marketplace/richiesta`): `preferred_slot` nello schema Zod; insert a CASCATA tollerante 066→065→base (una migration assente non fa perdere anche l'altro campo).
- **Richieste** (`page.tsx` select tollerante + `RequestRow`): pillola crema "Preferisce: **…**" (icona CalendarClock) nel dettaglio aperto, solo se indicata; la preferenza va anche nella nota del link "Crea preventivo".
- tsc+build+435/435 verdi · scan pulito.

### ✅ 4 ago (2) — PREVENTIVO RICORRENTE dal richiamo (punto 2 del piano migliorie)
La feature nuova col miglior rapporto valore/rischio per il target (manutenzioni che tornano). Sulla `RichiamoCard` (ramo richiamo ATTIVO), se il lavoro ha un preventivo di origine (`documentId`, sempre valorizzato: il lavoro nasce dal preventivo accettato), bottone "Prepara il preventivo per la manutenzione" → riusa **`duplicateDocumentAction(documentId, { keepTitle: true })`** (già testata: copia cliente, voci, opzioni, acconto, unit_cost/supplier_list_id in una NUOVA BOZZA di preventivo, redirect da sé). Navy pieno quando il richiamo è SCADUTO (due), bianco bordato quando è futuro. Flusso: notifica richiamo in campanella → /lavori/[id] → bottone navy → nuova bozza da rivedere e inviare. Nessuna migration (document_id è già il preventivo, verificato in createLavoroFromDocument). Free gate ereditato dalla duplicate. `runActionVoid` (l'action reindirizza). tsc+build+435/435 verdi · scan pulito. Voce in /novita.

### ✅ 4 ago — PROMEMORIA "PREVENTIVO FERMO" in campanella (piano "uno per uno" approvato da Eli)
Eli ha approvato la lista migliorie ("procediamo uno per uno, fanne uno, mi dici fatto e chiedi se proseguire"). Punto 1: promemoria INTERNO all'artigiano (niente email al cliente = nessun nodo B.0).
- **lib/notifications.ts**: nuovo tipo `preventivo_fermo` — preventivi sent/viewed con riferimento (= `last_reminder_at ?? sent_at`) ≥ 7 giorni fa e non oltre la scadenza (i quasi-scaduti hanno già la card In scadenza; niente doppioni). Chiave `fermo:{id}:{ref}` → dopo un sollecito la chiave cambia e il promemoria riparte (torna non-letto solo alla soglia successiva). Titolo "Preventivo N fermo da X giorni", body "… non ha ancora risposto: un sollecito?", href al dettaglio.
- **Toggle** `inapp_preventivo_fermo` (default ON): Zod in workspace.ts, mapping impostazioni/page.tsx (⚠️ il mapping esplicito va esteso a ogni chiave nuova — il tsc lo becca), riga in tabs/notifiche.tsx; icona Clock viola in NotificationList; voce in /novita.
- **Risposta a Eli su pagamenti con carta**: diverso dalla riconciliazione bancaria (che legge il conto = open banking, esclusa). Con Stripe Connect Standard i soldi vanno DIRETTI sul conto Stripe dell'artigiano, noi non tocchiamo mai fondi né dati carta. MAI incassare noi e girare i soldi (= intermediari di pagamento, serve licenza). Gated su Stripe live + riga nel dossier avvocato (B.0 soldi).
- tsc+build+435/435 verdi · scan pulito.

### ✅ 3 ago (16) — [BUG] "Visto" spariti dopo Riporta in bozza + FAQ listini fornitori + fix `,,`
Richiesta Eli: "in cronologia rimangano TUTTI i passaggi — è la storia del documento, nulla si cancella" + FAQ su come gestire i listini dei fornitori.
- **[BUG] Aperture sparite in bozza**: preventivi/[id] (`const views = doc.status !== 'draft' ? viewsRaw : []`) e fatture/[id] (gemello) nascondevano le aperture quando il documento tornava in bozza (Riporta in bozza / Riattiva) → gate RIMOSSO: le aperture restano sempre in cronologia. Anche il `fatturaRef` della timeline ora usa il dato grezzo (non più gated su accepted) — le CARD restano filtrate per stato. ⚠️ REGOLA: la cronologia riceve i dati GREZZI, mai filtrati per stato corrente.
- **[BUG latente] `,,` doppio nella Promise.all di preventivi/[id]** (array sparso, introdotto in un giro precedente): `supplierLists` si destrutturava sull'elemento VUOTO → sempre undefined → l'avviso "listino in scadenza" nel form era MORTO in silenzio (prop optional con default []). Virgola rimossa, avviso di nuovo vivo.
- **/aiuto**: FAQ nuova "Come gestisco i listini dei fornitori?" (Pro, Catalogo e listini, ricarico, import foto/PDF ~50 pagine, Rinnova con abbinamento per codice, prezzo proposto, scadenza, costi mai al cliente); FAQ SdI allineata alla dicitura (non più "badge").
- tsc+build+435/435 verdi · scan pulito.

### ✅ 3 ago (15) — Esito SdI in lista fatture come DICITURA (non badge)
Richiesta Eli: "piuttosto che il badge, mettilo come nella pagina preventivi per i preventivi che hanno 'bozza fattura'". In fatture/page.tsx la pillola colorata accanto allo stato è sostituita da una dicitura in riga 2, allineata a destra, stessa grafica della "fattura collegata" nella lista preventivi (11px, fontWeight 600, testo colorato, icona FileCheck2, niente sfondo): "SdI · Consegnata" verde / "SdI · Inviata" blu / "SdI · Emessa" ambra / "SdI · Scartata" rossa. `SDI_BADGE` → `SDI_LABEL`; riga 2 con flexWrap+marginLeft auto come il gemello preventivi. Ricerca "sdi …" invariata. tsc+build+435/435 verdi · scan pulito.

### ✅ 3 ago (14) — CRONOLOGIA COMPLETA (ogni apertura + ogni transizione manuale) + "Salva e invia" in modifica + 3 FAQ
Richiesta Eli: "ogni apertura elencata con data e ora nella cronologia; FAQ su modifica bozza / ricerca SdI / preventivi scaduti; in modifica manca Invia; la cronologia deve contenere ogni minima azione, anche di ritorno indietro e poi avanti".
- **Ogni apertura = evento proprio in cronologia** (`DocumentTimeline`): via il riassunto "Aperto dal cliente · N volte" → una voce per ciascuna `document_views` in ordine cronologico ("Aperto dal cliente", "(2ª volta)", …) con data e ora.
- **Ogni transizione MANUALE loggata**: la status route dei preventivi (`app/api/preventivi/[id]/status/route.ts`) ora scrive nel `document_log` (best-effort, tollerante colonna assente) le voci nuove `marked_accepted` / `marked_rejected` / `marked_expired` / `unaccepted` (riporta in bozza) / `reopened` (Riapri da rifiutato/scaduto). DocumentTimeline le mostra con icone/colori dedicati e DEDUPE sugli eventi derivati dallo stato (accettato derivato solo se dal cliente o senza log; rifiutato/scaduto derivati solo senza la voce log gemella) → niente doppioni, e il giro indietro-e-avanti si legge per intero.
- **Cronologia mobile dei preventivi UNIFICATA su DocumentTimeline**: la card inline costruita a mano in preventivi/[id] (che IGNORAVA il document_log: niente modifiche/incassi/reinvii su mobile) è stata sostituita dal componente condiviso → una sola cronologia ovunque (28 lug superato: `CronologiaDisclosure` ora inutilizzato).
- **"Salva e invia" in modifica**: nel branch edit non-bozza (sent/viewed/rejected/expired) accanto ad "Aggiorna" c'è il navy "Salva e invia" (`doSendFromDraft`: valida → salva → apre il pop-up canali via evento `cartacanta:open-share-dialog`; il ShareButton `listenOpenEvent` è montato anche quando la toolbar è nascosta su mobile). Copre il caso "aggiungo il cliente alla bozza/al documento in modifica e poi non trovo Invia".
- **/aiuto, 3 FAQ nuove**: "Come modifico una bozza? Dove devo cliccare?", "Come trovo le fatture passate dallo SdI?" (cerca "sdi", "sdi consegnata"…), "Come trovo i preventivi scaduti?" (tab/ricerca "scaduti" + reinvio).
- tsc+build+**435/435** verdi · scan spazi pulito (build+sorgente).

### ✅ 3 ago (13) — CARD VOCI VARIANTE B (scelta Eli dal mockup) + badge SdI con ESITO + ricerca "sdi consegnata"
- **VociTable mobile = VARIANTE B**: le voci compilate stanno CHIUSE in una riga sola (descrizione · "qtà unit × prezzo €" · margine/`da completare` · totale · ›); si apre quella toccata, col layout compatto della variante A (Tot nella testata, descrizione senza etichetta, campi h40 con label 11px, **📐 DENTRO il campo Q.tà** — `CalcQuantitaButton iconOnly` — e `VoceCosto` su UNA riga «🔒 Costo [campo] pillola», ora inline anche su desktop) + bottone "Chiudi ˄". La voce NUOVA (o senza descrizione) nasce aperta (`openKey`, init = prima voce vuota → in create parte aperta col suo autoFocus); rimozione/aggiunta aggiornano openKey. SOLO presentazione: dati/serialize/validazioni intatti; desktop invariato (badges e "Calcola quantità" testuali ora `hidden lg:*`). **Verificato sul componente REALE con Chromium a 390px**: 2 voci chiuse = 195px (prima ~600), tap→apre, Chiudi→richiude, Aggiungi→nuova aperta, riga chiusa aggiornata col testo scritto, 0 overflow. Screenshot fedele al mockup.
- **Badge SdI con ESITO in lista fatture**: "SdI ✓" → `SDI_BADGE` con dicitura per esito (SdI inviata blu · SdI consegnata verde · SdI emessa ambra [mancata_consegna] · SdI scartata rossa).
- **Ricerca "sdi + esito"**: nuovo `sdiEsitoQuery` in status-search.ts ("sdi" interruttore; "sdi consegnata"/"sdi scartate"/"sdi emessa"/prefissi → filtro su sdi_status; "sdi caldaia" → testuale). **+5 test (435/435)**.
- tsc+build verdi · scan pulito.

### ✅ 3 ago (12) — VISUALIZZAZIONI dentro la CRONOLOGIA (via le sezioni dedicate)
- Richiesta Eli: le aperture del preventivo devono stare NELLA cronologia, non in sezioni proprie. DocumentTimeline: evento "Aperto dal cliente · N volte" (data = prima apertura, dettaglio "ultima apertura il X"). Mobile preventivo: la card "Visualizzazioni" (stato Visto) RIMOSSA; l'evento inline della cronologia porta conteggio + "prima il X · ultima il Y" via dateLabel. Desktop: ViewHistorySection smontata dalla pagina (il componente resta nel repo, ora inutilizzato); i dati per-apertura (IP/device) restano in document_views a fini probatori. In sospeso: mockup card Voci compatta (varianti A/B inviate, attesa scelta di Eli).
- tsc+build+430/430 verdi.

### ✅ 3 ago (11) — [BUG] BottomNav SPARITA su Nuovo preventivo / Nuova fattura
- Causa vera: in create la PRIMA VOCE ha l'autoFocus → per il hook "nascondi con la tastiera" (F21) un campo a fuoco = tastiera aperta → barra nascosta dal primo istante SENZA nessuna tastiera (il tocco su Catalogo — un non-campo — la faceva ricomparire, esattamente come descritto da Eli). Fix in `useHideOnKeyboard`: conta solo il fuoco dato DALL'UTENTE (pointerdown sul campo, finestra 3s + match del target); tocco su un campo GIÀ a fuoco (autofocus) → setTyping(true) diretto (nessun focusin parte in quel caso). Verificato sul componente REALE con Chromium (esbuild + stub next/navigation, banner `var process={env:{}}` per next/link): dopo autofocus visibile ✓ · tap sul campo nascosta ✓ · tap su bottone torna ✓.
- tsc+build+430/430 verdi.

### ✅ 3 ago (10) — Avviso d'attesa durante l'analisi del listino
- In ListinoDetail, durante `extracting`, riquadro ambra: "Per i PDF lunghi possono servire fino a un minuto: non chiudere la pagina, le voci compaiono qui appena pronte." (Copy ONESTA: non "diversi minuti" — la route ha maxDuration 60s, o finisce entro un minuto o fallisce; chiudere la pagina butta via il risultato perché arriva al client.) tsc+build+430/430 verdi.

### ✅ 3 ago (9) — PUNTO 10 CHIARITO: nei PREVENTIVI si cerca per FATTURA COLLEGATA
- Chiarimento di Eli: "fattura annullata" nel cerca dei PREVENTIVI deve trovare i preventivi con la FATTURA COLLEGATA in quello stato (non i preventivi rifiutati). Nuovo `linkedFatturaQuery` in status-search.ts: la parola "fattura/fatture/fatt" è l'INTERRUTTORE — da sola trova i preventivi con una fattura qualsiasi, con uno stato ("bozza fattura", "fatture pagate", "fatt annull") filtra su quello; con parole non-stato ("fattura caldaia") resta la ricerca testuale. In preventivi/page.tsx: query fatture per origin_document_id → `id.in(prevIds)` (0 risultati = uuid impossibile, `.in` vuoto non è sintassi PostgREST valida). `FATTURA_STATUS_KEYWORDS` spostata in lib (fonte unica, la lista fatture la importa). **+6 test (430/430)**.
- tsc+build verdi.

### ✅ 3 ago (8) — PDF A PEZZI (tutte le pagine, fino a ~50) + linguette catalogo più alte + Sollecita morbido
- **[BUG] "AI non disponibile" sull'import PDF**: il testo veniva estratto (unpdf ok in prod) ma 15k caratteri di prezzario producevano un output oltre il tetto di token → **JSON troncato** → parse fallito su ENTRAMBI i provider → 503. Fix strutturale che risolve anche il limite "prime 10 pagine": **analisi A PEZZI** — `splitDocText` (taglio sui fine-riga, CHUNK_CHARS 9k, MAX_CHUNKS 10 ≈ 45-50 pagine, **4 test**: zero perdite alla ricomposizione) → chiamate AI in PARALLELO (Promise.allSettled, Mistral→OpenAI per pezzo, prompt "max 50 voci per risposta") → voci unite (cap 300). Pezzi falliti = parziale, non tutto perso; `_truncated`/`_failedChunks` nella risposta → **avviso ambra ONESTO in ListinoDetail** ("analizzate ~50 pagine" / "una parte non letta"). `maxDuration = 60` sulla route (10 chiamate parallele > 15s default).
- **Linguette "Il mio catalogo | Listini fornitori" più alte** (padding 15px, font 14): governano tutta la pagina sotto.
- **"Sollecita per mail" in Home morbido**: da navy pieno con ombra → bianco bordato come i gemelli WhatsApp/Chiama (peso 600, icona; spedito = testo verde). ⚠️ Commento JSX MAI dentro `{cond && (…)}` — due volte oggi lo stesso parse error Turbopack.
- tsc+build+**424/424** verdi · scan pulito.

### ✅ 3 ago (7) — DIALOG: causa VERA del taglio trovata (grid blow-out) + sfondo 3° schiarimento + cliente automatico dalla richiesta
- **[BUG CONFERMATO sul componente REALE] Dialog "Collega" con scritte tagliate**: NON era il truncate delle righe (già deployato) — la colonna della **grid** del contenitore base (`dialog.tsx`) si allargava alla min-content del nome lunghissimo (grid item con min-width:auto → il div `space-y-3` non può restringersi) → input/lista/bottoni più larghi del dialog e TAGLIATI dal nuovo overflow-x-hidden. Fix: **`*:min-w-0`** sulle grid item del contenitore. Verificato con harness esbuild sul VERO LinkToPreventivoButton+dialog.tsx a 360px: senza fix stato a 375px su dialog di 329 (= foto Eli, nome intero non troncato); col fix stato a 300 ✓, nome coi puntini ✓, bottoni dentro ✓. ⚠️ REGOLA: le grid item del dialog hanno min-w-0 — i contenuti larghi si troncano coi loro truncate.
- **Sfondo, terzo schiarimento**: #f6f4ef → **#f8f6f1** (AppShell + dashboard).
- **Tasto "Apri la scheda lavoro" ALLINEATO tra preventivo e fattura**: su fattura spostato dalla cima (sotto il collegato) alla zona azioni in fondo (dopo Segna pagata/Annulla), stesso punto del gemello preventivo.
- **Richiesta → preventivo SENZA titolo troncato**: "Crea preventivo" passa `?richiesta=<id>` (niente più ?titolo=); /preventivi/nuovo registra il cliente in RUBRICA (o riusa quello con stessa email/telefono — niente doppioni) e lo preseleziona nel riquadro Cliente. Tollerante pre-065 e best-effort (fallisce → form normale, recapiti restano nella nota).
- tsc+build+420/420 verdi · scan pulito.

### ✅ 3 ago (6) — PUNTO 10: ricerca per DICITURA di stato nelle liste
- Nel cerca di Preventivi E Fatture ora funzionano anche le diciture composte e le loro parti: "fattura annullata", "bozza fattura", "annullate", "annull", "preventivo rifiutato"… → filtro di stato (unione se più stati: "bozze annullate"). Nuovo helper PURO `lib/documents/status-search.ts` (`statusesFromQuery` tokenizzata: parole generiche fattura/preventivo/documento ignorate, match esatto → prefisso → stem per plurali; una parola non-stato → ricerca testuale normale; `coreQuery` per i check sdi/modificata: "fatture sdi" = "sdi") + **11 test** (420/420). Le due liste usano l'helper al posto della vecchia logica single-word (mappe keyword invariate).
- tsc+build+420/420 verdi · scan pulito.

### ✅ 3 ago (5) — LOTTO FEEDBACK SERALE (punti 1-9) — ⚠️ migration 065 DA APPLICARE
- **Sfondo** #f3f1ec → **#f6f4ef** (secondo schiarimento; AppShell + dashboard, tenere allineati).
- **Dialog, cintura**: `overflow-x-hidden` sul contenitore interno di TUTTI i dialog (dialog.tsx) — mai scroll orizzontale, si tronca. (Il fix truncate di Collega era già deployato: se Eli lo vede ancora largo è la PWA su build vecchia → chiudere e riaprire 2 volte.)
- **"Apri la scheda lavoro" da preventivo E fattura**: nuovo `LavoroLinkButton` (Link puro, stesso vestito di ApriLavoroButton). Preventivo: query lavori keyata su document_id (tollerante 048) → link in OGNI stato quando il lavoro esiste; ApriLavoroButton (che lo CREA) resta solo su accepted senza lavoro. Fattura: query su origin_document_id → card mobile (nascosta in editing) + bottone desktop nel banner del collegato.
- **Richieste**: link "Non hai risposto? Segna come non risposta" (replied→read, con toast su errore); **campo CELLULARE separato nel form vetrina** (⚠️ migration 065 `marketplace_requests.customer_phone`, GRANT non necessari: insert admin-only 045, select a tutta tabella): email consigliata + cellulare, basta un recapito; API con insert tollerante pre-065; RequestRow mostra ENTRAMBI i recapiti con bottoni Chiama/WhatsApp/Email (flexWrap) e la nota di Crea preventivo include il cellulare.
- **[BUG] Import listino da PDF morto in produzione**: pdf-to-image usava @sparticuz/chromium su Vercel = rotto per regola B.8 → falliva SEMPRE ("Impossibile elaborare il PDF", collaudo Eli col prezzario E.19). Ora: **testo estratto server-side con `unpdf`** (dipendenza nuova, puro JS — verificato sul PDF vero di Eli: 45 pagine, 85k caratteri) → nuovo `lib/ai/extract-doc-text.ts` (prompt documenti/prezzari: codici articolo in testa alla descrizione, righe di analisi escluse; Mistral→OpenAI, maxTokens 4000, cap input 15k chars) → stesso ExtractResultSchema. PDF scansionato senza testo → 422 con invito alla foto. `lib/ai/pdf-to-image.ts` ELIMINATO.
- **Avvio, lampo di /login**: anche la PRIMA fetch di /avvio può atterrare su /login per un fallimento transitorio del refresh → ora RIPROVA una volta dopo 600ms prima di decidere /login. **CACHE_VERSION → cc-v4** (regola: ogni modifica a /avvio bumpa il SW).
- **Punto 9 di Eli (cliente copiato al collegamento)**: GIÀ implementato nei giri (2)/(4) di oggi — comunicato che per i collegamenti fatti prima del deploy basta rifare "Cambia" → stesso preventivo.
- tsc+build+409/409 verdi · scan spazi puliti. ⏭️ Collaudo Eli: import PDF listino, form richiesta con cellulare (post-065), apertura app, tasto scheda lavoro.

### ✅ 3 ago (4) — SECONDO GIRO caccia-bug (2 agent: logica server + UI/stati): 2 MEDIE + 4 rifiniture
Richiesta Eli "fai un ulteriore controllo di bug". Due cacciatori paralleli sull'intero diff di giornata, findings verificati e fixati:
- **[MEDIA] linkDocumentAction e il CESTINO**: la fattura soft-deleted veniva ancora matchata dall'update (e un preventivo cestinato poteva finire marcato Accettato). Ora: `.is('deleted_at', null)` sull'update della fattura E **validazione del preventivo PRIMA di scrivere** (deve essere un preventivo del workspace, fuori dal cestino, ≠ dalla fattura stessa) → chiuso anche il dato sporco da uuid arbitrario (pre-esistente).
- **[MEDIA] Gate `?edit=1` su stati non modificabili**: con URL stantio (back del browser dopo Annulla/Segna pagata) le card di lettura sparivano ma il form non c'era → pagina quasi vuota, banner "Puoi riattivarla" SENZA bottone Riattiva. Ora `const editing = edit==='1' && status non-finale` governa TUTTI i gate → su accepted/rejected la vista è quella normale. Matrice stati×edit mobile+desktop verificata dal revisore (desktop invariato in tutti gli stati).
- **[BASSE] Scollega dal bottone fuori dal dialog: errore ora in toast (prima finiva nel {error} del dialog chiuso = invisibile); WhatsApp nelle richieste solo per numeri che wa.me sa interpretare (internazionale esplicito o mobile 39 3xx — i FISSI mostravano un bottone rotto); email lunghissima nel dettaglio richiesta con overflowWrap (sbordava, verificato con Chromium); copy guardia Fatturato dedicata al caso "documento collegato sparito/cestinato"; generateMetadata di /professionisti/[id] col gate enabled/published_at (il nome di un profilo NON pubblicato non finisce più nel title).**
- **Verificati puliti** (con prova, tra cui repliche Chromium a 360/320px + cc-large): righe Chiama+WhatsApp e card contatti vetrina senza sbordi; DialogFooter su una riga (twMerge vince su flex-col-reverse); race read→replied serializzata dallo stesso startTransition; eredità cliente anti-race; RLS su tutte le query nuove; sfondo #f3f1ec senza superfici stonate; pillole/statusError ok. tsc+build+409/409 verdi.

### ✅ 3 ago (3) — RI-REVIEW dell'intera giornata (richiesta Eli "ricontrolla tutto"): 9/9 CONFORMI + 4 rifiniture
Revisore fresco sull'intero diff dei 3 lotti del 3 ago, requisito per requisito: **tutti e 9 CONFORMI** (aria Impostazioni, Strumenti unificata, dialog Collega, banner in alto + edit=1 con desktop verificato caso per caso, eredità cliente, guardia Fatturato, vetrina, richieste con Contatta, sfondo). Rifiniture applicate dai findings:
- **[MEDIA] Guardia Fatturato**: il ramo "documento collegato = fattura" non escludeva le fatture NEL CESTINO (il ramo gemello sì) → `.is('deleted_at', null)` anche lì.
- **[BASSA] Guardia Fatturato, messaggi onesti**: un errore di lettura delle due query documents veniva raccontato come "prima la fattura" → ora "Non riesco a verificare… riprova" (errori letti, non ignorati).
- **[BASSA, pre-esistente] linkDocumentAction con fattura inesistente**: 0 righe → proseguiva con ok:true e poteva marcare Accettato un preventivo senza collegamento → ora `!fatturaRow` = errore "Fattura non trovata".
- **Cronologia nascosta in ?edit=1 mobile** (allineamento al gemello preventivo, segnalazione del revisore); il recapito in chiaro delle richieste segna anch'esso "Risposta" (già in c7d9665).
- Verificati puliti dal revisore: spazi Turbopack, import morti, desktop invariato con ?edit=1, catene Supabase, rollback ottimistici. tsc+build+409/409 verdi.

### ✅ 3 ago (2) — VETRINA: modulo prima dei contatti · RICHIESTE con Contatta · sfondo più chiaro
- **Profilo pubblico /professionisti/[id]**: i tasti Chiama / Scrivi un'email spostati DOPO il modulo richiesta (Eli: "voglio puntare al fatto che usino quello") in una card "Preferisci il contatto diretto?" — entrambi BIANCHI bordati (il navy resta solo all'invio del modulo).
- **Richieste (/richieste)**: bottoni **Contatta** in ogni richiesta — telefono → Chiama + WhatsApp (wa.me col saluto precompilato, numero validato con normalizePhoneForWhatsApp), email → Scrivi un'email (mailto con oggetto). **Al tocco la richiesta si segna DA SOLA "Risposta"** (best-effort silenzioso: sta partendo tel:/wa.me, un toast non si vedrebbe) → il bottone manuale "Segna come risposta" RIMOSSO (proposta accettata: il gesto di contatto È la risposta). "Crea preventivo" navy a tutta larghezza sotto.
- **Sfondo app**: #f0eee8 → **#f3f1ec** ("schiariamo leggerissimamente") in AppShell e dashboard — tenere allineati.
- tsc+build+409/409 verdi · scan spazi puliti. ⏭️ Collaudo Eli: profilo pubblico (ordine card), tocco Chiama/WhatsApp su una richiesta → pillola "Risposta".

### ✅ 3 ago — LOTTO FEEDBACK (7 punti) + decisione "Fatturato" (scelta A di Eli) — ✅ migration 064 APPLICATA
- **Altro**: Bilancio (con hint PRO) e "Fatti trovare dai clienti" (col badge richieste) DENTRO la card Strumenti — via la sezione "Soldi" e la card singola.
- **[BUG foto] Dialog "Collega a un preventivo" "troppo grande"**: misurato sul PNG (bianco 45→1034 su 1080) il dialog NON sborda — erano ① lo stato ("Scaduto") TAGLIATO dalla riga (nome cliente lungo senza spazi: flex item senza `min-w-0` non si restringe) e ② i 3 bottoni impilati in colonna (dialog altissimo). Fix in LinkToPreventivoButton: riga con `min-w-0 flex-1` + `truncate` su titolo e nome; footer `flex-row flex-wrap` con etichetta "Collega". Verificato con replica Chromium a 360px (stato dentro il riquadro, bottoni su 1 riga, altezza 233px). ⚠️ Teoria zoom cc-large SMENTITA empiricamente: il Chromium attuale centra i dialog fixed anche sotto `zoom` — non serve contro-zoom sui dialog.
- **Banner viola "Fattura modificata" IN ALTO**: spostato in cima al contenitore del dettaglio fattura (prima card visibile), prima stava sotto riepilogo e bottoni.
- **Collega preventivo→fattura eredita il CLIENTE**: `linkDocumentAction` copia `client_id` dal preventivo se la fattura ne è senza (update condizionato `is('client_id', null)`, best-effort) → contatti nei solleciti/scadenze.
- **Matita fattura = form in alto**: in `?edit=1` su mobile le card di sola lettura (Preventivo collegato, Cliente, SdI, Foto, Riepilogo, Anteprima/Condividi, Segna pagata/Annulla, banner e-fattura) SPARISCONO → il form appare subito sotto la testata (prima "le schermate di modifica apparivano in basso e non me ne accorgo"). Il gemello preventivo era già strutturato così.
- **Stato "Fatturato" del lavoro (decisione Eli via AskUserQuestion: opzione A "chiede la fattura al tocco")**: `setLavoroStatusAction` rifiuta 'fatturato' senza una fattura VERA (documento collegato = fattura, oppure fattura con `origin_document_id` = preventivo collegato; lavoro senza documento → messaggio dedicato). L'errore del cambio stato ora compare SOTTO le pillole (`statusError`), non più in fondo al form. Confermato a Eli: il KPI "Fatturato" in Home conta GIÀ solo le fatture status accepted (= Pagate).
- **DECISIONI_E_FEEDBACK.md**: nuova sezione "Collaudo Eli 20 lug – 3 ago 2026" (~35 voci, tutte le decisioni dall'ultima registrazione del 18 lug).
- tsc+build+409/409 verdi · scan spazi puliti. ⏭️ Collaudo Eli: dialog Collega, matita fattura, tocco "Fatturato" su lavoro senza fattura (messaggio sotto le pillole).

### Handoff precedenti (dal 2 agosto a ritroso) → `STORICO_SESSIONI.md`
Il 6 agosto 2026 gli handoff **dal 2 agosto in giù** sono stati spostati in `STORICO_SESSIONI.md`
(terzo consolidamento, dopo quelli del 14 giugno e del 15 luglio). Qui sopra restano solo le
sessioni **dal 3 agosto in poi**. Le regole permanenti che stavano dentro quelle voci non sono
andate perse: sono state estratte in **§B.2 "Regole imparate sul campo"**.

⚠️ **Quando questa sezione ricomincia a crescere** (indicativamente oltre le ~1.200 righe di
file, o dopo due settimane di handoff), rifare la stessa operazione: estrarre prima le regole
permanenti in §B.2, poi accodare il resto allo storico.

### Backlog residuo (rivisto 6 ago 2026)
**⚠️ PRIMA DEL LANCIO:** checklist bloccante in **`PRIMA_DEL_LANCIO.md`** (da leggere prima di dare l'app a utenti reali). Punto n.1: **Supabase Pro per i backup** (il piano free NON ha backup — verificato 20 lug; decisione Eli 29 lug: si attiva il giorno del lancio).

**Eli (azioni manuali)** — la lista viva e aggiornata è **`COSE_DA_FARE_ELI.md`**, qui solo i titoli: professionisti a settembre (avvocato: campi gialli privacy/termini, conferma §5-bis cookie, registro art. 30, copy fattura di cortesia, recensioni Google · commercialista: dossier 5 ago, D1-D40) · Play Store (tipo account, fingerprint assetlinks, nodo Play Billing — testi pronti in PLAY_STORE_SCHEDA.md) · Stripe live + P.IVA · SdI: sandbox GIÀ collaudata end-to-end (22-23 lug), per il live servono l'ok dell'avvocato sui testi OpenAPI e le chiavi di produzione · video demo /prova · `ORPHAN_CLEANUP_ENABLED` dal 1° settembre.
**Accesso con impronta:** ✅ sblocco rapido in produzione (20 lug, migration 056 applicata, collaudato da Eli; storia in `STORICO_SESSIONI.md`). Resta opzionale l'**accesso completo senza password** (passkey come login primario) per una prossima sessione.

**Codice (post-lancio o su richiesta):** **DOWNGRADE Pro→Free — ✅ COMPLETO (14 ago)**: tutte le fasi fatte — ① fondamenta+filigrana, ② preventivi/fatture oltre gli 8 in sola lettura, ③ template personalizzati bloccati, ④ filigrana forzata, ⑤ listini bloccati, ⑥ multi-proposta su documenti già creati, ⑦ AI import (già ok server-side). Handoff (20)-(24). Nessun residuo bloccante (solo il «Duplica» del menu ⋯ che dà toast d'errore invece di essere spento — cosmetico, zero impatto in beta). · **NOTE DI CREDITO TD04 (fase SdI)** — ⏸️ IN ATTESA per decisione Eli (19 lug): si costruisce quando lo SdI è LIVE **e** il commercialista ha risposto sulla numerazione (stessa serie vs sezionale). Struttura dati già quasi pronta (origin_document_id, invoice_sequences per doc_type, infra SdI xml/provider/webhook). **Progetto completo in `PROGETTO_NOTE_CREDITO.md`** (cosa c'è, cosa manca, fasi). Domande commercialista nel dossier unico §6. · FASE C commercialisti (XML FatturaPA, dopo SdI live) · **PAGAMENTO CON CARTA dal link fattura — ⏳ "APPENA POSSIBILE" (decisione Eli 4 ago)**: progetto congelato in `PROGETTO_PAGAMENTI_CARTA.md` (Stripe Connect Standard, direct charge sull'account dell'artigiano, noi mai i soldi); cancelli: Stripe live+P.IVA, attivazione Connect (Eli), riga dossier avvocato · cron purge workspace cancellati >10 anni · 2FA (decisione Eli 14 lug: non ora) · CSP con nonce + pen-test · salvataggio automatico foto analizzate dall'AI (decisione Eli 15 lug: si lascia così) · test Tier 2/3 · pattern checklist→mini-tour ✅ FATTO 15 lug.

### Stato migration (aggiornato 17 ago 2026)
**001-086 TUTTE applicate** (081-082 il 12 ago; 083 il 14 ago; 084, 085 e 086 applicate da Eli il 15 ago — «migration fatta», prima del ricontrollo (11)). **Prossima libera: 087.**
**086** («Mostra le ore al cliente nel rapportino»: `lavori.show_labor_to_client BOOLEAN NOT NULL DEFAULT false`). Validata su PG16: default `f`, idempotente, attivabile. Codice tollerante pre-086 (query a sé + retry-without su 42703 + update separato; colonna assente → false = ore nascoste). ✅ Applicata.
**085** («Interruttore conta-la-manodopera-nel-margine»: `workspaces.count_labor_in_margin BOOLEAN NOT NULL DEFAULT true`). Validata su PG16: default `t` sulla riga esistente, idempotente, spegnibile→`f`. Il codice è tollerante pre-085 (cast + update che ignora la colonna assente; letture `!== false` → true). ✅ Applicata.
**084** («Codici di recupero del 2FA»: `mfa_recovery_codes`). ✅ APPLICATA da Eli il 15 ago (+ TOTP abilitato su Supabase → Auth → Multi-Factor).
**083** («Limite di 8 fatture inviate sul piano Free»: `workspaces.sent_invoice_quota_used` + backfill dalle fatture non-draft + RPC atomica `increment_invoice_quota`, gemella della 059). Validata su PG16: backfill corretto (esclude bozze e cestinate), RPC incrementa, idempotente. ✅ **APPLICATA da Eli il 14 ago.**
**082** («La conversione preventivo→fattura perdeva bene_significativo»: ridefinisce `convert_preventivo_to_fattura` con la colonna nell'elenco dell'INSERT delle voci — senza, la fattura nasceva senza split 10/22 e con meno IVA del dovuto). Validata su PG16: flag copiato, idempotente.
**081** («Le tre cose che nella prassi si fanno»: `document_items.bene_significativo` — IVA 10% e beni significativi — · `documents.ritenuta_causale` — la sigla del tracciato per la ritenuta del condominio, vincolata a 1-2 lettere maiuscole — · `documents.reverse_charge` — inversione contabile in edilizia). Validata su PG16 prima della consegna: idempotente, default sulle righe esistenti, valori intatti al rilancio, vincolo che accetta `W`/`ZO` e respinge minuscole, sigle lunghe, testo libero e stringa vuota. `types/database.ts` aggiornato a mano coi 3 campi (eccezione B.1.6) + 3 fixture dei test allineate. **Applicabile prima o dopo il deploy**: l'insert delle voci ha la cascata tollerante e i due campi del documento si scrivono con un update che ignora la colonna assente.
**080** («Data di conferma + pilota automatico SdI»: `documents.doc_date` — la data FISCALE, nasce alla conferma della bozza, backfill dei non-bozza con created_at in Europe/Rome — · `workspaces.sdi_auto_enabled` default true · `documents.sdi_auto_at` + indice parziale per il cron orario `/api/cron/sdi-auto`). Validata su PG16 prima della consegna. `types/database.ts` aggiornato a mano coi 3 campi (eccezione B.1.6, come per 073-075) + 2 fixture dei test allineate. ⚠️ La tolleranza pre-080 resta nel codice (regola: non si toglie a cuor leggero).
**079** («Più note di credito per fattura»: DROP dell'indice unico della 078 — il tetto «Σ note attive ≤ totale fattura» ora vive nel codice: creazione a residuo, trasmissione bloccante, avviso sulla nota). Validata su PG16 (drop idempotente, seconda nota accettata dopo il drop). ⚠️ Applicabile prima o dopo il deploy: col codice nuovo e l'indice ancora presente, la seconda nota viene rifiutata con l'invito ad aprire quella esistente (23505 gestito).
**078** («Una sola nota di credito attiva per fattura»: indice unico parziale su `origin_document_id`). Validata su PG16: doppio submit concorrente bloccato, cestinata+nuova consentita, ripristino di una seconda nota con una attiva presente respinto, idempotente. Senza, il vincolo resta solo applicativo (maybeSingle prima dell'insert): un doppio tap può creare DUE note sulla stessa fattura — il doppio storno. Il codice gestisce già il 23505 (reindirizza alla nota esistente).
**Le precedenti:** la 077 («Acconto di default»: `workspaces.deposit_default_type`+`deposit_default_value`) applicata da Eli il 9 ago; la 076 («la richiesta ricorda il preventivo») l'8 ago.
**Le precedenti:** La 075 («Archivio dei documenti + solleciti spenti»: `documents.archived_at` e `documents.reminders_off_at`) è stata applicata da Eli l'8 ago, subito dopo il deploy; la 074 («Posticipa il sollecito») lo stesso giorno. Entrambe validate su PG16 prima della consegna.
⚠️ La tolleranza pre-migration resta nel codice (sonda `archivioDisponibile()` e query `.then(ok, ko)`): non va tolta a cuor leggero — è ciò che tiene in piedi liste e Home quando il deploy arriva prima della migration, che è sempre l'ordine reale.
**Le precedenti:** la 073 (preavviso della card «In scadenza») il 7 ago; 069 e 070 applicate da Eli il 5 ago (chiusura lettura pubblica foto · coordinate di pagamento solo dal server); 071 e la prima metà della 072 il 6 ago mattina (`security_events` · vincolo su `meta`); il **blocco di hardening della 072** (REVOKE+GRANT+`search_path` sulle due funzioni di purge, nella versione CORRETTA col GRANT a service_role) il 6 ago, dopo il fix del bug del REVOKE. Lo storico completo sta in `STORICO_SESSIONI.md`. ⚠️ Regola confermata da questo giro: **se serve rilanciare una migration, si rilancia il FILE INTERO** (sono tutte idempotenti) — mai indicare intervalli di righe, che invecchiano al primo edit.

**Verifica prima di ogni rilascio:** `npx tsc --noEmit` · `npm run build` · `npm test` (697) · `npm run build && npm run smoke:public` (20 check) · `npm run security:check` (sito vero).

---


## ⚠️ CONFIG STRIPE DA FARE (sessione 26 — cambio fatturazione SOLO mensile→annuale)

> **Decisione prodotto:** consentito SOLO l'upgrade mensile → annuale, MAI il downgrade
> annuale → mensile. Il bottone "Passa alla fatturazione annuale" in `/abbonamento` compare
> solo per gli abbonamenti mensili e usa `switchToAnnualAction` → portale Stripe con flow
> `subscription_update_confirm` e prezzo annuale **pre-selezionato** (l'utente vede solo la conferma).
>
> **Config Stripe Dashboard (1 volta, sia in sandbox/test sia poi in live):**
> Stripe Dashboard → Settings → Billing → **Customer portal** (in italiano: Impostazioni →
> Fatturazione → Portale clienti):
> 1. Sezione **"Subscriptions"** → attivare **"Customers can switch plans"** (necessario perché
>    il flow `subscription_update_confirm` funzioni).
> 2. Aggiungere il prodotto **Pro** con entrambi i prezzi (Mensile + Annuale).
> 3. Proration: **"Create prorations"** (accredita i giorni non usati al cambio).
>
> ⚠️ **Sandbox vs Live:** la config va rifatta anche in modalità LIVE quando si va in produzione
> (le impostazioni sandbox NON si propagano al live).
>
> **Nota one-directional:** la nostra app offre solo l'upgrade. Stripe però, con "switch plans"
> attivo, tecnicamente permetterebbe il downgrade a chi raggiunge il portale generico
> ("Gestisci abbonamento"). Esposizione minima (l'app non offre quel percorso). Se in futuro
> serve blindarlo del tutto: fare lo switch via `stripe.subscriptions.update()` diretto + dialog
> di conferma in-app, e disabilitare lo switch nel portale.
> Il webhook `customer.subscription.updated` sincronizza già `billing_interval` nel DB.

---

## ⏰ PROMEMORIA — CONFIGURAZIONI DA RICORDARE A ELI A FINE PACCHETTO FEATURE (richiesto da Eli 6 lug 2026)

> Quando TUTTE le nuove feature (blocchi 1-9) sono implementate, ricordare a Eli queste azioni manuali:
> 1. ~~AI Import~~ FATTO (11-12 lug): flag+chiavi su Vercel, tetti di spesa impostati (OpenAI $10, Mistral 10€ prepagato).
> 2. **Stripe Customer Portal** — config "switch plans" per upgrade mensile→annuale (dettagli nella sezione "CONFIG STRIPE DA FARE" qui sotto). Sandbox E live.
> 3. **SDI** — credenziali del provider di fatturazione elettronica (quando scelto — vedi ricerca-fatturazione-elettronica/DECISIONE_SDI.md).

---

## B. REGOLE DI COMPORTAMENTO

### B.0 ⚖️ REGOLA PRUDENZA LEGALE — PERMANENTE (decisione Eli, 13 lug 2026)

> **"Dobbiamo stare in sicurezza ed evitare ogni tipo di problema legale, amministrativo
> o che ci può mettere in seria difficoltà o costi elevati. Non abbiamo soldi per difenderci."**

Questa regola PREVALE su crescita, marketing e velocità di rilascio. In pratica:

1. **Default = NON implementare/lanciare** nulla con profilo legale, fiscale o amministrativo
   dubbio senza ok esplicito di Eli e, dove serve, del professionista (avvocato/commercialista).
2. **Aree sensibili che richiedono SEMPRE il cancello** (lista non esaustiva):
   fatturazione elettronica/SdI e qualsiasi claim di valore fiscale dei documenti;
   claims di marketing (AGCM — mai promesse assolute, mai "gratis per sempre");
   GDPR e nuovi destinatari/trattamenti di dati; recensioni e directory (diffamazione,
   notice-and-takedown); email automatiche ai CLIENTI FINALI degli artigiani (spam/consenso);
   pagamenti e denaro; scraping/uso di dati di terzi; integrazione con piattaforme
   con policy proprie (Google, Meta, WhatsApp Business).
3. **A parità di alternative, scegliere la più difendibile**, anche se meno "growth"
   (es. invito manuale invece che automatico, opt-in invece che opt-out, copy sobrio
   invece che aggressivo).
4. **Feature attualmente BLOCCATE su validazione professionale:** recensioni Google
   automatiche (avvocato) · SdI live (contratto/DPA OpenAPI + avvocato) · qualsiasi
   automazione email verso i clienti finali oltre a quelle già validate.
5. Ogni nuova feature con possibile rilevanza legale va segnalata a Eli PRIMA di
   implementarla, con i rischi spiegati in parole semplici, e aggiunta alla lista
   domande per i professionisti se serve.
6. **(istruzione Eli, 14 lug 2026)** Quando emergono nuove domande per avvocato o
   commercialista, AGGIORNARE SEMPRE i documenti per i professionisti senza aspettare
   che Eli lo chieda: addendum PDF datato (base: 3 PDF del 7 lug + addendum 14 lug),
   inviato in chat via SendUserFile. MAI committare questi documenti nel repo (pubblico).

### B.1 Regole TypeScript / codice

1. MAI `any` senza commento ESLint esplicito
2. MAI chiavi API nel client — tutto passa da Server Actions o API Routes
2-bis. **MAI credenziali/password nei file committati** (il repo è PUBBLICO) — nemmeno quelle dell'account demo: vivono in `.env.local` (es. `DEMO_PASSWORD`). Lezione GitGuardian 15 lug 2026.
3. MAI skipare i test sui calcoli fiscali — coverage 100% obbligatoria su `lib/fiscal/`
4. Commit atomici con conventional commits: `feat/fix/chore/docs/test`
5. Ogni modifica: `npx tsc --noEmit` + `npm run build` devono essere verdi prima del commit
6. `types/database.ts` va rigenerato dopo ogni migration (`npx supabase gen types typescript --project-id ivbzuhgwszkdnlsybsao > types/database.ts`). Non editare manualmente salvo aggiunta urgente documentata.

### B.2 Regole UX/UI permanenti

- **📖 OGNI FUNZIONE NUOVA O MODIFICATA PASSA DALLE FAQ (Eli, 9 ago 2026 — permanente).** Prima di chiudere un task, rileggere `app/(app)/aiuto/page.tsx` e correggere ciò che non è più vero, aggiungendo una domanda se la funzione è nuova. Vale anche per la voce in **`/novita`** e per le **guide di sezione** (`components/tour/section-tours.ts`), che invecchiano allo stesso modo.
  ⚠️ **Il pericolo non è la FAQ mancante: è quella che è rimasta indietro.** Chi legge una domanda frequente si fida di quello che c'è scritto e non va a controllare nell'app — quindi una FAQ vecchia non è un buco, è un'**informazione sbagliata data con autorità**. È già successo tre volte: il 9 agosto la FAQ diceva ancora *"al posto di «Annulla» trovi la spiegazione"* mentre lì c'era ormai il tasto «Crea nota di credito»; l'8 agosto una FAQ prometteva che le fatture SdI *"restano nel cestino finché non decidi tu"* dopo che le guardie glielo impedivano; il 7 agosto tre superfici raccontavano tre versioni diverse dello stesso avviso e due erano false.
  **Come si fa, in pratica:** cercare nelle FAQ le parole della funzione toccata (il campo di ricerca di `/aiuto` serve anche a questo) e chiedersi *"questa frase è ancora vera dopo la modifica di oggi?"*. Se la risposta è no, si riscrive nello stesso giro — non si annota per dopo.

- **✍️ TONO DEI TESTI — formale, semplice, diretto (Eli, 11 ago 2026 — permanente).** *«In generale in tutta la app voglio un tono formale e frasi semplici, dettagliate al punto giusto e dirette.»*
  **Formale non vuol dire dare del Lei all'artigiano**: con lui si continua a usare il «tu» (col cliente finale resta il «Lei», regola invariata). Vuol dire **registro sobrio**: niente colloquialismi, niente esclamazioni, niente giri di frase.
  **Lo schema per un divieto o un errore**, che è la famiglia in cui il tono si sente di più: **① cosa non si può fare · ② perché, in una riga · ③ cosa fare invece, chiamando il comando col suo nome esatto.**
  · ❌ *«C'è un incasso registrato: è nelle Entrate del Bilancio. Per eliminarla, prima "Segna come non pagata".»*
  · ✅ *«Fattura non eliminabile: l'incasso registrato è nelle Entrate del Bilancio. Se è errato, seleziona "Segna come non pagata".»*
  **Le tre cose da togliere quando si rilegge un testo:** l'attacco con «C'è…» o «Questo/a…» (il soggetto vero va davanti); le ipotesi appese in coda («…se l'aveva letto prima, ha in mente i numeri vecchi»); le parole di riempimento («già», «ancora», «più», «però») quando non cambiano il significato.
  ⚠️ **Dettagliate al punto giusto**: il fiscale e le conseguenze irreversibili si spiegano per esteso (restano visibili, non vanno nel ⓘ); tutto il resto sta in una o due frasi.

- **🔒 COSTO/RICARICO/MARGINE MAI AL CLIENTE (Eli, 2 ago 2026 — permanente):** il costo d'acquisto, il ricarico e il margine dell'artigiano non devono MAI comparire in nessuna superficie vista dal cliente — PDF (`lib/pdf/template.ts` + `TemplatePreview`), pagine pubbliche `/p/[token]` e `/r/[token]`, email ai clienti finali, `template_snapshot`. Le colonne dei costi (`unit_cost` ecc.) non entrano MAI nelle select delle route pubbliche né nelle prop di componenti pubblici; filtro alla FONTE + grep/test di verifica a ogni PR. Dettagli e superfici vietate in `PROGETTO_LISTINO_FORNITORE.md`.

- **⚠️ SPAZI NEL TESTO JSX (bug Turbopack — scoperto 11 lug 2026):** lo spazio tra un elemento inline (`</b>`, `</strong>`, `</Link>`) e il testo che segue può venire MANGIATO dal compilatore quando il testo contiene accenti/apostrofi tipografici (es. "…</b> e scarica" → "…e scarica" attaccato), anche se nel sorgente lo spazio c'è. **Regola: usare SEMPRE `{' '}` esplicito tra un elemento inline e il testo adiacente** nei copy visibili. Verifica ground-truth: `grep -roh '}),"[a-zàèéìòù][^"]\{0,50\}' .next/server/chunks/ssr/*.js | sort -u` dopo il build (devono restare solo valori tecnici). ⚠️ **Lo scan sul build è CIECO sulle MAIUSCOLE** (19 lug: "…foto.</b> Tocca" arrivò in prod attaccato — "Tocca" non matcha `[a-z]`; estendere alle maiuscole produce troppi falsi positivi dalle label): per le maiuscole affiancare il grep sul SORGENTE `grep -rn '</b> [A-ZÀÈÉ]\|</strong> [A-ZÀÈÉ]\|</Link> [A-ZÀÈÉ]' --include="*.tsx" app components` → deve restituire 0 righe.
- **Mobile-first è non negoziabile.** Ogni funzionalità deve funzionare perfettamente su telefono prima che su desktop.
- `ClientAutocomplete`, `AtecoMultiSelect`, `CatalogPicker`: usano `<PopoverContent>` Radix (portal su `document.body`) — NON rimuovere, evita clipping da `Card overflow-hidden`.
- **Descrizione voce = `<textarea>` auto-grow, mai un `<Input>`** (`VociTable.tsx`, desktop e mobile): rows=1 che cresce col contenuto, niente scroll interno, niente altezza fissa. Riportarlo a input a riga singola troncherebbe le descrizioni lunghe ("Installazione caldaia a condensazione con collaudo e messa in servizio inclusi") proprio mentre si scrivono. Il microfono resta accanto, allineato in alto (`items-start`). *(Regola recuperata dal redesign mobile di giugno, archiviata il 6 ago.)*
- **Ordine dei campi indirizzo: Città → Provincia → CAP**, in OGNI schermata che li chiede, mobile e desktop (`ClientForm`, `impostazioni/tabs/generali`, `onboarding`). E **P.IVA / Codice Fiscale = UN SOLO campo** con rilevamento automatico (11 cifre = P.IVA, 16 caratteri = CF). *(Idem.)*

**Regole imparate sul campo** (ognuna nasce da un bug vero; il racconto disteso è in `STORICO_SESSIONI.md`):

- **Il simbolo `€` non va MAI a capo separato dal suo importo.** Nel JSX si usa `&nbsp;`, nelle stringhe TypeScript lo spazio unificatore ` `. `Intl` con `style:'currency'` lo mette già da solo. *(19 lug: su un preventivo vero il `€` finiva da solo sulla riga sotto.)*
- **I toast di successo durano al massimo 4 secondi** e si chiudono da soli. Gli errori e gli AVVISI che portano un'informazione da leggere (12 giorni SdI, acconto, esito SdI) possono restare più a lungo con un `duration:` per-chiamata. *(Regola di Eli, 16 lug.)*
- **Il `<Toaster>` ha `closeButton` GLOBALE** (decisione Eli 12 ago, «due famiglie coerenti»): OGNI banner ha la ✕ per chiuderlo, così le semplici conferme si comportano tutte allo stesso modo. **Non aggiungere `closeButton: true` sulle singole chiamate** — è ridondante. Le due famiglie: *conferme* («l'ho fatto») = 4s + ✕, di serie; *avvisi* (info da leggere) = `duration:` lungo + ✕.
- **Il grigio dei testi secondari è `var(--cc-muted)`, mai un letterale**: il valore è **`#6f6d64`** (dal 15 ago 2026 — prima `#8a887f`, che faceva 3,55:1 su bianco, sotto il minimo WCAG AA di 4,5:1; scoperto dall'audit axe). Nella modalità "Testo grande" la variabile si scurisce ancora (a `#55534b`) per alzare il contrasto, e un valore fisso salta il meccanismo. ⚠️ I placeholder dei campi che nel design usano il grigio devono anch'essi passare da `var(--cc-muted)`.
- **Ogni portale flottante su `document.body` posizionato con `getBoundingClientRect` deve avere la classe `cc-portal-float`.** In modalità testo grande il body è ingrandito del 15% e senza contro-zoom il pannello si disallinea dal bottone che l'ha aperto (misurato: 59,6px di scarto su 390px).
- **Gli overlay a schermo intero vanno in portal su `document.body`.** `position: fixed` da solo non basta: un antenato con `transform`, `filter` o `zoom` diventa il contenitore di riferimento e l'overlay si dimensiona su quello (una volta è uscito come una striscia verticale di 23px).
- **Nei contenitori che scorrono in orizzontale, l'aria a fine riga si dà con uno spaziatore `::after`** — mai col padding del contenitore (viene mangiato a fine scroll) né coi margini sui figli (allargano la riga e spingono fuori l'ultima linguetta).
- **I suggerimenti contestuali passano SEMPRE da `ContextHint`**, mai da toast o banner scritti a mano: quel componente garantisce che un suggerimento compaia una volta sola, mai più di uno per sessione e mai durante il tutorial. La condizione di pertinenza la decide il chiamante lato server; l'id è nuovo, in kebab-case.
- **⚠️ Se una migration aggiunge colonne a una tabella con GRANT per colonna** (`reviews`, `marketplace_profiles`, `marketplace_requests`), bisogna estendere anche il GRANT, oppure spostare quella scrittura sull'admin client. Altrimenti PostgREST risponde `42501` e **fallisce l'INTERA scrittura**, non solo la colonna nuova — un bug rimasto latente per un mese.
- **⚠️ Una misura di sicurezza non è "fatta" perché il collaudo dal telefono sembra a posto.** Le policy permissive di PostgreSQL si sommano in **OR**: finché resta in piedi una vecchia policy aperta, una nuova policy restrittiva non restringe nulla. Va verificata con `npm run security:check` (che interroga il sito vero con la sola chiave pubblica), non a vista.
- **⚠️ Un velo di sicurezza non si toglie MAI da solo.** Il velo del blocco app aveva un timer che dopo 8 secondi si rimuoveva "per non lasciare l'app dietro un fondo navy per sempre" — ma `AppLock` è un fratello di `{children}`, non il loro contenitore: togliere il velo non libera l'app, la **scopre**. Su rete lenta la Home restava visibile e scorrevole per qualche secondo senza che nessuno avesse chiesto l'impronta. Quando un timer di sicurezza scade si spiega all'utente cosa sta succedendo e gli si dà un modo per riprovare — non si apre la porta.
- **⚠️ Un header di sicurezza sbagliato rompe le funzioni IN SILENZIO.** `Permissions-Policy: geolocation=()` negava la posizione anche a noi: "Vicino a me" non funzionava da luglio e l'interfaccia lo raccontava come "permesso negato dall'utente". Gli 8 header sono ora verificati a ogni giro dallo smoke test.
- Dropdown bot `KanbanView` e `ViewToggle` sono stati rimossi definitivamente (session 12). Non re-aggiungere.
- `StatusBadge` con prop `docType` per distinguere fatture da preventivi (accepted→"Pagata", rejected→"Annullata").
- IVA visibile su mobile per regime ordinario (grid-cols-5 nel VociTable mobile).
- `safeAccentColor` obbligatorio in `TemplatePreview.tsx` e `template.ts` per evitare testo chiaro su sfondo bianco.
- **Ordinamento liste preventivi/fatture (aggiornato 15 ago 2026):** default = **`recent` ("Ultima modifica", `updated_at DESC`)** — Eli: la prima volta le liste si vedono dall'ultimo documento modificato. La preferenza è in un **COOKIE di sessione PER-PAGINA** (`cc_sort_preventivi` / `cc_sort_fatture`, niente Max-Age) letto **server-side** dalle pagine → la lista arriva già ordinata al primo paint, niente "flip" post-mount. Preventivi e fatture hanno memoria **separata**. `DEFAULT_SORT = 'recent'` in `SortSelect.tsx`; nel branch di query delle due pagine `'oldest'` è ASC esplicito e il ramo `else` (default/`recent`) è DESC. (Storia: fino al 14 ago il default era `oldest` + sessionStorage `preventivi_sort_v2`, ora non più usato.)

### B.3 Regole numerazione documenti

**⚠️ AGGIORNATO sessione 25: NON ci sono più prefissi Prev/Fatt.**
I numeri sono nel formato `{NNN}/{YYYY}` (es. `001/2026`) per **entrambi** preventivi e fatture.
In `lib/actions/documents.ts`:
- `allocateDocNumber()` → `{NNN}/{YYYY}` (es. "001/2026") — sequenza `doc_type = 'preventivo'`
- `allocateInvoiceNumber()` → `{NNN}/{YYYY}` (es. "001/2026") — sequenza `doc_type = 'fattura'`
- `peekNextDocNumber()` / `peekNextInvoiceNumber()` → preview (usano colonna `doc_type` su `invoice_sequences`, NON `seq_type`)
- `formatDocNumber()` in `lib/utils/index.ts` rimuove eventuali prefissi letterali legacy (`replace(/^[A-Za-z]+/, '')`) per i documenti vecchi che avevano "Prev"/"Fatt".

**Differenziazione fattura (sessione 25):** il numero salvato nel DB è identico per entrambi
("001/2026"), MA in **visualizzazione in-app** `formatDocNumber(num, 'fattura')` antepone il
marcatore **"Fatt."** → le fatture appaiono come **"Fatt. 001/2026"**, i preventivi come "001/2026".
Questo evita confusione senza migration. Email e PDF usano il numero grezzo (il PDF ha già la
testata "FATTURA"/"PREVENTIVO"). I punti che mostrano una fattura collegata DENTRO un testo già
prefissato (es. "Fattura {numero}") NON passano 'fattura' per evitare "Fattura Fatt. ..." ridondante.

**Non c'è più una card "Numerazione documenti" in impostazioni** (rimossa in session 13 — 3d671d3). Il formato non è configurabile dall'utente.

**⚠️ AGGIORNATO sessione 26 — il numero viene assegnato SUBITO alla creazione (anche per le bozze).**
`createDocumentAction` chiama `allocateDocNumber()` prima dell'INSERT per OGNI nuovo documento
(sia "Salva bozza" sia "Invia al cliente"), a meno che non sia stato passato un numero manuale valido.
Quindi **una bozza ha già un `doc_number` dal momento della creazione** (non più `null`).
Motivo: l'utente vuole vedere il numero progressivo subito.
Conseguenza nota: le bozze cancellate lasciano "buchi" nella sequenza (la RPC non li riempie). Accettato.

**`intent` nel form:** valori usati = `'save_draft'` | `'send'` (preventivo), `'save'` | `'send'` (FatturaForm),
`'create'` (preventivo→fattura). Nello schema Zod `DocumentFormSchema.intent` è `z.string().optional()`
(NON un enum ristretto: un enum `['save','send']` rompeva il salvataggio bozza con
"Invalid option: expected one of save|send"). Ogni action interpreta i valori che le servono.

**`send-email/route.ts`** mantiene il fallback: se per qualche motivo `doc_number` è ancora null al primo invio, lo assegna lì.

**La RPC usa INSERT ... ON CONFLICT DO UPDATE incrementando `last_number`** — non riempie i buchi. Se l'ultimo allocato è 5, il prossimo è 6 anche se 3 e 4 sono stati cancellati.

### B.4 Regole preventivi / fatture / collegamenti

**Soft delete:** i documenti vengono spostati nel cestino (`deleted_at = now()`), non cancellati. Il cestino è a `/cestino`, recupero entro 15 giorni, poi purge automatico via cron. Tutte le query lista **devono filtrare `deleted_at IS NULL`** — se aggiungi una query sui documenti, controlla.

**Preventivo accettato — re-edit:** ⚠️ NOTA CORRETTA (22 lug 2026, verificata sul codice): oggi un documento `accepted` NON è modificabile in nessun caso — sia `updateDocumentAction` (documents.ts:596) sia `saveDraftAction` (:847) lo rifiutano incondizionatamente, e la status route dei preventivi non ha transizioni in uscita da `accepted`. La vecchia descrizione ("ri-editabile a meno che non abbia fattura accettata collegata") NON corrisponde più al codice. Limite noto da riconfermare con Eli: un preventivo segnato accettato PER ERRORE non ha via di ritorno (le fatture hanno "Riattiva", i preventivi no).

**Preventivo → fattura:** 
- Entry point 1: dal dettaglio preventivo accettato → "Converti in fattura"
- Entry point 2: `/fatture/nuovo` → `CreateFromPreventivoButton` — mostra tutti i preventivi non-bozza/non-scaduti con status badge; se non-accepted, chiede conferma prima di convertire
- La funzione `convert_preventivo_to_fattura` SQL è idempotente: se la fattura esiste già la restituisce
- Collegamento bidirezionale: la fattura ha `origin_document_id`; sul dettaglio fattura c'è `LinkToPreventivoButton` per agganciare/sganciare manualmente

**Fattura → preventivo:** su `/fatture/[id]` c'è il banner collegato o il pulsante "Collega a preventivo" se `origin_document_id = null`.

**DocumentTimeline:** presente su tutti i preventivi (bozze incluse). Mostra eventi created/sent/viewed/accepted/rejected/expired + eventuale "Fattura collegata". Non c'è una colonna `rejection_at` — usa `sent_at` come fallback per l'evento Rifiutato.

### B.5 Regole autenticazione / rate limiting

**Login rate limit** (post-fix sessione 13): il rate limit viene chiamato SOLO su autenticazione fallita. I login riusciti non consumano token. Limite: 10 fallimenti / 15 min per IP. Key: `auth:login-fail:{ip}`.

**Verifica email:** `/verifica-email` è in `PUBLIC_PATHS` del proxy. Gli utenti non autenticati (appena registrati con email non confermata) possono accedere a questa pagina senza essere rimandati al login.

**OAuth bfcache:** `OAuthButtons.tsx` ha listener `pageshow` che resetta lo stato loading quando `e.persisted === true` (tornare dalla pagina Google su mobile).

### B.6 Regole email / deliverability

**`sendEmail`** in `lib/email/send.ts` invia sia HTML che plain-text (generato automaticamente strippando i tag HTML). NON aggiungere emoji nei subject o nel body — peggiorano lo spam score.

**FROM:** `Carta Canta <noreply@send.cartacanta.app>` — non modificare il dominio mittente senza aggiornare anche DKIM/SPF.

**replyTo:** le email di invio preventivo al cliente usano l'email dell'owner come `reply_to` — se il cliente risponde, arriva all'artigiano.

### B.7 Regola migration — COME COMUNICARLE ALL'UTENTE

**OGNI VOLTA che il codice richiede una nuova migration SQL, incollare il testo della migration in fondo al messaggio inviato all'utente**, in un blocco SQL ben visibile con titolo "⚠️ Migration da applicare". L'utente la copia direttamente su Supabase SQL Editor.

Formato obbligatorio da usare alla fine del messaggio:

```
---
### ⚠️ Migration da applicare su Supabase SQL Editor

\```sql
-- testo della migration qui
\```
```

**Non inviare il messaggio senza questo blocco se c'è una migration.** L'utente non deve cercarla nel codice.

### B.8 Regole PDF — ARCHITETTURA POST-SESSIONE 16 (aggiornata sessione 23)

**`buildPdfHtml()` in `lib/pdf/template.ts` è LA FONTE UNICA DI VERITÀ.**
Tutte le superfici visive usano questa funzione. Non creare layout alternativi.

**Watermark (sessione 23):** Il watermark diagonale "Carta Canta" è stato RIMOSSO per tutti i piani.
Rimane solo il footer `"Preventivo generato con Carta Canta · cartacanta.app"` (10px, visibile solo se `showWatermark=true` = Free).
Pro può disabilitare anche il footer impostando `show_watermark=false`.

**Font size (sessione 23):** tutti i font size in `lib/pdf/template.ts` sono stati scalati ×1.2 (es. 11px→13px, 14px→17px, 26px→31px).
Anche `TemplatePreview.tsx` è stato allineato con le stesse proporzioni.

**Email non allega PDF:** Il documento viene inviato come LINK pubblico (`/p/[token]`). Nessun allegato PDF.
Il testo default del messaggio email è "Le faccio avere il link a ${ref} come da nostra intesa."

**⚠️ Chromium headless NON funziona su Vercel Lambda** — nessuna versione di `@sparticuz/chromium` funziona (manca `libnss3` nel runtime serverless). Non tentare di reintrodurlo senza un piano alternativo (microservizio separato su Render/Railway).

**Architettura definitiva:**

```
buildPdfHtml(data: PdfDocumentData) → HTML string
  → /api/documents/[id]/pdf?preview=1  → tab solo visualizzazione (no stampa)
  → /api/documents/[id]/pdf            → tab con window.print() automatico → utente salva come PDF
  → /api/p/[token]/pdf                 → idem (pagina pubblica cliente)
  → lib/pdf/generate.ts → generatePdfBuffer() → @react-pdf/renderer → Buffer
      → /api/documents/[id]/send-email  (allegato email — visivamente diverso ma funzionale)

buildPdfHtml(data) → HTML string
  → app/p/[token]/page.tsx → <DocumentFrame html={html} />  → <iframe srcDoc> 
  → app/(app)/preventivi/[id]/page.tsx → <DocumentFrame> (anteprima in-app)
```

**`preparePrintHtml(html, triggerPrint)`** in `lib/pdf/logo.ts`:
- Inietta `@media print { print-color-adjust: exact }` — forzare colori/sfondi senza che l'utente spunti "Grafica in background"
- Se `triggerPrint=true`: inietta `window.onload=()=>window.print()`

**PdfActions** (`app/(app)/preventivi/_components/PdfActions.tsx`):
- "Anteprima": `/api/documents/[id]/pdf?preview=1` → solo visualizzazione
- "Salva come PDF": `/api/documents/[id]/pdf` → apre dialogo stampa automaticamente

**Logo:** `fetchLogoBase64()` in `lib/pdf/logo.ts` — URL → data-URI base64 (timeout 5s).

**`template_snapshot`** congela il template al momento dell'invio.
- `saveDraftAction` salva lo snapshot se viene cambiato `template_id`
- `send-email/route.ts` sovrascrive sempre lo snapshot al primo invio

**Fallback chain per il template** (identica in tutti i route e pagine):
1. `doc.template_snapshot` (congelato all'invio)
2. Template default del workspace (`is_default = true`)
3. Qualsiasi template del workspace (`limit 1`)
4. `null` → `buildPdfHtml()` usa stili hardcoded di default

**Performance:** `maxDuration = 60` sulle route PDF (Vercel Pro). Chromium startup ~5-15s. Cold start può richiedere fino a 20s al primo invio.

**`PreventivoPDF.tsx`** — NON più in uso nella chain di produzione. Candidato alla rimozione.

---

## C. FORMATO RISPOSTA OBBLIGATORIO PER OGNI TASK

Quando chiudi (o aggiorni) un task, la risposta **deve** contenere:

```
1. Bug/problema trovato
   - Causa reale confermata (dove nel codice, quale riga)

2. Fix implementato
   - Cosa esattamente è cambiato

3. File toccati
   - Lista con motivo della modifica

4. Migration necessarie
   - Sì / No — se sì, specifica SQL e se applicata

5. Test eseguiti
   - Cosa è stato verificato e COME (codice tracciato / browser reale / nessun test)

5-bis. FAQ e copy
   - Le FAQ di /aiuto (e /novita, e le guide di sezione) sono state rilette?
     Rispondere sempre una di queste tre: "aggiornate: <quali>" · "rilette, nessuna
     toccata da questa modifica" · "non rilette" (e allora il task NON è chiuso).
     ⚠️ Non basta che manchi una FAQ: il pericolo è quella rimasta indietro, che
     dice il falso con l'autorità di una risposta ufficiale. Vedi §B.2.

6. Esito finale
   - ✅ CHIUSO — verificato end-to-end nel browser
   - ⚠️ PARZIALE — fix codice ok, ma parte del fix richiede azione esterna o test non ancora fatto
   - 🟡 FIX APPLICATO — codice corretto per logica, da verificare manualmente
   - ❌ APERTO — causa identificata ma fix non ancora implementato
```

**Regola assoluta:** non scrivere "✅ CHIUSO" se non è stato verificato end-to-end nel browser reale o in un test automatico che riproduce il flusso.

---

## D. STATO PROGETTO — FEATURE COMPLETE (aggiornato sessione 23)

| Area | Stato | Note |
|---|---|---|
| Auth (email + OAuth) | ✅ Stabile | bfcache fix; rate limit fallimenti; reset password via /auth/confirm |
| Onboarding multi-step | ✅ Stabile | |
| Password sicura | ✅ Implementato | `PasswordStrength.tsx` — 4 requisiti validati client+server |
| Rinvia email verifica | ✅ Implementato | `/verifica-email` ha form resend via `supabase.auth.resend()` |
| Preventivi CRUD | ✅ Stabile | soft delete, re-edit, timeline, scadenze, Modificato banner |
| Fatture CRUD | ✅ Stabile | doppio entry point, Invia al cliente, timeline, Modificato banner |
| Clienti rubrica | ✅ Stabile | email/telefono obbligatori, full-text search, CF dedup |
| Catalogo CRUD | ✅ Stabile | |
| Template PDF — 4 preset | ✅ Stabile | font +20%, watermark diagonale rimosso, footer solo Free |
| Template — personalizzazioni Pro | ✅ Stabile | logo, font, legal notice |
| DocumentTimeline | ✅ Stabile | preventivi + fatture; eventi: sent/resent/modified/restored/accepted/rejected |
| Piano Free — quota storica | ✅ Stabile | `FREE_DOC_LIMIT = 8` |
| Soft delete + cestino | ✅ Stabile | `/cestino`, 15gg, cron purge |
| Dashboard KPI | ✅ Stabile | 4 card (accettati, valore prev, valore fatt, bozze); KPI fatturato → `/fatture?q=Pagata`; Prossima Scadenza → expires_at ASC |
| RevenueChart | ✅ Stabile | dual-bar accettati + fatturato |
| Referral system | ✅ Stabile | Team rimosso dall'UI referral |
| Piano Team | ⏸️ Nascosto | Card nascosta da abbonamento + referral fino al lancio |
| Stripe webhook | ✅ Stabile | |
| Voice input | ✅ Implementato | AssemblyAI SDK v4 |
| Export CSV preventivi | ✅ Implementato | |
| Cron scadenze + reminder | ✅ Stabile | |
| AI import | ⏸️ Disabilitato via flag | Bottone "IN ARRIVO" (flag `NEXT_PUBLIC_AI_IMPORT_ENABLED`). Per attivare: flag=true + chiavi OpenAI/Mistral |
| PostHog / Flagsmith / Sentry | ⏸️ Non configurati | |

---

## E. DECISIONI DI PRODOTTO CONFERMATE

| Decisione | Stato |
|---|---|
| Piano Team nascosto | ✅ Sessione 23 — nascosto da abbonamento + referral fino al lancio |
| Piano Team ⊇ Piano Pro | ✅ Confermato — nella logica interna Team include Pro |
| Limite Free: 8 preventivi storici (sent_quota_used) | ✅ Confermato — `FREE_DOC_LIMIT = 8` |
| Consumo Free: conta al primo invio | ✅ Implementato — non si decrementa alla cancellazione |
| Soft delete + cestino 15gg | ✅ Implementato |
| Numerazione: formato {NNN}/{YYYY} senza prefissi (no Prev/Fatt) | ✅ Confermato sessione 25 |
| Watermark diagonale rimosso | ✅ Sessione 23 — rimosso per tutti; solo footer Free |
| Font PDF +20% | ✅ Sessione 23 — confermato definitivo |
| `expires_at` riparte SOLO al (re)invio | ✅ Sessione 23 — salvataggio manuale non cambia scadenza |
| Email/telefono obbligatori per ogni cliente | ✅ Sessione 23 — bloccante in tutti i form creazione |
| Password: 4 requisiti obbligatori | ✅ Sessione 23 — maiuscola, minuscola, numero, simbolo |
| Email invio: link (no PDF allegato) | ✅ Confermato — testo default aggiornato |
| Template Free: preset non resetta colore | ✅ Confermato |
| Template Elegante: doc number NO brand color | ✅ Confermato — usa `safeAccentColor` |
| Preventivo accepted re-editabile se no fattura | ✅ Implementato |
| Kanban view rimosso | ✅ Definitivamente rimosso |
| AI import: attivare dopo test Pro | ✅ Confermato — key mancanti in prod |

---

## F. COSA NON TOCCARE SENZA SCREENSHOT/TEST

| Area | Motivo | Regola |
|---|---|---|
| `lib/fiscal/calcoli.ts` | Motore fiscale — 100% test coverage | Non toccare senza test. Nessuna eccezione. |
| `lib/pdf/template.ts` | 4 layout PDF su design di riferimento | Non modificare senza screenshot aggiornati |
| `TemplatePreview.tsx` | 4 layout React distinti, safeAccentColor | Non modificare senza screenshot |
| Stripe webhook handler | Funziona in produzione | Testare sempre in Stripe test mode prima |
| `template_snapshot` formato | I PDF vecchi usano snapshot congelato | Non cambiare formato senza considerare retrocompatibilità |

---

## 0. REGOLE BASE PER CLAUDE CODE

1. Leggi TUTTO questo file prima di scrivere codice
2. Un task alla volta — output sempre: file toccati + commit hash + tsc verde + build verde
3. Sequenza: capire → implementare → **rileggere le FAQ di `/aiuto` e aggiornarle se la modifica le ha rese false** (regola §B.2, richiesta di Eli 9 ago) → `npx tsc --noEmit` → `npm run build` → verificare → commit
4. Mai interpretare arbitrariamente una decisione di prodotto — se non è documentata qui, chiedi
5. Non reimplementare da zero senza prima trovare la causa precisa del problema
5-B. Prima di cambiare UI/copy/comportamento, leggi DECISIONI_E_FEEDBACK.md. NON annullare le voci ✅ (bloccate) senza istruzione esplicita di Eli.
6. **A fine di OGNI task** (non solo a fine sessione): aggiornare CLAUDE.md + `git push` (origin → Vercel) — questo è il backup primario. Confermare all'utente che il push è andato a buon fine. **Backup NAS (`git push nas master`) ora OPZIONALE** (decisione Eli 14 giu 2026): GitHub è la fonte di verità/backup; il NAS solo occasionale e solo quando il drive Z: è montato (utente `moian`). Con l'utente `elisa` il push NAS fallisce ed è normale — non bloccarsi.
7. `types/database.ts` va rigenerato dopo ogni migration
8. **Non dichiarare risolto un bug solo perché hai trovato la causa nel codice.** Usa il formato sezione C.

---

## 0-B. BACKUP NAS

```
NAS path:    Z:\CARTA CANTA
Remote git:  nas   (già configurato)
Comando:     git push nas master

File da ESCLUDERE sempre: node_modules/ .next/ dist/ build/ .claude/worktrees/ supabase/.temp/

⚠️ AGGIORNATO 14 giu 2026 — il NAS NON è più obbligatorio a ogni task. GitHub (origin) è il backup primario.
  1. Aggiorna CLAUDE.md
  2. git add <file specifici> && git commit -m "..."
  3. git push              (origin → Vercel Production, deploy automatico entro 1-3 min) — OBBLIGATORIO
  4. git push nas master   (OPZIONALE — backup NAS, solo se il drive Z: è montato; con utente 'elisa' fallisce ed è normale)
  5. Confermare all'utente: "Push origin riuscito — deploy Vercel partito. URL: https://cartacanta.app"

Nota: il drive Z: (NAS) è montato solo con l'utente 'moian'. Con l'utente 'elisa'
git push nas master fallisce con "does not appear to be a git repository".
In quel caso: eseguire solo git push origin, segnalare il fallimento NAS all'utente.
```

---

## 1. IDENTITÀ E POSIZIONAMENTO

**Carta Canta** è una SaaS italiana per preventivi e fatture, rivolta ad artigiani, freelance e piccole imprese.

- **Target primario:** Artigiani italiani (idraulici, elettricisti, falegnami, imbianchini, installatori) — usano prevalentemente il telefono, spesso in cantiere
- **Target secondario:** Freelance/professionisti in regime forfettario o ordinario
- **Target terziario:** Piccole realtà 2-5 persone (imprese edili, studi tecnici)

**Promessa:** *"Preventivi professionali in 60 secondi. Senza Excel, senza carta."*

UX mobile-first è **non negoziabile**: ogni funzionalità deve funzionare perfettamente dal telefono prima che dal computer.

---

## 2. TECH STACK

| Componente | Tecnologia | Versione / Note |
|---|---|---|
| Framework | Next.js App Router | **16.2.11** — NON 15. ⚠️ Restare sulla patch della stessa minor (le 9 CVE del 20 lug sono chiuse in 16.2.11) |
| Runtime UI | React | 19.2.4 |
| Database | Supabase (PostgreSQL 16) | `@supabase/supabase-js` 2.103 |
| Auth | Supabase Auth (PKCE flow) | Route Handler `/auth/callback`, NON Server Action |
| Hosting | Vercel Pro | Frankfurt fra1 — EU data residency |
| Pagamenti | Stripe | SDK 22.x |
| Email | Resend + React Email | HTML + plain-text (generato da strip HTML) |
| AI import | Mistral (primario) + OpenAI (fallback) | Disabilitato in prod (chiavi vuote) |
| Voice input | AssemblyAI SDK | 4.32.1 — `speech_models: ['universal']` (array, NON singolare) |
| Rate limiting | Upstash Redis + `@upstash/ratelimit` | sliding window |
| CSS | Tailwind CSS v4 | |
| Componenti UI | shadcn/ui (Radix UI) | `radix-ui` 1.4.x |
| PDF | HTML + stampa del browser | `buildPdfHtml()` → HTML servito dalle route → l'utente salva come PDF con la stampa. ⚠️ **Niente Chromium headless**: `@sparticuz/chromium`, `puppeteer-core` e `playwright-core` sono stati RIMOSSI il 5 ago (non funzionavano su Vercel Lambda). Non reintrodurli — vedi B.8. |
| Lettura PDF (import listini) | `unpdf` | Puro JS, estrazione testo server-side. |
| Analytics | PostHog EU | Non configurato in prod |
| Feature flags | Flagsmith | Non configurato in prod |
| Error tracking | Sentry | Non configurato in prod |
| Testing | Vitest (unit) + Playwright (E2E) | |
| Linguaggio | TypeScript 5.x strict mode | |

---

## 3. INFO OPERATIVE

```
Repo:           github.com/Elis93/carta-canta
Dev locale:     C:\Users\Public\carta-canta   (⚠️ spostato da C:\progetti\carta-canta — giugno 2026)
Backup NAS:     Z:\CARTA CANTA  (remote git "nas")
Hosting:        Vercel Pro fra1
DB:             Supabase — project ID ivbzuhgwszkdnlsybsao
URL prod:       https://cartacanta.app
Deploy:         push su master → Vercel Production automatico entro 1-3 min
```

---

## 4. STRUTTURA PROGETTO (rilevante)

```
app/
├── (app)/
│   ├── dashboard/                  # KPI, attività recente, PendingDocCard
│   ├── preventivi/
│   │   ├── page.tsx                # Lista con search unificata, filtri, tab status
│   │   ├── [id]/page.tsx           # Dettaglio con timeline, PDF, send
│   │   ├── scadenze/page.tsx       # Preventivi in scadenza entro 3gg
│   │   └── _components/           # PreventivoForm, VociTable, CatalogPicker,
│   │                               # DocumentTimeline, PdfActions, StatusBadge...
│   ├── fatture/
│   │   ├── page.tsx
│   │   ├── [id]/page.tsx           # Con LinkToPreventivoButton
│   │   └── _components/           # CreateFromPreventivoButton, LinkToPreventivoButton
│   ├── cestino/page.tsx            # Soft delete — recupero/purge (15gg)
│   ├── clienti/[id]/page.tsx
│   ├── template/                   # 4 preset, PresetSelector, TemplateEditor, Preview
│   ├── catalogo/                   # CRUD + AtecoCatalogSuggestion
│   ├── impostazioni/tabs/          # generali, fiscali (senza card Numerazione), piano, notifiche
│   ├── abbonamento/page.tsx        # Quota bar free, piano explanation
│   └── referral/
├── (auth)/
│   ├── login/page.tsx
│   ├── signup/
│   ├── verifica-email/page.tsx     # Accessibile senza auth (in PUBLIC_PATHS)
│   └── actions.ts                  # loginAction, signupAction, ecc.
├── p/[token]/                      # Pagina pubblica preventivo
├── api/
│   ├── documents/[id]/pdf/         # GET — genera/serve PDF (inline o attachment)
│   ├── documents/[id]/send-email/  # POST — invia email con PDF allegato
│   ├── preventivi/[id]/status/     # PATCH — cambio stato manuale
│   ├── p/[token]/accept|decline|view/
│   ├── cron/expire-documents/
│   ├── cron/referral/
│   └── webhooks/stripe/
lib/
├── actions/documents.ts            # Server Actions: create, saveDraft, send, duplicate,
│                                   # restore, purge, linkDocument, peekNextDoc/Invoice
├── actions/templates.ts            # CRUD template + selectPresetAction
├── fiscal/calcoli.ts               # INTOCCABILE — 100% coverage
├── pdf/template.ts                 # buildPdfHtml — 4 layout — INTOCCABILE senza screenshot
├── pdf/generate.ts                 # Playwright HTML→PDF + cache Supabase Storage
├── email/send.ts                   # sendEmail — HTML + plain-text generato
├── free-trial.ts                   # checkFreeBlock — FREE_DOC_LIMIT = 8
└── auth-rate-limit.ts              # isAuthRateLimited — Upstash Redis
proxy.ts                            # Middleware Next.js — PUBLIC_PATHS include /verifica-email
types/database.ts                   # GENERATO — non modificare manualmente
```

---

## 5. VARIABILI D'AMBIENTE

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PRO_MONTHLY=
STRIPE_PRICE_PRO_YEARLY=
STRIPE_PRICE_TEAM_MONTHLY=
STRIPE_PRICE_TEAM_YEARLY=
STRIPE_PRICE_LIFETIME=
OPENAI_API_KEY=           # Fallback AI (vuota in prod)
MISTRAL_API_KEY=          # Primario AI (vuota in prod)
ASSEMBLYAI_API_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@send.cartacanta.app
RESEND_FROM_NAME=Carta Canta
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
CRON_SECRET=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://eu.posthog.com
NEXT_PUBLIC_FLAGSMITH_KEY=
SENTRY_DSN=
NEXT_PUBLIC_APP_URL=https://cartacanta.app
NEXT_PUBLIC_APP_NAME=Carta Canta
NEXT_PUBLIC_AI_IMPORT_ENABLED=    # 'true' per mostrare il bottone AI Import (richiede anche OPENAI/MISTRAL key)
NEXT_PUBLIC_SDI_ENABLED=          # 'true' per mostrare la card SDI sulle fatture
OPENAPI_SDI_API_KEY=              # chiave OpenAPI SdI (vuota = provider MOCK di prova, nessuna trasmissione reale)
OPENAPI_SDI_BASE_URL=             # default sandbox https://test.sdi.openapi.it (prod: da doc OpenAPI)
SDI_WEBHOOK_SECRET=               # segreto per /api/webhooks/sdi?secret=...
OPENAPI_COMPANY_API_KEY=          # ⚠️ DIVERSA dalla chiave SdI — token OpenAPI con scope GET company.openapi.com/IT-start, per la verifica P.IVA sul Registro Imprese quando si pubblica il profilo vetrina (vuota = solo VIES). Scade: se scaduta → 401/403 → 'unavailable' → il profilo NON si pubblica per chi non è nel VIES.
OPENAPI_COMPANY_BASE_URL=         # default https://company.openapi.com
TWA_SHA256_FINGERPRINT=           # Play Store: fingerprint SHA-256 (anche più d'uno, separati da virgola) → attiva /.well-known/assetlinks.json
TWA_PACKAGE_NAME=                 # default app.cartacanta.twa
```

---

## 6. PIANI E FEATURE GATING

```typescript
// lib/stripe/plans.ts — valori effettivi in produzione
Piano Free:         limit = 8 preventivi storici (sent_quota_used in lib/free-trial.ts)
                    1 template, watermark visibile, voice 300s/mese
Piano Pro:          preventivi illimitati, template illimitati, no watermark, voice 3600s/mese
Piano Team:         tutto Pro + 5 collaboratori + approval workflow
Piano Lifetime:     tutto Pro, pagamento one-time
```

**Prezzi Stripe:**
```
Free:           €0
Pro Mensile:    €19.00/mese
Pro Annuale:    €182.00/anno
Team Mensile:   €49.00/mese
Team Annuale:   €470.00/anno
Lifetime:       €299.00 one-time
```

**Template gating:**
- Free: scelta 4 preset base, 1 template max, nessuna personalizzazione avanzata
- Pro/Team: colore, font, logo position, watermark, legal notice, header/footer HTML, template illimitati

---

## 7. DATABASE SCHEMA

### Enums
```sql
plan_type:     free | pro | team | lifetime
fiscal_regime: forfettario | ordinario | minimi
doc_status:    draft | sent | viewed | accepted | rejected | expired
```

### Tabelle principali

**`workspaces`**: `owner_id`, `plan`, `stripe_customer_id`, `stripe_subscription_id`, `billing_interval`, `fiscal_regime`, `ateco_codes TEXT[]`, `validity_days`, `logo_url`, `bollo_auto`, `ritenuta_auto`, `sent_quota_used INT`.

**`documents`**: `doc_type` ('preventivo'|'fattura'), `status`, `public_token`, `doc_number`, `doc_year`, `doc_seq`, `template_snapshot JSONB`, `signature_image`, `rejection_reason`, `bonus_edilizio`, `origin_document_id UUID` (per fatture da preventivo), `last_reminder_at TIMESTAMPTZ`, `deleted_at TIMESTAMPTZ` (null = attivo, non-null = nel cestino), `accepted_at`, `accepted_ip`, `accepted_ua`, `signer_name`.

**`document_items`**: `sort_order`, `description`, `unit`, `quantity`, `unit_price`, `discount_pct`, `vat_rate`, `total`, `bonus_tipo`.

**`invoice_sequences`**: PK `(workspace_id, year, doc_type)`. Colonne: `doc_type TEXT`, `seq_type TEXT` (legacy), `last_number INT`, `year`, `workspace_id`. Funzione RPC `next_invoice_number(p_workspace, p_year, p_doc_type)` — atomica, usa INSERT ON CONFLICT DO UPDATE.

**`templates`**: `preset_key TEXT CHECK('classico'|'bold'|'tecnico'|'elegante')`, `color_primary`, `font_family`, `show_logo`, `show_watermark`, `legal_notice`, `header_html`, `footer_html`, `logo_position TEXT('left'|'right')`, `is_default`.

**`catalog_items`**: `workspace_id`, `name`, `description`, `unit`, `unit_price`, `vat_rate`, `category`, `is_active`.

**`document_views`**: `document_id`, `viewed_at`, `user_agent`, `ip_address`.

**`referral_codes`**, **`referral_uses`**, **`referral_rewards`**: vedi sezione 13.

**`voice_usage`**: `workspace_id`, `period TEXT` (YYYY-MM), `seconds_used`. UNIQUE su `(workspace_id, period)`.

### Migration applicate (001–031)

| # | Contenuto |
|---|---|
| 001 | Schema completo: workspaces, clients, templates, documents, RLS |
| 002 | `doc_year`, `doc_seq` generated columns |
| 003–010 | signer_name, viewed_status, document_views, notification_prefs, catalog_items, fatture, signature_image, rejection_reason |
| 011 | rate_limit_events |
| 012–013 | invoice_sequences per doctype, next_invoice_number unificata |
| 014–017 | ateco_codes array, bonus_edilizio, workspace_validity_days, storage logos |
| 018 | Referral system + trigger + RLS + my_workspace_ids() |
| 019 | voice_usage |
| 020 | billing_interval su workspaces + reward_month su referral_rewards |
| 021 | template preset_key CHECK |
| 022 | template logo_position + number_format |
| 023 | pdf_downloaded_at |
| 024 | free_trial_expires_at |
| 025 | sent_quota_used su workspaces |
| 026 | origin_document_id su documents |
| 027 | fix doc_seq prefix per prefissi non-numerici |
| 028 | repair invoice_sequences (aggiunge doc_type, ricrea PK, aggiorna RPC) |
| 029 | last_reminder_at TIMESTAMPTZ su documents |
| 030 | deleted_at TIMESTAMPTZ su documents + indici parziali (soft delete) |
| 031 | next_invoice_number: SECURITY DEFINER + GREATEST anti-gap (applicata 20 mag 2026) |

---

## 8. MOTORE FISCALE — REGOLE INVIOLABILI

```typescript
// lib/fiscal/calcoli.ts — NON TOCCARE senza test

// ARROTONDAMENTO: sempre round half up — MAI toFixed() — MAI banker's rounding
function roundFiscale(v: number) { return Math.round((v + Number.EPSILON) * 100) / 100 }

// ORDINE CALCOLO OBBLIGATORIO:
// 1. totale per voce (qty × price × (1 - discount%))
// 2. subtotale
// 3. sconto globale
// 4. IVA PER ALIQUOTA: basi (scontate) sommate per aliquota, UNA moltiplicazione
//    per aliquota — è il ricalcolo che fa lo SdI (controllo 00421, ±1 cent).
//    ⚠️ MAI per voce e poi somma: 5 voci da 10,11 € al 22% → 11,10 contro il
//    ricalcolo 11,12 = fattura SCARTATA. (Corretto 10 ago 2026; prima qui
//    c'era scritto "IVA PER VOCE — obbligatorio per legge", che era falso.)
// 5. ritenuta d'acconto
// 6. marca da bollo (forfettari con afterDiscount > 77.47 → €2.00)
// 7. totale finale
```

---

## 9. FLOWS UTENTE

### Creazione preventivo
1. Nuovo → seleziona cliente → aggiunge voci (con microfono) → salva bozza
2. Invia al cliente → email con PDF → public_token generato → status 'sent'
3. Cliente apre `/p/[token]` → accetta/rifiuta → notifica email all'artigiano
4. Accettazione: salva IP + UA + timestamp → status 'accepted'
5. Opzionale: converte in fattura (doppio entry point)

### Link pubblico cliente
- URL: `/p/[token]` — MAI `/preventivi/[id]`
- No auth, mostra preventivo nel template
- Email `reply_to` impostata sull'email dell'owner

### Re-edit preventivo accepted
- Disponibile se non ha fattura collegata con status accepted
- `saveDraftAction` resetta status a 'draft', azzera `accepted_at`
- Se ha fattura collegata accepted → locked, solo lettura

### Soft delete
- `deleteDocumentAction` imposta `deleted_at = now()`
- `/cestino` mostra i documenti nel cestino con countdown 15gg
- `restoreDocumentAction` azzera `deleted_at`
- `purgeDeletedDocumentAction` cancella definitivamente
- Cron auto-purge documenti con `deleted_at > 15gg`

---

## 10. RATE LIMITING

```typescript
// lib/auth-rate-limit.ts
// Auth login: 10 fallimenti / 15min per IP — conta solo errori, non login riusciti
// Key: auth:login-fail:{ip}

// lib/rate-limit.ts (in-memory fallback)
// send-email: 10/ora per user
// accept/decline: 5/ora per token
// AI extract: 5/min
// PDF: 10/min
```

---

## 11. FEATURE FLAGS (Flagsmith — non configurato in prod)

```typescript
FEATURE_AI_IMPORT: true (ma chiavi vuote)
FEATURE_VOICE_INPUT: true
FEATURE_REFERRAL: true
FEATURE_SDI_INTEGRATION: false
FEATURE_MARKETPLACE: false
FEATURE_PUBLIC_API: false
```

---

## 12. FUNZIONALITÀ IMPLEMENTATE (sintesi)

- Auth: email/password + OAuth Google (solo Google — GitHub non implementato) + bfcache fix mobile
- Onboarding multi-step (fiscali, ATECO, logo)
- Preventivi CRUD + status workflow + DocumentTimeline + re-edit accepted
- Soft delete + cestino + recupero 15gg
- Pagina scadenze `/preventivi/scadenze`
- Fatture CRUD + conversione da preventivo (doppio entry point + idempotenza)
- Collegamento bidirezionale preventivo ↔ fattura
- Clienti: rubrica + full-text search + StatusBadge + CF dedup
- Catalogo: CRUD + suggerimento ATECO verificato in produzione
- Template PDF: 4 preset (Classico, Bold, Tecnico, Elegante)
- Template: personalizzazioni Free/Pro + safeAccentColor + logo position
- PdfActions: server-side links (non più client-side)
- Dashboard: 5 KPI + RevenueChart dual-bar + PendingDocCard solleciti
- Referral: codici, cron premi mensili, pagina piano-specifica
- Stripe: webhook + billing_interval + subscription lifecycle
- Voice input: AssemblyAI SDK v4, quota mensile per piano
- AI import: endpoint pronto, disabilitato in prod (chiavi vuote)
- Export CSV preventivi
- Cron: scadenze + last_reminder_at + referral premi
- Email: HTML + plain-text, replyTo owner, no emoji nei subject/body

---

## 13. LOGICA REFERRAL

La logica viene calcolata il **1° di ogni mese** dal cron `/api/cron/referral`. Premio quando il referrer ha **3+ referee con abbonamento attivo**.

| Piano referrer | Tipo referee | Beneficio |
|---|---|---|
| Free | Qualsiasi abbonamento | 1 mese Pro gratis |
| Pro mensile | Qualsiasi abbonamento | Rinnovo €19 non addebitato |
| Pro annuale | Qualsiasi abbonamento | Scadenza +1 mese |
| Team mensile | 3+ Piano Team | Rinnovo €49 non addebitato |
| Team mensile | 3+ Piano Pro (non Team) | 50% sconto rinnovo (€24,50) |
| Team annuale | 3+ Piano Team | Scadenza +1 mese |
| Team annuale | 3+ Piano Pro (non Team) | Scadenza +2 settimane |

---

## 14. 4 TEMPLATE PDF — SPECIFICHE VISIVE

**NON modificare senza screenshot di riferimento aggiornati.**

| Preset | Font | Target | Caratteristica chiave |
|---|---|---|---|
| **Classico** | Inter | Artigiani, imprese | Header bianco, "PREVENTIVO" 26px a destra, table header scuro |
| **Bold** | Helvetica | Imprese, ristrutturazioni | Header dark full-width, badge pillola doc number, box "TOTALE DA PAGARE" |
| **Tecnico** | GeistSans | Elettricisti, idraulici, geometri | Strip 4 celle, colonna COD, totale sulla seconda riga voce |
| **Elegante** | Georgia | Consulenti, creativi, architetti | Logo bordato (non riempito), serif, doc number grande italic, no fill header table |

`safeAccentColor` è obbligatorio: se il colore brand è chiaro (luminosità > soglia), usa `#1a1a2e` per il testo — mai testo chiaro su sfondo bianco.

---

## 15. DEBITO TECNICO

| Voce | Priorità | Stato |
|---|---|---|
| AI import attivazione | Media | Chiavi vuote in prod — attivare quando pronto |
| PostHog / Flagsmith / Sentry | Bassa | Configurare chiavi in prod |
| INET → TEXT per `ip_address` | Bassa | Opzionale, non urgente |
| `referee_workspace_id` nullable | Bassa | Decisione aperta |
| Logo PNG nel PDF | Alta | Non testato con logo reale — da verificare |
| Email spam | Alta | Fix codice applicato (plain-text + no emoji). DNS da verificare. |

---

## 16. ROADMAP — DECISO MA RIMANDATO

| Feature | Note |
|---|---|
| Numerazione bozze separata | "Bozza 001" vs "Prev001/2026" — proposta non confermata. Migration + logica separata. |
| TASK 13 — Template preview consistency | Descrizione vaga. Non procedere. |
| SDI / fatturazione elettronica | Provider gestito, ~€0.10/fattura. Rimandato. |
| Team collaboration UI | DB pronto, manca UX inviti. |
| Portale cliente avanzato | Diverso da p/[token]. |
| Notifiche push mobile | — |
| Multi-lingua PDF | Fase 2. |
| Marketplace ATECO | Fase 3. |

---

## 17. COMMIT RECENTI RILEVANTI

```
83f1b89  fix(bugs): 7 bug fix — auth, PDF, numerazione, email, mobile         ← SESSIONE 13
a9ea4fe  fix(ux): tasks 29-45 — doc number prefix, template fields, CF dedup  ← pre-sessione 13
53b2c61  fix(ux): mobile fixes, auth email URL, fattura-da-preventivo          ← pre-sessione 13
58438b1  feat(preventivi): timeline always visible, link fattura, quota fix    ← pre-sessione 13
741ee8c  feat(preventivi): accepted→draft re-edit, DocumentTimeline            ← pre-sessione 13
d4dbddf  fix(ux): doc number prefixes, segna accettato, status dropdown        ← pre-sessione 13
92670ce  fix(ux): sollecito ripetibile, login hints, VociTable lg, dual-bar    ← SESSIONE 12
225c949  fix(ux): OAuth bfcache, login error hints, VociTable mobile, no kanban← SESSIONE 12
7ec389b  feat(ux): soft delete cestino + dashboard KPI fatturato               ← pre-sessione 12
3d671d3  fix(ux): hardcode prefixes + scadenze page + update overlay           ← pre-sessione 12
066dee1  feat(solleciti): last_reminder_at + email deliverability fixes        ← SESSIONE 11
356b9f3  fix(dashboard): split draft KPI preventivi + fatture                  ← SESSIONE 11
```

---

## 18. COMANDI UTILI

```bash
# Sviluppo
npm run dev

# Type check (OBBLIGATORIO prima di ogni commit)
npx tsc --noEmit

# Rigenerare tipi Supabase (dopo ogni migration)
npx supabase gen types typescript --project-id ivbzuhgwszkdnlsybsao > types/database.ts

# Build
npm run build

# Test
npm test

# Backup NAS
git push nas master

# Forzare rigenerazione PDF
GET /api/documents/[id]/pdf?force=1
```

---

## 19. CHECKLIST PER RIPRENDERE IL LAVORO

- [ ] Leggi questo file per intero (almeno sezioni A, B, C, D)
- [ ] `git log --oneline -5` — capire l'ultimo stato
- [ ] Verifica bug aperti in sezione A prima di iniziare nuovi task
- [ ] Prima di ogni modifica: capire la causa reale nel codice
- [ ] Dopo ogni modifica: `npx tsc --noEmit` + `npm run build` — entrambi verdi
- [ ] Aggiorna CLAUDE.md a fine sessione con formato sezione C
- [ ] Backup NAS + push origin prima di chiudere
