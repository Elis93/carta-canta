# CLAUDE.md — Memoria permanente del progetto Carta Canta

> **Fonte di verità per Claude Code.**
> Va aggiornato a fine di ogni sessione con: feature implementate, decisioni prese, bug emersi, cose rimandate.
> **Ultima sessione: 6 agosto 2026** (bonifica dati sensibili, pulizia della documentazione, PostHog e cookie nell'informativa privacy, correzione del blocco di hardening della 072).
> Gli handoff qui sotto partono dal **3 agosto**; quelli precedenti sono in `STORICO_SESSIONI.md` (consolidamenti: 14 giu · 15 lug · 6 ago 2026).
>
> **Dove sta cosa:** decisioni di prodotto e feedback → `DECISIONI_E_FEEDBACK.md` · azioni manuali di Eli → `COSE_DA_FARE_ELI.md` · sicurezza → `SICUREZZA.md` + `AUDIT_COPERTURA_SICUREZZA.md` · collaudi → `TEST_DA_FARE_ELI.md` · cancelli pre-lancio → `PRIMA_DEL_LANCIO.md`.
> I documenti di `_archivio-doc/` sono **roba finita**: non usarli come riferimento, contengono affermazioni non più vere.

---

## A0. HANDOFF — sessioni recenti (dalla più recente)

### ⏰ PROMEMORIA DA DARE A ELI — PULIZIA FILE ORFANI (richiesta esplicita del 5 ago: "ricordamelo, io me lo dimenticherò")
**⚠️ CLAUDE: se leggi questa riga il 1° settembre 2026 o dopo, TIRALA FUORI TU nella prima risposta — non aspettare che Eli se ne ricordi.**
Il job `/api/cron/orphan-files` gira il **1° di ogni mese alle 4:00** e da lì scrive un report; oggi è in SOLA LETTURA (`ORPHAN_CLEANUP_ENABLED` non impostata: conta e riferisce, non cancella).
**Cosa fare quando è il momento:** ① farsi mandare da Eli il report (Vercel → Logs, cerca `[cron/orphan-files]`, oppure la riga `orphan_cleanup` in `security_events`); ② **leggere i numeri PRIMA di accendere**: il segnale di salute è `orfani` PICCOLO rispetto a `file`. Se `orfani ≈ file` su un bucket, il confronto sbaglia ancora e accendere cancellerebbe roba viva — è esattamente quello che è successo il 5 ago col cache-buster `?v=` dei loghi, preso solo perché la cancellazione era spenta; ③ solo allora dire a Eli di aggiungere `ORPHAN_CLEANUP_ENABLED=true` su Vercel + Redeploy; ④ spuntare la casella in `COSE_DA_FARE_ELI.md §0-ter` e togliere questo promemoria.
⚠️ Se il report NON esiste (zero righe, zero log), la causa più probabile NON è "zero orfani": è che il cron non è partito. Verificare l'autenticazione della route (`Authorization: Bearer`, non `?secret=` — bug del 5 ago) e che `CRON_SECRET` sia su Vercel.

### ⏭️ PROMEMORIA PLAY STORE (29 lug, richiesta Eli): quando la TWA diventa app vera, ① attivare la "Location delegation" nel pacchetto (PWABuilder/Bubblewrap) così Posizione compare nel pannello Android dell'app; ② AGGIORNARE le istruzioni del pop-up "Attiva la posizione" in `NearMeButton` (variante standalone: oggi manda su Chrome→lucchetto perché le PWA delegano il permesso al sito). Annotato anche in COSE_DA_FARE_ELI.md §4.

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

**Codice (post-lancio o su richiesta):** **NOTE DI CREDITO TD04 (fase SdI)** — ⏸️ IN ATTESA per decisione Eli (19 lug): si costruisce quando lo SdI è LIVE **e** il commercialista ha risposto sulla numerazione (stessa serie vs sezionale). Struttura dati già quasi pronta (origin_document_id, invoice_sequences per doc_type, infra SdI xml/provider/webhook). **Progetto completo in `PROGETTO_NOTE_CREDITO.md`** (cosa c'è, cosa manca, fasi). Domande commercialista nel dossier unico §6. · FASE C commercialisti (XML FatturaPA, dopo SdI live) · **PAGAMENTO CON CARTA dal link fattura — ⏳ "APPENA POSSIBILE" (decisione Eli 4 ago)**: progetto congelato in `PROGETTO_PAGAMENTI_CARTA.md` (Stripe Connect Standard, direct charge sull'account dell'artigiano, noi mai i soldi); cancelli: Stripe live+P.IVA, attivazione Connect (Eli), riga dossier avvocato · cron purge workspace cancellati >10 anni · 2FA (decisione Eli 14 lug: non ora) · CSP con nonce + pen-test · salvataggio automatico foto analizzate dall'AI (decisione Eli 15 lug: si lascia così) · test Tier 2/3 · pattern checklist→mini-tour ✅ FATTO 15 lug.

### Stato migration (aggiornato 6 ago 2026)
**001-072 TUTTE APPLICATE, per intero.** Le ultime: 069 e 070 applicate da Eli il 5 ago (chiusura lettura pubblica foto · coordinate di pagamento solo dal server); 071 e la prima metà della 072 il 6 ago mattina (`security_events` · vincolo su `meta`); il **blocco di hardening della 072** (REVOKE+GRANT+`search_path` sulle due funzioni di purge, nella versione CORRETTA col GRANT a service_role) il 6 ago, dopo il fix del bug del REVOKE. Lo storico completo sta in `STORICO_SESSIONI.md`. ⚠️ Regola confermata da questo giro: **se serve rilanciare una migration, si rilancia il FILE INTERO** (sono tutte idempotenti) — mai indicare intervalli di righe, che invecchiano al primo edit.

**Verifica prima di ogni rilascio:** `npx tsc --noEmit` · `npm run build` · `npm test` (471) · `npm run build && npm run smoke:public` (20 check) · `npm run security:check` (sito vero).

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

- **🔒 COSTO/RICARICO/MARGINE MAI AL CLIENTE (Eli, 2 ago 2026 — permanente):** il costo d'acquisto, il ricarico e il margine dell'artigiano non devono MAI comparire in nessuna superficie vista dal cliente — PDF (`lib/pdf/template.ts` + `TemplatePreview`), pagine pubbliche `/p/[token]` e `/r/[token]`, email ai clienti finali, `template_snapshot`. Le colonne dei costi (`unit_cost` ecc.) non entrano MAI nelle select delle route pubbliche né nelle prop di componenti pubblici; filtro alla FONTE + grep/test di verifica a ogni PR. Dettagli e superfici vietate in `PROGETTO_LISTINO_FORNITORE.md`.

- **⚠️ SPAZI NEL TESTO JSX (bug Turbopack — scoperto 11 lug 2026):** lo spazio tra un elemento inline (`</b>`, `</strong>`, `</Link>`) e il testo che segue può venire MANGIATO dal compilatore quando il testo contiene accenti/apostrofi tipografici (es. "…</b> e scarica" → "…e scarica" attaccato), anche se nel sorgente lo spazio c'è. **Regola: usare SEMPRE `{' '}` esplicito tra un elemento inline e il testo adiacente** nei copy visibili. Verifica ground-truth: `grep -roh '}),"[a-zàèéìòù][^"]\{0,50\}' .next/server/chunks/ssr/*.js | sort -u` dopo il build (devono restare solo valori tecnici). ⚠️ **Lo scan sul build è CIECO sulle MAIUSCOLE** (19 lug: "…foto.</b> Tocca" arrivò in prod attaccato — "Tocca" non matcha `[a-z]`; estendere alle maiuscole produce troppi falsi positivi dalle label): per le maiuscole affiancare il grep sul SORGENTE `grep -rn '</b> [A-ZÀÈÉ]\|</strong> [A-ZÀÈÉ]\|</Link> [A-ZÀÈÉ]' --include="*.tsx" app components` → deve restituire 0 righe.
- **Mobile-first è non negoziabile.** Ogni funzionalità deve funzionare perfettamente su telefono prima che su desktop.
- `ClientAutocomplete`, `AtecoMultiSelect`, `CatalogPicker`: usano `<PopoverContent>` Radix (portal su `document.body`) — NON rimuovere, evita clipping da `Card overflow-hidden`.
- **Descrizione voce = `<textarea>` auto-grow, mai un `<Input>`** (`VociTable.tsx`, desktop e mobile): rows=1 che cresce col contenuto, niente scroll interno, niente altezza fissa. Riportarlo a input a riga singola troncherebbe le descrizioni lunghe ("Installazione caldaia a condensazione con collaudo e messa in servizio inclusi") proprio mentre si scrivono. Il microfono resta accanto, allineato in alto (`items-start`). *(Regola recuperata dal redesign mobile di giugno, archiviata il 6 ago.)*
- **Ordine dei campi indirizzo: Città → Provincia → CAP**, in OGNI schermata che li chiede, mobile e desktop (`ClientForm`, `impostazioni/tabs/generali`, `onboarding`). E **P.IVA / Codice Fiscale = UN SOLO campo** con rilevamento automatico (11 cifre = P.IVA, 16 caratteri = CF). *(Idem.)*

