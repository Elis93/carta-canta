'use client'

// ============================================================
// PhotoGallery — "Il lavoro in foto" sulla pagina pubblica del documento.
// Le miniature si toccano e la foto si apre INGRANDITA a schermo pieno
// (richiesta Eli 4 ago: "il cliente deve poter cliccare sulle foto e
// ingrandirsi come un pop-up, ricliccare e si chiude").
// ============================================================

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export interface PublicPhoto {
  id: string
  src: string
  label: string | null
}

export function PhotoGallery({ photos }: { photos: PublicPhoto[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // Con la foto aperta: niente scroll di fondo, Esc per chiudere
  useEffect(() => {
    if (openIdx === null) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenIdx(null) }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [openIdx])

  if (photos.length === 0) return null
  const openPhoto = openIdx !== null ? photos[openIdx] : null

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 14, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)' }}>
      <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: 10 }}>
        Il lavoro in foto
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
        {photos.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setOpenIdx(i)}
            aria-label={`Ingrandisci la foto${p.label ? ` ${p.label}` : ''}`}
            style={{ position: 'relative', height: 96, borderRadius: 10, overflow: 'hidden', background: '#f2f2f5', border: 'none', padding: 0, cursor: 'zoom-in', display: 'block', width: '100%' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- storage pubblico */}
            {/* Niente loading="lazy": l'indirizzo firmato scade dopo un'ora e
                il cliente lascia spesso la pagina aperta sul telefono. Con il
                caricamento pigro le foto sotto la piega verrebbero chieste il
                giorno dopo, con un indirizzo ormai scaduto → immagini rotte.
                Sono poche miniature, si caricano subito. */}
            <img src={p.src} alt={p.label === 'dopo' ? 'Foto a lavoro finito' : 'Foto prima dell’intervento'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            {p.label && (
              <span style={{ position: 'absolute', top: 5, left: 5, border: '1px solid rgba(255,255,255,.85)', background: 'rgba(22,22,22,.55)', color: '#fff', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700, letterSpacing: '.05em' }}>
                {p.label.toUpperCase()}
              </span>
            )}
          </button>
        ))}
      </div>
      <p style={{ fontSize: 13, color: '#767676', marginTop: 9 }}>
        Tocca una foto per ingrandirla.
      </p>

      {/* Foto ingrandita — portal su body: nessun contenitore della pagina
          può ritagliarla o rimpicciolirla. Un tocco ovunque richiude. */}
      {openPhoto && mounted && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Foto ingrandita"
          onClick={() => setOpenIdx(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(12,12,20,.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, cursor: 'zoom-out' }}
        >
          <button
            type="button"
            onClick={() => setOpenIdx(null)}
            aria-label="Chiudi"
            style={{ position: 'absolute', top: 14, right: 14, width: 44, height: 44, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,.14)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <X size={22} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- storage pubblico */}
          <img
            src={openPhoto.src}
            alt={openPhoto.label === 'dopo' ? 'Foto a lavoro finito' : 'Foto prima dell’intervento'}
            style={{ maxWidth: '100%', maxHeight: '86dvh', objectFit: 'contain', borderRadius: 10 }}
          />
          {openPhoto.label && (
            <span style={{ position: 'absolute', bottom: 22, left: '50%', transform: 'translateX(-50%)', border: '1px solid rgba(255,255,255,.7)', background: 'rgba(22,22,22,.6)', color: '#fff', borderRadius: 999, padding: '4px 12px', fontSize: 12, fontWeight: 700, letterSpacing: '.05em' }}>
              {openPhoto.label.toUpperCase()}
            </span>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
