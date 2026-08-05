'use client'

// ============================================================
// Hook per le miniature delle foto nell'app dell'artigiano.
//
// Con l'archivio privato l'indirizzo di una foto non è più prevedibile: va
// chiesto e scade. Questo hook tiene una mappa percorso → URL e la aggiorna
// quando compaiono foto nuove (appena caricate), senza rifirmare quelle che
// ha già.
// ============================================================

import { useEffect, useRef, useState } from 'react'
import { signWorkPhotoUrls } from '@/lib/photos/upload-client'

export function useSignedPhotos(paths: string[]): Map<string, string> {
  const [urls, setUrls] = useState<Map<string, string>>(new Map())
  // Percorsi già chiesti: evita di rifirmare a ogni render.
  const chiesti = useRef<Set<string>>(new Set())

  const chiave = paths.filter(Boolean).join('|')

  useEffect(() => {
    const nuovi = paths.filter((p) => p && !chiesti.current.has(p))
    if (nuovi.length === 0) return
    nuovi.forEach((p) => chiesti.current.add(p))
    let vivo = true
    signWorkPhotoUrls(nuovi).then((mappa) => {
      if (!vivo || mappa.size === 0) return
      setUrls((prev) => {
        const next = new Map(prev)
        mappa.forEach((v, k) => next.set(k, v))
        return next
      })
    })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `chiave` riassume l'elenco dei percorsi
  }, [chiave])

  return urls
}
