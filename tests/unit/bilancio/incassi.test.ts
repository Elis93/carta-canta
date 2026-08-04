import { describe, it, expect } from 'vitest'
import { incassiFromDoc } from '@/lib/bilancio/incassi'

const m = (iso: string) => `${iso}T12:00:00.000Z`

describe('incassiFromDoc — storia degli incassi per il Bilancio', () => {
  it('acconto e saldo in MESI diversi restano nei rispettivi mesi (niente migrazione)', () => {
    const doc = {
      payment_status: 'paid',
      paid_amount: 1000,
      paid_at: m('2026-02-10'), // sovrascritto col saldo
      document_log: [
        { type: 'payment', kind: 'acconto', at: m('2026-01-05'), amount: 400 },
        { type: 'payment', kind: 'saldo', at: m('2026-02-10'), amount: 600 },
      ],
    }
    const ev = incassiFromDoc(doc)
    expect(ev).toHaveLength(2)
    expect(ev[0].when.getUTCMonth()).toBe(0) // gennaio
    expect(ev[0].amount).toBe(400)
    expect(ev[1].when.getUTCMonth()).toBe(1) // febbraio
    expect(ev[1].amount).toBe(600)
    // Il totale resta corretto
    expect(ev.reduce((s, e) => s + e.amount, 0)).toBe(1000)
  })

  it('un reset sottrae nel mese in cui è avvenuto (netto corretto)', () => {
    const doc = {
      payment_status: 'unpaid',
      paid_amount: null,
      paid_at: null,
      document_log: [
        { type: 'payment', kind: 'acconto', at: m('2026-03-01'), amount: 500 },
        { type: 'payment_reset', at: m('2026-03-02'), amount: 500, reason: 'correzione' },
      ],
    }
    const ev = incassiFromDoc(doc)
    expect(ev.reduce((s, e) => s + e.amount, 0)).toBe(0)
  })

  it('correzione poi nuovo acconto: netto = il nuovo importo', () => {
    const doc = {
      payment_status: 'partial',
      paid_amount: 700,
      document_log: [
        { type: 'payment', kind: 'acconto', at: m('2026-04-01'), amount: 500 },
        { type: 'payment_reset', at: m('2026-04-01'), amount: 500, reason: 'correzione' },
        { type: 'payment', kind: 'acconto', at: m('2026-04-02'), amount: 700 },
      ],
    }
    expect(incassiFromDoc(doc).reduce((s, e) => s + e.amount, 0)).toBe(700)
  })

  it('documento storico senza voci di incasso nel log → singolo evento dai campi (fallback)', () => {
    const doc = {
      payment_status: 'paid',
      paid_amount: 900,
      paid_at: m('2026-05-20'),
      total: 900,
      document_log: [{ type: 'sent', at: m('2026-05-01') }], // nessun 'payment'
    }
    const ev = incassiFromDoc(doc)
    expect(ev).toHaveLength(1)
    expect(ev[0].amount).toBe(900)
    expect(ev[0].when.getUTCMonth()).toBe(4) // maggio
  })

  it('fallback: fattura accepted senza paid_amount → usa il totale', () => {
    const doc = {
      payment_status: null,
      paid_amount: null,
      accepted_at: m('2026-06-15'),
      total: 1200,
      document_log: null,
    }
    const ev = incassiFromDoc(doc)
    expect(ev).toHaveLength(1)
    expect(ev[0].amount).toBe(1200)
  })

  it('fallback partial: usa paid_amount, non il totale', () => {
    const doc = {
      payment_status: 'partial',
      paid_amount: 300,
      paid_at: m('2026-07-10'),
      total: 1000,
      document_log: undefined,
    }
    expect(incassiFromDoc(doc)[0].amount).toBe(300)
  })

  it('RETE DI SICUREZZA: acconto pre-log (trasferito/storico) + saldo loggato → il totale NON perde l’acconto', () => {
    // Il caso della review 4 ago: acconto 400 registrato SOLO nei campi
    // denormalizzati (conversione preventivo→fattura pre-fix, o incasso
    // precedente alla nascita del log) e poi saldo 600 che scrive nel log
    // SOLO il residuo. Contare "solo il log" dava 600 invece di 1000.
    const doc = {
      payment_status: 'paid',
      paid_amount: 1000,
      paid_at: m('2026-02-10'),
      total: 1000,
      document_log: [
        { type: 'payment', kind: 'saldo', at: m('2026-02-10'), amount: 600 },
      ],
    }
    const ev = incassiFromDoc(doc)
    expect(ev.reduce((s, e) => s + e.amount, 0)).toBe(1000)
    // Il saldo resta nel suo mese; la differenza è reintegrata
    expect(ev.some((e) => e.amount === 600 && e.kind === 'saldo')).toBe(true)
    expect(ev.some((e) => e.amount === 400)).toBe(true)
  })

  it('rete di sicurezza NON scatta quando il log è completo (niente doppio conteggio)', () => {
    const doc = {
      payment_status: 'paid',
      paid_amount: 1000,
      paid_at: m('2026-02-10'),
      document_log: [
        { type: 'payment', kind: 'acconto', at: m('2026-01-05'), amount: 400 },
        { type: 'payment', kind: 'saldo', at: m('2026-02-10'), amount: 600 },
      ],
    }
    const ev = incassiFromDoc(doc)
    expect(ev).toHaveLength(2)
    expect(ev.reduce((s, e) => s + e.amount, 0)).toBe(1000)
  })

  it('rete di sicurezza con reset in mezzo: confronto sul NETTO, niente reintegro sbagliato', () => {
    // payment 500, reset 500, payment 700 → paid_amount 700 = netto 700 → nessun delta
    const doc = {
      payment_status: 'partial',
      paid_amount: 700,
      document_log: [
        { type: 'payment', kind: 'acconto', at: m('2026-04-01'), amount: 500 },
        { type: 'payment_reset', at: m('2026-04-01'), amount: 500 },
        { type: 'payment', kind: 'acconto', at: m('2026-04-02'), amount: 700 },
      ],
    }
    expect(incassiFromDoc(doc).reduce((s, e) => s + e.amount, 0)).toBe(700)
  })

  it('paid_amount MINORE del netto eventi (reset best-effort fallito): nessuna correzione negativa inventata', () => {
    const doc = {
      payment_status: 'partial',
      paid_amount: 200,
      document_log: [
        { type: 'payment', kind: 'acconto', at: m('2026-05-01'), amount: 500 },
      ],
    }
    // Non si sottrae nulla che il log non racconti: restano i 500 del log
    expect(incassiFromDoc(doc).reduce((s, e) => s + e.amount, 0)).toBe(500)
  })

  it('solo reset senza alcun payment (anomalo): nessun evento', () => {
    const doc = {
      payment_status: 'unpaid',
      paid_amount: null,
      document_log: [{ type: 'payment_reset', at: m('2026-08-01'), amount: 200 }],
    }
    expect(incassiFromDoc(doc)).toEqual([])
  })

  it('voci payment senza amount valido non producono eventi fantasma', () => {
    const doc = {
      payment_status: 'paid',
      paid_amount: 0,
      document_log: [{ type: 'payment', kind: 'saldo', at: m('2026-09-01'), amount: 0 }],
    }
    // Payment con importo 0 → nessun evento prodotto, somma 0
    const ev = incassiFromDoc(doc)
    expect(ev.reduce((s, e) => s + e.amount, 0)).toBe(0)
  })
})
