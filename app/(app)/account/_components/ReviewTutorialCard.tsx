'use client'

// ============================================================
// "Rivedi il tutorial" — spostata da Impostazioni › Generale alla
// pagina Account e dati (richiesta Eli 14 lug: più facile da trovare;
// best practice: il rilancio volontario del tour va reso evidente).
// ============================================================

import { GraduationCap } from 'lucide-react'

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  boxShadow: '0 1px 2px rgba(20,20,40,.05), 0 8px 24px -10px rgba(20,20,40,.15)',
  padding: '14px 15px',
}

export function ReviewTutorialCard() {
  return (
    <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 12 }}>
      <GraduationCap size={20} style={{ color: 'var(--cc-muted)', flexShrink: 0 }} aria-hidden />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#161616' }}>Rivedi il tutorial</div>
        <div style={{ fontSize: 12, color: '#767676', marginTop: 1 }}>Il giro guidato dei 5 passi per creare e inviare un preventivo.</div>
      </div>
      <button
        type="button"
        onClick={() => {
          try {
            sessionStorage.setItem('cc_tour_restart', '1')
            sessionStorage.removeItem('cc_tour_step')
          } catch { /* noop */ }
          window.location.href = '/dashboard'
        }}
        style={{ flexShrink: 0, border: '1px solid #e7e7ea', borderRadius: 10, background: '#fff', color: '#1a1a2e', fontSize: 13, fontWeight: 600, padding: '9px 14px', cursor: 'pointer' }}
      >
        Rivedi
      </button>
    </div>
  )
}
