# Feedback Eli 22 lug 2026 — TUTTI LAVORATI (deploy in produzione, PR #168)

## ✅ TEST DA FARE SUL TELEFONO (Eli) — chiudi e riapri l'app una volta per prendere la build nuova

- [ ] **App-lock (#1)** — chiudi l'app col blocco a schermo e riaprila: deve richiedere lo sblocco (impronta o password), MAI la Home diretta. Prova anche: sblocca, usa l'app, chiudi, riapri subito → deve entrare senza blocco (entro il timeout scelto).
- [ ] **"Vicino a me" (#2)** — col permesso posizione NEGATO dal sistema: tocca il bottone → deve comparire l'hint che spiega di sbloccarlo dalle impostazioni del telefono.
- [ ] **Tendine ora (#7)** — Sopralluogo/Lavoro → appuntamento: scegli giorno e poi ora/minuti dalle due tendine (niente più orologio coi bottoni tagliati). Scelta l'ora, i minuti partono da :00.
- [ ] **Foto scontrino (#10)** — scatta uno scontrino con IVA esposta: deve prendere il TOTALE (non l'IVA); se qualcosa va storto, il messaggio deve dire il motivo vero (non "errore di rete").
- [ ] **Indirizzi cliente (#14)** — apri un cliente completo, cambia SOLO il CAP e salva: città e provincia salvate NON devono cambiare da sole. Poi su un cliente NUOVO: scrivi una città, poi correggila → CAP e provincia si ri-allineano alla città nuova.
- [ ] **Notifiche (#16)** — tocca una notifica della campanella: deve diventare "letta" subito.
- [ ] **Documenti chiusi (#18)** — apri una fattura pagata o annullata (o un preventivo accettato): campi GRIGI e non toccabili, avviso ben leggibile in cima.
- [ ] **Tastiera (#21)** — tocca un campo di testo: la barra in basso (Home/Preventivi/…) NON deve salire sopra la tastiera; chiusa la tastiera ricompare. Prova anche: apri un popup con un campo, chiudilo col campo attivo → la barra deve ricomparire.
- [ ] **Riporta in bozza (NUOVO)** — su un preventivo accettato con "Segna accettato": bottone "Riporta in bozza" → torna bozza con lo stesso numero. Su uno accettato DAL CLIENTE (firmato): il bottone NON c'è.
- [ ] **Scarica XML (#20)** — su una fattura inviata senza sconti: scarica l'XML dalla card SdI; poi prova da /studio (commercialista). Su una fattura CON sconti: messaggio chiaro che spiega perché non ancora.
- [ ] **Trasmissione SdI (pre-check NUOVO)** — prova a trasmettere una fattura a un cliente SENZA indirizzo in rubrica: deve dirti subito "manca indirizzo/CAP/città", non l'errore tecnico del provider.
- [x] **Esito SdI della Fatt. 014/2026** — ✅ FATTO 23 lug sera: simulazione RC via `POST /simulate/customer-notification` (curl dal PC di Eli, la Swagger UI è bloccata dal CORS) → "Controlla l'esito ora" → **"Consegnata"**. Ciclo completo verificato end-to-end in sandbox.
- [ ] **Scarto SdI (NS) + webhook (prossimo giro)** — su una NUOVA fattura di prova: trasmetti (alla trasmissione si agganciano i callback giusti), simula **NS** con lo stesso curl (cambiando uuid e `"notification":"NS"`) → atteso: stato "Scartata" + email di avviso; controlla anche se stavolta si aggiorna DA SOLO senza premere il bottone (= webhook funzionante; verifica nel registro CALLBACKS/Sandbox della console).

---

## Lista feedback originale (tutti lavorati — dettagli in CLAUDE.md)
1. Avvio: 3 schermate in sequenza (spinner → flash login → lock impronta); e se salto lo sblocco, chiudo e riapro → Home SENZA login (bug sicurezza app-lock, da investigare)
2. "Vicino a me" dal telefono: al tocco non succede NULLA (nemmeno il prompt permessi; desiderata: portare alle impostazioni se bloccata)
3. /professionisti: manca tasto "torna indietro"
4. (commercialista: risposta ricevuta — email di follow-up preparata in chat)
5. Profilo pubblico "Mestieri e servizi": suggerire mestieri comuni (imbianchino, elettricista…)
6. BUG: salva bozza/pubblica profilo → "migration 023 potrebbe non essere applicata"
7. Orologio appuntamento sopralluogo: bottoni cancella/annulla/imposta troppo larghi su mobile ("Impo")
8. /sopralluoghi: click su PROSSIMI APPUNTAMENTI → aprire l'Agenda
9. Nuova Spesa: togliere "Assicurazione" dai suggerimenti (spesa annuale, non di lavoro) → sostituire
10. BUG foto scontrino: prende l'IVA invece del totale; data male (8→6); poi "errore di rete" PERSISTENTE anche dopo reload
11. Lavoro "Fatturato": valutare senso (decisione: lasciarlo come feature in più)
12. Lavoro finito → rapportino in ALTO nella pagina, non in basso
13. Impostazioni: spaziatura uniforme tra le tab (Pagamenti/Notifiche/Piano)
14. BUG: a volte non salva indirizzi/info clienti inserite e salvate
15. PC: manca ordinamento fatture (c'è solo su mobile)
16. Notifica campanella cliccata deve diventare "letta" subito
17. Lavoro finito → sotto il preventivo in alto: "clicca sul preventivo per aprirlo e trasformarlo in fattura"
18. Sezioni non modificabili nelle fasi avanzate → mostrarle DISATTIVATE (grigie, non cliccabili)
19. Card "Blocca l'app" in fondo a Impostazioni›Generale: trovare posizione più consona o integrarla meglio
20. "Scarica XML" fattura: anche nell'area commercialista (/studio)
21. Mobile: aprendo la tastiera per compilare un campo, la BottomNav (Home/Preventivi/Fatture/Altro) sale sopra la tastiera → deve restare giù (nascosta sotto la tastiera), non seguire il viewport
