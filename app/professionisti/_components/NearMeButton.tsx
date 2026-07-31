'use client'

// ============================================================
// NearMeButton — "Vicino a me" (19 lug 2026, richiesta Eli): chiede la
// posizione al telefono e ricarica la pagina ordinando i professionisti
// dal più vicino. La posizione (lat/lng) va SOLO al nostro server via URL;
// nessun terzo la riceve. Mantiene l'eventuale parola cercata (q).
//
// 21 lug (Eli): al tocco deve aprirsi DIRETTAMENTE la finestra di sistema
// del telefono — `getCurrentPosition` fa comparire da solo il prompt nativo.
// 29 lug (Eli): niente più riga di testo quando non va — si apre un
// POP-UP guidato con il bottone "Riprova". ⚠️ Limite del web: se il
// permesso è stato NEGATO in passato, il sistema non permette a nessun
// sito di riaprire il prompt né di aprire le impostazioni del telefono —
// il pop-up spiega il gesto esatto (2 tocchi) e "Riprova" riparte subito
// appena il permesso è di nuovo attivo.
// ============================================================

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Loader2, X } from 'lucide-react'

type Problema = 'permesso' | 'gps' | null

export function NearMeButton({ q, active }: { q: string; active: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [problema, setProblema] = useState<Problema>(null)

  function locate() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    setLoading(true)
    // Il prompt nativo del telefono/browser compare qui, al tocco.
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setProblema(null)
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
        // code 1 = permesso negato (il prompt nativo non ricompare più);
        // code 2/3 = posizione del telefono spenta o non disponibile.
        setProblema(err.code === 1 ? 'permesso' : 'gps')
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

    {/* Pop-up guidato (29 lug): compare solo se la posizione non è arrivata */}
    {problema && (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Attiva la posizione"
        style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(20,20,40,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        onClick={() => setProblema(null)}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ background: '#fff', borderRadius: 16, padding: '20px 18px', maxWidth: 360, width: '100%', boxShadow: '0 10px 40px rgba(20,20,40,.25)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700, color: '#161616' }}>
              <MapPin size={18} style={{ color: '#1a1a2e' }} /> Attiva la posizione
            </div>
            <button type="button" aria-label="Chiudi" onClick={() => setProblema(null)} style={{ background: 'none', border: 'none', color: '#8a887f', cursor: 'pointer', padding: 4 }}>
              <X size={18} />
            </button>
          </div>

          {problema === 'permesso' ? (
            <p style={{ fontSize: 13.5, color: '#55534b', lineHeight: 1.55, margin: '0 0 12px' }}>
              La posizione è <b>bloccata per questo sito</b>, quindi il telefono non mostra più
              la richiesta. Per riattivarla: tocca il <b>lucchetto</b> (o l'icona ⓘ) accanto
              all'indirizzo qui in alto → <b>Autorizzazioni</b> → <b>Posizione</b> → Consenti.
              Poi torna qui e tocca Riprova.
            </p>
          ) : (
            <p style={{ fontSize: 13.5, color: '#55534b', lineHeight: 1.55, margin: '0 0 12px' }}>
              Il telefono non riesce a leggere la posizione: probabilmente la <b>Posizione
              (GPS) è spenta</b>. Attivala dalla tendina delle impostazioni rapide (scorri
              giù dall'alto dello schermo) e tocca Riprova.
            </p>
          )}

          <div style={{ display: 'flex', gap: 9 }}>
            <button
              type="button"
              onClick={() => { setProblema(null); locate() }}
              style={{ flex: 1, minHeight: 44, borderRadius: 11, border: 'none', background: '#1a1a2e', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Riprova
            </button>
            <button
              type="button"
              onClick={() => setProblema(null)}
              style={{ flex: 1, minHeight: 44, borderRadius: 11, border: '1px solid #e3e3e6', background: '#fff', color: '#1a1a2e', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Cerca per comune
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
