'use client'

// Form di firma del rapportino (pubblico, senza login).
// Nome + tocco → POST /api/r/[token]/sign. Stessa FES dei preventivi.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, PenLine } from 'lucide-react'

export function SignRapportoForm({ token, defaultName }: { token: string; defaultName: string }) {
  const router = useRouter()
  const [name, setName] = useState(defaultName)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSign() {
    const trimmed = name.trim()
    if (trimmed.length < 2) {
      setError('Scrivi nome e cognome per firmare.')
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch(`/api/r/${token}/sign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ signer_name: trimmed }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(json?.error ?? 'Firma non riuscita. Riprova tra poco.')
          if (res.status === 409) router.refresh() // già firmato → mostra lo stato reale
          return
        }
        router.refresh()
      } catch {
        setError('Connessione assente. Controlla la rete e riprova.')
      }
    })
  }

  return (
    <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)', padding: '15px 16px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: 9 }}>
        Firma per accettazione
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nome e cognome"
        maxLength={120}
        autoComplete="name"
        style={{
          width: '100%', border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 12px',
          fontSize: 16, fontFamily: 'inherit', color: '#161616', background: '#fff', boxSizing: 'border-box', outline: 'none',
        }}
      />
      {error && <p style={{ fontSize: 13, color: '#dc2626', fontWeight: 500, marginTop: 8 }}>{error}</p>}
      <button
        type="button"
        onClick={handleSign}
        disabled={pending}
        style={{
          width: '100%', height: 50, marginTop: 10, border: 'none', borderRadius: 13, background: '#1a1a2e',
          color: '#fff', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 8, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)',
          opacity: pending ? 0.7 : 1,
        }}
      >
        {pending ? <Loader2 size={17} className="animate-spin" /> : <PenLine size={16} />}
        Firmo: i lavori sono stati eseguiti
      </button>
    </div>
  )
}
