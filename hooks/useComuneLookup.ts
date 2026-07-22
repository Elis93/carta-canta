'use client'

import { useRef, useState } from 'react'
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
 * - ⚠️ L'autocompilazione NON sovrascrive MAI un valore dell'UTENTE (scritto a
 *   mano o caricato dal salvataggio — feedback Eli 22 lug #14: riaprendo un
 *   cliente completo e ritoccando il CAP, città/provincia salvate venivano
 *   rimpiazzate in silenzio). Però un valore messo DALL'AUTOFILL in questa
 *   stessa sessione può essere RI-ALLINEATO: se scrivo "Asti" (CAP 14100
 *   autocompilato) e poi correggo in "Alba", il 14100 va aggiornato, non
 *   protetto — altrimenti si salva città e CAP incoerenti (review 22 lug).
 *   Il ref `auto` ricorda l'ultimo valore messo dall'autofill per campo:
 *   campo vuoto O uguale all'autofill → sovrascrivibile; altrimenti intoccabile.
 */
export function useComuneLookup(initial: Partial<ComuneState> = {}): UseComuneLookupReturn {
  const [cap, setCap]           = useState(initial.cap       ?? '')
  const [citta, setCitta]       = useState(initial.citta     ?? '')
  const [provincia, setProvincia] = useState(initial.provincia ?? '')
  // Ultimo valore scritto dall'AUTOFILL (mai dai valori iniziali salvati:
  // quelli sono dell'utente e restano protetti).
  const auto = useRef({ cap: '', citta: '', provincia: '' })

  const canFill = (current: string, autoValue: string) =>
    !current.trim() || current === autoValue

  const onCapChange = (value: string) => {
    const v = value.replace(/\D/g, '').slice(0, 5)
    setCap(v)
    auto.current.cap = '' // scritto a mano: d'ora in poi è dell'utente
    if (v.length === 5) {
      const match = lookupByCap(v)
      if (match) {
        if (canFill(citta, auto.current.citta)) { setCitta(match.comune); auto.current.citta = match.comune }
        if (canFill(provincia, auto.current.provincia)) { setProvincia(match.provincia); auto.current.provincia = match.provincia }
      }
    }
  }

  const onCittaChange = (value: string) => {
    setCitta(value)
    auto.current.citta = ''
    if (value.trim().length >= 3) {
      const match = lookupByCitta(value)
      if (match) {
        if (canFill(cap, auto.current.cap)) { setCap(match.cap); auto.current.cap = match.cap }
        if (canFill(provincia, auto.current.provincia)) { setProvincia(match.provincia); auto.current.provincia = match.provincia }
      }
    }
  }

  const onProvinciaChange = (value: string) => {
    setProvincia(value.toUpperCase().slice(0, 2))
    auto.current.provincia = ''
  }

  return { cap, citta, provincia, onCapChange, onCittaChange, onProvinciaChange }
}
