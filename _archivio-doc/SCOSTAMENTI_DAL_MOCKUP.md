# 📐 SCOSTAMENTI DAL MOCKUP — cose chieste da Eli in aggiunta/modifica

> **Cosa contiene:** l'elenco delle cose che **Eli ha chiesto di aggiungere o modificare rispetto ai mockup**
> (`mockup-mobile/Carta_Canta_mockup_app.html` e `Carta_Canta_mockup_pagine2.html`).
> Il mockup resta la specifica al pixel; qui sono segnate **solo le eccezioni volute**, così sono tracciate e non si perdono.
> Ordino per area. Aggiornare a ogni nuova richiesta di Eli che si discosta dal mockup.

---

## Condivisione / Invio
- **Copia link → conferma "Inviato":** nel pop-up Condividi, su una **bozza**, dopo aver copiato il link compare una conferma per segnarla come **Inviato** (assegna il numero progressivo). *Non presente nel mockup.*

## Dettaglio preventivo
- **"Altre azioni" rimossa** (Duplica/Elimina restano solo nel menu ⋮ della lista — opzione B). *Il mockup la mostra ancora.*
- **Cronologia — nodo finale "Scade il {data}"** (solo preventivi). *Aggiunta.*
- **Cronologia con data + ora** (il mockup mostra solo il giorno, es. "20 giu").

## Dettaglio fattura
- **"Altre azioni" rimossa** (come il preventivo). *Il mockup 05 la mostra ancora.*
- **"Annulla fattura"** (bianco, X rossa) affiancato a **"Segna pagata"**, stesso formato delle chip "Segna accettato/rifiutato" del preventivo. *Il mockup 05 ha solo "Segna pagata".*
- **Card "Preventivo collegato" in alto** (etichetta + numero + **Apri** + **Cambia**) al posto del banner "Da preventivo … · Vai →" del mockup 05 e del bottone in basso. Dentro "Cambia" c'è anche **Scollega**.
- **Collegamento preventivo → fattura segna il preventivo come "Accettato":** collegando un preventivo **inviato/visto** a una fattura, questo viene segnato **Accettato** (con avviso nel dialog di collegamento). *Non previsto dal mockup.*
- **Cronologia:** etichette fattura **Creata / Pagata (icona €) / Annullata**.

## Coerenza preventivo ↔ fattura
- **Font/titoli uniformati:** i titoletti di sezione (CLIENTE/RIEPILOGO/CRONOLOGIA) del **preventivo** portati da 11px/#8a887f a **13px/#6f6d64** per pareggiare la fattura/mockup.

## Form (Nuovo preventivo / Nuova fattura)
- **Titolo sezione voci:** "Voci preventivo" / "Voci fattura" invece di solo "Voci".
- **Bonus edilizio:** solo **interruttore on/off + percentuale** (rimosse le opzioni Ecobonus/Sismabonus/Bonus Casa dal form fattura — il tipo bonus non era usato in calcoli/PDF).

## Scheda cliente (Nuovo / Modifica)
- **Campo "Paese" libero:** niente "Italia" precompilato di default.

## Template
- **Nuovo modello a LISTA** (Default + Template personalizzato 1, 2, …) al posto della griglia di preset del mockup (schermate 15/16). Decisioni:
  - **Free = solo "Default"** (Classico + colore + logo). I preset **Bold/Tecnico/Elegante** e i template multipli sono **solo Pro**.
  - Nomi **automatici ma rinominabili** ("Template personalizzato N").
  - La scelta dello **stile base (preset)** e le personalizzazioni si fanno **dentro l'editor** di ciascun template.

## Impostazioni / Pagina pubblica
- **Pagina pubblica cliente — info aggiuntive nella card documento** (oltre il mockup 18, che ha solo voci+totali): "Valido fino al {data}" (preventivo) / "Scadenza pagamento" (fattura), "Termini di pagamento", Note per il cliente, righe Sconto e Marca da bollo nel riepilogo.
- **Campo "Telefono" dell'attività** (Impostazioni → Generale) — non nel mockup. *Richiede migration `workspaces.phone`.*
- **"Chiama l'artigiano" reale** (`tel:`) sulla pagina pubblica **scaduto**, usando il telefono; se assente, fallback `mailto:` "Contatta l'artigiano".