**Regole imparate sul campo** (ognuna nasce da un bug vero; il racconto disteso è in `STORICO_SESSIONI.md`):

- **Il simbolo `€` non va MAI a capo separato dal suo importo.** Nel JSX si usa `&nbsp;`, nelle stringhe TypeScript lo spazio unificatore ` `. `Intl` con `style:'currency'` lo mette già da solo. *(19 lug: su un preventivo vero il `€` finiva da solo sulla riga sotto.)*
- **I toast di successo durano al massimo 4 secondi** e si chiudono da soli (`<Toaster duration={4000}>`). Gli errori possono restare più a lungo. *(Regola di Eli, 16 lug.)*
- **Il grigio dei testi secondari è `var(--cc-muted)`, mai il letterale `#8a887f`**: nella modalità "Testo grande e leggibile" quella variabile si scurisce per alzare il contrasto, e un valore fisso salta il meccanismo.
- **Ogni portale flottante su `document.body` posizionato con `getBoundingClientRect` deve avere la classe `cc-portal-float`.** In modalità testo grande il body è ingrandito del 15% e senza contro-zoom il pannello si disallinea dal bottone che l'ha aperto (misurato: 59,6px di scarto su 390px).
- **Gli overlay a schermo intero vanno in portal su `document.body`.** `position: fixed` da solo non basta: un antenato con `transform`, `filter` o `zoom` diventa il contenitore di riferimento e l'overlay si dimensiona su quello (una volta è uscito come una striscia verticale di 23px).
- **Nei contenitori che scorrono in orizzontale, l'aria a fine riga si dà con uno spaziatore `::after`** — mai col padding del contenitore (viene mangiato a fine scroll) né coi margini sui figli (allargano la riga e spingono fuori l'ultima linguetta).
- **I suggerimenti contestuali passano SEMPRE da `ContextHint`**, mai da toast o banner scritti a mano: quel componente garantisce che un suggerimento compaia una volta sola, mai più di uno per sessione e mai durante il tutorial. La condizione di pertinenza la decide il chiamante lato server; l'id è nuovo, in kebab-case.
- **⚠️ Se una migration aggiunge colonne a una tabella con GRANT per colonna** (`reviews`, `marketplace_profiles`, `marketplace_requests`), bisogna estendere anche il GRANT, oppure spostare quella scrittura sull'admin client. Altrimenti PostgREST risponde `42501` e **fallisce l'INTERA scrittura**, non solo la colonna nuova — un bug rimasto latente per un mese.
- **⚠️ Una misura di sicurezza non è "fatta" perché il collaudo dal telefono sembra a posto.** Le policy permissive di PostgreSQL si sommano in **OR**: finché resta in piedi una vecchia policy aperta, una nuova policy restrittiva non restringe nulla. Va verificata con `npm run security:check` (che interroga il sito vero con la sola chiave pubblica), non a vista.
- **⚠️ Un header di sicurezza sbagliato rompe le funzioni IN SILENZIO.** `Permissions-Policy: geolocation=()` negava la posizione anche a noi: "Vicino a me" non funzionava da luglio e l'interfaccia lo raccontava come "permesso negato dall'utente". Gli 8 header sono ora verificati a ogni giro dallo smoke test.
- Dropdown bot `KanbanView` e `ViewToggle` sono stati rimossi definitivamente (session 12). Non re-aggiungere.
- `StatusBadge` con prop `docType` per distinguere fatture da preventivi (accepted→"Pagata", rejected→"Annullata").
- IVA visibile su mobile per regime ordinario (grid-cols-5 nel VociTable mobile).
- `safeAccentColor` obbligatorio in `TemplatePreview.tsx` e `template.ts` per evitare testo chiaro su sfondo bianco.
- **Ordinamento lista preventivi (aggiornato sessione 26):** default = **`oldest` ("Meno recenti", `updated_at ASC`)** — NON più `recent`. La preferenza utente è in **sessionStorage** (chiave `preventivi_sort_v2`), vale solo per la sessione. Questo elimina il "flip" all'apertura della pagina (prima il default server `recent` + localStorage `oldest` causava un `router.replace` visibile). NB: supera le note della sessione 18 che descrivevano localStorage + default `recent`.

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
3. Sequenza: capire → implementare → `npx tsc --noEmit` → `npm run build` → verificare → commit
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
OPENAPI_SDI_API_KEY=              # chiave OpenAPI (vuota = provider MOCK di prova, nessuna trasmissione reale)
OPENAPI_SDI_BASE_URL=             # default sandbox https://test.sdi.openapi.it (prod: da doc OpenAPI)
SDI_WEBHOOK_SECRET=               # segreto per /api/webhooks/sdi?secret=...
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
// 4. IVA PER VOCE (non sul totale — obbligatorio per legge IT)
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
