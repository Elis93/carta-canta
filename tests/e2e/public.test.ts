/**
 * tests/e2e/public.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Test E2E delle pagine PUBBLICHE (senza login): landing ads, registrazione,
 * login, pagine legali, firma rapportino, redirect delle rotte protette.
 *
 * NON richiede credenziali: gira sempre, anche in CI, senza .env reali
 * (le pagine pubbliche non hanno bisogno di una sessione).
 *
 * Server: usa quello indicato da PLAYWRIGHT_BASE_URL (default localhost:3000).
 * Il webServer in playwright.config.ts lo avvia/riusa automaticamente.
 */

import { test, expect } from '@playwright/test'

test.describe('Pagine pubbliche', () => {
  test('/prova — landing ads: claim, CTA, sezioni', async ({ page }) => {
    const resp = await page.goto('/prova')
    expect(resp?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/furgone/i)
    await expect(page.getByRole('link', { name: /provala gratis/i }).first()).toBeVisible()
    await expect(page.locator('body')).toContainText(/gratis durante la beta/i)
  })

  test('/signup — form completo, captcha assente senza chiave', async ({ page }) => {
    const resp = await page.goto('/signup')
    expect(resp?.status()).toBe(200)
    await expect(page.locator('input[name="nome"]')).toBeVisible()
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()
    // Senza NEXT_PUBLIC_TURNSTILE_SITE_KEY il widget non deve caricarsi
    expect(await page.content()).not.toContain('challenges.cloudflare.com')
  })

  test('/login — campo email presente', async ({ page }) => {
    const resp = await page.goto('/login')
    expect(resp?.status()).toBe(200)
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible()
  })

  test('/privacy e /termini rispondono 200', async ({ page }) => {
    expect((await page.goto('/privacy'))?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect((await page.goto('/termini'))?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('/cancella-account cita la via in-app e i 10 anni', async ({ page }) => {
    const resp = await page.goto('/cancella-account')
    expect(resp?.status()).toBe(200)
    await expect(page.locator('body')).toContainText(/Elimina account/i)
    await expect(page.locator('body')).toContainText(/10 anni/i)
  })

  test('/r/[token] — token inesistente o non valido → 404', async ({ page }) => {
    const r1 = await page.goto('/r/11111111-2222-3333-4444-555555555555')
    expect(r1?.status()).toBe(404)
    const r2 = await page.goto('/r/non-un-uuid')
    expect(r2?.status()).toBe(404)
  })

  test('rotta protetta /dashboard → redirect a /login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })
})
