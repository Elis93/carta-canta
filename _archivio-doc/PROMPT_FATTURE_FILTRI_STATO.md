# PROMPT CODE — Filtri di stato (tab) sulla lista Fatture

> Incolla in Claude Code. **Leggi prima `CLAUDE.md` e `DECISIONI_E_FEEDBACK.md` (non annullare le voci ✅).** Regole: `npx tsc --noEmit` + `npm run build` verdi prima del commit; risposta nel formato sez. C; push a fine task. Lavora SOLO su `master`, niente worktree.

## Problema
La lista **Preventivi** (`app/(app)/preventivi/page.tsx`) ha i tab di stato (Tutti / Bozze / In attesa / Accettati / Rifiutati). La lista **Fatture** (`app/(app)/fatture/page.tsx`) NO: ha solo la ricerca testuale e i filtri data/importo. Vogliamo gli stessi tab anche sulle fatture.

## Obiettivo
Aggiungere alla pagina Fatture la **stessa identica barra di tab di stato** di Preventivi (stesso markup/stile/componente — replica `STATUS_TABS.map(...)` di `preventivi/page.tsx`, righe ~318-328), con le etichette del dominio fattura:

| Etichetta | value (querystring) | filtro `status` |
|---|---|---|
| Tutte | (vuoto) | nessun filtro |
| Bozze | `draft` | `status = 'draft'` |
| Inviate | `inviate` | `status in ('sent','viewed')` |
| Pagate | `accepted` | `status = 'accepted'` |
| Annullate | `rejected` | `status = 'rejected'` |

(Non aggiungere "Scadute" per ora — coerente col mockup approvato.)

## Implementazione
- Aggiungi `status?: string` ai `searchParams` della pagina Fatture (oggi: `q, date_from, date_to, amount_min, amount_max`).
- Definisci un array `STATUS_TABS` analogo a quello di preventivi, con le etichette qui sopra; i link puntano a `/fatture?status=<value>` (e `/fatture` per "Tutte"). Mantieni l'evidenziazione del tab attivo con la stessa classe/stile di preventivi.
- Applica il filtro alla query Supabase: `inviate` → `.in('status', ['sent','viewed'])`; gli altri → `.eq('status', <value>)`; "Tutte" → nessun filtro. Riusa lo stesso branching già presente in preventivi.
- **Coesistenza con la ricerca**: la ricerca testuale `q` (con keyword→stato già presente) e i filtri avanzati data/importo devono continuare a funzionare insieme al nuovo filtro `status`. Se un tab di stato è attivo, applicalo in AND con `q`/filtri.
- **Empty state**: se il tab attivo non ha risultati, mostra un messaggio coerente con quello già usato in preventivi per i filtri di stato (es. "Nessuna fattura in questo stato"), senza CTA fuorviante.
- **Conteggio intestazione**: se la pagina mostra "N fatture/risultati", deve riflettere il filtro attivo (come già fa con `q`).

## Vincoli
- Nessuna migration. Nessun cambio al layout delle righe lista, ai badge, alle date contestuali, all'ordinamento.
- Stesso componente/stile dei tab di preventivi — coerenza visiva totale tra le due pagine.

## Accettazione (browser)
Sulla pagina Fatture compaiono i tab Tutte / Bozze / Inviate / Pagate / Annullate; cliccandone uno la lista si filtra di conseguenza; ricerca e filtri data/importo continuano a funzionare in combinazione.

## Definition of Done
- Tab di stato su Fatture identici a quelli di Preventivi; filtro applicato alla query.
- Risposta nel formato sez. C; `tsc` + `build` verdi.
- Aggiorna `DECISIONI_E_FEEDBACK.md` (nuova voce: "Filtri di stato anche su Fatture (desktop)").
- Commit `feat(fatture): tab di stato (Tutte/Bozze/Inviate/Pagate/Annullate) come in preventivi`; `git push`; conferma con `git log origin/master -1`.
