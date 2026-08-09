# TEST DA FARE — checklist operativa per Eli

> Aggiornato: 25 luglio 2026, notte.
> Tutti i test che **devi fare tu** perché richiedono un telefono vero, un
> account vero, la console di un servizio esterno o un occhio umano.
> Quelli che potevo fare io (codice, database, PDF, logica) sono già fatti:
> 297 test automatici + collaudi su Postgres reale + screenshot.
>
> Metti una ✅ accanto a quelli che passi. Se qualcosa non torna, scrivimelo
> con lo screenshot: quasi tutti si sistemano in pochi minuti.

---

## A. APP — collaudo dal telefono (30-40 min)

### A1 · Ciclo di vita della fattura (il più importante)
| # | Cosa fare | Cosa deve succedere |
|---|---|---|
| A1.1 | Crea una fattura da zero **senza scegliere il cliente** e salva | Ti blocca: "Scegli il cliente della fattura prima di salvare" |
| A1.2 | Crea una fattura completa e salvala come bozza | Numero assegnato subito (es. 001/2026), niente errori |
| A1.3 | Salvata la bozza l'app ti riporta alla **lista** (è voluto: il pop-up ti mostra il numero assegnato). **Riapri la bozza** e cerca in fondo "Segna pagata" e "Annulla fattura" | Ci sono entrambi (prima su mobile mancavano) |
| A1.4 | Segna la bozza come **pagata** per errore, poi "Segna come non pagata" | Chiede conferma; torna in **BOZZA** (non in "Inviate"), incasso azzerato |
| A1.5 | Invia la fattura al cliente, poi registra un **acconto** (es. 300 su 1000) | Resta "da incassare"; il Bilancio del mese segna +300 |
| A1.6 | Premi due volte di fila "Segna pagata" con lo stesso acconto | La seconda volta dà errore, **non** registra 600 |
| A1.7 | Con l'acconto attivo, apri **Fatture › da incassare** | "Totale da incassare" mostra il **residuo** (700), non 1000 |
| A1.8 | Annulla la fattura con l'acconto registrato | Chiede conferma citando gli acconti; il Bilancio **torna giù** di 300 |
| A1.9 | Riattiva la fattura annullata | Torna in bozza con lo stesso numero, senza acconto stantio |
| A1.10 | Duplica una fattura ("Usa come modello") | Il numero nuovo segue la serie **fatture** (non quella dei preventivi) |

### A2 · Fattura scaduta (il caso che prima si rompeva)
| # | Cosa fare | Cosa deve succedere |
|---|---|---|
| A2.1 | Prendi una fattura inviata e mettile una scadenza già passata (o aspetta il cron) | Diventa "Scaduta" |
| A2.2 | Apri il **link pubblico** come farebbe il cliente | Vedi la fattura completa + **IBAN e QR di pagamento** (prima sparivano) |
| A2.3 | Dall'app, manda il **sollecito** | Funziona (prima diceva "solo le fatture in attesa possono essere sollecitate") |
| A2.4 | Reinvia la fattura scaduta **via WhatsApp** e ricontrolla lo stato | Torna "Inviata" con nuova scadenza (prima solo via email) |

### A3 · Prove firmate e protezioni
| # | Cosa fare | Cosa deve succedere |
|---|---|---|
| A3.1 | Prova a **cancellare un cliente** che ha un preventivo firmato | Bloccato con spiegazione (prima cancellava nome e indirizzo dalla prova) |
| A3.2 | Elimina un preventivo **firmato** dalla lista | Compare l'avviso ambra "è la tua prova dell'accordo" |
| A3.3 | Vai nel **cestino** e prova "Elimina per sempre" su quello firmato | Avviso anche lì, e l'eliminazione funziona (collaudata sul database) |
| A3.4 | Su un lavoro con **rapportino firmato**: prova a cambiare le ore e le foto | Bloccato con messaggio chiaro in tutti i punti (timer, "correggi totale", foto) |
| A3.5 | Fai firmare un rapportino mentre il **timer è acceso** | Il timer si ferma da solo (prima restava acceso per sempre) |

### A4 · Accesso
| # | Cosa fare | Cosa deve succedere |
|---|---|---|
| A4.1 | Sbaglia la password **3 volte** | Compare la spiegazione + il riquadro di verifica, con sotto "Reimposta la password" |
| A4.2 | Risolvi la verifica e metti la password giusta | Entri; al login successivo la verifica non c'è più |
| A4.3 | Blocco app con impronta: esci e rientra | Chiede impronta (o password); con account Google chiede solo l'impronta |

