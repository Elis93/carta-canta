// ── BENI SIGNIFICATIVI e IVA 10% (L. 488/1999 · DM 29.12.1999 · circ. 15/E/2018)
//
// LA REGOLA, in parole semplici. Sui lavori di manutenzione (ordinaria e
// straordinaria) in una casa privata l'IVA è al 10%. Ma se dentro il lavoro
// c'è un «bene significativo» — l'elenco è tassativo, sono sette — il 10% su
// quel bene vale solo FINO A CONCORRENZA del valore della prestazione; quel
// che avanza va al 22%.
//
// ⚠️ IL TERMINE DI CONFRONTO NON È LA SOLA MANODOPERA. È l'intera prestazione
// al netto del bene significativo: manodopera, materiali di consumo, e anche
// gli altri beni NON significativi e le parti staccate con autonomia
// funzionale (tapparelle, persiane, zanzariere, grate: autonome rispetto
// all'infisso → stanno nella prestazione; il bruciatore della caldaia NO →
// sta nel valore del bene).
//
// ⚠️ IL VALORE DEL BENE È IL SUO COSTO, NON IL PREZZO DI VENDITA (norma di
// interpretazione autentica, art. 1 c.19 L. 205/2017, retroattiva; circolare
// 15/E/2018 p.14: «escludere dal valore del bene significativo il margine
// aggiunto dal prestatore… Ciò che rileva è solo il costo "originario"»).
// Il mark-up sta CON la manodopera, dalla parte agevolata — è l'esempio
// ufficiale della circolare: corrispettivo 1.800 = bene 1.000 (costo) +
// manodopera 600 + mark-up 200 → 10% su 1.600, 22% su 200. Le circolari
// 71/E §4.2 e 98/E §4.1.2 (che dicevano «prezzo pattuito») sono SUPERATE.
// Qui il costo è `unit_cost × quantity`; se manca, RIPIEGO sul prezzo
// (la vecchia regola del 2000: prudenziale, si versa IVA in più, mai in meno).
//
// LA FORMULA, con C = totale voci al 10%, B = valore del bene (costo),
// P = C − B (la prestazione, mark-up del bene compreso):
//     quota al 10% = P + min(B, P)
//     quota al 22% = max(0, B − P)
//
// ⚠️ OBBLIGO DI FORMA (art. 1 c.19 L. 205/2017): in fattura vanno indicati
// DISTINTAMENTE il corrispettivo al netto del bene, il valore del bene, e la
// separata evidenza della parte al 10% e di quella al 22% — **anche quando
// tutto rientra nel 10%**. È il punto che i gestionali sbagliano più spesso.
//
// ⚠️ Riguarda SOLO il regime ORDINARIO: un forfettario non addebita IVA, e la
// questione 10/22 non si pone. E la qualificazione dell'intervento
// (manutenzione? ristrutturazione? immobile abitativo?) NON la decide l'app:
// la marcatura del bene la fa l'artigiano, voce per voce.
//
// Modulo PURO: numeri dentro, numeri fuori. Testato.

