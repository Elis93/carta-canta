// La verità scritta sulla copia (Fase 0 copia di cortesia, 20 set 2026).
// Le diciture sono gli STANDARD dei concorrenti (decisione Eli «Facciamo
// uguale»): i test le fissano — cambiarle è una decisione di prodotto, non
// un refactoring.

import { describe, it, expect } from 'vitest'
import { statoCopiaSdi, dicituraCopiaSdi, esitoPositivoSdi, copiaCortesiaBloccata, copiaAutomaticaConsentita } from '@/lib/documents/copia-sdi'

describe('statoCopiaSdi', () => {
  it('preventivo → null (client-first intatto, mai una dicitura SdI)', () => {
    expect(statoCopiaSdi('preventivo', null)).toBeNull()
    expect(statoCopiaSdi('preventivo', 'consegnata')).toBeNull()
    expect(statoCopiaSdi(null, null)).toBeNull()
    expect(statoCopiaSdi(undefined, 'inviata')).toBeNull()
  })

  it('fattura mai trasmessa → non_emessa (anche stringa vuota/spazi)', () => {
    expect(statoCopiaSdi('fattura', null)).toBe('non_emessa')
    expect(statoCopiaSdi('fattura', undefined)).toBe('non_emessa')
    expect(statoCopiaSdi('fattura', '')).toBe('non_emessa')
    expect(statoCopiaSdi('fattura', '  ')).toBe('non_emessa')
  })

  it('scartata = per legge MAI emessa → non_emessa', () => {
    expect(statoCopiaSdi('fattura', 'scartata')).toBe('non_emessa')
    expect(statoCopiaSdi('nota_credito', 'scartata')).toBe('non_emessa')
  })

  it('inviata (trasmessa, esito non noto) → in_attesa_esito', () => {
    expect(statoCopiaSdi('fattura', 'inviata')).toBe('in_attesa_esito')
  })

  it('un valore SCONOSCIUTO non promette mai la copia di cortesia', () => {
    // Un valore futuro del provider non deve né negare la trasmissione
    // («non costituisce fattura» sarebbe falso) né promettere l'originale
    // nel cassetto fiscale: la via di mezzo è l'attesa dell'esito.
    expect(statoCopiaSdi('fattura', 'boh_futuro')).toBe('in_attesa_esito')
  })

  it('esito positivo (consegnata / mancata_consegna) → copia_cortesia', () => {
    expect(statoCopiaSdi('fattura', 'consegnata')).toBe('copia_cortesia')
    expect(statoCopiaSdi('fattura', 'mancata_consegna')).toBe('copia_cortesia')
    expect(statoCopiaSdi('nota_credito', 'consegnata')).toBe('copia_cortesia')
  })
})

describe('dicituraCopiaSdi', () => {
  it('non_emessa: la famiglia proforma (standard di mercato)', () => {
    const t = dicituraCopiaSdi('non_emessa', 'fattura')
    expect(t).toContain('non costituisce fattura valida ai fini del DPR 633/1972')
    expect(t).toContain('trasmissione al Sistema di Interscambio')
    // La coda dell'originale proforma («all'atto del pagamento») NON c'è:
    // è il caso proforma, non il nostro.
    expect(t).not.toContain('pagamento del corrispettivo')
  })

  it('copia_cortesia: lo standard Fatture in Cloud (quasi verbatim)', () => {
    const t = dicituraCopiaSdi('copia_cortesia', 'fattura')
    expect(t).toContain('Copia di cortesia non valida ai fini fiscali')
    expect(t).toContain("L'originale della fattura è stato inviato al Sistema di Interscambio")
    expect(t).toContain("area riservata del sito dell'Agenzia delle Entrate")
  })

  it('in_attesa_esito: trasmessa ma senza promesse', () => {
    const t = dicituraCopiaSdi('in_attesa_esito', 'fattura')
    expect(t).toContain('in attesa di esito')
    expect(t).toContain('Copia priva di valenza fiscale')
    expect(t).not.toContain('non costituisce')
    expect(t).not.toContain('consultabile')
  })

  it('nota di credito: mai la parola «fattura» al posto sbagliato', () => {
    expect(dicituraCopiaSdi('non_emessa', 'nota_credito')).toContain('non costituisce nota di credito valida')
    expect(dicituraCopiaSdi('non_emessa', 'nota_credito')).not.toContain('fattura')
    expect(dicituraCopiaSdi('copia_cortesia', 'nota_credito')).toContain("L'originale della nota di credito")
    expect(dicituraCopiaSdi('in_attesa_esito', 'nota_credito')).toContain('Nota di credito trasmessa')
  })
})

