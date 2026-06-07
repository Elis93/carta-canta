# PROMPT CODE — FIX 04: email e pagina pubblica del cliente

> Incolla in Claude Code. Autocontenuto. **Leggi prima `CLAUDE.md` (sez. B.6 email, B.8 PDF/link) e `MAPPA_APP.md`.** Rispetta le regole CLAUDE.md.
> Tema: ciò che vede il CLIENTE (email + pagina pubblica) ha incoerenze che danneggiano l'immagine e la conversione.

## Problemi da risolvere

### FIX-11 — L'email dice "PDF allegato" ma si invia solo il link
**Sintomo:** il corpo email recita *"La fattura/Il preventivo in formato PDF è allegato a questa email. … tramite il link qui sotto"*. Ma l'architettura (CLAUDE.md B.8) invia **solo il link pubblico**, niente allegato PDF.
**CONFERMATO dall'utente:** l'allegato PDF è stato **rimosso di proposito** (il template dell'allegato non corrispondeva a quello scelto dall'utente). Quindi **non c'è alcun allegato** e il testo "PDF allegato" è semplicemente rimasto lì ed è **errato**.
**Fix atteso:** rimuovere ogni riferimento a "PDF allegato"/"in formato PDF è allegato" dal template email (preventivo e fattura), lasciando solo l'invito a usare il link ("Visualizza preventivo/fattura online"). Testo coerente, parametrizzato preventivo/fattura.
**File:** `components/email/PreventivoEmail.tsx`, eventuali template in `lib/email/`, default message in `send-email/route.ts` e nei dialog (`SendEmailDialog.tsx`).

### FIX-12 — Email personale dell'artigiano esposta al cliente
**Sintomo:** sulla pagina pubblica compare *"Contatta Eli Impianti: elly.4ee@gmail.com"* — è l'**email personale dell'account** (login), non un contatto business.
**Fix atteso:** mostrare al cliente un'email di contatto appropriata: preferire l'email business del workspace / il `reply_to` impostato; se non disponibile, valutare di non esporre l'indirizzo personale in chiaro (es. bottone "Contatta" che apre il client mail senza stampare l'indirizzo). Allinea al `reply_to` già usato nelle email (CLAUDE.md B.6).
**File:** `app/p/[token]/page.tsx`, `app/p/[token]/_components/ActionBar.tsx`.

### FIX-13 — Il documento pubblico richiede scroll orizzontale e taglia il contenuto
**Sintomo:** nella pagina pubblica (e nell'anteprima in-app) il foglio A4 è più largo del contenitore su viewport stretti: il cliente vede "PREVENTIVO"→"PREV", il totale tagliato, e deve scrollare in orizzontale. È la **pagina di conversione**: deve essere impeccabile su mobile.
**Causa da confermare:** `components/public/DocumentFrame.tsx` dovrebbe scalare il documento alla larghezza del contenitore (CLAUDE.md menziona `scale = containerWidth / 794`). Verifica perché lo scaling non si applica/è insufficiente in questi casi (es. preview con `?preview=1`).
**Fix atteso:** su mobile/contenitori stretti il documento **scala per intero** senza scroll orizzontale e senza tagliare intestazione/totale. Verifica su 360px.
**File:** `components/public/DocumentFrame.tsx`, `app/p/[token]/page.tsx`.

### FIX-14 (estetico correlato) — Footer/diciture documento coerenti
Assicurati che, una volta sistemato FIX-5 del prompt 02, la pagina pubblica non mostri "Preventivo generato con Carta Canta" su una fattura e non mostri "Valido fino al" sulle fatture (qui è il lato cliente: massima cura).

## Criteri di accettazione
1. Email ricevuta (preventivo e fattura) coerente col comportamento reale: nessuna menzione di "PDF allegato" se non c'è allegato. Testo professionale, link funzionante.
2. La pagina pubblica non espone l'email personale dell'account.
3. Su 360px la pagina pubblica mostra il documento **intero, scalato, senza scroll orizzontale**; intestazione e totale interamente visibili.
4. Lato cliente, diciture coerenti col tipo documento.
5. `tsc` + `build` verdi.

## Definition of Done
- Causa confermata (in particolare: c'è o no l'allegato PDF? dichiaralo). Test sez. C con screenshot mobile della pagina pubblica. CLAUDE.md aggiornato.
- Commit `fix(cliente): email testo link-only + no email personale + documento pubblico responsive`.