### A5 · Documenti che vede il cliente
| # | Cosa fare | Cosa deve succedere |
|---|---|---|
| A5.1 | Scarica il PDF di una fattura **forfettaria con bollo** | "Imponibile" = imponibile puro, poi "Marca da bollo 2,00", poi il totale |
| A5.2 | Scarica il PDF di una fattura **annullata** dal link pubblico | Grande scritta diagonale **ANNULLATA** |
| A5.3 | Apri il link pubblico di una fattura con **acconto** | "Acconto già ricevuto" e "Saldo da pagare" coerenti col PDF |
| A5.4 | Esporta le fatture in CSV e aprilo con **Excel** | Accenti giusti, importi come numeri, colonne Cliente (nome+cognome) e Incassato |
| A5.5 | **Scarica l'XML** di una fattura (dal dettaglio fattura, e dall'area commercialista) | Il file si apre; è un XML FatturaPA, non una pagina d'errore |
| A5.6 | **Apri l'XML e leggi il contenuto** (col Blocco note, o su un visualizzatore di fatture elettroniche) | ⚠️ Controlla che **combacino col PDF**: numero e data del documento · P.IVA/CF tuoi e del cliente · **codice destinatario o PEC** · ogni riga con descrizione, quantità e prezzo · **imponibile, aliquota e imposta** nel riepilogo · totale documento. Se una cifra non torna col PDF, **fermati e dimmelo**: è il file che fa fede per l'Agenzia, non il PDF |
| A5.7 | Prova l'XML su una fattura con **sconto** e su una con **due aliquote diverse** | Oggi l'app **rifiuta** di generarlo e lo dice chiaramente (non sono ancora rappresentabili). Se invece lo genera, è un problema: segnalamelo |

---

## B. INFRASTRUTTURA — le tre cose che salvano l'azienda (1 ora)

### B1 · Backup + PROVA DI RIPRISTINO ⚠️ priorità massima
1. Supabase → Settings → **attiva il piano Pro** (il piano free **non ha backup**).
2. Attendi il primo backup automatico (24h).
3. **Prova il ripristino**: crea un progetto Supabase di prova e ripristina lì il backup.
4. Verifica che i dati ci siano (documenti, clienti, workspace).

> Un backup mai testato non è un backup. Questo è il test più importante di tutta la lista.

