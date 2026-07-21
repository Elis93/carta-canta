'use client'

// ============================================================
// NearMeButton — "Vicino a me" (19 lug 2026, richiesta Eli): chiede la
// posizione al telefono e ricarica la pagina ordinando i professionisti
// dal più vicino. La posizione (lat/lng) va SOLO al nostro server via URL;
// nessun terzo la riceve. Mantiene l'eventuale parola cercata (q).
//
// 21 lug (Eli): se la posizione è BLOCCATA, non basta "controlla i permessi" —
// mostriamo una guida passo-passo per riattivarla (dal web NON si può aprire
// direttamente l'impostazione di sistema, quindi diamo le istruzioni chiare).
// ============================================================

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Loader2, ChevronDown, ChevronUp } from 'lucide-react'

export function NearMeButton({ q, active }: { q: string; active: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [denied, setDenied] = useState(false)   // permesso bloccato → mostra la guida
  const [showHelp, setShowHelp] = useState(false)

  function locate() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setDenied(false)
      setError('Il tuo telefono non permette di rilevare la posizione.')
      return
    }
    setError(null)
    setDenied(false)
    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // 2 decimali (~1 km): bastano per ordinare per vicinanza e la posizione
        // esatta del cliente non finisce negli access log dell'URL (finding M6).
        const lat = pos.coords.latitude.toFixed(2)
        const lng = pos.coords.longitude.toFixed(2)
        const params = new URLSearchParams()
        if (q.trim()) params.set('q', q.trim())
        params.set('lat', lat)
        params.set('lng', lng)
        router.push(`/professionisti?${params.toString()}`)
      },
      (err) => {
        setLoading(false)
        // code 1 = PERMISSION_DENIED · 2 = POSITION_UNAVAILABLE · 3 = TIMEOUT
        if (err.code === 1) {
          setDenied(true)
          setShowHelp(true)
          setError('Hai bloccato l’accesso alla posizione per questo sito.')
        } else {
          setDenied(false)
          setError('Non riesco a leggere la posizione. Controlla che il GPS del telefono sia acceso e riprova.')
        }
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

      {error && (
        <p style={{ fontSize: 12, color: '#b05656', marginTop: 6, textAlign: 'center' }}>{error}</p>
      )}

      {denied && (
        <div style={{ marginTop: 8, background: '#faf7f0', border: '1px solid #eee3cc', borderRadius: 10, padding: '10px 12px' }}>
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: '#8a6c33', padding: 0 }}
          >
            Come riattivare la posizione
            {showHelp ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showHelp && (
            <div style={{ fontSize: 12.5, color: '#6b5626', lineHeight: 1.6, marginTop: 8 }}>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>Dal browser (Chrome/Safari):</div>
              <div>1. Tocca il <b>lucchetto 🔒</b> (o &ldquo;Aa&rdquo;) accanto all&rsquo;indirizzo del sito, in alto.</div>
              <div>2. Apri <b>Autorizzazioni</b> (o &ldquo;Impostazioni sito&rdquo;) &rarr; <b>Posizione</b> &rarr; scegli <b>Consenti</b>.</div>
              <div>3. Torna qui e tocca di nuovo <b>&laquo;Vicino a me&raquo;</b>.</div>
              <div style={{ fontWeight: 700, margin: '8px 0 2px' }}>Se hai installato l&rsquo;app sul telefono:</div>
              <div>Impostazioni del telefono &rarr; <b>App</b> &rarr; <b>Carta Canta</b> &rarr; <b>Autorizzazioni</b> &rarr; <b>Posizione</b> &rarr; <b>Consenti</b>.</div>
              <div style={{ marginTop: 8, color: '#8a6c33' }}>
                In alternativa puoi sempre <b>scrivere il tuo comune</b> nella ricerca qui sopra: funziona anche senza posizione.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
