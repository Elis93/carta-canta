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
// LA FORMULA, con C = totale, B = valore del bene, P = C − B:
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
 * in ogni fattura il valore del bene va riportato in misura PROPORZIONALE al
 * pagamento, con lo split 10/22 rifatto su quella proporzione (prassi AdE,
 * ripresa dalle guide 2026). Senza questo, fatturando a stati di avanzamento
 * si otterrebbe uno split diverso da quello del lavoro intero.
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
  const { valoreBeni, valorePrestazione } = valoriPerSplit(items, vatDef)
  return splitBeniSignificativi(valoreBeni, valorePrestazione)
}

/** Aliquota su cui vale l'agevolazione dei beni significativi. */
export const ALIQUOTA_AGEVOLATA = 10
/** Aliquota ordinaria a cui scivola l'eccedenza del bene. */
export const ALIQUOTA_ORDINARIA = 22

const importoVoce = (i: VoceSplittabile) =>
  roundFiscale(
    Number(i.quantity ?? 0) * Number(i.unit_price ?? 0) * (1 - (Number(i.discount_pct ?? 0) / 100)),
  )

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

function valoriPerSplit(items: VoceSplittabile[], vatRateDefault: number): { valoreBeni: number; valorePrestazione: number } {
  const valorePrestazione = items
    .filter((i) => !eBene(i, vatRateDefault) && (i.vat_rate ?? vatRateDefault) === ALIQUOTA_AGEVOLATA)
    .reduce((s, i) => s + importoVoce(i), 0)
  const valoreBeni = items
    .filter((i) => eBene(i, vatRateDefault))
    .reduce((s, i) => s + importoVoce(i), 0)
  return { valoreBeni, valorePrestazione }
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
  const marcate = items.filter((i) => eBene(i, vatDef))
  if (marcate.length === 0) return items

  const { valoreBeni, valorePrestazione } = valoriPerSplit(items, vatDef)
  const split = splitBeniSignificativi(valoreBeni, valorePrestazione)
  // Tutto agevolato: le voci restano com'erano (una riga sola per bene).
  // ⚠️ L'obbligo di INDICARE il valore del bene resta anche in questo caso:
  // lo assolve il PDF con la riga descrittiva, non lo split.
  if (!split.haEccedenza) return items

  // L'eccedenza si ripartisce fra le voci marcate in proporzione al loro
  // valore (residuo sull'ultima, come per lo sconto di documento: così la
  // somma torna al centesimo).
  const out: T[] = []
  let eccedenzaAssegnata = 0
  const ultimaMarcata = marcate[marcate.length - 1]
  for (const voce of items) {
    if (!eBene(voce, vatDef)) { out.push(voce); continue }
    const val = importoVoce(voce)
    const quota = voce === ultimaMarcata
      ? roundFiscale(split.imponibile22 - eccedenzaAssegnata)
      : roundFiscale((split.imponibile22 * val) / (valoreBeni || 1))
    eccedenzaAssegnata = roundFiscale(eccedenzaAssegnata + quota)
    const agevolata = Math.max(0, roundFiscale(val - quota))

    // ⚠️ Le righe prodotte NON sono più «beni significativi»: sono già il
    // risultato dello split. Senza azzerare il flag, una seconda chiamata
    // (il motore espande, poi espande anche il PDF) rifarebbe lo split su
    // righe già spezzate — la funzione dev'essere IDEMPOTENTE, perché viene
    // chiamata a più livelli apposta per non poter divergere.
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
      } as T)
    }
  }
  return out
}
