# Cose da fare (Eli) — aggiornato al 19 luglio 2026

> Tutto ciò che richiede un'azione manuale tua e non risulta ancora fatto.
> Spunta le caselle man mano; quando una sezione è completa dimmelo e
> aggiorno il file. In fondo c'è la sezione **TEST** con tutti i collaudi.

---

## 🔐 0. DA CONTROLLARE ORA — Autenticazione a 2 fattori sui TUOI account

> Promemoria che mi hai chiesto tu (5 ago). È **l'azione di sicurezza col miglior
> rapporto tra fatica e protezione**: la nostra app è difesa bene, ma chi entra in
> uno di questi cinque account non ha bisogno di attaccarla — si prende tutto
> (dati di tutti gli artigiani, dominio, codice, incassi).

Su ognuno: attiva il **2FA con app di autenticazione** (Google Authenticator, Authy,
1Password…) — **non con SMS**, che si intercetta con lo scambio di SIM — e **salva i
codici di recupero** (stampati o in cassaforte, non nella stessa email).

- [ ] **Supabase** (il database: ci sono TUTTI i dati) → Account Settings → Security → Two-Factor
- [ ] **Vercel** (l'hosting: chi entra pubblica quello che vuole su cartacanta.app) → Settings → Authentication
- [ ] **GitHub** (il codice, ed è collegato al deploy) → Settings → Password and authentication
- [ ] **Registrar del dominio** (chi prende il dominio dirotta email e sito) → area sicurezza del pannello
- [ ] **La tua casella email** (serve a recuperare tutti gli altri: è la chiave delle chiavi)

Quando li hai fatti, dimmelo e li spunto io. Se uno di questi ha già il 2FA attivo,
verifica solo che i **codici di recupero** siano al sicuro e non nella stessa email.

---

## 🔐 0-bis. DUE MIGRATION (5 ago) — applicate, resta da confermare

Applicate da Eli il 5 agosto dal telefono. **Verificato dal vivo**: le impostazioni
di pagamento si salvano correttamente (= il codice nuovo è online e la 070 non ha
rotto il salvataggio) e il cambio IBAN **fa partire davvero l'email di avviso**.

- [~] **069 — chiude davvero l'archivio foto.** La 068 non era bastata: era rimasta
      la vecchia regola *"le foto le può leggere chiunque"*, e le regole si sommano.
      Con la chiave pubblica del sito si poteva sfogliare e scaricare le foto di
      **tutti** gli artigiani.
- [~] **070 — l'IBAN si cambia solo passando dall'app.** Senza, chi ruba una sessione
      cambia le coordinate di pagamento **scavalcando l'email di avviso**.

⚠️ **Perché non sono ancora spuntate del tutto.** Salvataggio riuscito ed email
ricevuta dimostrano che il codice funziona, **non** che le migration siano in piedi:
entrambe quelle cose vivono nel codice, e sarebbero andate a buon fine anche senza.
È la stessa trappola in cui è caduta la 068 stamattina (il collaudo passava perché
toccava l'unico canale già chiuso). La conferma vera sono questi due controlli dal PC:

1. `npm run security:check` → prova i canali dell'archivio foto con la sola chiave
   pubblica del sito (è il controllo che smaschera la 069 mancante).
2. Nel SQL Editor: `select case when exists (select 1 from pg_trigger where
   tgname='trg_protect_payment_details' and not tgisinternal) then '070 OK' else
   '070 DA FARE' end;`

---

## 🔴 1. URGENTE — Rotazione password account demo (GitGuardian)

La password del demo è finita nel repository pubblico (segnalazione GitGuardian
del 15 lug). Se hai già lanciato `seed:demo` in passato, l'account esiste in
produzione con quella password: va cambiata subito.

- [x] ~~Nel file `.env.local` una password NUOVA (min 12 caratteri): `DEMO_PASSWORD=...`~~ ✅
- [x] ~~`npm run seed:demo` — ruota la password in prod + rigenera il demo~~ ✅ (20 lug: seed
      andato a buon fine, "ACCOUNT DEMO PRONTO" → password = quella del tuo .env.local; la vecchia è morta)
- [x] ~~GitGuardian: segnare l'incident risolto~~ ✅ (20 lug: incident del 15 lug → Resolved
      "Secret revoked"; le 2 segnalazioni di maggio erano falsi positivi — password finta nei
      test + falso riconoscimento in auth/confirm — → Ignored "Not a secret". 0 incident aperti.)

**🎉 SEZIONE COMPLETATA — l'incidente GitGuardian è chiuso del tutto.**

---

## ⚖️ 2. Professionisti — il cancello che sblocca quasi tutto

> **📅 Aggiornamento Eli (20 lug):** al **commercialista ha GIÀ scritto**; il contatto con
> l'**avvocato** slitta a **SETTEMBRE** (vacanze estive di mezzo). I due dossier unici del
> 19 lug restano pronti e validi — se emergono nuove domande, Code li aggiorna e li
> ri-manda in chat. (Da verificare: se al commercialista è stato allegato il dossier
> `CartaCanta_Commercialista_DOSSIER_UNICO_19lug2026.pdf` o se era un primo contatto.)

- [ ] **Inviare all'avvocato UN SOLO file**: `CartaCanta_Avvocato_DOSSIER_UNICO_19lug2026.pdf`
      (in chat, 19 lug — 16 aree: riassorbe e SOSTITUISCE tutti i PDF precedenti del
      7/14/15/17 lug e l'addendum ads; include anche le domande sulla campagna video AI).
      ⏭️ **Da aggiungere alla prossima rigenerazione del dossier** (annotato 4 ago):
      pagamenti con carta via **Stripe Connect Standard** (direct charge sull'account
      dell'artigiano, Carta Canta mai parte del flusso di denaro) — conferma impostazione
      + aggiornamento Termini/Privacy (Stripe destinatario). Dettagli in PROGETTO_PAGAMENTI_CARTA.md §3.
      Allega solo, se te lo chiede: PLAY_STORE_SCHEDA.md (per il Data Safety, punto 15)
      e il brief video (per il punto 16)
- [ ] **Inviare al commercialista UN SOLO file**: `CartaCanta_Commercialista_DOSSIER_UNICO_5ago2026.pdf`
      (in chat, 5 ago — **17 aree, 40 domande numerate D1-D40**: riassorbe e SOSTITUISCE il dossier
      del 19 lug e ogni PDF/addendum precedente). ⚠️ **Manda questo, non quello del 19 luglio.**
      Nuove rispetto al 19 lug: pagina Bilancio + testo di avvertenza per i forfettari (§11),
      storia degli incassi che cambia il CSV già consegnato in passato (§12), tracciato export con
      la colonna "Lavoro" (§13), incasso con carta via Stripe Connect (§15), collaboratori e ore
      di lavoro (§16). Le risposte più urgenti sono segnate in fondo al PDF: D13-D14 (data della
      fattura), D17-D19 (note di credito), D9 (IVA sullo sconto), D2-D3 (P.IVA/forma giuridica).

⏭️ **Da aggiungere alla prossima rigenerazione del dossier avvocato** (annotato 5 ago):
**verifica automatica della partita IVA sui registri pubblici.** Quando un artigiano chiede di
pubblicarsi nella vetrina, controlliamo la sua P.IVA prima sul VIES (servizio pubblico della
Commissione europea) e, se lì non risulta, sul **Registro Imprese tramite Openapi S.p.A.** —
lo stesso fornitore dello SdI, quindi l'avvocato può guardare i due contratti insieme. Da
chiedergli: ① la **base giuridica** che abbiamo scritto nell'informativa è quella giusta
(oggi: esecuzione del contratto + legittimo interesse a una directory affidabile)? ② l'
**addendum "informazioni commerciali"** di Openapi, firmato da Eli come persona fisica ai sensi
del T.U.L.P.S., copre il nostro uso (verifichiamo la P.IVA di TERZI, cioè dei nostri utenti)?
③ va rifatto se in futuro nasce una società? ④ l'informativa dice abbastanza, o serve anche un
avviso nel momento della pubblicazione?
⚠️ **L'informativa privacy è già stata aggiornata** con questa informazione (5 ago): meglio
dichiarare un trattamento che facciamo davvero che ometterlo. Resta da far confermare il testo.

Dopo l'OK dell'avvocato (in ordine di impatto):
- [ ] Compilare i **campi in giallo** nelle pagine Privacy e Termini
      (ragione sociale, P.IVA, foro competente, email privacy)
- [ ] Testo della **cookie policy** (il banner è già pronto nel codice e si accende da solo)
- [ ] Dicitura **"copia di cortesia"** sulle fatture PDF (finché lo SdI non è live)
- [ ] Decisione sulle **recensioni Google** automatiche (feature pronta ma bloccata)
- [ ] Conferma delle risposte **Data Safety** del Play Store (sono in PLAY_STORE_SCHEDA.md §2)

Dopo il confronto col commercialista:
- [ ] Decisione **forma giuridica / P.IVA** (questione frontaliera — ricerca del 7 lug)
- [ ] Validare i **tracciati degli export** (registro fatture e bilancio CSV)

---

## 🧾 3. SdI / fatturazione elettronica (must-have fiscale n.1)

- [ ] Registrazione su **console.openapi.com**
- [ ] Generare le **chiavi sandbox** e passarmele → collaudo io la trasmissione di prova
- [ ] (dopo l'ok dell'avvocato sul contratto/DPA OpenAPI) chiavi di produzione
- [ ] ⏸️ **Note di credito (TD04)** — da costruire QUANDO lo SdI è live: chiedi al
      commercialista se la nota di credito usa la **stessa serie** delle fatture o un
      **sezionale separato** (dossier §6). Con quella risposta + SdI attivo, Code costruisce
      la funzione (progetto già pronto in `PROGETTO_NOTE_CREDITO.md`). NON prima.

---

## 📱 4. Play Store

I testi sono pronti in **PLAY_STORE_SCHEDA.md** (te l'ho mandato anche in chat).

- [ ] Decidere il **tipo di account sviluppatore**: Personale (richiede 12 tester
      per 14 giorni prima di pubblicare) vs Organizzazione (serve numero D-U-N-S,
      niente requisito tester) — dipende dalla decisione P.IVA del punto 2
- [ ] Decidere sul **nodo Play Billing** (scheda §5): l'abbonamento comprato dentro
      l'app Android viola la policy pagamenti di Google → il mio consiglio è
      nascondere l'acquisto nell'app Android e gestire l'upgrade solo dal sito
- [ ] Impacchettare la TWA (es. PWABuilder) e prendere il **fingerprint SHA-256**
      → su Vercel imposta `TWA_SHA256_FINGERPRINT=<fingerprint>` + Redeploy:
      `assetlinks.json` si pubblica da solo (già pronto nel codice)
- [ ] ⚠️ Nel pacchetto TWA attivare la **"Location delegation"** (opzione di
      PWABuilder/Bubblewrap): fa comparire la voce **Posizione** nel pannello
      Android dell'app (verificato il 29 lug: senza, le PWA mostrano solo
      "Notifiche" e il permesso posizione resta dentro Chrome).
      → Dopo il rilascio dell'app vera, DIRE A CLAUDE di aggiornare le
      istruzioni del pop-up "Attiva la posizione" (`NearMeButton`, variante
      app installata): il percorso diventa quello standard "tieni premuta
      l'icona → ⓘ → Autorizzazioni → Posizione".
- [ ] **Screenshot** del telefono (minimo 2 — consigliati: Home, Nuovo preventivo,
      pagina del cliente con Accetta, Lavori, Bilancio)
- [x] ~~Feature graphic 1024×500~~ ✅ pronta — te l'ho inviata in chat il 15 lug

---

## 💳 5. Stripe

- [ ] **Stripe live** (dopo P.IVA): chiavi live su Vercel + prodotti/prezzi in modalità live
- [x] ~~**Customer Portal (modalità TEST/sandbox)**~~ ✅ (20 lug: "cambio piani" attivo,
      prodotto Pro con entrambi i prezzi 19€/mese + 182€/anno, proration = "Ripartisci
      addebiti e accrediti", salvato)
- [ ] **Customer Portal (modalità LIVE)** — rifare IDENTICA config al lancio (la sandbox
      non si propaga al live). Istruzioni in CLAUDE.md §"CONFIG STRIPE DA FARE" → anche in PRIMA_DEL_LANCIO.md
- [ ] **Stripe Connect (per il "Paga con carta" dalla fattura — deciso 4 ago "appena possibile")**:
      quando Stripe è live, attiva **Connect → account Standard** dal Dashboard (gratis, solo config).
      Poi dimmelo: il progetto è pronto in `PROGETTO_PAGAMENTI_CARTA.md` e lo implemento.
      ⚠️ Prima serve anche la riga nel dossier avvocato (già annotata per la prossima rigenerazione).

---

## 📣 6. Marketing / lancio

- [ ] **Video demo** per la pagina /prova (lo volevi fare con NotebookLM)
- [ ] **Email automatica per i lead** dei moduli Meta (si imposta quando parte la campagna)

### Video promo con Higgsfield (brief pronto in chat: `CartaCanta_Brief_Higgsfield_Video_Promo.md`)
- [ ] **Registrare le 4 clip REALI dell'app** dall'account demo (10 min — elenco nel brief §3c:
      dettatura voce, invio, pagina cliente con firma, notifica+converti in fattura).
      ⚠️ Le schermate nei video devono essere vere, mai inventate dall'AI
- [ ] Generare le scene su **Higgsfield** con i prompt del brief (parti dal video corto da 15s)
- [ ] Montare: sottotitoli sempre, scritta "Video realizzato con AI", musica con licenza commerciale
- [ ] Alla pubblicazione: **toggle "Contenuto generato con AI" su TikTok** + autodichiarazione
      AI nelle inserzioni Meta (obbligatori; checklist completa nel brief §9)
- [ ] Claim ammessi SOLO quelli del brief §2b ("Gratis durante la beta", mai "gratis per sempre",
      niente promesse di guadagno) — le domande fini (es. claim "60 secondi") sono nel dossier
      avvocato punto 16, ma NON bloccano la partenza se rispetti il brief

---

## 🛰️ 7. Operatività post-lancio (dalla verifica del 15 lug contro le checklist di settore)

Tre cose da 10 minuti l'una che le checklist di lancio danno per obbligatorie
e che nessuno strumento nostro copre ancora:

- [x] ~~**Monitoraggio uptime** (UptimeRobot)~~ ✅ (20 lug: monitor HTTP su `cartacanta.app`,
      intervallo 5 min, avviso email a elly.4ee@gmail.com, status "Up" verde. Test email ok.)
- [x] ~~**Google Search Console** — proprietà + sitemap~~ ✅ (20 lug: proprietà DOMINIO
      `cartacanta.app` verificata via record TXT su OVH ⚠️ NON rimuovere quel TXT; sitemap
      `sitemap.xml` inviata con successo.)
- [~] **Backup del database** — ⚠️ **VERIFICATO 20 lug: il progetto è su piano FREE, che
      NON include backup automatici.** Ora va bene (solo dati demo). 🔴 **AL LANCIO (prima del
      primo cliente reale) → passare a Supabase Pro (~25 $/mese)**: attiva il backup giornaliero
      (7 gg) + Point-in-Time Recovery. NON rinunciabile per un gestionale con documenti fiscali.
      (Facoltativo nel frattempo: export manuale periodico — chiedere a Code se serve.)

---

## 💡 8. Accesso con impronta — FATTO (da collaudare)

Lo **sblocco rapido con l'impronta** è pronto (versione "dopo un primo login",
quella che avevi scelto). Come funziona: entri una volta con email e password sul
telefono, poi da **Impostazioni › Generale › "Sblocco con impronta"** lo attivi su
quel telefono; da lì, riaprendo l'app dopo il tempo che scegli (ad ogni apertura /
15 min / 1 ora / 1 giorno), rientri con impronta o Face ID. La password resta come
riserva. L'impronta **resta sul telefono**, non arriva a noi.

- [x] ~~Applica la migration 056 su Supabase~~ ✅ fatto il 20 lug
- [ ] **Collaudo sul telefono vero**: attiva lo sblocco, chiudi e riapri l'app,
      verifica che chieda l'impronta e che "Usa la password" riporti al login
- [ ] (più avanti, se vuoi) l'opzione "accesso completo SENZA password" — la
      valutiamo in una prossima sessione, tocca il cuore del login e va con calma

---

## 🧪 TEST — collaudi da fare sul telefono (10-15 minuti totali)

### Tutorial e guide
- [ ] **Tutorial nuovo (5 passi)**: Altro → Account e dati → "Rivedi il tutorial".
      Verifica: i 5 passi filano uno dietro l'altro SENZA dover salvare nulla in mezzo;
      al passo 3 si parla anche del preventivo dalle foto; alla fine la schermata
      scorre da sola sulla card Cliente
- [ ] **Mini-guide dalla checklist**: Home → tocca una voce NON completata di
      "Completa il profilo" (es. "Carica il listino nel catalogo").
      Verifica: atterri sulla pagina giusta e compare una guida che evidenzia il punto
      esatto dove agire — e puoi scriverci dentro subito, senza chiudere la guida

### Filtri e layout (le "sezioni tagliate")
- [ ] **Lavori**: i 5 filtri (Tutti · Da fare · In corso · Finiti · Fatturati) si vedono
      TUTTI senza scorrere, con spazi uguali tra le parole
- [ ] **Preventivi e Fatture**: le 5 tab entrano tutte, niente scroll laterale
- [ ] **Pagina del cliente** (se hai un preventivo con opzioni a livelli): le proposte
      sono impilate in verticale, tutte visibili subito

### Preventivo dalle foto (round 2)
- [ ] Rifai la prova con la foto del bagno: i badge ora dicono
      "prezzo dal tuo catalogo" / "prezzo da inserire" / "quantità da inserire"
- [ ] Il water sospeso NON deve più venire descritto "a pavimento" (nel dubbio l'AI
      ora omette il dettaglio di posa)
- [ ] **"Importa con AI"** (dal catalogo o dalle voci): su telefono la tabella dei
      risultati è impilata e non esce più dallo schermo

### Nuove pagine e contenuti
- [ ] **Altro → Account e dati**: c'è tutto (Scarica dati, Pacchetto commercialista,
      Invita commercialista, Rivedi tutorial, Elimina account) e Impostazioni è
      tornata a 5 tab comode
- [ ] **Aiuto**: 5 FAQ nuove (foto AI, Lavori, ore, richiami, rapportino)
- [ ] **Novità**: c'è l'annuncio del preventivo dalle foto
- [ ] **Velocità**: apri Home, Preventivi, Fatture, un dettaglio preventivo e il
      Bilancio — devono sembrare più reattivi di prima
- [ ] **Account demo** (dopo il seed del punto 1): entra col demo e verifica che ci
      siano i 3 lavori, la campanella col richiamo, i sopralluoghi in agenda e il
      margine nella card Economia del lavoro

---

*Le cose fatte di recente (per riferimento): caselle email OVH ✅ · DMARC quarantine ✅ ·
chiavi PostHog/Sentry/Turnstile su Vercel ✅ · chiavi AI + tetti di spesa ✅ ·
migration 047-052 ✅.*
