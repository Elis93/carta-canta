# Revisione contratto OpenAPI — esito (21 luglio 2026)

> Revisione svolta da Claude su richiesta di Eli, sul PDF **"API Contract Terms and
> Conditions" v.3.2 del 16/01/2026** (Termini GENERALI, 19 pagine, inviato da Eli in
> chat il 21 lug). Registrata qui perché le sessioni future la ritrovino e non
> richiedano di nuovo il documento.

## Esito in breve

**✅ OK ad accettare per la SANDBOX e procedere.** Nessuna clausola anomala per un
fornitore API: condizioni standard di mercato. **⚠️ La revisione NON è completa ai
fini della PRODUZIONE**: questo documento è il contratto GENERALE e **non contiene
le condizioni specifiche della fatturazione elettronica** (conservazione a norma
10 anni, designazione del conservatore, dettagli sub-responsabile). Quelle stanno
in DUE documenti separati che compaiono come requisiti nella console alla scheda
STATE dell'API Invoice:

1. **"Data processor agreement" (DPA)** ← il documento chiave per il GDPR
2. **"Early Access Program"** (eventuali condizioni specifiche dell'API Invoice)

→ **Eli li scarica/screenshotta PRIMA di accettarli** e li manda in chat per la
revisione. Solo dopo quella revisione si passa alle chiavi di PRODUZIONE
(la precondizione bloccante di DECISIONE_SDI.md §9 resta APERTA fino ad allora;
per la sandbox si può procedere).

## Punti rilevanti del contratto generale (per l'avvocato, non bloccanti)

- **Art. 5.4-5.5 (Plafond/credito prepagato):** il credito non usato alla scadenza
  del contratto è **perso** (nessun rimborso). Il contratto dura **12 mesi** e ogni
  ricarica fa ripartire i 12 mesi (art. 6.1). → Operativo: **caricare importi
  piccoli**, ricaricare quando serve; mai lasciare credito grosso fermo.
- **Art. 6.2:** account disattivato se nessuna ricarica per ulteriori 90 giorni
  dopo la scadenza.
- **Art. 6.3-6.4 (fine rapporto):** entro **3 mesi** dalla cessazione si possono
  recuperare i propri dati gratis; poi Openapi cancella ciò che non è tenuta a
  conservare per legge. → Per le fatture in **conservazione a norma** vale
  l'obbligo legale di 10 anni: confermare nel DPA/condizioni Invoice cosa succede
  alla conservazione se si cessa il rapporto (domanda già nel dossier avvocato).
- **Art. 7.3 (dati dei NOSTRI clienti):** per usare i servizi con dati dei clienti
  dobbiamo (i) informarli che i dati passano a terzi per il servizio, (ii) avere
  privacy policy adeguata, (iii) standard di sicurezza non inferiori a quelli di
  Openapi. → Già previsto nel nostro piano (privacy policy con OpenAPI
  sub-responsabile, registro trattamenti).
- **Art. 8.8 (responsabilità):** risarcimento **limitato al prezzo pagato** per il
  servizio (centesimi a fattura), esclusi lucro cessante/danni indiretti. Standard
  per API provider, ma da far pesare all'avvocato.
- **Art. 4.7 / 8.3:** Openapi può modificare o dismettere i servizi in qualunque
  momento. → Mitigato dal nostro layer di astrazione `lib/sdi/` (anti lock-in).
- **Art. 5.1:** prezzi modificabili in qualunque momento (salvo garanzie espresse).
- **Art. 3.1-3.2:** modifiche unilaterali dei termini, accettate proseguendo l'uso
  dopo 15 giorni dalla comunicazione.
- **Art. 17.8:** Openapi può cedere il contratto a terzi.
- **Art. 18:** legge italiana, **foro esclusivo di Roma**.
- Art. 12 (Digital Trust): copre firma elettronica/FEA/TSP eIDAS — non cita
  espressamente la conservazione delle e-fatture (→ vedi DPA/condizioni Invoice).

## ✅ DPA revisionato (21 lug, 4 pagine "Agreement for the appointment of the Data Processor", datato Roma 21/07/2026)

**Esito: MOLTO BUONO, sopra lo standard di mercato. OK ad accettare.** Punti verificati:

- **Dati SOLO in UE (3.8.1):** divieto espresso di trasferire fuori dagli Stati UE
  senza adeguatezza/garanzie GDPR (SCC, BCR…). Coerente con la nostra impostazione
  (Supabase Francoforte, Vercel fra1). ✔ condizione chiave soddisfatta.
- **Data breach entro 24 ORE (3.4.1):** notifica al cliente entro 24h dal sospetto,
  con documentazione — meglio del generico "senza ingiustificato ritardo"; ci
  permette di rispettare le 72h verso il Garante.
- **Sub-responsabili (3.2):** solo con autorizzazione specifica preventiva del
  cliente, con obbligo di contratti equivalenti; se il sub-responsabile sbaglia,
  **Openapi ne risponde interamente** (3.2.3).
- **Responsabilità (6.1):** Openapi **manleva integralmente** il cliente ("with all
  exceptions waived") per danni e sanzioni del Garante attribuibili a Openapi.
  Clausola fortemente favorevole al cliente — NB: più protettiva del cap generale
  dell'art. 8.8 dei Termini (per i danni privacy prevale questa, lex specialis).
- **Audit/ispezioni (3.1.1.11-12)**, assistenza DPIA (3.5), registro trattamenti
  (3.6), misure di sicurezza art. 32 con obbligo di aggiornamento (3.7), diritti
  degli interessati inoltrati subito (3.3), riservatezza senza limiti di tempo (3.9).
- **Fine rapporto (2.2):** restituzione o distruzione a scelta del cliente, SALVO
  ritenzione richiesta per legge ("accounting, tax, etc.") → compatibile con la
  conservazione fiscale decennale.
- Foro di Roma, legge italiana; modifiche solo per iscritto (8.1).

**Note per l'avvocato (non bloccanti):**
1. Il DPA chiama il cliente "Controller": nella nostra catena reale l'artigiano è
   titolare, Carta Canta responsabile e Openapi **sub-responsabile** (art. 28(4)).
   Prassi comune nei DPA standard; da far confermare che la catena regga così.
2. Il DPA NON parla della **designazione del conservatore** (conservazione a norma):
   resta la domanda aperta del punto 7 di DECISIONE_SDI.md §8 — gestirla
   nell'onboarding (accettazione click-through) e farla validare all'avvocato
   prima del go-live.

## Stato della precondizione bloccante (DECISIONE_SDI.md §9)

| Documento | Stato |
|---|---|
| Termini generali v3.2 | ✅ Revisionati 21 lug — ok per sandbox; punti per l'avvocato annotati sopra |
| **DPA** (4 pagine, art. 28 GDPR) | ✅ Revisionato 21 lug — esito MOLTO BUONO, ok ad accettare (2 note per l'avvocato sopra) |
| Condizioni Early Access Program | ✅ Revisionate 21 lug — innocue (feedback, no condivisione API con terzi, API in preview soggetta a modifiche) |
| Ok finale avvocato sui testi legali | ⏳ Prima delle chiavi di PRODUZIONE (le note sopra vanno nel dossier unico avvocato) |
