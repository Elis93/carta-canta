# DESIGN TOKENS & CRITERI ESTETICI — Carta Canta (mobile)

> Guida estetica compatta: palette, badge, scala tipografica, forme.
>
> ⚠️ **Aggiornata il 6 agosto 2026.** La regola d'oro non è più "riprodurre il mockup al pixel":
> i mockup HTML sono di giugno e l'interfaccia è cambiata molte volte da allora. **La verità è
> il codice** (`app/globals.css` per i token, `StatusBadge.tsx` per le tinte di stato). Questo
> file serve a ritrovare in fretta i valori, non a dettarli: se trovi una differenza, ha ragione
> il codice — e correggi qui.

---

## 0. PRINCIPI DI ELEGANZA (la "filosofia")
1. **Mobile-first**, pulito, arioso. Niente affollamento.
2. **Card bianche con ombra morbida, NIENTE bordi marcati.** Lo sfondo pagina è grigio chiarissimo; il colore si usa solo per stati/avvisi.
3. **Gerarchia chiara con i grigi:** titoli di sezione più scuri, sotto-etichette più chiare (vedi §3).
4. **Coerenza tra pagine:** stessi header, stesse card, stessi campi, stessi bottoni ovunque.
5. **Opzionale è implicito:** solo l'asterisco oro segna l'obbligatorio; NIENTE diciture "facoltativo".
6. **Niente doppioni:** un'azione in un posto solo (le secondarie vanno in "Altre azioni").
7. **Azione primaria = un solo bottone navy pieno** per schermata; le altre sono bianche bordate.
8. Testo mai sotto 11px. Importi sempre formato italiano `€ 1.234,56`.

---

## 1. PALETTE (chiaro)
- **Navy brand** (primario, testo forte, bottoni, nav attiva): `#1a1a2e`
- **Oro brand** (accento "Pro"/bonus, asterischi obbligatori): `#c9a44c` · scuro `#b08d3e`
- **Sfondo pagina** (dietro le card, solo mobile): `#f8f6f1` — grigio caldo, così le card bianche si staccano. È in `AppShell.tsx` sul `<main>`; su desktop resta `bg-background`. Schiarito tre volte fra il 2 e il 3 agosto: `#f0eee8` → `#f3f1ec` → `#f6f4ef` → `#f8f6f1`.
- **Grigio dei testi secondari:** usare **sempre `var(--cc-muted)`**, mai il letterale `#8a887f`. Nella modalità "Testo grande e leggibile" quella variabile si scurisce da sola (a `#55534b`) per alzare il contrasto; scrivendo il valore fisso quel meccanismo salta.
- **Card / superfici bianche:** `#ffffff`
- **Campo "ricerca/seleziona" chiaro** (es. "Cerca cliente"): bg `#f7f7f8`, bordo `0.5px #e6e6e6`
- **Testo:** primario `#161616` · secondario `#55534b` · placeholder/note `#8a887f`
- **Grigio "titoli sezione"** (CLIENTE/VOCI/RIEPILOGO/ALTRE OPZIONI…): `#6f6d64`
- **Grigio "note/frasette di aiuto":** `#767676`
- **Bordi campo:** `#e3e3e6` · bordo chiaro/divisori `#e7e7ea` / `#eeeeee`

## 2. STATI (badge + cronologia) — sfondo pastello / icona-tono scuro
| Stato | bg badge | icona/tono scuro |
|---|---|---|
| Bozza | `#e8e8e8` | `#8a8a8a` |
| Inviato/Inviata | `#d8e8fb` | `#3f6fb0` |
| Visto | `#fbe1ee` | `#c25b91` |
| Accettato/Pagata | `#d4efe2` | `#2f8a63` |
| Rifiutato/Annullata | `#f5dede` | `#b05656` |
| Scaduto/Scaduta | `#f5e9d0` | `#b0863e` |

- Badge: testo `#2b2b2b`, weight 600, pill `border-radius 999`, padding `3px 11px`, font 12px.
- Cronologia: pallino col **bg del badge** + icona dello **stesso tono scuro**; connettore `1.5px #ececef`.

## 3. TIPOGRAFIA (font: **Inter**)
- **Header schermata** ("Nuovo preventivo", "Preventivo 001/2026"): 17px / 600 / `#161616`.
- **Titolo sezione** (CLIENTE, VOCI, RIEPILOGO, ALTRE OPZIONI, SUBTOTALE): 13px / 600 / letter-spacing `.07em` / **UPPERCASE** / `#6f6d64`.
- **Titoletto campo** (Numero preventivo, Email, ecc.): 12px / 600 / letter-spacing `.05em` / **UPPERCASE** / `#8a887f`.
- **"VOCE N":** 12px / 600 / `#8a887f` (più piccolo del titolo "VOCI").
- **Testo dentro i campi** (input/select/textarea): 14px, color `#161616`, placeholder `#8a887f`.
- **Valori riga voce** (pz, q.tà, prezzo, sconto): 13px.
- **Frasette di aiuto / note:** 12px / `#767676` (tutte identiche tra loro).
- **Totale** nel riepilogo: 16px (etichetta 600, importo 700).

