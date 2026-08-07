'use client'

// ============================================================
// Account e sicurezza — TRE sezioni che si alternano dalle pillole in cima
// (Eli, 7 ago: "farei una sezione ulteriore account e mettere lì le cose
// account invece che in dati").
//
//  · ACCOUNT   → chi sei e come chiudere il conto: l'indirizzo con cui
//                entri, e l'eliminazione dell'account (art. 17 GDPR).
//  · SICUREZZA → proteggere l'accesso: blocco con impronta e chiusura di
//                tutte le sessioni aperte.
//  · DATI      → i tuoi dati e chi li usa: esportazione (art. 20 GDPR),
//                pacchetto e accesso per il commercialista.
//
// ⚠️ Tre sezioni e non due perché ognuna risponde a una domanda diversa:
// "chi sono", "come mi proteggo", "dove sono i miei dati". Metterle insieme
// obbligava a leggere tutte le card per trovarne una.
//
// ⚠️ Il giro guidato NON sta più qui: chi cerca un tutorial cerca aiuto, e
// ora vive in cima ad /aiuto insieme alle guide delle sezioni.
// ============================================================

import { Download, Mail } from 'lucide-react'
import { ExportCommercialistaButton } from '@/components/shared/ExportCommercialistaButton'
import { AccountantCard } from '@/components/shared/AccountantCard'
import { DeleteAccountCard } from '@/components/shared/DeleteAccountCard'
import { BiometricToggle } from '@/components/security/BiometricToggle'
import { SignOutEverywhereCard } from './SignOutEverywhereCard'

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  boxShadow: '0 1px 2px rgba(20,20,40,.05), 0 8px 24px -10px rgba(20,20,40,.15)',
  padding: '14px 15px',
}

export type SezioneAccount = 'account' | 'sicurezza' | 'dati'

export function DatiSections({
  section = 'account',
  userEmail,
}: {
  section?: SezioneAccount
  userEmail?: string
}) {
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

  if (section === 'dati') {
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
      </div>
    )
  }

  // ── ACCOUNT ──
  return (
    <div>
      <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Mail size={20} style={{ color: 'var(--cc-muted)', flexShrink: 0 }} aria-hidden />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--cc-muted)' }}>
            Indirizzo di accesso
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#161616', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {userEmail || '—'}
          </div>
          <div style={{ fontSize: 12, color: '#767676', marginTop: 3, lineHeight: 1.45 }}>
            È l&rsquo;email con cui entri nell&rsquo;app. Arrivano qui anche gli avvisi di
            sicurezza, per esempio se cambia il tuo IBAN.
          </div>
        </div>
      </div>

      {/* ── Elimina account (GDPR art. 17) ── */}
      <DeleteAccountCard />
    </div>
  )
}
