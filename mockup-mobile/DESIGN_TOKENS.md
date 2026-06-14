# DESIGN TOKENS — Redesign mobile Carta Canta

Specifica estratta dai mockup in questa cartella. **Fonte di verità visiva = i file `*.html` qui dentro** (layout, spaziature, copy, colori, ombre). Riprodurli fedelmente in React/Tailwind, mobile-first, **senza deviazioni**.

> NB: i mockup sono HTML statici. NON copiarli verbatim: vanno tradotti nei componenti React/Tailwind esistenti, ottenendo lo **stesso risultato visivo**. Le icone nei mockup sono Tabler (`ti ti-…`): nell'app si usa **lucide-react** → usare l'icona lucide equivalente (il nome esatto non conta, conta la forma/significato).

## Palette (light)
- Navy brand (primario / testo forte / pulsanti): `#1a1a2e`
- Oro brand (accento, es. corona "Pro", "Canta" nel logo): `#c9a44c` (variante scura `#b08d3e`)
- Crema brand (dettagli logo): `#f3ede0`
- Sfondo pagina (dietro le schede): `#eceae4`
- Superficie "secondaria" (wrapper schermata, search, chip, fondo neutro caldo): `#f0efe9` / `#f4f3ef`
- Card bianche: `#ffffff`
- Testo: primario `#1d1c19` · secondario `#55534b` · terziario `#827f74`
- Bordi: terziario `#e8e6df` · secondario (input/bottoni) `#d7d4cb`
- Stati (testo / sfondo pill):
  - info (Inviata): `#185fa5` / `#e6f1fb`
  - success (Accettato/Pagata): `#0f6e56` / `#e1f5ee`
  - warning (In attesa/avvisi): `#8a5208` / `#faeeda`
  - danger (Rifiutato/Annullata/scadenza): `#a32d2d` / `#fceaea`
  - bozza/neutro: testo `#55534b` su `#f0efe9`

> Questi valori sono i token mobile. Allinearli al sistema di temi dell'app (CSS variables / Tailwind theme). Possono valere anche desktop (palette coerente). NON rompere il desktop: usare classi responsive (base = mobile, `sm:`/`lg:` = comportamento desktop attuale dove diverge).

## Tipografia
- Font: **Inter** (400/500/600). Titoli schermata 17–20px/600; etichette di sezione 12px MAIUSCOLETTO `letter-spacing .08em` colore terziario; testo 13–14px; importi/totali 15–18px/600.
- Niente font sotto 12px.

## Forme e profondità
- Raggi: card interne `13px`, card-schermata esterna `16px`, input/bottoni `9px` (md), pill `999px`.
- Ombre (CSS esatti):
  - Scheda standard: `0 1px 2px rgba(20,20,40,.04), 0 6px 16px -8px rgba(20,20,40,.13)`
  - Scheda **marcata** (solo Nuovo preventivo / Nuova fattura, tante schede): `0 1px 3px rgba(20,20,40,.06), 0 10px 26px -10px rgba(20,20,40,.22)`
  - "+" flottante/azione: `0 6px 16px -6px rgba(26,26,46,.5)`
- Le schede sono **bianche con ombra**, niente bordi marcati; niente fondi azzurro/grigio decorativi; colore solo per stati/avvisi.

## Navigazione (mobile)
- Barra in basso, 5 slot: **Home · Preventivi · [ + ] · Fatture · Altro**.
- Il **"+" è centrale** (FAB navy) = "Nuovo preventivo", su ogni pagina.
- Voce attiva: navy `#1a1a2e` + label 500; inattive: terziario.
- **"Altro"** = pagina menu (mockup `m_altro.html`): profilo/piano in alto, gruppo **Strumenti** (Clienti, Catalogo, Template, Scadenze) e **Account** (Impostazioni, Abbonamento, Cestino) + Esci. Clienti su mobile sta QUI (non è un tab fisso).
- La barra in basso è SOLO mobile: su desktop resta la navigazione attuale (sidebar/header). Usare un breakpoint (es. `lg:hidden` per la tab bar mobile, `hidden lg:flex` per la nav desktop).

## Filtri di stato nelle liste (Preventivi/Fatture)
- Una sola riga, testo distribuito con **spazi uguali** (`justify-content: space-between`), voce **attiva = navy + sottolineatura 2px** (no pill piena). Tutte visibili, niente scroll.

## Date contestuali nelle liste
Già implementato lato dati (`lib/utils/document-date.ts`): usare quello. Colore rosso per "Scade tra N g".

## Mappa mockup → route app
| Mockup | Route / componente app |
|---|---|
| `home_browser.html` | `app/(app)/dashboard/page.tsx` |
| `preventivi.html` | `app/(app)/preventivi/page.tsx` |
| `fatture.html` | `app/(app)/fatture/page.tsx` |
| `clienti.html` | `app/(app)/clienti/page.tsx` (+ bottone "Nuovo cliente") |
| `nuovo_prev.html` | `PreventivoForm.tsx` (create) |
| `nuova_fattura.html` | `FatturaForm.tsx` (create) |
| `m_dett_preventivo.html` | `app/(app)/preventivi/[id]/page.tsx` |
| `m_dett_fattura.html` | `app/(app)/fatture/[id]/page.tsx` |
| `m_dett_cliente.html` | `app/(app)/clienti/[id]/page.tsx` |
| `m_form_cliente.html` | `ClientForm.tsx` (Paese; P.IVA/CF campo unico; ordine Città→Provincia→CAP) |
| `m_catalogo.html` | `app/(app)/catalogo/page.tsx` (tap voce = modifica/elimina) |
| `m_template.html` / `m_template_free.html` | `app/(app)/template/page.tsx` (variante Free con lucchetti Pro) |
| `m_impostazioni.html` / `m_impostazioni_fiscale.html` | `app/(app)/impostazioni/*` (tab Generale/Fiscale/Notifiche/Piano) |
| `m_abbonamento.html` | `app/(app)/abbonamento/page.tsx` (NO Lifetime) |
| `m_altro.html` | NUOVA pagina menu mobile (es. `app/(app)/altro/page.tsx`) |
| `m_cestino.html` | `app/(app)/cestino/page.tsx` |
| `m_pubblica.html` | `app/p/[token]/page.tsx` (accetta con firma, rifiuta con motivo) |
| `m_login.html` | `app/(auth)/login` (logo `branding/brand-extended-centered-light.svg`) |

## Free vs Pro
- Template: Free = solo Classico, watermark NON rimovibile, personalizzazione bloccata → lucchetti "Pro" (vedi `m_template_free.html`). Pro = `m_template.html`.
- AI Import: solo Pro (oggi "in arrivo").
- Abbonamento: Free vede quota + upgrade.
