# PROMPT CODE — Data contestuale allo stato (liste preventivi + fatture)

> Incolla in Claude Code. **Leggi prima `CLAUDE.md` e `DECISIONI_E_FEEDBACK.md` (non annullare le voci ✅).** Regole: `npx tsc --noEmit` + `npm run build` verdi prima del commit; risposta nel formato sez. C; push a fine task. Lavora SOLO su `master`, niente worktree.

## Problema
Nelle liste **preventivi** (`app/(app)/preventivi/page.tsx`, ~riga 420) e **fatture** (`app/(app)/fatture/page.tsx`, ~riga 244) la data mostrata sotto ogni documento è sempre `created_at` (data di creazione). È ambigua: non dice nulla di utile rispetto allo stato del documento.

## Obiettivo
La data accanto a ogni documento deve essere **contestuale allo stato**, con una breve etichetta. Questo vale per l'app **desktop attuale** (che è anche ciò che si vede su mobile).

### Logica richiesta — PREVENTIVI
Per ciascun documento, scegli data + etichetta in base allo stato (in quest'ordine):

- **scaduto** (`status === 'expired'` oppure `expires_at` nel passato): `"Scaduto il {expires_at}"`
- **accepted**: `"Accettato il {accepted_at ?? updated_at}"`
- **rejected**: `"Rifiutato il {sent_at ?? updated_at}"`  *(non esiste una colonna `rejected_at`)*
- **sent / viewed**: se c'è `expires_at` → `"Scade {…}"` (vedi formato sotto); altrimenti `"Inviato il {sent_at}"`
- **draft**: `"Modificato il {updated_at}"`

### Logica richiesta — FATTURE (stessi stati, etichette del dominio fattura)
- **scaduto**: `"Scaduta il {expires_at}"`
- **accepted** (= Pagata): `"Pagata il {accepted_at ?? updated_at}"`
- **rejected** (= Annullata): `"Annullata il {updated_at}"`
- **sent / viewed**: se c'è `expires_at` → `"Scade {…}"`; altrimenti `"Inviata il {sent_at}"`
- **draft**: `"Modificato il {updated_at}"`

### Formato "Scade"
- se la scadenza è **futura entro 7 giorni**: `"Scade tra N g"` (oggi = "Scade oggi"; domani = "Scade tra 1 g")
- se **futura oltre 7 giorni**: `"Scade il {data}"`
- se **passata**: ricade già nel caso "scaduto" sopra
- **Opzionale (nice-to-have):** quando è "Scade tra N g" (≤7 g) o "Scade oggi", colora il testo in rosso/ambra per dare urgenza, coerente con i colori già usati nell'app. Se complica, lascialo neutro.

Formato data assoluta: invariato rispetto a oggi → `toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })` (es. "7 lug").

## Implementazione
- Crea **un helper condiviso** (es. `lib/utils/document-date.ts`) tipo:
  `getContextualDate(doc, docType: 'preventivo' | 'fattura'): { text: string; urgent: boolean }`
  che incapsula tutta la logica sopra. Usalo in **entrambe** le liste — niente logica duplicata.
- **Aggiorna le `select` Supabase** per includere i campi che oggi mancano:
  - preventivi: aggiungi `updated_at, accepted_at` (già presenti: `created_at, sent_at, expires_at, updated_after_send_at, status`).
  - fatture: aggiungi `sent_at, expires_at, accepted_at, updated_at` (oggi la select ha solo `created_at, updated_after_send_at`).
- Sostituisci SOLO il testo della data nelle due righe lista (le `new Date(doc.created_at!).toLocaleDateString(...)`). **Non toccare** layout, badge "Modificato", pill di stato, ordinamento, ricerca, troncature nomi.
- Il badge "Modificato" (`updated_after_send_at`) resta **separato e invariato** — è indipendente dalla data contestuale.

## Vincoli
- Nessuna migration (tutti i campi esistono già nello schema `documents`).
- Non cambiare la query di ordinamento né i default di sort.
- `formatDocNumber` e le etichette di stato esistenti restano invariate.

## Accettazione (browser)
Nella lista preventivi e fatture, ogni documento mostra una data coerente col suo stato: un accettato → "Accettato il…", un inviato in scadenza → "Scade tra N g", una bozza → "Modificato il…", un rifiutato → "Rifiutato il…". Nessun documento mostra più genericamente la sola data di creazione.

## Definition of Done
- Helper condiviso creato e usato in entrambe le liste; cause/campi confermati.
- Risposta nel formato sez. C; `tsc` + `build` verdi.
- Aggiorna `DECISIONI_E_FEEDBACK.md` (nuova voce: "Data contestuale liste — mobile+desktop").
- Commit `feat(liste): data contestuale allo stato in preventivi e fatture`; `git push`; conferma con `git log origin/master -1`.
