# Scheda Play Store — testi pronti da incollare

> Preparata il 15 lug 2026. Tutto il testo rispetta i limiti della Play Console e
> i claim leciti del progetto (beta gratuita, MAI "gratis per sempre" — regola AGCM).
> Le parti segnate ⚠️ richiedono una decisione o un'azione di Eli prima dell'invio.

---

## 1. Testi della scheda

**Titolo** (max 30 caratteri — usati: 24)

```
Carta Canta – Preventivi
```

**Descrizione breve** (max 80 caratteri — usati: 76)

```
Preventivi e fatture in 60 secondi, dal telefono. Pensata per gli artigiani.
```

**Descrizione completa** (max 4000 caratteri — usati: ~1.700)

```
Il preventivo è fatto prima di risalire sul furgone.

Carta Canta è l'ufficio in tasca degli artigiani italiani: idraulici,
elettricisti, imbianchini, falegnami, installatori. Crei preventivi
professionali dal telefono in 60 secondi, li invii su WhatsApp o email,
e sai subito quando il cliente li apre e li accetta.

PREVENTIVI IN 60 SECONDI
• Scegli il cliente, aggiungi le voci dal tuo catalogo o dettale col microfono
• Invia con WhatsApp, email o link: il cliente accetta e firma dal telefono
• Badge di stato e cronologia: vedi quando il cliente ha ricevuto, visto, accettato

DAL PREVENTIVO ALL'INCASSO
• Converti il preventivo accettato in fattura con un tocco
• Acconti, pagamenti con IBAN e QR code, PayPal o Satispay
• Scadenze e solleciti: nessun preventivo dimenticato

IL CANTIERE SOTTO CONTROLLO
• Sopralluoghi con foto e appunti, trasformabili in preventivo
• Lavori per stato: da fare, in corso, finito, fatturato
• Ore di lavoro col timer e margine reale (preventivato vs speso)
• Rapportino di fine lavoro firmato dal cliente
• Promemoria di richiamo a 3, 6 o 12 mesi (es. manutenzione caldaia)

LA CONTABILITÀ SENZA PENSIERI
• Bilancio entrate/uscite mese per mese, foto allo scontrino per le spese
• Registro fatture pronto per il commercialista, o invitalo in sola lettura
• Regime forfettario e ordinario, marca da bollo e ritenuta calcolate da sole

FATTA PER CHI LAVORA COL TELEFONO
• Tutto pensato per l'uso in cantiere, anche con i guanti
• I tuoi dati restano tuoi: server in Europa, esporti tutto quando vuoi

Durante la beta l'app è gratuita. Il piano gratuito include 8 preventivi
inviati; con Pro diventano illimitati.

Assistenza: supporto@cartacanta.app
```

**Categoria:** Business (in alternativa: Produttività)

**Email di contatto:** supporto@cartacanta.app

**Sito web:** https://cartacanta.app

**URL informativa privacy:** https://cartacanta.app/privacy

---

## 2. Data Safety (questionario "Sicurezza dei dati")

⚠️ Risposte preparate in buona fede dalla ricognizione tecnica: prima dell'invio
vale la pena farle confermare all'avvocato (sono dichiarazioni pubbliche).

| Domanda | Risposta |
|---|---|
| L'app raccoglie o condivide dati utente? | **Sì, raccoglie** |
| Dati raccolti — Informazioni personali | Nome, indirizzo email, numero di telefono (facoltativo), indirizzo (facoltativo), P.IVA |
| Dati raccolti — Contenuti utente | Documenti (preventivi/fatture), foto caricate dall'utente, registrazioni audio (solo se usa la dettatura, elaborate e non conservate) |
| Dati raccolti — Informazioni finanziarie | No (i pagamenti dell'abbonamento avvengono su Stripe, fuori dall'app; gli importi dei documenti sono contenuti utente) |
| I dati sono condivisi con terze parti? | No ai fini di Google (i fornitori — hosting, email, AI — agiscono come responsabili del trattamento per conto nostro) |
| Crittografia in transito | Sì (HTTPS ovunque) |
| L'utente può chiederne la cancellazione | Sì — URL: https://cartacanta.app/cancella-account |
| I dati sono obbligatori o facoltativi | Email e nome obbligatori per l'account; il resto facoltativo |
| Finalità | Funzionalità dell'app, gestione account. Analytics solo previo consenso (banner cookie) |

---

## 3. Note per la revisione (campo "App access")

I revisori devono poter entrare. Account demo: email `demo@cartacanta.app`,
password = quella che imposti in `DEMO_PASSWORD` nel tuo `.env.local` quando
lanci `npm run seed:demo`. ⚠️ La password NON va mai scritta in questo file
né altrove nel repository (è pubblico — segnalazione GitGuardian 15 lug 2026):
si incolla SOLO nel campo riservato "App access" della Play Console.

Nota da scrivere ai revisori (in inglese):
```
Demo account above gives full access. The app is a business tool for Italian
tradespeople (quotes & invoices). All content is in Italian by design.
```

---

## 4. Grafiche richieste (checklist)

| Asset | Requisito | Stato |
|---|---|---|
| Icona app | 512×512 PNG | ✅ c'è (icona PWA hi-res dal marchio nuovo) |
| Feature graphic | 1024×500 PNG | ✅ pronta (inviata in chat il 15 lug: marchio su crema + riga oro) |
| Screenshot telefono | min 2, max 8 (min 320px, max 3840px) | ⚠️ da fare — consigliati: Home, Nuovo preventivo, pagina pubblica col bottone Accetta, Lavori, Bilancio |
| Screenshot tablet 7"/10" | facoltativi | — |

---

## 5. ⚠️ PRIMA DELL'INVIO — due nodi da sciogliere

1. **Account sviluppatore**: Personale (verifica con 12 tester per 14 giorni prima
   della pubblicazione) vs **Organizzazione** (serve numero D-U-N-S, nessun requisito
   tester). Decisione già in sospeso — dipende dalla questione P.IVA/forma giuridica.

2. **Policy pagamenti di Google**: l'abbonamento Pro oggi si acquista dentro l'app
   (via Stripe). La policy Play impone il **Google Play Billing** per gli abbonamenti
   digitali venduti *dentro* un'app Android — vale anche per le app TWA come la nostra.
   Opzioni: (a) nella versione Android nascondere l'acquisto e gestire l'upgrade solo
   dal sito (pattern usato da molte app, es. "gestisci il piano dal nostro sito");
   (b) integrare Play Billing (lavoro significativo, commissione 15%).
   **Da decidere prima della submission** — consiglio la (a) per il lancio.

3. **assetlinks.json**: ✅ GIÀ PRONTO nel codice. Quando hai il fingerprint
   SHA-256 (dalla Play Console → App integrity, o da PWABuilder) basta
   impostare su Vercel la variabile `TWA_SHA256_FINGERPRINT` (più fingerprint
   separati da virgola) + Redeploy: il file compare da solo su
   cartacanta.app/.well-known/assetlinks.json. Se cambi il package name della
   TWA rispetto a `app.cartacanta.twa`, imposta anche `TWA_PACKAGE_NAME`.