## 4. FORME, OMBRE, SPAZI
- **Raggi:** card 14px · campi/dropdown 10px · bottoni 12–13px · pill 999px.
- **Ombra card (unica, morbida):** `0 1px 2px rgba(20,20,40,.04), 0 6px 16px -8px rgba(20,20,40,.13)` — è il token `--cc-shadow` in `globals.css`, da usare tramite la variabile.
- **Ombra bottone navy:** `0 6px 16px -6px rgba(26,26,46,.5)`.
- **Card:** bianche, radius 14, padding `15px 15px`, niente bordi; spazio tra card ~14px.

## 5. COMPONENTI
- **Campo (input/select/textarea):** border `1px #e3e3e6`, radius 10, padding `11px 12px`, font 14, placeholder `#8a887f`. Tutti i campi di una riga alla **stessa altezza** (es. `height:44px; box-sizing:border-box`).
- **Microfono (dettatura):** iconcina ~14px `#8a887f` **DENTRO** il riquadro (a destra), non un bottone separato.
- **Asterischi obbligatori:** oro `#b08d3e`. (Opzionale = nessun asterisco, niente scritta "facoltativo".)
- **Bottone primario:** navy pieno `#1a1a2e`, testo bianco 14/600, radius 12, height ~48–50, ombra navy.
- **Bottone secondario:** bianco, bordo `1px #e7e7ea`, testo `#1a1a2e`, ombra card. **Stessa altezza** del primario.
- **Toggle (interruttore):** acceso = navy; per il **bonus edilizio** acceso = **oro** `#c9a44c`.
- **Icone:** lucide-react; scegliere l'equivalente più simile al mockup (la forma conta, non il nome). Bonus = `BadgePercent` (NON `Tag`).

## 6. HEADER & NAVIGAZIONE
- **Header form** (Nuovo preventivo, Nuova fattura, Nuovo cliente): fascia bianca + bordo `0.5px #eeeeee`; **✕ in cerchietto** `34px` `#f4f4f5` a sinistra; titolo centrato 17/600; spacer a destra.
- **Header dettaglio** (preventivo/fattura/cliente): **← indietro** + titolo + (matita per modificare).
- **Liste** (Preventivi, Fatture, Clienti, Catalogo): **fascia titolo bianca** in alto; ricerca `#f7f7f8`; "Nuovo …" bottone navy a piena larghezza.
- **Bottom nav (solo mobile):** Home · Preventivi · **[ + ]** (FAB navy = Nuovo preventivo) · Fatture · Altro. Attivo = navy.
- **"Altro"** = hub con profilo + gruppo **Strumenti** (Clienti, Catalogo, Template, Scadenze) + **Account** (Impostazioni, Abbonamento, Cestino) + Esci. Clienti/Catalogo NON sono tab fissi: stanno qui.

## 7. LISTE & DETTAGLI
- **Righe lista:** avatar/iniziale o nome + sottotitolo grigio + chevron a destra; divisori `0.5px #eee`.
- **Catalogo:** raggruppato per **categoria** con bande `#ececef` (come la popup "Da catalogo").
- **NON mostrare dati fiscali (P.IVA/CF) nella lista clienti** — solo nella scheda cliente.
- **Dettaglio documento — azioni primarie** dipendono dallo stato; le secondarie (Duplica, Elimina) vanno in **"Altre azioni"** (card a tendina). "Segna accettato/rifiutato" e "Segna pagata" restano **primarie**.

## 8. FREE vs PRO
- Banner Free corto oro ("N/8 preventivi gratuiti · Passa a Pro →") **solo dove serve** (lista preventivi, dettaglio bozza). Pro = nessun banner.
- Template: Free = solo Classico, watermark non rimovibile, personalizzazione bloccata (lucchetti "Pro"). Pro = tutto sbloccato.

---
*In caso di dubbio ha ragione il **codice** (`app/globals.css`, `StatusBadge.tsx`), come dice l'avvertenza in testa; questi token spiegano il "perché" delle scelte. Il vecchio registro `DECISIONI_UI_CONSOLIDATE.md` è in `_archivio-doc/` e non va più consultato.*