### B2 · Monitoraggio "sito giù" (10 min)
1. Registrati su **UptimeRobot** (gratis).
2. Monitor HTTP su `https://cartacanta.app` ogni 5 minuti.
3. Avviso via email **e SMS/Telegram** (l'email non arriva se sei tu ad essere giù).
4. Prova: metti un URL sbagliato di proposito e verifica che l'avviso arrivi davvero.

> Sentry ti dice quando il codice va in errore, **non** quando il sito è irraggiungibile.

### B3 · Email che non finiscono in spam (15 min)
1. Vai su **mail-tester.com**, copia l'indirizzo che ti dà.
2. Dall'app, manda un preventivo a quell'indirizzo.
3. Torna sul sito e guarda il punteggio: **deve essere 9/10 o 10/10**.
4. Se è più basso, mandami lo screenshot: quasi sempre è un record DNS (SPF/DKIM/DMARC) da aggiungere.
5. Prova anche a mandarti un preventivo su **Gmail e su Libero/Virgilio** (i più usati dai clienti italiani) e controlla che non finisca in spam.

---

## C. SDI IN SANDBOX — prima del go-live (30 min)

| # | Cosa fare | Cosa deve succedere |
|---|---|---|
| C1 | Crea una fattura per un cliente con **P.IVA sbagliata** (es. 12345678901) e prova a trasmettere | Ti blocca PRIMA di inviare: "La P.IVA non sembra corretta…" (nuovo) |
| C2 | Metti un **codice destinatario di 5 caratteri** e trasmetti | Ti blocca con spiegazione (prima diventava 0000000 in silenzio) |
| C3 | Trasmetti una fattura valida in sandbox | "Inviata allo SDI · In attesa dell'esito" |
| C4 | Dalla console OpenAPI simula **NS (scarto)** | Stato "Scartata" + email + il messaggio ora dice "entro 5 giorni, stesso numero e data" |
| C5 | Correggi il dato e **reinvia** | Riparte pulita, l'XML scaricato è quello nuovo (non quello scartato) |
| C6 | Simula **RC (consegnata)** su un'altra fattura | Stato "Consegnata" |
| C7 | Su una fattura trasmessa prova ad **annullarla** | Bloccata: "serve una nota di credito" |
| C8 | Su una fattura trasmessa prova a **modificarla** | Bloccata |
| C9 | Metti una fattura trasmessa nel **cestino** | Avviso "documento fiscale emesso…"; dopo 15 giorni **non** sparisce da sola (il cron non la tocca più) |

**Come si simula un esito in sandbox** (recuperato dal 23 lug — la Swagger UI della console è bloccata dal CORS, va usato **curl dal PC** col token sandbox):
```
POST https://test.sdi.openapi.it/simulate/customer-notification
body: {"uuid": "<uuid della fattura>", "notification": "RC"}     ← RC = consegnata
                                                    "NS"          ← NS = scartata
```
✅ Il giro **RC → "Consegnata"** è già stato verificato end-to-end il 23 lug (Fatt. 014/2026).
⏳ Resta da provare **NS**: trasmetti una fattura NUOVA (alla trasmissione si agganciano i callback giusti), simula NS, e guarda se lo stato passa a "Scartata" **da solo**, senza premere "Controlla l'esito" — se sì il webhook funziona (conferma nel registro CALLBACKS/Sandbox della console).

---

## C-bis. Due collaudi rimasti indietro da luglio

- [ ] **Collaboratori (piano Team, se lo userai)** — un collaboratore invitato deve poter creare e inviare preventivi e fatture, generare i PDF e collegare i documenti, senza l'errore "Workspace non trovato".
- [ ] **CSP — controllo che non abbia rotto niente.** La Content-Security-Policy attiva è permissiva, quindi non dovrebbe rompere nulla, ma va confermato su cartacanta.app da un browser vero: ① il captcha nella registrazione compare e funziona · ② il login funziona · ③ l'anteprima/stampa PDF di un preventivo si apre · ④ la pagina pubblica `/p/...` si vede bene · ⑤ (facoltativo) apri la Console del browser con F12 e controlla che non ci siano errori rossi che citano "Content Security Policy". Se qualcosa non va, dimmelo: si allarga la CSP per quel servizio.

---

## D. ABBONAMENTI STRIPE — dopo la migration 060 (20 min)

| # | Cosa fare | Cosa deve succedere |
|---|---|---|
| D1 | In Stripe **test mode**, fai un abbonamento Pro completo | Piano Pro attivo in app + email "Piano attivato" |
| D2 | Nella dashboard Stripe → Webhooks → **rinvia lo stesso evento** ("Resend") | **Nessuna seconda email**, nessun cambio di stato (nuovo: idempotenza) |
| D3 | Cancella l'abbonamento, poi rinvia un vecchio evento di aggiornamento | Il piano resta cancellato (prima si riattivava) |
| D4 | Config portale Stripe: attiva "**Customers can switch plans**" (sandbox **e** live) | Serve per il passaggio mensile → annuale |

---

## E. DOMANDE PER I PROFESSIONISTI (da fare prima del go-live SdI)

### Commercialista
1. ⚠️ **Data della fattura**: oggi l'XML usa la data di *creazione* del documento. Se creo una bozza il 20 e trasmetto il 5 del mese dopo, esce con la data vecchia — con il **termine dei 12 giorni** questo può costare 250-2.000 € a fattura. Va usata la data di trasmissione? Serve un avviso in app?
2. **IVA e sconto sul totale**: in regime ordinario l'IVA è calcolata sulle voci *prima* dello sconto globale. È corretto o va cambiato? (Per i forfettari non cambia nulla.)
3. **Ritenuta d'acconto**: la implementiamo o la lasciamo fuori? (Oggi l'interruttore è nascosto perché non era collegato ai calcoli.)
4. **Cancellazione di una fattura trasmessa**: la blocchiamo del tutto o basta l'avviso?
5. **Numerazione**: i buchi lasciati dalle bozze cancellate sono accettabili (risulta di sì, ma confermiamolo).

### Avvocato
Tutto già nel dossier unico. Punti aperti: reminder al cliente in opt-out, conservazione delle prove firmate, recensioni Google.

---

## Riferimenti
- Elenco completo dei rischi e dei punti deboli: **`RISCHI_E_PUNTI_DEBOLI.md`**
- Checklist bloccante pre-lancio: **`PRIMA_DEL_LANCIO.md`**
- Azioni operative: **`COSE_DA_FARE_ELI.md`**
