// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  CONSENT_KEY, CONSENT_EVENT, getConsent, setConsent,
} from '@/lib/consent'

// Consenso cookie: la scelta va memorizzata, riletta e notificata; un valore
// corrotto in storage non deve "contare" come consenso.

describe('getConsent / setConsent', () => {
  beforeEach(() => { localStorage.clear() })

  it('null quando l\'utente non ha ancora scelto', () => {
    expect(getConsent()).toBeNull()
  })

  it('round-trip: setConsent scrive e getConsent rilegge', () => {
    setConsent('granted')
    expect(getConsent()).toBe('granted')
    expect(localStorage.getItem(CONSENT_KEY)).toBe('granted')

    setConsent('denied')
    expect(getConsent()).toBe('denied')
  })

  it('un valore corrotto in storage → null (non conta come consenso)', () => {
    localStorage.setItem(CONSENT_KEY, 'maybe')
    expect(getConsent()).toBeNull()
  })

  it('setConsent emette l\'evento di consenso col dettaglio corretto', () => {
    const spy = vi.fn()
    window.addEventListener(CONSENT_EVENT, spy as EventListener)
    setConsent('granted')
    expect(spy).toHaveBeenCalledOnce()
    const ev = spy.mock.calls[0][0] as CustomEvent
    expect(ev.detail).toEqual({ consent: 'granted' })
    window.removeEventListener(CONSENT_EVENT, spy as EventListener)
  })
})

describe('analyticsAllowed', () => {
  beforeEach(() => { vi.resetModules(); localStorage.clear() })
  afterEach(() => { vi.unstubAllEnvs() })

  it('false se PostHog NON è configurato, anche col consenso', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', '')
    const { setConsent: set, analyticsAllowed } = await import('@/lib/consent')
    set('granted')
    expect(analyticsAllowed()).toBe(false)
  })

  it('true SOLO se PostHog configurato E consenso granted', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test_key')
    const { setConsent: set, analyticsAllowed } = await import('@/lib/consent')
    set('granted')
    expect(analyticsAllowed()).toBe(true)
    set('denied')
    expect(analyticsAllowed()).toBe(false)
  })
})
