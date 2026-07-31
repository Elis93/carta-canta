'use client'

// ============================================================
// NearMeButton — "Vicino a me" (19 lug 2026, richiesta Eli): chiede la
// posizione al telefono e ricarica la pagina ordinando i professionisti
// dal più vicino. La posizione (lat/lng) va SOLO al nostro server via URL;
// nessun terzo la riceve. Mantiene l'eventuale parola cercata (q).
//
// 21 lug (Eli): al tocco deve aprirsi DIRETTAMENTE la finestra di sistema del
// telefono per consentire la posizione — `getCurrentPosition` fa comparire da
// solo il prompt nativo del browser/telefono. Niente più guida passo-passo né
// messaggi d'errore sui permessi (scelta Eli).
// ============================================================

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Loader2 } from 'lucide-react'

export function NearMeButton({ q, active }: { q: string; active: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [blocked, setBlocked] = useState(false)

  function locate() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    setLoading(true)
    setBlocked(false)
    // Il prompt nativo del telefono/browser compare qui, al tocco.
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
        // replace, non push (29 lug): attivare la posizione è uno stato della
        // STESSA pagina — impilarlo in cronologia rendeva muto il tasto
        // indietro (ripercorreva le varianti di /professionisti una a una).
        router.replace(`/professionisti?${params.toString()}`)
        // Ri-tocco quando si è GIÀ in modalità geo: la key del componente non
        // cambia → nessun remount → senza questo lo spinner resterebbe acceso.
        setLoading(false)
      },
      (err) => {
        setLoading(false)
        // Permesso GIÀ negato a livello di sistema (feedback Eli 22 lug #2): il
        // prompt nativo non ricompare mai più, quindi "non succede nulla". Una
        // riga che spiega dove riattivarlo — dal web non si può aprire
        // direttamente l'impostazione. Altri errori (GPS/timeout): silenzio,
        // la ricerca per comune resta.
        if (err.code === 1) setBlocked(true)
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 }
    )
  }

  return (
    <>
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
    {blocked && (
      <p style={{ fontSize: 12, color: '#8a6c33', marginTop: 6, textAlign: 'center', lineHeight: 1.5 }}>
        La posizione è bloccata per questa app: riattivala da Impostazioni del telefono → App →
        browser/Carta Canta → Autorizzazioni → Posizione. Oppure cerca per comune qui sopra.
      </p>
    )}
    </>
  )
}
