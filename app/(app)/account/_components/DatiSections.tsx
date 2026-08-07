'use client'

// ============================================================
// Account e sicurezza — due sezioni che si alternano dalle pillole in cima
// alla pagina (Eli, 7 ago: "fare due pagine che si alternano cliccando su
// uno o l'altro titolo").
//
//  · DATI      → portabilità (art. 20 GDPR), commercialista, tutorial,
//                cancellazione dell'account (art. 17).
//  · SICUREZZA → blocco dell'app con impronta e chiusura delle sessioni.
//
// ⚠️ Il blocco con impronta stava in Impostazioni › Generale, insieme a
// ragione sociale e indirizzo: sono due materie diverse — quelli sono i dati
// dell'ATTIVITÀ, questo è l'accesso all'ACCOUNT.
// ============================================================

import { Download } from 'lucide-react'
import { ExportCommercialistaButton } from '@/components/shared/ExportCommercialistaButton'
import { AccountantCard } from '@/components/shared/AccountantCard'
import { DeleteAccountCard } from '@/components/shared/DeleteAccountCard'
import { BiometricToggle } from '@/components/security/BiometricToggle'
import { ReviewTutorialCard } from './ReviewTutorialCard'
import { SignOutEverywhereCard } from './SignOutEverywhereCard'

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  boxShadow: '0 1px 2px rgba(20,20,40,.05), 0 8px 24px -10px rgba(20,20,40,.15)',
  padding: '14px 15px',
}

export function DatiSections({ section = 'dati' }: { section?: 'dati' | 'sicurezza' }) {
  if (section === 'sicurezza') {
    return (
      <div>
        {/* ── Blocco dell'app (impronta / volto) ── */}
        <BiometricToggle />

        {/* ── Chiudi tutte le sessioni aperte ── */}
        <SignOutEverywhereCard />
      </div>
    )
  }

  return (
    <div>
      {/* ── I tuoi dati (portabilità GDPR) ── */}
      <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Download size={20} style={{ color: 'var(--cc-muted)', flexShrink: 0 }} aria-hidden />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#161616' }}>Scarica i tuoi dati</div>
          <div style={{ fontSize: 12, color: '#767676', marginTop: 1 }}>
            Un file con account, clienti, preventivi, fatture e spese.
          </div>
        </div>
        <a
          href="/api/account/export"
          style={{ flexShrink: 0, border: '1px solid #e7e7ea', borderRadius: 10, background: '#fff', color: '#1a1a2e', fontSize: 13, fontWeight: 600, padding: '9px 14px', textDecoration: 'none' }}
        >
          Scarica
        </a>
      </div>

      {/* ── Pacchetto per il commercialista (registro fatture CSV) ── */}
      <ExportCommercialistaButton variant="card" />

      {/* ── Invita il tuo commercialista (accesso read-only) ── */}
      <AccountantCard />

      {/* ── Rivedi il tutorial (tour primo accesso) ── */}
      <div style={{ marginTop: 16 }}>
        <ReviewTutorialCard />
      </div>

      {/* ── Elimina account (GDPR art. 17) ── */}
      <DeleteAccountCard />
    </div>
  )
}
