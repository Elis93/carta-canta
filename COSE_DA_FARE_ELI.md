# Cose da fare (Eli) — aggiornato al 15 luglio 2026

> Tutto ciò che richiede un'azione manuale tua e non risulta ancora fatto.
> Spunta le caselle man mano; quando una sezione è completa dimmelo e
> aggiorno il file. In fondo c'è la sezione **TEST** con tutti i collaudi.

---

## 🔴 1. URGENTE — Rotazione password account demo (GitGuardian)

La password del demo è finita nel repository pubblico (segnalazione GitGuardian
del 15 lug). Se hai già lanciato `seed:demo` in passato, l'account esiste in
produzione con quella password: va cambiata subito.

- [ ] Nel file `.env.local` sul tuo PC aggiungi una riga con una password NUOVA
      (lunga almeno 12 caratteri): `DEMO_PASSWORD=la-tua-nuova-password`
- [ ] Dalla cartella del progetto: `git pull` poi `npm run seed:demo`
      (ruota la password in produzione E rigenera il demo arricchito con
      lavori, richiami, ore e sopralluoghi)
- [ ] Nell'email di GitGuardian: "Fix This Secret Leak" → segna l'incident risolto

---

## ⚖️ 2. Professionisti — il cancello che sblocca quasi tutto

- [ ] **Inviare all'avvocato** il PDF consolidato (`CartaCanta_Avvocato_COMPLETO_14lug2026.pdf`,
      te l'ho mandato in chat il 14 lug — 14 punti)
- [ ] **Inviare al commercialista** il PDF consolidato (`CartaCanta_Commercialista_COMPLETO_14lug2026.pdf`,
      stessa chat — 13 punti)

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

---

## 📱 4. Play Store

I testi sono pronti in **PLAY_STORE_SCHEDA.md** (te l'ho mandato anche in chat).

- [ ] Decidere il **tipo di account sviluppatore**: Personale (richiede 12 tester
      per 14 giorni prima di pubblicare) vs Organizzazione (serve numero D-U-N-S,
      niente requisito tester) — dipende dalla decisione P.IVA del punto 2
- [ ] Decidere sul **nodo Play Billing** (scheda §5): l'abbonamento comprato dentro
      l'app Android viola la policy pagamenti di Google → il mio consiglio è
      nascondere l'acquisto nell'app Android e gestire l'upgrade solo dal sito
- [ ] Impacchettare la TWA (es. PWABuilder) e passarmi il **fingerprint SHA-256**
      → pubblico io `assetlinks.json`
- [ ] **Screenshot** del telefono (minimo 2 — consigliati: Home, Nuovo preventivo,
      pagina del cliente con Accetta, Lavori, Bilancio)
- [ ] Dirmi se vuoi che prepari io la **feature graphic** 1024×500 (marchio su fondo navy)

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
