'use client'

import { useEffect, useRef } from 'react'

interface TrackViewProps {
  token: string
}

/**
 * Componente client-only che segnala l'apertura del preventivo.
 * Essendo eseguito solo nel browser (non server-side), filtra automaticamente:
 * - scanner di sicurezza email (Microsoft Safe Links, Proofpoint, Barracuda…)
 * - bot e crawler che non eseguono JavaScript
 * - preview automatiche di app di messaggistica
 */
export function TrackView({ token }: TrackViewProps) {
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true
    fetch(`/api/p/${token}/view`, { method: 'POST' }).catch(() => {})
  }, [token])

  return null
}
