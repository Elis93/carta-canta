import { describe, it, expect } from 'vitest'
import {
  normalizzaTesto,
  suggerisciVoci,
  MAX_SUGGERIMENTI,
  type FonteVoce,
} from '@/lib/documents/suggerimenti-voce'

// I suggerimenti mentre si scrive la descrizione (11 ago 2026): alla prima
// lettera fino a 10 voci dal catalogo e dai listini, a ogni lettera in più
// la lista si restringe. La scelta è sempre dell'artigiano.

function fonte(descrizione: string, extra: Partial<FonteVoce> = {}): FonteVoce {
  return {
    descrizione,
    alias: null,
    unit: 'pz',
    unit_price: 10,
    vat_rate: 22,
    unit_cost: null,
    supplier_list_id: null,
    fonte: 'catalogo',
    ...extra,
  }
}

describe('normalizzaTesto', () => {
  it('minuscole, accenti e spazi doppi', () => {
    expect(normalizzaTesto('  Impianto  Elèttrico ')).toBe('impianto elettrico')
  })
})

describe('suggerisciVoci — pertinenza', () => {
  it('query vuota o di soli spazi → nessun suggerimento', () => {
    expect(suggerisciVoci('', [fonte('Posa piastrelle')])).toEqual([])
    expect(suggerisciVoci('   ', [fonte('Posa piastrelle')])).toEqual([])
  })

  it('chi INIZIA con la query viene prima di chi la contiene', () => {
    const fonti = [
      fonte('Smontaggio caldaia vecchia'),
      fonte('Caldaia a condensazione'),
    ]
    const out = suggerisciVoci('cald', fonti)
    expect(out.map((f) => f.descrizione)).toEqual([
      'Caldaia a condensazione',
      'Smontaggio caldaia vecchia',
    ])
  })

  it('più parole restringono: ognuna deve trovare riscontro', () => {
    const fonti = [
      fonte('Caldaia a condensazione'),
      fonte('Caldaia a camera aperta'),
    ]
    // «caldaia cond» → solo la condensazione (l'altra non ha «cond»)
    expect(suggerisciVoci('caldaia cond', fonti).map((f) => f.descrizione))
      .toEqual(['Caldaia a condensazione'])
  })

  it('gli accenti non fanno perdere il riscontro (in entrambe le direzioni)', () => {
    expect(suggerisciVoci('elettrico', [fonte('Impianto elèttrico')])).toHaveLength(1)
    expect(suggerisciVoci('elèttr', [fonte('Impianto elettrico')])).toHaveLength(1)
  })

  it('si cerca anche sul NOME della voce di catalogo (alias)', () => {
    // Il picker inserisce la description, ma l'artigiano conosce il nome
    const f = fonte('Fornitura e posa di piastrelle in gres 60x60', { alias: 'Piastrelle gres' })
    expect(suggerisciVoci('piastrelle gr', [f])).toHaveLength(1)
    // …e anche sul codice articolo dei listini
    const l = fonte('Tubo multistrato 26mm', { alias: 'TM26', fonte: 'listino' })
    expect(suggerisciVoci('tm26', [l])).toHaveLength(1)
  })

  it('una parola senza riscontro esclude la voce', () => {
    expect(suggerisciVoci('caldaia xyz', [fonte('Caldaia a condensazione')])).toEqual([])
  })
})

describe('suggerisciVoci — tetto e doppioni', () => {
  it(`mai più di ${MAX_SUGGERIMENTI} risultati`, () => {
    const fonti = Array.from({ length: 30 }, (_, i) => fonte(`Voce numero ${i + 1}`))
    expect(suggerisciVoci('voce', fonti)).toHaveLength(MAX_SUGGERIMENTI)
  })

  it('stessa voce in catalogo E listino (stesso prezzo): compare una volta, dal catalogo', () => {
    const fonti = [
      fonte('Tubo multistrato 26mm', { fonte: 'catalogo' }),
      fonte('Tubo multistrato 26mm', { fonte: 'listino', supplier_list_id: 'l1', unit_cost: 6 }),
    ]
    const out = suggerisciVoci('tubo', fonti)
    expect(out).toHaveLength(1)
    expect(out[0]!.fonte).toBe('catalogo')
  })

  it('stessa descrizione ma prezzo DIVERSO: sono due scelte, restano entrambe', () => {
    const fonti = [
      fonte('Tubo multistrato 26mm', { unit_price: 12 }),
      fonte('Tubo multistrato 26mm', { unit_price: 9, fonte: 'listino', supplier_list_id: 'l1' }),
    ]
    expect(suggerisciVoci('tubo', fonti)).toHaveLength(2)
  })

  it('a parità di pertinenza vince la descrizione più corta', () => {
    const fonti = [
      fonte('Posa piastrelle bagno completo con preparazione fondo'),
      fonte('Posa piastrelle'),
    ]
    expect(suggerisciVoci('posa', fonti)[0]!.descrizione).toBe('Posa piastrelle')
  })
})
