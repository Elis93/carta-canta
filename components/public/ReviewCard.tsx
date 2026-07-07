'use client'

// ============================================================
// ReviewCard — "Com'è andata?" sulla pagina pubblica del cliente
// (mockup crescita §2). SOLO domande chiuse: 4 valutazioni a stelle
// + "Lo consiglieresti?" Sì/No. Nessun testo libero, nessun account.
// Compare solo a fattura pagata per intero.
// ============================================================

import { useState } from 'react'
import { Star, CheckCircle2 } from 'lucide-react'

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

const QUESTIONS = [
  { key: 'rating_puntualita', label: 'Puntualità' },
  { key: 'rating_qualita', label: 'Qualità del lavoro' },
  { key: 'rating_preventivo', label: 'Rispetto del preventivo' },
  { key: 'rating_pulizia', label: 'Pulizia del cantiere' },
] as const

type RatingKey = (typeof QUESTIONS)[number]['key']

function StarRow({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <span style={{ display: 'inline-flex' }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={n === 1 ? '1 stella' : `${n} stelle`}
          onClick={() => onChange(n)}
          // padding 6 → area di tocco ~32px per stella (le dita in cantiere)
          style={{ background: 'none', border: 'none', padding: 6, cursor: 'pointer', display: 'flex' }}
        >
          <Star size={20} fill={n <= value ? '#c9a44c' : 'none'} style={{ color: n <= value ? '#c9a44c' : '#d8d8dc' }} />
        </button>
      ))}
    </span>
  )
}

export function ReviewCard({ token, workspaceName }: { token: string; workspaceName: string }) {
  const [ratings, setRatings] = useState<Record<RatingKey, number>>({
    rating_puntualita: 0,
    rating_qualita: 0,
    rating_preventivo: 0,
    rating_pulizia: 0,
  })
  const [recommends, setRecommends] = useState<boolean | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setError(null)
    if (QUESTIONS.some((q) => ratings[q.key] === 0) || recommends === null) {
      setError('Rispondi a tutte le domande per inviare.')
      return
    }
    setSending(true)
    try {
      const res = await fetch(`/api/p/${token}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...ratings, recommends }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Invio non riuscito. Riprova.')
        return
      }
      setSent(true)
    } catch {
      setError('Errore di rete. Controlla la connessione e riprova.')
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div style={{ background: '#fff', borderRadius: 14, padding: '18px 15px', boxShadow: SH, textAlign: 'center' }}>
        <CheckCircle2 size={26} style={{ color: '#2f8a63', display: 'inline-block' }} />
        <div style={{ fontSize: 14, fontWeight: 700, color: '#161616', marginTop: 6 }}>Grazie per la recensione!</div>
        <p style={{ fontSize: 12, color: '#767676', marginTop: 4, lineHeight: 1.5 }}>
          Comparirà nelle medie del profilo di {workspaceName} col tuo nome puntato.
        </p>
      </div>
    )
  }

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 14, boxShadow: SH }}>
      <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64' }}>
        Com&rsquo;è andata?
      </div>
      <p style={{ fontSize: 13, color: '#55534b', margin: '6px 0 4px' }}>
        Rispondi a 5 domande rapide. Niente testo da scrivere.
      </p>

      {QUESTIONS.map((q, i) => (
        <div key={q.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 0', borderBottom: i < QUESTIONS.length - 1 ? '0.5px solid #eee' : 'none' }}>
          <span style={{ fontSize: 13, color: '#161616' }}>{q.label}</span>
          <StarRow value={ratings[q.key]} onChange={(n) => setRatings((prev) => ({ ...prev, [q.key]: n }))} />
        </div>
      ))}

      <div style={{ padding: '11px 0 13px' }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#161616', marginBottom: 8 }}>Lo consiglieresti?</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {([true, false] as const).map((v) => (
            <button
              key={String(v)}
              type="button"
              onClick={() => setRecommends(v)}
              style={{
                flex: 1, height: 40, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                border: recommends === v ? '1.5px solid #1a1a2e' : '1px solid #e3e3e6',
                background: recommends === v ? '#1a1a2e' : '#fff',
                color: recommends === v ? '#fff' : '#55534b',
              }}
            >
              {v ? 'Sì' : 'No'}
            </button>
          ))}
        </div>
      </div>

      {error && <p style={{ fontSize: 13, color: '#dc2626', fontWeight: 500, marginBottom: 10 }}>{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={sending}
        style={{
          width: '100%', height: 46, border: 'none', borderRadius: 12, background: '#1a1a2e', color: '#fff',
          fontSize: 14, fontWeight: 600, boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)',
          cursor: sending ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: sending ? 0.7 : 1,
        }}
      >
        {sending ? 'Invio…' : 'Invia recensione'}
      </button>
      <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.5, marginTop: 10 }}>
        ✓ Recensione verificata — sbloccata solo dopo un lavoro fatturato e pagato. Inviandola
        acconsenti alla pubblicazione delle valutazioni con il tuo nome puntato (es. &ldquo;Mario R.&rdquo;)
        e il comune. Vedi l&rsquo;<a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#1a1a2e', fontWeight: 600 }}>informativa privacy</a>.
      </p>
    </div>
  )
}
