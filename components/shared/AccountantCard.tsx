'use client'

// ============================================================
// Card "Il tuo commercialista" (Impostazioni › Generale).
// L'artigiano invita il commercialista per email (accesso in sola
// lettura ai propri dati) e può revocarlo in un tocco.
// ============================================================

import { useEffect, useState, useTransition } from 'react'
import { Loader2, UserPlus, X, Check, Clock } from 'lucide-react'
import { toast } from 'sonner'
import {
  inviteAccountantAction,
  revokeAccountantAction,
  listAccountantLinks,
  getSuggestedAccountantEmail,
  type AccountantLinkView,
} from '@/lib/actions/accountant'

const cardStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 14,
  boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)',
  padding: '14px 15px', marginTop: 16,
}
const fieldStyle: React.CSSProperties = {
  flex: 1, minWidth: 0, border: '1px solid #e3e3e6', borderRadius: 10, padding: '0 12px',
  height: 42, boxSizing: 'border-box', fontSize: 14, fontFamily: 'inherit', color: '#161616', background: '#fff', outline: 'none',
}

export function AccountantCard() {
  const [email, setEmail] = useState('')
  const [links, setLinks] = useState<AccountantLinkView[]>([])
  const [loaded, setLoaded] = useState(false)
  // Studio che ha invitato l'artigiano alla registrazione (invito inverso)
  const [suggested, setSuggested] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  async function reload() {
    const l = await listAccountantLinks()
    setLinks(l)
    setLoaded(true)
  }
  useEffect(() => {
    reload()
    getSuggestedAccountantEmail().then(setSuggested).catch(() => {})
  }, [])

  function handleInvite(target?: string) {
    const e = (target ?? email).trim()
    if (!e) return
    startTransition(async () => {
      const res = await inviteAccountantAction(e)
      if (res?.error) { toast.error(res.error); return }
      toast.success(res?.success ?? 'Invito inviato')
      setEmail('')
      setSuggested(null)
      await reload()
    })
  }

  function handleRevoke(id: string) {
    startTransition(async () => {
      const res = await revokeAccountantAction(id)
      if (res?.error) { toast.error(res.error); return }
      toast.success('Accesso revocato')
      await reload()
    })
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <UserPlus size={20} style={{ color: '#8a887f', flexShrink: 0 }} aria-hidden />
        <div style={{ fontSize: 14, fontWeight: 600, color: '#161616' }}>Il tuo commercialista</div>
      </div>
      <p style={{ fontSize: 12, color: '#767676', margin: '0 0 12px', lineHeight: 1.5 }}>
        Invitalo con la sua email: potrà vedere le tue fatture, gli incassi e le spese in sola lettura
        e scaricare il registro per la contabilità. Puoi revocarlo quando vuoi.
      </p>

      {suggested && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fdf9ef', border: '1px solid #ecdfc0', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: '#55534b', lineHeight: 1.45 }}>
            Il tuo commercialista (<strong style={{ color: '#161616' }}>{suggested}</strong>) ti ha
            invitato su Carta Canta. Vuoi collegarlo?
          </span>
          <button
            type="button"
            onClick={() => handleInvite(suggested)}
            disabled={pending}
            style={{ flexShrink: 0, border: 'none', borderRadius: 9, background: '#b0863e', color: '#fff', fontSize: 13, fontWeight: 600, padding: '8px 14px', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Collega
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleInvite() }}
          placeholder="email@studio.it"
          autoComplete="off"
          disabled={pending}
          style={fieldStyle}
        />
        <button
          type="button"
          onClick={() => handleInvite()}
          disabled={pending || !email.trim()}
          style={{
            flexShrink: 0, border: 'none', borderRadius: 10, background: '#1a1a2e', color: '#fff',
            fontSize: 13, fontWeight: 600, padding: '0 16px', height: 42, cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 6, opacity: (pending || !email.trim()) ? 0.6 : 1,
          }}
        >
          {pending ? <Loader2 size={15} className="animate-spin" /> : null} Invita
        </button>
      </div>

      {loaded && links.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {links.map((l) => (
            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fafafa', borderRadius: 10, padding: '9px 11px' }}>
              <span style={{ flexShrink: 0, color: l.acceptedAt ? '#2f8a63' : '#b0863e' }}>
                {l.acceptedAt ? <Check size={15} /> : <Clock size={15} />}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, color: '#161616', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.email}</span>
                <span style={{ display: 'block', fontSize: 11, color: '#8a887f' }}>{l.acceptedAt ? 'Collegato' : 'Invito inviato'}</span>
              </span>
              <button
                type="button"
                onClick={() => handleRevoke(l.id)}
                disabled={pending}
                aria-label={`Revoca ${l.email}`}
                style={{ flexShrink: 0, border: 'none', background: 'none', color: '#b05656', cursor: 'pointer', padding: 4, fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <X size={15} /> Revoca
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
