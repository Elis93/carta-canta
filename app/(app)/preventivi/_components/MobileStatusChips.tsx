'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { TIER_LABEL, type TierKey } from '@/lib/documents/proposte'

interface MobileStatusChipsProps {
  documentId: string
  chipBase: React.CSSProperties
}

export function MobileStatusChips({ documentId, chipBase }: MobileStatusChipsProps) {
  const router = useRouter()
  // ⚠️ Non basta sapere CHE si sta caricando: con due proposte la rotella
  // compariva su entrambi i tasti (Eli, 9 ago — stesso difetto del rinvio
  // sollecito). Qui dentro c'è QUALE proposta è stata toccata.
  const [loading, setLoading] = useState<'accepted' | 'rejected' | null>(null)
  const [tierInCorso, setTierInCorso] = useState<string | null>(null)
  // Proposte fra cui scegliere: il server le restituisce quando il preventivo
  // ne ha più d'una e non è ancora stato deciso quale ha accettato il cliente.
  const [scelta, setScelta] = useState<string[] | null>(null)

  async function changeStatus(status: 'accepted' | 'rejected', tier?: string) {
    if (loading !== null) return
    setLoading(status)
    setTierInCorso(tier ?? null)
    try {
      const res = await fetch(`/api/preventivi/${documentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tier ? { status, tier } : { status }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        // 422 con l'elenco delle proposte = "dimmi quale", non un errore:
        // il cliente può aver risposto a voce e la scelta la fa l'artigiano.
        if (res.status === 422 && Array.isArray(data?.tiers) && data.tiers.length > 1) {
          setScelta(data.tiers as string[])
          return
        }
        throw new Error(data?.error ?? 'Errore aggiornamento stato')
      }
      setScelta(null)
      toast.success(
        status === 'accepted'
          ? (tier ? `Accettato: proposta ${TIER_LABEL[tier as TierKey] ?? tier}.` : 'Preventivo segnato come accettato.')
          : 'Preventivo segnato come rifiutato.'
      )
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    } finally {
      setLoading(null)
      setTierInCorso(null)
    }
  }

  if (scelta) {
    return (
      <div style={{ gridColumn: '1 / -1', border: '1px solid #e6e6e6', background: '#f7f7f8', borderRadius: 12, padding: '12px 13px' }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: '#161616' }}>Quale proposta ha accettato?</div>
        <p style={{ fontSize: 12.5, color: 'var(--cc-muted)', margin: '3px 0 9px', lineHeight: 1.45 }}>
          Questo preventivo ne ha più d&rsquo;una. Scegli quella che il cliente ha
          accettato: il <b style={{ color: '#55534b' }}>totale</b>{' '}diventa quello di
          quella proposta, ed è la sola che finisce in fattura. L&rsquo;altra resta
          scritta nel preventivo: se sbagli, <b style={{ color: '#55534b' }}>Riporta in
          bozza</b>{' '}e tornano disponibili tutte e due.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {scelta.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => changeStatus('accepted', t)}
              disabled={loading !== null}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                border: '1px solid #e3e3e6', borderRadius: 10, background: '#fff',
                color: '#161616', fontSize: 13, fontWeight: 600, padding: '9px 13px',
                cursor: loading !== null ? 'default' : 'pointer', fontFamily: 'inherit',
                opacity: loading !== null && tierInCorso !== t ? 0.5 : 1,
              }}
            >
              {/* ⚠️ Niente spunta verde: con due tasti sembravano entrambi
                  già scelti (Eli, 9 ago). Qui non c'è ancora nessuna scelta
                  fatta — sono due alternative, e il segno arriva DOPO. */}
              {tierInCorso === t ? <Loader2 size={13} className="animate-spin" /> : null}
              {TIER_LABEL[t as TierKey] ?? t}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setScelta(null)}
            disabled={loading !== null}
            style={{ border: 'none', background: 'none', color: 'var(--cc-muted)', fontSize: 13, fontWeight: 600, padding: '9px 6px', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Annulla
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => changeStatus('accepted')}
        disabled={loading !== null}
        style={{ ...chipBase }}
      >
        {loading === 'accepted'
          ? <Loader2 size={18} className="animate-spin" style={{ color: '#2f8a63' }} />
          : <Check size={18} style={{ color: '#2f8a63' }} />}
        Segna accettato
      </button>
      <button
        type="button"
        onClick={() => changeStatus('rejected')}
        disabled={loading !== null}
        style={{ ...chipBase }}
      >
        {loading === 'rejected'
          ? <Loader2 size={18} className="animate-spin" style={{ color: '#b05656' }} />
          : <X size={18} style={{ color: '#b05656' }} />}
        Segna rifiutato
      </button>
    </>
  )
}
