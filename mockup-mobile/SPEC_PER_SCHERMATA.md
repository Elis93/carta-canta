# SPEC PER SCHERMATA — riproduzione ESATTA dei mockup mobile

> Obiettivo: il mobile dell'app deve essere **identico** ai mockup `mockup-mobile/*.html` — layout, ordine, copy, spaziature, colori, **ombre**, raggi, font. Zero deviazioni.
>
> **REGOLE GLOBALI (valgono per tutte le schermate):**
> 1. Usa le classi/variabili di **`CC_MOBILE.css`** (valori esatti). Allinea `app/globals.css` a quei valori. Per qualunque misura non coperta da una classe, **copia il valore inline dal mockup** (non inventare).
> 2. La cornice esterna dei mockup — `…background:secondary…><div …background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 16px 38px…>` — è il **telaio del telefono**, NON un elemento dell'app. Nell'app lo schermo ha sfondo **`--cc-page` (#eceae4)** e i contenuti sono dentro `cc-card`/`cc-card-md` che "galleggiano" su quello sfondo. Padding orizzontale schermata = **16px**.
> 3. Font **Inter** 400/500/600; min 12px. Icone: equivalente **lucide** dell'icona Tabler del mockup.
> 4. Mobile-first con breakpoint `lg:` — **non rompere il desktop** (resta com'è).
> 5. **Ombre identiche**: card standard `--cc-shadow`, card form `--cc-shadow-md`, FAB `--cc-shadow-fab`, bottone primario `--cc-shadow-btn`. Niente bordi marcati al posto delle ombre.

---

## Navigazione (tutte le schermate app) — file: `home_browser.html`, `m_altro.html`
- Bottom nav `cc-bottomnav` (solo mobile, `lg:hidden`): **Home · Preventivi · [ + ] · Fatture · Altro**.
- "+" = **`cc-fab` CENTRALE** (cerchio navy 50px, `margin-top:-14px`, ombra `--cc-shadow-fab`, label "Preventivo" 11px). NON flottante.
- **Clienti NON è un tab** → solo dentro "Altro".
- Tab attivo: `cc-navitem-active` (navy + 500). Su pagine sotto "Altro" (Clienti, Catalogo, …) attivo = **Altro**.

## Home — `home_browser.html`
Header: saluto ("Ciao, Eli" 13 secondary + "Eli Impianti" 19/500) a sx; a dx **campanello** + avatar iniziali navy 40px; hairline sotto. Poi: card "Prossima scadenza" (cc-card) con numero·cliente, "Scade domani" (danger), importo 18/600, bottoni "Sollecita" (navy) + "Apri" (outline). Due metric tile su `--cc-surface` (Accettati·mese / Fatturato·mese). "Attività recente" con righe + pill stato. Bottom nav (Home attivo).

## Preventivi — `preventivi.html`
Titolo "Preventivi" 20/500 + ⋮. `cc-search` ("Cerca numero, cliente, voce…"). **Filtri `cc-tabs`** (Tutti/Bozze/In attesa/Accettati/Rifiutati) una riga, attivo sottolineato. Riga "Ordina: Più recenti ▾" a dx. Schede `cc-card` per documento: riga1 numero(500)·cliente(secondary) + pill stato; riga2 data contestuale (rossa se urgente) · importo(500) + ⋮. Bottom nav (Preventivi attivo). KPI solo desktop.

## Fatture — `fatture.html`
Come Preventivi + in cima **due bottoni**: "Nuova fattura" (`cc-btn-primary`) + "Da preventivo" (`cc-btn-outline`). Filtri (Tutte/Bozze/Inviate/Pagate/Annullate). Schede con badge "Modificata" dove serve. Bottom nav (Fatture attivo).

## Nuovo preventivo — `nuovo_prev.html`  (card **marcate** `cc-card-md`)
Header: X + "Nuovo preventivo" 17/600 + "Anteprima" (navy 13/500). Card **Cliente** (label sezione + campo "Cerca o aggiungi un cliente…" con icona user + chevron). Card **Voci**: "Voce 1" + cestino; descrizione + microfono (navy); riga Q.tà/Prezzo/Unità; **riga "IVA 22% ▾  ＋ Sconto voce"**; "Totale voce". Poi bottoni "Aggiungi voce" + "Da catalogo" (outline). Card **Altre opzioni** (collassabile, ChevronDown). Card **Riepilogo**: Subtotale, "＋ Aggiungi sconto", Totale 16/600·18/600. In fondo "Salva bozza" (outline) + "Invia al cliente" (navy).

## Nuova fattura — `nuova_fattura.html`  (card **marcate**, STESSO stile di Nuovo preventivo)
Come sopra ma: titolo "Nuova fattura"; prima card con **Numero** + **Data** + campo Cliente; Riepilogo con **"Totale da pagare"**. ⚠️ Oggi `FatturaForm.tsx` è vecchio stile → va riportato a questo identico stile a schede.

## Dettaglio preventivo — `m_dett_preventivo.html`
Header (freccia + numero/cliente + pill stato + ⋮). Banner verde **"Accettato e firmato dal cliente"** (nome · data · IP) quando accettato. Azioni: Condividi + Anteprima (outline). "Crea fattura" (navy) per accettati. Card documento (date, voci, Totale). Card **"Altre azioni"** collassabile (Duplica, Cambia stato, Registra invio manuale, Elimina). Cronologia con pallini colorati.

## Dettaglio fattura — `m_dett_fattura.html`
Come sopra, stati fattura; banner **SdI** (warning) "non sostituisce la fattura elettronica…"; banner **"Collegata al preventivo …"** (info); "Segna pagata"; Totale da pagare; cronologia.

## Dettaglio cliente — `m_dett_cliente.html`
Header (freccia + "Scheda cliente" + ⋮). Avatar iniziale 52px su `--cc-surface`, nome 18/500, "Cliente dal…". Chip azioni Chiama/Modifica. Card info (mail, telefono, P.IVA, indirizzo con icone). Sezione "Documenti" con righe + pill + "Nuovo".

## Nuovo/modifica cliente — `m_form_cliente.html`
Header (X + "Nuovo cliente"). 3 card: **Contatto** (Nome/Cognome, Email, Telefono + nota "almeno email o telefono"); **Dati fiscali** (campo unico "P.IVA / Codice Fiscale"); **Indirizzo** (Indirizzo; riga Città/Prov/CAP nell'ordine **Città→Prov→CAP**; **campo Paese = "Italia"** con chevron). Bottone "Salva cliente" navy. ⚠️ Manca il campo Paese: aggiungerlo.

## Catalogo — `m_catalogo.html`
Titolo "Catalogo" + ⋮. `cc-search`. Bottone "Nuova voce" navy. Card elenco voci (`cc-card` padding 4px 15px) con `cc-row`: nome(500) + "unità · IVA xx%"(tertiary) a sx, prezzo(600) + **chevron** a dx → **tap = modifica**. Card "Suggeriti per la tua attività" (bulb warning) con righe + "Aggiungi". ⚠️ Oggi le voci hanno bottoni inline → riportare a riga tappabile + chevron.

## Template (Pro) — `m_template.html`
Header (freccia + "Template documenti"). Card **Modello**: griglia 2×2 (Classico attivo, Bold/Tecnico/Elegante con "Pro"). Card **Personalizzazione**: Colore accento (4 pallini, oro `#c9a44c` incluso), Font (Inter ▸), Posizione logo (Sinistra ▸), Mostra logo (toggle on), Watermark (toggle), Note legali (▸). Bottoni Anteprima (outline) + Salva (navy). ⚠️ Bug: il **Classico (Free) non deve mai mostrare "Pro"**.

## Template (Free) — `m_template_free.html`
Come sopra ma: Bold/Tecnico/Elegante con **lucchetto** + "Pro"; personalizzazione con **lucchetti**; Watermark "Sempre attivo + lucchetto"; banner oro **"Sblocca tutto con Pro"**; bottone "Passa a Pro" (navy, corona oro).

## Impostazioni — Generale — `m_impostazioni.html`
Header "Impostazioni". **Tab `cc-tabs`**: Generale/Fiscale/Notifiche/Piano. Card **Logo** (riquadro tratteggiato + "Carica logo"). Card **Dati azienda**: Ragione sociale, **Email**, Indirizzo. (NIENTE P.IVA qui.) "Salva modifiche" navy. ⚠️ Le tab usano ancora `Card` shadcn → portarle a `cc-card`/`cc-section-label`.

## Impostazioni — Fiscale — `m_impostazioni_fiscale.html`
Tab Fiscale attivo. Card **Dati fiscali**: Regime (Forfettario ▾), **P.IVA**, **Codice Fiscale**. Card **Automazioni**: Marca da bollo automatica (toggle on, "€ 2,00 oltre 77,47 €"), Ritenuta d'acconto (toggle, "20%"). "Salva modifiche". ⚠️ Spostare qui P.IVA/CF (ora sono in Generale).

## Abbonamento — `m_abbonamento.html`
Header "Abbonamento". Card **Piano Free** (pill "Attuale", barra quota "6/8" warning, "Ti restano 2 preventivi…"). Card **Pro** (ombra, badge navy "Consigliato", "€ 19 /mese · o € 182/anno", 4 check, "Passa a Pro" navy). **NIENTE Lifetime.**

## Altro (menu) — `m_altro.html`
Titolo "Altro". Riga profilo (avatar EI, "Eli Impianti", "Piano Free", ▸) su `--cc-surface`. Gruppo **Strumenti** (Clienti, Catalogo, Template documenti, Scadenze e solleciti [badge "2"]) in `cc-card` con righe icona+label+chevron. Gruppo **Account** (Impostazioni, Abbonamento [corona oro, "Passa a Pro"], Cestino). Bottone "Esci" (outline, danger). Bottom nav (Altro attivo).

## Cestino — `m_cestino.html`
Header (freccia + "Cestino"). Nota "Gli elementi… eliminati dopo 15 giorni." Per documento `cc-card`: numero·cliente + "N g rimasti" (danger/warning), bottoni "Ripristina" (outline) + cestino.

## Pagina pubblica cliente — `m_pubblica.html`
Header azienda (avatar EI + "ti ha inviato un preventivo"). Titolo doc + valido fino + importo. Card riepilogo (Per: cliente + voci). "Vedi documento completo". Card **Accetta** (label, Nome, **Firma** box tratteggiato, "Accetto e firmo" verde). Bottone "Rifiuta (indica un motivo)" (outline). Bottone WhatsApp (success bg). 

## Accesso — `m_login.html`
Logo **grande** centrato (SVG: mark navy + archi oro/crema + "Carta **Canta**" con Canta in oro + "il tuo ufficio in tasca"), "Bentornato" 20/600. "Continua con Google" (outline). divisore "oppure". Email, Password (con occhio), "Password dimenticata?". "Accedi" navy. "Non hai un account? Registrati".
