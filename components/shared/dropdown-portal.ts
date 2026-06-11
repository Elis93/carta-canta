'use client'

// FIX-16 (T-18): helper condivisi per tendine "a portale" — renderizzano la
// lista di suggerimenti su document.body con position:fixed, così non vengono
// tagliate dall'overflow-hidden/overflow-y-auto dei contenitori (es. dialog).
// Vedi ClientAutocomplete.tsx e SendEmailDialog.tsx (ClientSearchInput).

import { useEffect, useState, type RefObject } from 'react'

/** Ricalcola il rect dell'anchor mentre la tendina è aperta (scroll/resize). */
export function useAnchorRect(anchorRef: RefObject<HTMLElement | null>, open: boolean): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!open) {
      setRect(null)
      return
    }
    const update = () => setRect(anchorRef.current?.getBoundingClientRect() ?? null)
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open, anchorRef])

  return rect
}

/** Chiude la tendina su mousedown fuori da TUTTI i ref forniti (anchor + lista portata). */
export function useCloseOnOutsideMouseDown(
  open: boolean,
  onClose: () => void,
  refs: RefObject<HTMLElement | null>[],
) {
  useEffect(() => {
    if (!open) return
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node
      if (refs.some((r) => r.current?.contains(target))) return
      onClose()
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose, ...refs])
}
