'use client'

// Selettore "Ordina" della vetrina pubblica (richiesta Eli 29 lug).
// Cambia solo il parametro ?sort= mantenendo ricerca, comune e posizione.
// "Più vicini" compare solo quando c'è la posizione (bottone "Vicino a me").

import { useRouter } from 'next/navigation'

export function OrdinaSelect({
  value,
  q,
  city,
  lat,
  lng,
}: {
  value: string
  q: string
  city: string
  lat?: string
  lng?: string
}) {
  const router = useRouter()
  const hasGeo = !!(lat && lng)
  return (
    <select
      aria-label="Ordina i professionisti"
      value={value}
      onChange={(e) => {
        const p = new URLSearchParams()
        if (q.trim()) p.set('q', q.trim())
        if (city.trim()) p.set('city', city.trim())
        if (lat) p.set('lat', lat)
        if (lng) p.set('lng', lng)
        if (e.target.value !== 'consigliati') p.set('sort', e.target.value)
        const qs = p.toString()
        router.replace(qs ? `/professionisti?${qs}` : '/professionisti')
      }}
      style={{
        border: '1px solid #e3e3e6', borderRadius: 9, background: '#fff',
        color: '#55534b', fontSize: 12, fontWeight: 600, padding: '5px 7px',
        fontFamily: 'inherit', maxWidth: 170,
      }}
    >
      <option value="consigliati">Ordina: consigliati</option>
      {hasGeo && <option value="vicini">Ordina: più vicini</option>}
      <option value="recensioni">Ordina: recensioni</option>
      <option value="nome">Ordina: nome (A-Z)</option>
    </select>
  )
}