// ⚠️ L'arrotondamento è ricopiato qui invece di importarlo da `./calcoli`:
// il motore importa QUESTO modulo (espande le voci prima di calcolare), e un
// import di ritorno chiuderebbe un ciclo. È la stessa regola del progetto —
// round half up, mai toFixed, mai banker's rounding — e c'è un test che
// verifica che le due funzioni diano lo stesso risultato.
function roundFiscale(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/** I sette beni significativi del DM 29.12.1999 — elenco TASSATIVO.
 *  ⚠️ Tassativo nella SOSTANZA, non nel nome: la circ. 15/E/2018 dice che i
 *  termini vanno intesi in senso generico, e un bene con la stessa
 *  funzionalità ma nome commerciale diverso è ugualmente significativo (una
 *  stufa a pellet che scalda l'acqua dell'impianto = caldaia). Per questo la
 *  spunta la mette l'artigiano: nessun riconoscimento automatico dal testo. */
export const BENI_SIGNIFICATIVI = [
  'Ascensori e montacarichi',
  'Infissi esterni e interni',
  'Caldaie',
  'Videocitofoni',
  'Apparecchiature di condizionamento e riciclo dell’aria',
  'Sanitari e rubinetteria da bagno',
  'Impianti di sicurezza',
] as const

export interface SplitBeniSignificativi {
  /** Valore dei beni significativi marcati */
  valoreBeni: number
  /** Valore della prestazione (tutto il resto delle voci agevolate) */
  valorePrestazione: number
  /** Imponibile che resta al 10% (prestazione + quota agevolata del bene) */
  imponibile10: number
  /** Imponibile che scivola al 22% (l'eccedenza del bene) */
  imponibile22: number
  /** Quota del bene che gode del 10% — serve alla riga di dettaglio */
  beneAl10: number
  /** true se una parte del bene è finita al 22%: va detto all'artigiano */
  haEccedenza: boolean
}

/**
 * Applica la regola dei beni significativi a un gruppo di voci agevolate.
 *
 * @param valoreBeni valore complessivo delle voci marcate come bene significativo
 * @param valorePrestazione valore di tutto il resto (manodopera, materiali,
 *        beni non significativi, parti staccate autonome)
 */
export function splitBeniSignificativi(
  valoreBeni: number,
  valorePrestazione: number,
): SplitBeniSignificativi {
  const B = Math.max(0, roundFiscale(valoreBeni))
  const P = Math.max(0, roundFiscale(valorePrestazione))
  // La quota del bene che resta agevolata non può superare la prestazione.
  const beneAl10 = roundFiscale(Math.min(B, P))
  const imponibile10 = roundFiscale(P + beneAl10)
  const imponibile22 = roundFiscale(Math.max(0, B - P))
  return {
    valoreBeni: B,
    valorePrestazione: P,
    imponibile10,
    imponibile22,
    beneAl10,
    haEccedenza: imponibile22 > 0,
  }
}

/**
 * La quota di un ACCONTO che va imputata al bene significativo.
 * ⚠️ Il limite si calcola sull'INTERO corrispettivo dovuto, non sull'acconto:
 * in ogni fattura il valore del bene va riportato «nella quota percentuale
 * corrispondente alla parte di corrispettivo pagata», con entrambe le parti
 * 10/22 in evidenza (circolare 71/E/2000 §5.2, testuale). Senza questo,
 * fatturando a stati di avanzamento si otterrebbe uno split diverso da
 * quello del lavoro intero. Si cabla nella Fase 2 (TD02).
 */
export function quotaAccontoBene(
  valoreBeneTotale: number,
  corrispettivoTotale: number,
  importoAcconto: number,
): number {
  if (corrispettivoTotale <= 0) return 0
  const proporzione = Math.min(1, Math.max(0, importoAcconto / corrispettivoTotale))
  return roundFiscale(valoreBeneTotale * proporzione)
}

// ── Come lo split entra nel documento ───────────────────────────────────────
//
// ⚠️ NON si tocca il motore fiscale: la voce marcata come bene significativo
// viene SPEZZATA IN DUE RIGHE *prima* del calcolo — una al 10% (la quota
// agevolata) e una al 22% (l'eccedenza). Da lì in poi tutto funziona già:
//  · il motore somma le basi per aliquota e calcola l'imposta una volta per
//    aliquota (il fix del 10 ago che evita lo scarto 00421);
//  · il PDF mostra due righe, che è ESATTAMENTE ciò che l'art. 1 c.19
//    L. 205/2017 chiede di indicare distintamente;
//  · l'XML produce due `DettaglioLinee` e due `DatiRiepilogo`, che è la
//    rappresentazione standard (nel tracciato non esiste un campo dedicato
//    ai beni significativi).
// Una riga in più al posto di un ramo in più: meno codice che può divergere.

/** La forma minima di voce che serve allo split (compatibile con le righe
 *  del DB e con quelle del form). */
export interface VoceSplittabile {
  description: string
  quantity: number
  unit_price: number
  discount_pct?: number | null
  vat_rate?: number | null
  unit?: string | null
  bene_significativo?: boolean | null
  /** Costo d'acquisto del bene (062). Sulle voci marcate «bene significativo»
   *  è LA fonte del valore del bene (circ. 15/E/2018): assente o non positivo
   *  → ripiego sul prezzo. ⚠️ Eccezione dichiarata alla regola §B.2 «costo mai
   *  al cliente», limitata al regime ordinario: il valore del bene (= costo)
   *  finisce in fattura PER OBBLIGO DI LEGGE (71/E §5.1). Le select pubbliche
   *  che lo portano ne fanno uso SOLO qui: mai nelle prop dei componenti. */
  unit_cost?: number | null
  /** Importo di riga già calcolato. Le righe prodotte dallo split lo
   *  riscrivono: PDF e XML leggono `total`, e lasciarci quello della voce
   *  intera farebbe divergere le righe dai totali (e scartare la fattura). */
  total?: number | null
}

/** Il valore complessivo delle voci marcate come bene significativo, e quello
 *  della prestazione: servono alla RIGA DESCRITTIVA del documento, che l'art. 1
 *  c.19 L. 205/2017 pretende **anche quando tutto rientra nel 10%** — il caso
 *  in cui lo split non produce nessuna riga in più e quindi da solo non
 *  assolverebbe l'obbligo. Restituisce null se non c'è nulla da dichiarare. */
export function dettaglioBeniSignificativi(
  items: VoceSplittabile[],
  fiscalRegime: string | null | undefined,
  vatRateDefault?: number | null,
): SplitBeniSignificativi | null {
  if (fiscalRegime === 'forfettario') return null
  const vatDef = vatRateDefault ?? ALIQUOTA_ORDINARIA
  if (!items.some((i) => eBene(i, vatDef))) return null
  return splitDocumento(items, vatDef).split
}

/** Aliquota su cui vale l'agevolazione dei beni significativi. */
export const ALIQUOTA_AGEVOLATA = 10
/** Aliquota ordinaria a cui scivola l'eccedenza del bene. */
export const ALIQUOTA_ORDINARIA = 22

const importoVoce = (i: VoceSplittabile) =>
  roundFiscale(
    Number(i.quantity ?? 0) * Number(i.unit_price ?? 0) * (1 - (Number(i.discount_pct ?? 0) / 100)),
  )

/** Il VALORE del bene significativo di una voce: il suo COSTO (`unit_cost ×
 *  quantity`, circ. 15/E/2018 — il costo non si sconta: lo sconto è sul
 *  prezzo di vendita). Costo assente o non positivo → RIPIEGO sul prezzo:
 *  è la vecchia regola del 2000, prudenziale (più IVA versata, mai meno),
 *  e tiene identici tutti i documenti salvati senza costo. */
const costoVoce = (i: VoceSplittabile) => {
  const uc = Number(i.unit_cost ?? NaN)
  if (Number.isFinite(uc) && uc > 0) return roundFiscale(Number(i.quantity ?? 0) * uc)
  return importoVoce(i)
}

/** Separa le voci fra «bene significativo» e «prestazione».
 *  ⚠️ La PRESTAZIONE non è la sola manodopera: è tutto ciò che sta nel lavoro
 *  agevolato e non è bene significativo — materiali di consumo, beni non
 *  significativi e le parti staccate con autonomia funzionale (tapparelle,
 *  zanzariere, grate). È l'errore più diffuso: confrontare il bene con la sola
 *  posa fa scivolare al 22% molto più del dovuto.
 *  ⚠️ Una voce con IVA vuota vale l'aliquota PREDEFINITA del documento, che di
 *  norma è il 22%: contarla come prestazione al 10% (il difetto trovato al
 *  ricontrollo del 12 ago) gonfiava la quota agevolata del bene. */
// ⚠️ Un bene conta SOLO se la sua voce è (ancora) al 10%: la spunta resta nel
// dato anche quando l'artigiano cambia l'aliquota a 22 (la casella sparisce
// dalla UI e non c'è più modo di toglierla) — senza questo filtro il flag
// stantio riconvertiva pezzi di 22% in 10% e, nel caso B ≤ P, faceva stampare
// una dicitura di legge FALSA («l'intero corrispettivo è al 10%») accanto a
// un riepilogo al 22% (ricontrollo 12 ago).
function eBene(i: VoceSplittabile, vatRateDefault: number): boolean {
  return i.bene_significativo === true && (i.vat_rate ?? vatRateDefault) === ALIQUOTA_AGEVOLATA
}

function valoriPerSplit(items: VoceSplittabile[], vatRateDefault: number): {
  valoreBeni: number
  valorePrestazione: number
  /** Prezzo di VENDITA dei beni marcati: il denaro che le loro righe portano
   *  nel documento — è il tetto naturale dell'eccedenza al 22%. */
  prezzoBeni: number
  /** Corrispettivo complessivo delle voci al 10% (prezzi, sconti compresi). */
  corrispettivo: number
} {
  const agevolate = items.filter((i) => (i.vat_rate ?? vatRateDefault) === ALIQUOTA_AGEVOLATA)
  const corrispettivo = roundFiscale(agevolate.reduce((s, i) => s + importoVoce(i), 0))
  const beni = agevolate.filter((i) => eBene(i, vatRateDefault))
  const valoreBeni = roundFiscale(beni.reduce((s, i) => s + costoVoce(i), 0))
  const prezzoBeni = roundFiscale(beni.reduce((s, i) => s + importoVoce(i), 0))
  // P = C − B (98/E §4.1.4): la prestazione è l'intero corrispettivo meno il
  // VALORE (costo) dei beni — così il mark-up del bene confluisce nella parte
  // agevolata, come nell'esempio ufficiale della 15/E. Coi costi assenti
  // (ripiego sul prezzo) torna esattamente la somma delle voci non-bene al 10%.
  const valorePrestazione = Math.max(0, roundFiscale(corrispettivo - valoreBeni))
  return { valoreBeni, valorePrestazione, prezzoBeni, corrispettivo }
}

/** Lo split del DOCUMENTO, con il tetto di coerenza: l'eccedenza al 22% non
 *  può superare il PREZZO dei beni, perché è il denaro che quelle righe
 *  portano nel documento. Col valore = costo il caso può presentarsi (vendita
 *  sottocosto estrema: costo del bene sopra l'intero corrispettivo) — il
 *  vecchio codice ne era immune per costruzione (valore = prezzo). Senza il
 *  tetto, la dicitura dichiarerebbe al 22% più denaro di quanto il documento
 *  ne contenga e le righe (che il tetto ce l'hanno per forza) divergerebbero. */
function splitDocumento(items: VoceSplittabile[], vatRateDefault: number): {
  split: SplitBeniSignificativi
  valoreBeni: number
  prezzoBeni: number
} {
  const { valoreBeni, valorePrestazione, prezzoBeni, corrispettivo } = valoriPerSplit(items, vatRateDefault)
  let split = splitBeniSignificativi(valoreBeni, valorePrestazione)
  if (split.imponibile22 > prezzoBeni) {
    split = {
      ...split,
      imponibile22: prezzoBeni,
      imponibile10: roundFiscale(Math.max(0, corrispettivo - prezzoBeni)),
      beneAl10: 0,
    }
  }
  return { split, valoreBeni, prezzoBeni }
}

/**
 * Espande le voci marcate «bene significativo» nelle due righe previste.
 *
 * Non fa nulla (restituisce le voci invariate) quando nessuna voce marcata è
 * al 10%, o quando il regime è forfettario (lì non si addebita IVA).
 * ⚠️ Con prestazione a ZERO (solo il bene, nessuna posa al 10%) la formula
 * manda l'INTERO bene al 22% — `10% = P + min(B,P)` con P=0 dà zero. Non è
 * un caso limite dimenticato: è la regola, e c'è un test che la fissa.
 */
export function espandiBeniSignificativi<T extends VoceSplittabile>(
  items: T[],
  fiscalRegime: string | null | undefined,
  vatRateDefault?: number | null,
): T[] {
  if (fiscalRegime === 'forfettario') return items
  const vatDef = vatRateDefault ?? ALIQUOTA_ORDINARIA
  const idxMarcate = items.map((v, i) => (eBene(v, vatDef) ? i : -1)).filter((i) => i >= 0)
  if (idxMarcate.length === 0) return items

  const { split, valoreBeni } = splitDocumento(items, vatDef)
  // Tutto agevolato: le voci restano com'erano (una riga sola per bene).
  // ⚠️ L'obbligo di INDICARE il valore del bene resta anche in questo caso:
  // lo assolve il PDF con la riga descrittiva, non lo split.
  if (!split.haEccedenza) return items

  // L'eccedenza si ripartisce fra le voci marcate in proporzione al loro
  // VALORE (il costo, che è ciò che l'ha generata), residuo sull'ultima —
  // e MAI oltre il PREZZO della voce: le due righe prodotte devono sommare
  // al prezzo, che è il denaro che la voce porta nel documento. Se il cap
  // per-voce lascia un residuo (costi molto diversi dai prezzi), un secondo
  // giro lo versa dove c'è ancora spazio: il tetto a livello documento
  // (imponibile22 ≤ prezzo dei beni, in splitDocumento) garantisce che lo
  // spazio complessivo basti sempre.
  const quote = new Map<number, number>()
  idxMarcate.forEach((idx, ord) => {
    const val = importoVoce(items[idx])
    const teorica = ord === idxMarcate.length - 1
      ? roundFiscale(split.imponibile22 - [...quote.values()].reduce((s, q) => s + q, 0))
      : roundFiscale((split.imponibile22 * costoVoce(items[idx])) / (valoreBeni || 1))
    quote.set(idx, Math.min(Math.max(0, teorica), val))
  })
  let residuo = roundFiscale(split.imponibile22 - [...quote.values()].reduce((s, q) => s + q, 0))
  for (const idx of idxMarcate) {
    if (residuo <= 0) break
    const spazio = roundFiscale(importoVoce(items[idx]) - (quote.get(idx) ?? 0))
    if (spazio <= 0) continue
    const extra = Math.min(spazio, residuo)
    quote.set(idx, roundFiscale((quote.get(idx) ?? 0) + extra))
    residuo = roundFiscale(residuo - extra)
  }

  const out: T[] = []
  for (const [i, voce] of items.entries()) {
    if (!eBene(voce, vatDef)) { out.push(voce); continue }
    const val = importoVoce(voce)
    const quota = quote.get(i) ?? 0
    const agevolata = Math.max(0, roundFiscale(val - quota))

    // ⚠️ Le righe prodotte NON sono più «beni significativi»: sono già il
    // risultato dello split. Senza azzerare il flag, una seconda chiamata
    // (il motore espande, poi espande anche il PDF) rifarebbe lo split su
    // righe già spezzate — la funzione dev'essere IDEMPOTENTE, perché viene
    // chiamata a più livelli apposta per non poter divergere.
    // ⚠️ `unit_cost: null` sulle righe prodotte: lo spread `...voce` lo
    // porterebbe con sé, e queste righe viaggiano verso superfici di lettura.
    // Il costo serve SOLO al calcolo (qui sopra): sulle righe sintetiche è
    // un dato in più che non deve poter trapelare (§B.2, difesa in profondità).
    // Riga 1 — la parte che resta al 10%
    if (agevolata > 0) {
      out.push({
        ...voce,
        description: `${voce.description} (quota agevolata)`,
        quantity: 1,
        unit_price: agevolata,
        discount_pct: 0,
        vat_rate: ALIQUOTA_AGEVOLATA,
        total: agevolata,
        bene_significativo: false,
        unit_cost: null,
      } as T)
    }
    // Riga 2 — l'eccedenza, al 22%
    if (quota > 0) {
      out.push({
        ...voce,
        description: `${voce.description} (quota eccedente il valore della prestazione)`,
        quantity: 1,
        unit_price: quota,
        discount_pct: 0,
        vat_rate: ALIQUOTA_ORDINARIA,
        total: quota,
        bene_significativo: false,
        unit_cost: null,
      } as T)
    }
  }
  return out
}
