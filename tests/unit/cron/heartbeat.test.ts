import { describe, it, expect } from 'vitest'
import { isCronStale, CRON_JOBS } from '@/lib/cron/heartbeat'

const H = 3_600_000 // ms in un'ora
const NOW = Date.UTC(2026, 7, 15, 12, 0, 0)
const hoursAgo = (h: number) => new Date(NOW - h * H).toISOString()

describe('isCronStale', () => {
  it('cold-start: mai battuto (null) → NON è fermo (nessun falso allarme al primo deploy)', () => {
    expect(isCronStale(null, 3, NOW)).toBe(false)
  })

  it('battito recente entro la soglia → non fermo', () => {
    expect(isCronStale(hoursAgo(1), 3, NOW)).toBe(false)
  })

  it('battito oltre la soglia → fermo', () => {
    expect(isCronStale(hoursAgo(5), 3, NOW)).toBe(true)
  })

  it('esattamente alla soglia → non fermo (serve superarla)', () => {
    expect(isCronStale(hoursAgo(3), 3, NOW)).toBe(false)
  })

  it('data illeggibile → non inventa un allarme', () => {
    expect(isCronStale('non-una-data', 3, NOW)).toBe(false)
  })

  it('cron mensile: un battito di 20 giorni fa è ancora fresco', () => {
    const mensile = CRON_JOBS.find((c) => c.name === 'referral')!
    expect(isCronStale(hoursAgo(24 * 20), mensile.maxAgeHours, NOW)).toBe(false)
  })

  it('cron mensile: 35 giorni senza battito → fermo', () => {
    const mensile = CRON_JOBS.find((c) => c.name === 'orphan-files')!
    expect(isCronStale(hoursAgo(24 * 35), mensile.maxAgeHours, NOW)).toBe(true)
  })
})

describe('CRON_JOBS registry', () => {
  it('sorveglia i quattro cron di produzione, non sé stesso', () => {
    const names = CRON_JOBS.map((c) => c.name)
    expect(names).toEqual(['sdi-auto', 'expire-documents', 'referral', 'orphan-files'])
    expect(names).not.toContain('health') // il guardiano non sorveglia sé stesso
  })

  it('ogni nome è una stringa «da codice» (vincolo meta della 072)', () => {
    for (const c of CRON_JOBS) expect(c.name).toMatch(/^[A-Za-z0-9_.:-]{1,40}$/)
  })
})
