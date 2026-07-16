'use client'

// ============================================================
// Account e dati — export, commercialista, tutorial e cancellazione
// account. Era la tab "Dati" di Impostazioni: spostata in una pagina
// propria (richiesta Eli 14 lug: 6 tab schiacciavano la barra di
// Impostazioni su mobile).
// ============================================================

import { Download } from 'lucide-react'
import { ExportCommercialistaButton } from '@/components/shared/ExportCommercialistaButton'
import { AccountantCard } from '@/components/shared/AccountantCard'
import { DeleteAccountCard } from '@/components/shared/DeleteAccountCard'
import { ReviewTutorialCard } from './ReviewTutorialCard'

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  boxShadow: '0 1px 2px rgba(20,20,40,.05), 0 8px 24px -10px rgba(20,20,40,.15)',
  padding: '14px 15px',
}

export function DatiSections() {
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
