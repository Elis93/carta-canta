'use client'

// ============================================================
// Form di contatto della pagina Aiuto: textarea + invio diretto
// (server action → email a supporto@). Sostituisce il mailto:
// che non funziona se sul dispositivo non c'è un client di posta.
// ============================================================

import { useState, useTransition } from 'react'
import { Loader2, Send, Check } from 'lucide-react'
import { toast } from 'sonner'
import { sendSupportMessageAction } from '@/lib/actions/support'

export function SupportForm() {
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleSend() {
    const m = message.trim()
    if (!m) return
    startTransition(async () => {
      const res = await sendSupportMessageAction(m)
      if (res?.error) { toast.error(res.error); return }
      setSent(true)
      setMessage('')
      toast.success(res?.success ?? 'Messaggio inviato')
    })
  }

  if (sent) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#eef7f1', border: '1px solid #cfe8da', borderRadius: 10, padding: '11px 13px', marginTop: 12 }}>
        <Check size={17} style={{ color: '#2f8a63', flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: '#2f6a4f', lineHeight: 1.5 }}>
          Messaggio inviato. Ti rispondiamo alla tua email entro 1 giorno lavorativo.
        </span>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 12 }}>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Descrivi il problema o la domanda. Rispondiamo alla email del tuo account."
        rows={4}
        maxLength={2000}
        disabled={pending}
        style={{
          width: '100%', boxSizing: 'border-box', border: '1px solid #e3e3e6', borderRadius: 10,
          padding: '11px 12px', fontSize: 14, fontFamily: 'inherit', color: '#161616',
          background: '#fff', outline: 'none', resize: 'none', lineHeight: 1.55,
        }}
      />
      {message.trim().length > 0 && message.trim().length < 10 && (
        <p style={{ fontSize: 12, color: '#8a887f', margin: '5px 2px 0' }}>
          Ancora qualche parola: servono almeno 10 caratteri.
        </p>
      )}
      <button
        type="button"
        onClick={handleSend}
        disabled={pending || message.trim().length < 10}
        style={{
          marginTop: 9, width: '100%', height: 46, border: 'none', borderRadius: 11,
          background: '#1a1a2e', color: '#fff', fontSize: 14, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          cursor: 'pointer', fontFamily: 'inherit',
          opacity: (pending || message.trim().length < 10) ? 0.6 : 1,
          boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)',
        }}
      >
        {pending ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
        {pending ? 'Invio…' : 'Invia il messaggio'}
      </button>
    </div>
  )
}
