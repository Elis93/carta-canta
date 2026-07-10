'use client'

// ============================================================
// Card "Porta un tuo cliente" nell'area /studio del commercialista.
// Lo studio invita un artigiano per email: l'invito porta a /signup
// con il riferimento allo studio; sarà l'ARTIGIANO, una volta dentro,
// a confermare il collegamento (consenso esplicito).
// ============================================================

import { useState, useTransition } from 'react'
import { Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { inviteClientFromStudioAction } from '@/lib/actions/accountant'

export function InviteClientCard() {
  const [email, setEmail] = useState('')
  const [pending, startTransition] = useTransition()

  function handleInvite() {
    const e = email.trim()
    if (!e) return
    startTransition(async () => {
      const res = await inviteClientFromStudioAction(e)
      if (res?.error) { toast.error(res.error); return }
      toast.success(res?.success ?? 'Invito inviato')
      setEmail('')
    })
  }

  return (
    <div style={{
      background: '#fff', borderRadius: 14, marginTop: 16,
      boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)',
      padding: '14px 15px',
    }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#161616', marginBottom: 3 }}>
        Porta un tuo cliente su Carta Canta
      </div>
      <p style={{ fontSize: 12, color: '#767676', margin: '0 0 12px', lineHeight: 1.5 }}>
        Invita un artigiano che segui: si registra gratis e, quando ti collega,
        vedi qui i suoi documenti e scarichi da solo registro e bilancio.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleInvite() }}
          placeholder="email del tuo cliente"
          autoComplete="off"
          disabled={pending}
          style={{
            flex: 1, minWidth: 0, border: '1px solid #e3e3e6', borderRadius: 10, padding: '0 12px',
            height: 42, boxSizing: 'border-box', fontSize: 14, fontFamily: 'inherit', color: '#161616', background: '#fff', outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={handleInvite}
          disabled={pending || !email.trim()}
          style={{
            flexShrink: 0, border: 'none', borderRadius: 10, background: '#1a1a2e', color: '#fff',
            fontSize: 13, fontWeight: 600, padding: '0 16px', height: 42, cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 6, opacity: (pending || !email.trim()) ? 0.6 : 1,
          }}
        >
          {pending ? <Loader2 size={15} className="animate-spin" /> : <Send size={14} />} Invita
        </button>
      </div>
    </div>
  )
}