// ── Fase 1 (21 set): il blocco dell'invio al cliente prima dell'esito ──────
describe('esitoPositivoSdi', () => {
  it('positivo solo su consegnata e mancata_consegna', () => {
    expect(esitoPositivoSdi('consegnata')).toBe(true)
    expect(esitoPositivoSdi('mancata_consegna')).toBe(true)
    expect(esitoPositivoSdi('inviata')).toBe(false)
    expect(esitoPositivoSdi('scartata')).toBe(false)
    expect(esitoPositivoSdi(null)).toBe(false)
    expect(esitoPositivoSdi('')).toBe(false)
  })
})

describe('copiaCortesiaBloccata', () => {
  it('preventivo mai bloccato (client-first intatto)', () => {
    expect(copiaCortesiaBloccata('preventivo', null)).toBe(false)
    expect(copiaCortesiaBloccata('preventivo', 'inviata')).toBe(false)
  })

  it('fattura senza esito positivo → bloccata (bozza, inviata, scartata)', () => {
    expect(copiaCortesiaBloccata('fattura', null)).toBe(true)
    expect(copiaCortesiaBloccata('fattura', 'inviata')).toBe(true)
    expect(copiaCortesiaBloccata('fattura', 'scartata')).toBe(true)
  })

  it('esito positivo → la copia si sblocca', () => {
    expect(copiaCortesiaBloccata('fattura', 'consegnata')).toBe(false)
    expect(copiaCortesiaBloccata('fattura', 'mancata_consegna')).toBe(false)
  })

  it('vale anche per le note (TD04 e TD05: copie della stessa famiglia)', () => {
    expect(copiaCortesiaBloccata('nota_credito', null)).toBe(true)
    expect(copiaCortesiaBloccata('nota_debito', 'inviata')).toBe(true)
    expect(copiaCortesiaBloccata('nota_credito', 'consegnata')).toBe(false)
  })

  it('un esito futuro sconosciuto NON sblocca (mai fidarsi di un valore ignoto)', () => {
    expect(copiaCortesiaBloccata('fattura', 'accettata_con_riserva')).toBe(true)
  })
})

// ── Fase 2: flag per cliente «Invia sempre la copia di cortesia» ───────────
describe('copiaAutomaticaConsentita', () => {
  it('ferma SOLO il false esplicito (la rinuncia espressa)', () => {
    expect(copiaAutomaticaConsentita({ copia_cortesia_auto: false })).toBe(false)
  })

  it('flag acceso → si invia', () => {
    expect(copiaAutomaticaConsentita({ copia_cortesia_auto: true })).toBe(true)
  })

  it('pre-089 (colonna assente) o cliente assente → comportamento di serie', () => {
    // undefined = la colonna non esiste ancora · null = nessuna scelta
    // registrata · cliente mancante: in nessuno di questi casi qualcuno ha
    // RIFIUTATO la copia — si invia come da Fase 1.
    expect(copiaAutomaticaConsentita({})).toBe(true)
    expect(copiaAutomaticaConsentita({ copia_cortesia_auto: null })).toBe(true)
    expect(copiaAutomaticaConsentita(null)).toBe(true)
    expect(copiaAutomaticaConsentita(undefined)).toBe(true)
  })
})
