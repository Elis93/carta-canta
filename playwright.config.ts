import { defineConfig, devices } from '@playwright/test'
import fs from 'fs'
import path from 'path'

// Carica .env.local per E2E_TEST_EMAIL / E2E_TEST_PASSWORD.
// Usiamo fs invece di dotenv per non richiedere una dipendenza diretta:
// dotenv non è in package.json (è solo una transitiva di Next.js).
// Le chiavi già presenti nel processo non vengono sovrascritte.
const envLocalPath = path.join(__dirname, '.env.local')
if (fs.existsSync(envLocalPath)) {
  const lines = fs.readFileSync(envLocalPath, 'utf-8').split('\n')
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/)
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim()
    }
  }
}

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.test.ts',

  // retries: 0 — ogni retry consuma un tentativo di login verso il rate limiter
  retries: 0,
  // workers: 1 — i test auth devono essere seriali (stessa sessione browser)
  workers: 1,

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    // Artefatti solo in caso di fallimento — non appesantiscono i run verdi
    screenshot: 'only-on-failure',
    trace:      'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Se next dev è già in ascolto su :3000 lo riusa.
  // Se non lo è, lo avvia (attendi ~30s al primo run).
  webServer: {
    command: 'npm run dev',
    url:     'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
