'use client'

import { useState, useCallback } from 'react'
import { lookupByCap, lookupByCitta } from '@/lib/data/comuni'

interface ComuneState {
  cap: string
  citta: string
  provincia: string
}

interface UseComuneLookupReturn extends ComuneState {
  onCapChange: (value: string) => void
  onCittaChange: (value: string) => void
  onProvinciaChange: (value: string) => void
}

/**
 * Hook che gestisce i tre campi indirizzo (CAP / città / provincia)
 * con autocompilazione incrociata quando il match è univoco.
 *
 * Regole:
 * - CAP esatto (5 cifre) → riempie città + provincia se match univoco
 * - Città (≥ 3 char, corrispondenza esatta) → riempie CAP + provincia se match univoco
 * - Provincia: solo input manuale, mai autocompilata da sola
 * - I campi restano sempre modificabili
 */
export function useComuneLookup(initial: Partial<ComuneState> = {}): UseComuneLookupReturn {
  const [cap, setCap]           = useState(initial.cap       ?? '')
  const [citta, setCitta]       = useState(initial.citta     ?? '')
  const [provincia, setProvincia] = useState(initial.provincia ?? '')

  const onCapChange = useCallback((value: string) => {
    const v = value.replace(/\D/g, '').slice(0, 5)
    setCap(v)
    if (v.length === 5) {
      const match = lookupByCap(v)
      if (match) {
        setCitta(match.comune)
        setProvincia(match.provincia)
      }
    }
  }, [])

  const onCittaChange = useCallback((value: string) => {
    setCitta(value)
    if (value.trim().length >= 3) {
      const match = lookupByCitta(value)
      if (match) {
        setCap(match.cap)
        setProvincia(match.provincia)
      }
    }
  }, [])

  const onProvinciaChange = useCallback((value: string) => {
    setProvincia(value.toUpperCase().slice(0, 2))
  }, [])

  return { cap, citta, provincia, onCapChange, onCittaChange, onProvinciaChange }
}
