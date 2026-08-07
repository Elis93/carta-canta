'use client'

// ============================================================
// "Rivedi il tutorial" — spostata da Impostazioni › Generale alla
// pagina Account e dati (richiesta Eli 14 lug: più facile da trovare;
// best practice: il rilancio volontario del tour va reso evidente).
//
// Dal 7 ago la card contiene DUE cose (richiesta Eli: "questo tutorial poi
// lo può rivedere insieme all'altro tutorial che abbiamo già"):
//  · il giro guidato del primo accesso — creare e mandare un preventivo;
//  · le GUIDE DI SEZIONE, che spiegano le funzioni di una singola pagina e
//    si aprono da sole la prima volta che ci entri.
// Stanno insieme perché chi cerca aiuto cerca "il tutorial", non sa che ce
// n'è più d'uno: due card separate lo costringerebbero a indovinare quale.
// ============================================================

import { GraduationCap, Compass, ArrowRight } from 'lucide-react'
import { SECTION_TOURS, SECTION_TOUR_REQUEST } from '@/components/tour/section-tours'

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  boxShadow: '0 1px 2px rgba(20,20,40,.05), 0 8px 24px -10px rgba(20,20,40,.15)',
  padding: '14px 15px',
}

export function ReviewTutorialCard() {
  function apriGuida(key: string, path: string) {
    try {
      sessionStorage.setItem(SECTION_TOUR_REQUEST, key)
    } catch { /* senza storage la guida non parte: si apre comunque la pagina */ }
    window.location.href = path
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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

      <div style={{ height: 1, background: '#eee', margin: '13px -15px' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
        <Compass size={16} style={{ color: 'var(--cc-muted)', flexShrink: 0 }} aria-hidden />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#161616' }}>Guide delle sezioni</span>
      </div>
      <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.5, marginBottom: 10 }}>
        Si aprono da sole la prima volta che entri in una sezione. Da qui le rivedi quando vuoi.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Object.entries(SECTION_TOURS).map(([key, tour]) => (
          <button
            key={key}
            type="button"
            onClick={() => apriGuida(key, tour.path)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
              border: '1px solid #e7e7ea', borderRadius: 11, background: '#fff',
              padding: '10px 12px', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: '#1a1a2e' }}>{tour.label}</span>
              <span style={{ display: 'block', fontSize: 12, color: '#767676', marginTop: 1 }}>{tour.sub}</span>
            </span>
            <ArrowRight size={15} style={{ color: 'var(--cc-muted)', flexShrink: 0 }} aria-hidden />
          </button>
        ))}
      </div>
    </div>
  )
}
