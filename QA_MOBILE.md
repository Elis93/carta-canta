# QA MOBILE — verifica visiva e funzionale (giugno 2026)

> Verifica fatta a **390px** sul deployment di produzione, **sessione reale (piano Pro)**.
> Fonte di verità visiva: `mockup-mobile/*.html` + `DECISIONI_REDESIGN_MOBILE.md`.
> Mobile-first: correggere il mobile **senza rompere il desktop** (gating `lg:`).
> NB: l'utente è su **piano Pro** → la personalizzazione template sbloccata e il watermark disattivabile sono **corretti** (non toccare).

---

## G-QA1 — GRAVE: layout schiacciato / contenuto mancante

### QA1.1 — Impostazioni: layout desktop su mobile (schiacciato)
Oggi `/impostazioni` su mobile mostra il layout desktop: le tab come **iconcine in colonna a sinistra** e il contenuto **compresso nella metà destra** dello schermo. Vale per tutte le tab (Generale/Fiscale/Notifiche/Piano).
**Atteso (mockup `m_impostazioni.html` / `m_impostazioni_fiscale.html`):** su mobile tab **orizzontali a tutta larghezza** (`cc-tabs`: Generale · Fiscale · Notifiche · Piano, voce attiva sottolineata) e card `cc-card` **full-width**. Desktop invariato.

### QA1.2 — Abbonamento (Pro): pagina quasi vuota
`/abbonamento` su Pro mostra solo una pill "Piano Pro — Attivo" e poi spazio bianco.
**Atteso (mockup `m_abbonamento.html`, variante piano attivo):** card del piano con dettagli (cosa include, intervallo di fatturazione mensile/annuale, eventuale "Passa alla fatturazione annuale" se mensile, gestione abbonamento). Niente più pagina vuota.

---

## G-QA2 — Funzionali / tap

### QA2.1 — Righe lista non interamente tappabili
Nelle liste **Clienti** e **Preventivi** (verificare anche **Fatture**) il tap apre il dettaglio **solo toccando la parte destra / il chevron**; toccando nome/avatar/corpo non succede nulla.
**Atteso:** **tutta la riga/card** è tappabile e apre il dettaglio (un solo `<Link>`/handler che copre l'intera riga). Mantenere il chevron come indicatore.

### QA2.2 — Scheda cliente: form inline invece di card info
`/clienti/[id]` mostra direttamente un **form di modifica inline** ("Modifica dati") invece della **card info in sola lettura** del mockup `m_dett_cliente.html` (mail, telefono, P.IVA, indirizzo con icone) + sezione "Documenti". Le azioni sono "Modifica + Preventivo" invece di **"Chiama + Modifica"**.
**Atteso:** scheda in sola lettura come da mockup; l'editing si apre con "Modifica" (non sempre aperto). Chip azioni "Chiama" + "Modifica".

### QA2.3 — Cestino: spinner
`/cestino` resta in caricamento (spinner) — verificare che si risolva, soprattutto a **cestino vuoto** (mostrare stato vuoto, non spinner infinito).

---

## G-QA3 — Deviazioni dai mockup (estetica/coerenza)

### QA3.1 — Doppie etichette di sezione
Nei form e nei dettagli compaiono **due etichette**: "CLIENTE" + "Cliente", "VOCI" + "VOCI PREVENTIVO/FATTURA". Tenerne **una sola** (la `cc-section-label`), come nei mockup `nuovo_prev.html` / `nuova_fattura.html`.

### QA3.2 — Header creazione non compatto
`/preventivi/nuovo` e `/fatture/nuovo` usano "breadcrumb + titolo grande + sottotitolo". Il mockup vuole un header **compatto**: "✕ · Nuovo preventivo/fattura · Anteprima" (link Anteprima a destra). Allineare al mockup su mobile.

### QA3.3 — Riepilogo con vuoto a sinistra
Nel **Riepilogo** (form e dettaglio) la tabella ha una **colonna sinistra vuota** e spinge tutto a destra. Allineare a **tutta larghezza** (etichetta a sinistra, valore a destra) come mockup.

### QA3.4 — Sconti dentro il Riepilogo
Oggi c'è una card separata "Sconti globali". Nel mockup lo sconto è **dentro il Riepilogo** ("＋ Aggiungi sconto"). Riportare lì.

### QA3.5 — Dettaglio preventivo accettato
Il banner verde è più scarno del mockup: aggiungere la riga **"Accettato e firmato dal cliente"** con nome · data · IP (`m_dett_preventivo.html`). Verificare che **"Crea fattura"** sia ben visibile per gli accettati.

### QA3.6 — Catalogo
Header mostra "7 voci" invece del **⋮**; le righe non mostrano "**IVA xx%**" nel sottotitolo (mockup `m_catalogo.html`: "unità · IVA 22%").

### QA3.7 — Minori (wording/badge)
- "Dal catalogo" → "**Da catalogo**" (mockup).
- Template: bottone "Personalizza" → "**Salva**" (mockup).
- Altro: aggiungere il **badge "2"** su "Scadenze e solleciti" (mockup `m_altro.html`).

---

## Fedeli (NON toccare)
Dashboard (con "+" centrato), liste Preventivi/Fatture (filtri una riga, ordina, pill, doppio bottone su Fatture), Catalogo (righe + chevron), Altro (profilo Pro, Clienti dentro Strumenti), Template **Pro** (sbloccato = corretto), Nuova fattura in stile schede `cc-card-md` con "Totale da pagare".

## Non ancora verificato (da testare a parte)
Pagina pubblica `/p/[token]`, menu ⋮ "Altre azioni" (preventivo/fattura), e i tasti che mutano dati (Salva/Invia/Sollecita/Crea fattura/Segna pagata) — non testati per non creare/inviare dati reali.

---

## Definition of Done
Ogni punto G-QA1→G-QA3 allineato ai mockup su mobile (390px), desktop intatto; `npx tsc --noEmit` + `npm run build` + `npm test -- --run` verdi; check NUL prima di ogni commit; commit + push per gruppo; aggiornare `DECISIONI_REDESIGN_MOBILE.md` con le voci risolte.
