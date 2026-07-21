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

## Stato della precondizione bloccante (DECISIONE_SDI.md §9)

| Documento | Stato |
|---|---|
| Termini generali v3.2 | ✅ Revisionati 21 lug — ok per sandbox; punti per l'avvocato annotati sopra |
| **DPA** (requisito in console) | ⏳ DA INVIARE da Eli prima di accettarlo (o subito dopo, con copia salvata) |
| Condizioni Early Access / Invoice | ⏳ DA INVIARE da Eli se mostrate all'attivazione |
| Ok finale avvocato sui testi legali | ⏳ Prima delle chiavi di PRODUZIONE |
