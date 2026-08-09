import { describe, it, expect } from 'vitest'
import { ordinaPerUrgenza, gruppoUrgenza, GRUPPO, type DocOrdinabile } from '@/lib/documents/ordina-scadenza'

// L'ordine l'ha dettato Eli (9 ago): prima ciò che richiede un'azione, e più
// è in ritardo più sta in alto. Il vecchio `expires_at ASC` metteva una
// fattura GIÀ PAGATA sopra una ancora da incassare.

const d = (id: string, status: string, expires?: string | null, updated?: string | null): DocOrdinabile & { id: string } =>
  ({ id, status, expires_at: expires ?? null, updated_at: updated ?? null, created_at: '2026-01-01T00:00:00Z' })

const ids = (docs: Array<{ id: string }>) => docs.map((x) => x.id)

describe('gruppoUrgenza', () => {
  it('mette ogni stato nella sua fascia', () => {
    expect(gruppoUrgenza(d('a', 'expired'))).toBe(GRUPPO.scadute)
    expect(gruppoUrgenza(d('a', 'sent'))).toBe(GRUPPO.inAttesa)
    expect(gruppoUrgenza(d('a', 'viewed'))).toBe(GRUPPO.inAttesa)
    expect(gruppoUrgenza(d('a', 'draft'))).toBe(GRUPPO.bozze)
    expect(gruppoUrgenza(d('a', 'accepted'))).toBe(GRUPPO.chiuse)
    expect(gruppoUrgenza(d('a', 'rejected'))).toBe(GRUPPO.annullate)
  })

  it('uno stato sconosciuto NON si intrufola fra le cose urgenti', () => {
    expect(gruppoUrgenza(d('a', 'qualcosa_di_nuovo'))).toBe(GRUPPO.annullate)
  })
})

describe('ordinaPerUrgenza — l’ordine chiesto da Eli', () => {
  it('scadute, poi in attesa, poi bozze, poi pagate, infine annullate', () => {
    const lista = [
      d('annullata', 'rejected', '2026-08-01'),
      d('pagata',    'accepted', '2026-08-02'),
      d('bozza',     'draft',    null),
      d('inviata',   'sent',     '2026-09-30'),
      d('scaduta',   'expired',  '2026-07-01'),
    ]
    expect(ids(ordinaPerUrgenza(lista))).toEqual(['scaduta', 'inviata', 'bozza', 'pagata', 'annullata'])
  })

  it('IL CASO CHE HA FATTO NASCERE TUTTO: una pagata con scadenza vicina non passa davanti a una da incassare', () => {
    const lista = [
      d('pagata_scadenza_vicina',  'accepted', '2026-08-10'),
      d('da_incassare_piu_lontana', 'sent',    '2026-12-31'),
    ]
    // Col vecchio `expires_at ASC` l'ordine era esattamente il contrario.
    expect(ids(ordinaPerUrgenza(lista))).toEqual(['da_incassare_piu_lontana', 'pagata_scadenza_vicina'])
  })

  it('fra le SCADUTE viene prima quella più in ritardo', () => {
    const lista = [
      d('in_ritardo_di_poco', 'expired', '2026-08-05'),
      d('in_ritardo_da_mesi', 'expired', '2026-03-01'),
    ]
    expect(ids(ordinaPerUrgenza(lista))).toEqual(['in_ritardo_da_mesi', 'in_ritardo_di_poco'])
  })

  it('fra le IN ATTESA viene prima quella che scade prima', () => {
    const lista = [
      d('scade_a_dicembre', 'viewed', '2026-12-01'),
      d('scade_domani',     'sent',   '2026-08-10'),
    ]
    expect(ids(ordinaPerUrgenza(lista))).toEqual(['scade_domani', 'scade_a_dicembre'])
  })

  it('chi non ha scadenza va in FONDO alla sua fascia, non in cima', () => {
    // `null` non vuol dire "scade subito".
    const lista = [
      d('senza_scadenza', 'sent', null),
      d('con_scadenza',   'sent', '2026-12-31'),
    ]
    expect(ids(ordinaPerUrgenza(lista))).toEqual(['con_scadenza', 'senza_scadenza'])
  })

  it('fra le PAGATE conta il più recente, non la scadenza', () => {
    const lista = [
      d('pagata_vecchia', 'accepted', '2026-01-31', '2026-02-01T10:00:00Z'),
      d('pagata_ieri',    'accepted', '2026-12-31', '2026-08-08T10:00:00Z'),
    ]
    expect(ids(ordinaPerUrgenza(lista))).toEqual(['pagata_ieri', 'pagata_vecchia'])
  })

  it('non modifica l’elenco di partenza', () => {
    const lista = [d('b', 'accepted'), d('a', 'expired')]
    const copia = [...lista]
    ordinaPerUrgenza(lista)
    expect(lista).toEqual(copia)
  })

  it('l’ordine è STABILE: due caricamenti danno la stessa lista', () => {
    const lista = [
      d('x', 'sent', '2026-09-01'),
      d('y', 'sent', '2026-09-01'),
      d('z', 'sent', '2026-09-01'),
    ]
    expect(ids(ordinaPerUrgenza(lista))).toEqual(ids(ordinaPerUrgenza(lista)))
  })
})
