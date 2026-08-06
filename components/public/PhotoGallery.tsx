'use client'

// ============================================================
// PhotoGallery — la card "Il lavoro in foto" che il CLIENTE vede sul link.
// Usata in due posti, che devono restare identici perché sono lo stesso
// gesto per la stessa persona: la pagina del documento (/p/[token]) e il
// rapportino di fine lavoro da firmare (/r/[token]).
//
// Le miniature si toccano e la foto si apre ingrandita (richiesta Eli 4 ago,
// estesa al rapportino il 6 ago). Il comportamento dell'ingrandimento vive
// in components/shared/PhotoLightbox.tsx, condiviso anche con le schermate
// dell'artigiano.
// ============================================================

import { usePhotoLightbox } from '@/components/shared/PhotoLightbox'

export interface PublicPhoto {
  id: string
  src: string
  label: string | null
}

export function PhotoGallery({ photos, title = 'Il lavoro in foto' }: {
  photos: PublicPhoto[]
  /** il rapportino può volere un titolo diverso; di default quello del documento */
  title?: string
}) {
  const { openPhoto, lightbox } = usePhotoLightbox(photos)

  if (photos.length === 0) return null

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 14, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)' }}>
      <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: 10 }}>
        {title}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
        {photos.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => openPhoto(i)}
            aria-label={`Ingrandisci la foto${p.label ? ` ${p.label}` : ''}`}
            style={{ position: 'relative', height: 96, borderRadius: 10, overflow: 'hidden', background: '#f2f2f5', border: 'none', padding: 0, cursor: 'zoom-in', display: 'block', width: '100%' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- storage privato con URL firmata */}
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

      {lightbox}
    </div>
  )
}
