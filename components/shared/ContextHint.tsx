'use client'

// ============================================================
// ContextHint — suggerimento contestuale UNA-TANTUM (2 ago 2026,
// ricerca "progressive disclosure": la guida giusta nel momento
// giusto, non annunci generici). Regole ferree anti-rumore:
// - compare UNA volta sola: chiuso o no, al prossimo mount della
//   stessa pagina non torna (localStorage per-id);
// - MAI più di un hint per sessione (sessionStorage), così due
//   pagine con hint diversi non fanno "fiera del suggerimento";
// - MAI durante il tutorial (body.driver-active).
// Il CHIAMANTE decide la condizione di pertinenza (server-side):
// qui vive solo la disciplina di frequenza.
// ============================================================

import { useEffect, useState } from 'react'
import { X, Lightbulb } from 'lucide-react'

export function ContextHint({ id, children }: { id: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(`cc_hint_${id}`)) return
      const sessione = sessionStorage.getItem('cc_hint_session')
      if (sessione && sessione !== id) return
      if (document.body.classList.contains('driver-active')) return
      sessionStorage.setItem('cc_hint_session', id)
      setShow(true)
    } catch { /* storage bloccato dal browser: nessun hint, nessun danno */ }
  }, [id])

  function dismiss() {
    try { localStorage.setItem(`cc_hint_${id}`, '1') } catch { /* idem */ }
    setShow(false)
  }

  if (!show) return null
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, background: '#fdf9ef', border: '1px solid #e8d6ad', borderRadius: 12, padding: '11px 13px' }}>
      <Lightbulb size={15} style={{ color: '#b0863e', flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, fontSize: 13, color: '#6b5626', lineHeight: 1.5 }}>{children}</div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Chiudi il suggerimento"
        style={{ background: 'none', border: 'none', color: '#b0863e', cursor: 'pointer', padding: 2, flexShrink: 0 }}
      >
        <X size={15} />
      </button>
    </div>
  )
}
