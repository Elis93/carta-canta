'use client'

// ============================================================
// PhotoLightbox — la foto si tocca e si apre INGRANDITA, si ritocca e si chiude.
//
// PERCHÉ QUI E NON IN OGNI PAGINA (richiesta Eli 6 ago: "ogni volta che ci
// sono foto allegate, lato artigiano o cliente, voglio che siano cliccabili"):
// le foto compaiono in cinque posti diversi — card «Foto lavoro» (che a sua
// volta vive su preventivo, fattura, lavoro, sopralluogo), form del preventivo,
// form del sopralluogo, pagina pubblica del documento, rapportino da firmare.
// Scriverne cinque copie significherebbe che fra tre mesi tre si comportano in
// un modo e due in un altro. Il comportamento sta qui, una volta sola.
//
// COME SI CHIUDE, in tutti i modi che una persona prova d'istinto:
// toccando la foto ingrandita, toccando lo sfondo, la ✕ in alto a destra,
// o Esc da tastiera.
//
// ⚠️ PORTAL SU document.body: `position: fixed` da solo non basta — un
// antenato con transform/filter/zoom diventa il contenitore di riferimento e
// la foto verrebbe ritagliata dentro la card invece di coprire lo schermo
// (è il bug del righello "a striscia verticale" del 4 agosto).
// ============================================================

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export interface LightboxPhoto {
  /** indirizzo firmato; se manca (firma non ancora arrivata) la foto non si apre */
  src: string | undefined
  /** 'prima' | 'dopo' o altra etichetta, mostrata come pillola */
  label?: string | null
  alt?: string
}

function altOf(p: LightboxPhoto): string {
  if (p.alt) return p.alt
  if (p.label === 'dopo') return 'Foto a lavoro finito'
  if (p.label === 'prima') return 'Foto prima dell’intervento'
  return 'Foto del lavoro'
}

export function usePhotoLightbox(photos: LightboxPhoto[]) {
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const close = useCallback(() => setOpenIdx(null), [])

  // Con la foto aperta: niente scroll di fondo (altrimenti si scorre la pagina
  // sotto mentre si guarda la foto) e Esc per chiudere.
  useEffect(() => {
    if (openIdx === null) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [openIdx, close])

  // Se la foto aperta sparisce dalla lista (eliminata da sotto, o staccata dal
  // documento) l'ingrandimento si chiude invece di restare su un indice morto.
  useEffect(() => {
    if (openIdx !== null && openIdx >= photos.length) setOpenIdx(null)
  }, [photos.length, openIdx])

  const photo = openIdx !== null ? photos[openIdx] : null

  const lightbox = photo && photo.src && mounted
    ? createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Foto ingrandita"
          onClick={close}
          style={{
            position: 'fixed', inset: 0, zIndex: 90,
            background: 'rgba(12,12,20,.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 12, cursor: 'zoom-out',
          }}
        >
          <button
            type="button"
            onClick={close}
            aria-label="Chiudi"
            style={{
              position: 'absolute', top: 14, right: 14, width: 44, height: 44,
              borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,.14)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={22} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- URL firmata dello storage */}
          <img
            src={photo.src}
            alt={altOf(photo)}
            style={{
              maxWidth: '100%',
              // ⚠️ diviso --cc-zoom: in "Testo grande" il body è ingrandito del
              // 15% e un 86dvh secco varrebbe il 15% in più dello schermo vero.
              maxHeight: 'calc(86dvh / var(--cc-zoom, 1))',
              objectFit: 'contain', borderRadius: 10,
            }}
          />
          {photo.label && (
            <span style={{
              position: 'absolute', bottom: 22, left: '50%', transform: 'translateX(-50%)',
              border: '1px solid rgba(255,255,255,.7)', background: 'rgba(22,22,22,.6)',
              color: '#fff', borderRadius: 999, padding: '4px 12px',
              fontSize: 12, fontWeight: 700, letterSpacing: '.05em',
            }}>
              {photo.label.toUpperCase()}
            </span>
          )}
        </div>,
        document.body,
      )
    : null

  return { openPhoto: setOpenIdx, closePhoto: close, lightbox }
}

/**
 * Zona toccabile che copre l'intera miniatura e apre l'ingrandimento.
 *
 * ⚠️ È un FRATELLO dei bottoni sovrapposti (etichetta, ✕, occhio), non il loro
 * contenitore: un <button> dentro un altro <button> è HTML non valido e su
 * alcuni browser il tocco interno non arriva. Va messo come PRIMO figlio della
 * miniatura, con i controlli dopo e con zIndex più alto, così restano cliccabili.
 */
export function ZoomHotspot({ onClick, label }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label ?? 'Ingrandisci la foto'}
      style={{
        position: 'absolute', inset: 0, zIndex: 1,
        border: 'none', background: 'transparent', padding: 0, cursor: 'zoom-in',
      }}
    />
  )
}
