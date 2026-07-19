'use client'

// ============================================================
// NearMeButton — "Vicino a me" (19 lug 2026, richiesta Eli): chiede la
// posizione al telefono e ricarica la pagina ordinando i professionisti
// dal più vicino. La posizione (lat/lng) va SOLO al nostro server via URL;
// nessun terzo la riceve. Mantiene l'eventuale parola cercata (q).
// ============================================================

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Loader2 } from 'lucide-react'

export function NearMeButton({ q, active }: { q: string; active: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function locate() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Il tuo telefono non permette di rilevare la posizione.')
      return
    }
    setError(null)
    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(5)
        const lng = pos.coords.longitude.toFixed(5)
        const params = new URLSearchParams()
        if (q.trim()) params.set('q', q.trim())
        params.set('lat', lat)
        params.set('lng', lng)
        router.push(`/professionisti?${params.toString()}`)
      },
      () => {
        setLoading(false)
        setError('Non riesco a leggere la posizione. Controlla i permessi e riprova.')
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 }
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={locate}
        disabled={loading}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%',
          minHeight: 44, borderRadius: 11, cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit',
          fontSize: 13, fontWeight: 600,
          border: active ? '1px solid #1a1a2e' : '1px solid #e3e3e6',
          background: active ? '#1a1a2e' : '#fff',
          color: active ? '#fff' : '#1a1a2e',
        }}
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
        {active ? 'Ordinati dal più vicino a te' : 'Vicino a me'}
      </button>
      {error && <p style={{ fontSize: 12, color: '#b05656', marginTop: 6, textAlign: 'center' }}>{error}</p>}
    </div>
  )
}
