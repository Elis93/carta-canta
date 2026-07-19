import { describe, it, expect } from 'vitest'
import { distanceKm } from '@/lib/geocode'

describe('distanceKm (Haversine)', () => {
  it('è 0 tra lo stesso punto', () => {
    expect(distanceKm(45.4384, 10.9916, 45.4384, 10.9916)).toBeCloseTo(0, 5)
  })

  it('Verona → Milano ≈ 140 km (±10)', () => {
    const d = distanceKm(45.4384, 10.9916, 45.4642, 9.19)
    expect(d).toBeGreaterThan(130)
    expect(d).toBeLessThan(150)
  })

  it('Verona → Vicenza ≈ 44 km (±8)', () => {
    const d = distanceKm(45.4384, 10.9916, 45.5455, 11.5353)
    expect(d).toBeGreaterThan(36)
    expect(d).toBeLessThan(52)
  })

  it('è simmetrica', () => {
    const a = distanceKm(45.07, 7.69, 45.46, 9.19)
    const b = distanceKm(45.46, 9.19, 45.07, 7.69)
    expect(a).toBeCloseTo(b, 6)
  })
})
