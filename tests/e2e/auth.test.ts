/**
 * tests/e2e/auth.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Test E2E minimale per il flow auth:
 *   login → dashboard → logout → /login
 *
 * Prerequisiti:
 *   - E2E_TEST_EMAIL / E2E_TEST_PASSWORD in .env.local
 *   - L'utente test deve avere completato l'onboarding (ragione_sociale compilata)
 *
 * Rate limit: ogni run consuma 1 dei 5 login disponibili per IP/15 min.
 * Non superare 5 run consecutivi ravvicinati.
 */

import { test, expect } from '@playwright/test'

const EMAIL    = process.env.E2E_TEST_EMAIL    ?? ''
const PASSWORD = process.env.E2E_TEST_PASSWORD ?? ''

test.beforeAll(() => {
  if (!EMAIL || !PASSWORD) {
    throw new Error(
      'Aggiungi E2E_TEST_EMAIL e E2E_TEST_PASSWORD in .env.local prima di eseguire i test E2E.'
    )
  }
})

test.describe('Auth flow', () => {
  test('login → dashboard → logout → /login', async ({ page }) => {
    // ── 1. Pagina di login ───────────────────────────────────────────────────
    await page.goto('/login')
    await expect(page).toHaveURL('/login')

    // Attendi che React abbia completato l'idratazione prima di interagire
    await page.waitForLoadState('networkidle')

    // "Bentornato" è il CardTitle (shadcn lo renderizza come <div>, non <h2>)
    await expect(page.getByText('Bentornato')).toBeVisible()

    // ── 2. Compila e invia il form ───────────────────────────────────────────
    // Selettori diretti per id — più robusti in headless rispetto a getByLabel
    await page.locator('#email').fill(EMAIL)
    await page.locator('#password').fill(PASSWORD)

    // Verifica esplicita che i valori siano stati scritti correttamente
    // (catchs env var loading issues prima di sprecare un tentativo di login)
    await expect(page.locator('#email')).toHaveValue(EMAIL)
    await expect(page.locator('#password')).toHaveValue(PASSWORD)

    await page.getByRole('button', { name: 'Accedi' }).click()

    // ── 3. Redirect alla dashboard ───────────────────────────────────────────
    // loginAction restituisce { success: '/dashboard' } e il client fa router.push().
    // waitForURL attende la navigazione client-side completata.
    await page.waitForURL('**/dashboard', { timeout: 15_000 })
    await expect(page).toHaveURL('/dashboard')

    // ── 4. Apri il menu utente (avatar dropdown) ─────────────────────────────
    // Radix DropdownMenuTrigger imposta aria-haspopup="menu" sull'elemento trigger.
    // In dev mode Next.js inietta un pulsante Dev Tools con lo stesso attributo:
    // scopo il selettore all'interno del <header> per escluderlo.
    const avatarTrigger = page.locator('header button[aria-haspopup="menu"]')
    await expect(avatarTrigger).toBeVisible()
    await avatarTrigger.click()

    // ── 5. Clicca "Esci" nel menu ────────────────────────────────────────────
    // Radix DropdownMenuItem renderizza role="menuitem".
    // LogoutButton renderizza: <DropdownMenuItem>…Esci</DropdownMenuItem>
    const logoutItem = page.getByRole('menuitem', { name: 'Esci' })
    await expect(logoutItem).toBeVisible()
    await logoutItem.click()

    // ── 6. Redirect a /login dopo logout ─────────────────────────────────────
    // logoutAction: supabase.signOut() → redirect('/login')
    await page.waitForURL('**/login', { timeout: 10_000 })
    await expect(page).toHaveURL('/login')
  })
})
