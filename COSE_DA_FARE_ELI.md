# Cose da fare (Eli) — aggiornato al 19 luglio 2026

> Tutto ciò che richiede un'azione manuale tua e non risulta ancora fatto.
> Spunta le caselle man mano; quando una sezione è completa dimmelo e
> aggiorno il file. In fondo c'è la sezione **TEST** con tutti i collaudi.

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

- [ ] **Inviare all'avvocato UN SOLO file**: `CartaCanta_Avvocato_DOSSIER_UNICO_19lug2026.pdf`
      (in chat, 19 lug — 16 aree: riassorbe e SOSTITUISCE tutti i PDF precedenti del
      7/14/15/17 lug e l'addendum ads; include anche le domande sulla campagna video AI).
      Allega solo, se te lo chiede: PLAY_STORE_SCHEDA.md (per il Data Safety, punto 15)
      e il brief video (per il punto 16)
- [ ] **Inviare al commercialista UN SOLO file**: `CartaCanta_Commercialista_DOSSIER_UNICO_19lug2026.pdf`
      (in chat, 19 lug — 13 aree: riassorbe e SOSTITUISCE tutti i PDF/addendum commercialista
      precedenti; include annullamento/riattivazione fattura, numerazione e la domanda sulle
      note di credito TD04 via SdI)

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
- [ ] **Screenshot** del telefono (minimo 2 — consigliati: Home, Nuovo preventivo,
      pagina del cliente con Accetta, Lavori, Bilancio)
- [x] ~~Feature graphic 1024×500~~ ✅ pronta — te l'ho inviata in chat il 15 lug

---

## 💳 5. Stripe

- [ ] **Stripe live** (dopo P.IVA): chiavi live su Vercel + prodotti/prezzi in modalità live
- [ ] **Customer Portal**: attivare "Customers can switch plans" + prodotto Pro con
      entrambi i prezzi + proration "Create prorations" — va fatto in sandbox E in live
      (istruzioni dettagliate in CLAUDE.md §"CONFIG STRIPE DA FARE")

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

- [ ] **Monitoraggio uptime**: account gratuito su UptimeRobot (o Better Stack free)
      → aggiungi un monitor HTTPS su `https://cartacanta.app` con avviso alla tua
      email. Così se il sito va giù lo scopri tu, non un cliente. (Sentry che
      abbiamo già copre gli ERRORI nel codice, non il sito irraggiungibile.)
- [ ] **Google Search Console**: [search.google.com/search-console](https://search.google.com/search-console)
      → aggiungi la proprietà `cartacanta.app` (verifica via DNS su OVH) e invia
      la sitemap `https://cartacanta.app/sitemap.xml` (è già pubblicata dal codice).
      Serve a comparire su Google e ad accorgersi di problemi di indicizzazione.
- [ ] **Backup del database**: dashboard Supabase → Database → Backups → verifica
      che i backup giornalieri ci siano e (consigliato al lancio) valuta il
      Point-in-Time Recovery. Una volta sola: prova un restore su un progetto di
      test — un backup mai provato non è un backup.

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
