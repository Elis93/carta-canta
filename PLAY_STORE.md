# 📱 Scheda Google Play — Carta Canta

> Testi pronti da incollare nella Play Console. Rispettano i limiti di caratteri
> di Google e i **claim leciti** (vedi §Regole in fondo). Aggiornare a ogni release.
> *Creato il 9 luglio 2026.*

---

## 1. Nome dell'app (max 30 caratteri)

**Consigliato:** `Carta Canta: preventivi` (23) — aggiunge la keyword principale.

Alternative:
- `Carta Canta` (11) — solo brand, più pulito
- `Carta Canta: preventivi PRO` (27)

---

## 2. Descrizione breve (max 80 caratteri)

**Consigliata:**
`Preventivi e fatture dal telefono. Il cliente firma con un tocco.` (63)

Alternative:
- `Fai il preventivo in cantiere, il cliente firma dal telefono.` (60)
- `L'ufficio in tasca: preventivi, fatture e clienti dal telefono.` (62)

---

## 3. Descrizione completa (max 4000 caratteri)

*(Google indicizza tutta la descrizione: le parole chiave — preventivi, fatture,
artigiani, idraulico, elettricista, imbianchino — sono inserite in modo naturale.)*

```
Il preventivo è fatto prima di risalire sul furgone.

Carta Canta è l'app pensata per gli artigiani italiani: fai preventivi e fatture professionali dal telefono, in cantiere, in 60 secondi. Senza Excel, senza carta, senza tornare in ufficio.

COME FUNZIONA
• Detti le voci col microfono o le prendi dal tuo catalogo: il preventivo è pronto in un minuto.
• Mandi il link al cliente su WhatsApp: lui lo guarda e firma con un tocco, dal suo telefono.
• Trasformi il preventivo accettato in fattura, apri il lavoro e segui il cantiere fino all'incasso.

TUTTO L'UFFICIO, IN TASCA
• Preventivi e fatture professionali, con 4 stili e il tuo logo
• Firma del cliente a distanza, con valore di prova (data, ora)
• Clienti e catalogo sempre con te
• Sopralluoghi con foto e appuntamenti, con navigazione al cantiere
• Lavori: da iniziare, in corso, finito, fatturato — con il margine (preventivato vs speso)
• Rapportino di fine lavoro firmato dal cliente
• Bilancio con entrate, uscite e spese, e foto allo scontrino
• Acconti e pagamenti con IBAN, QR, PayPal o Satispay
• Promemoria e solleciti automatici ai clienti
• Calendario degli appuntamenti e dei lavori

PER CHI È
Idraulici, elettricisti, imbianchini, falegnami, muratori, installatori, manutentori e tutti i piccoli artigiani e le partite IVA che lavorano fuori e non hanno tempo per la burocrazia.

I TUOI DATI AL SICURO
Server in Europa, protezioni attive, esporti tutti i tuoi dati quando vuoi. Il cliente vede solo quello che decidi tu.

QUANTO COSTA
Durante la beta è gratis, senza carta di credito. Chi entra ora avrà condizioni riservate al lancio.

Hai bisogno di aiuto? Scrivici, rispondiamo noi.
```

---

## 4. "Novità di questa versione" (release notes, max 500 caratteri)

Esempio da aggiornare a ogni rilascio:
```
Novità: rapportino di fine lavoro firmato dal cliente, calendario settimanale dei lavori, margine per lavoro nel Bilancio. Più tante piccole migliorie di velocità e stabilità.
```

---

## 5. Elementi grafici da preparare (li fai tu / con NotebookLM o Canva)

- **Icona** 512×512 px (c'è già il logo "firma" navy/oro — riusare quello).
- **Feature graphic** 1024×500 px (banner in cima alla scheda): claim + logo.
- **Screenshot telefono** (min 2, meglio 4-8), in ordine **Valore → Uso → Fiducia**:
  1. Valore: schermata preventivo + frase "Preventivo pronto prima di risalire sul furgone"
  2. Uso: creazione voce col microfono / catalogo
  3. Uso: il cliente che firma dal telefono
  4. Fiducia: Bilancio o lista lavori + "i tuoi dati al sicuro in Europa"
- **Video** (facoltativo, 30-60s): la demo che giri con NotebookLM.

---

## 6. Data Safety / Contenuti dell'app (già pronti nel prodotto)

- **URL cancellazione account:** https://cartacanta.app/cancella-account (già online e pubblica)
- **Privacy policy:** https://cartacanta.app/privacy
- **Nessun tracciamento pubblicitario** attivo (PostHog/Sentry sono spenti finché non metti le chiavi; niente pixel).
- **Account demo per i revisori:** `npm run seed:demo` → `demo@cartacanta.app` / `CartaCanta-Demo-2026` (vedi scripts/README.md).

---

## 7. ⚠️ Regole sui claim (cosa NON scrivere)

- ✅ "Gratis durante la beta" · "condizioni riservate a chi entra ora"
- ❌ "Gratis per sempre"
- ❌ "Fattura elettronica inclusa" / "invio allo SdI" — **finché l'SdI reale non è attivo** (ora nel prodotto è disattivato)
- ❌ "A norma di legge" / "sostituisce il commercialista"
- ❌ Numeri inventati (utenti, recensioni, tempi) — usa solo dati veri
- ❌ Nascondere che è una beta

> Le microimprese sono tutelate come consumatori (AGCM): i claim devono essere veri e non ingannevoli.
