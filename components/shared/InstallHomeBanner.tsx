'use client'

// ============================================================
// InstallHomeBanner — banner "Installa l'app" in HOME (richiesta Eli 18 lug):
// compare al primo utilizzo dal browser, e SPARISCE per sempre dopo il primo
// tocco (installa o ✕) — flag in localStorage. Mai visibile se l'app è già
// installata (avviata standalone). La voce di Altro › Strumenti resta come
// percorso permanente. Stessa logica prompt/istruzioni di InstallAppButton.
// ============================================================

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { InstallSheet } from './InstallAppButton'

const DONE_KEY = 'cc_install_home_done'

export function InstallHomeBanner() {
  const [show, setShow] = useState(false)
  const [canPrompt, setCanPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [sheet, setSheet] = useState<null | 'ios' | 'generic'>(null)

  useEffect(() => {
    try {
      if (localStorage.getItem(DONE_KEY) === '1') return
    } catch { return /* storage bloccato: meglio non mostrare che riproporre a vita */ }
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Safari iOS
      (navigator as any).standalone === true
    if (standalone) return

    const ua = navigator.userAgent
    setIsIOS(/iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
    if (window.__ccInstallPrompt) setCanPrompt(true)
    setShow(true)

    const onAvailable = () => setCanPrompt(true)
    const onInstalled = () => { markDone(); setShow(false); setSheet(null) }
    window.addEventListener('cc-install-available', onAvailable)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('cc-install-available', onAvailable)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  function markDone() {
    try { localStorage.setItem(DONE_KEY, '1') } catch { /* ignora */ }
  }

  function dismiss() {
    markDone()
    setShow(false)
  }

  async function handleInstall() {
    markDone() // primo utilizzo → il banner non ricompare più (richiesta Eli)
    const evt = window.__ccInstallPrompt
    if (evt) {
      try {
        await evt.prompt()
        try { await evt.userChoice } catch { /* l'utente ha chiuso */ }
        setShow(false)
        return
      } catch {
        setSheet(isIOS ? 'ios' : 'generic')
        return
      } finally {
        window.__ccInstallPrompt = null
        setCanPrompt(false)
      }
    }
    setSheet(isIOS ? 'ios' : 'generic')
  }

  if (!show) return null

  return (
    <>
      <div style={{ margin: '12px 15px 0', background: '#fff', borderRadius: 11, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)', borderLeft: '3px solid #c9a44c', padding: '11px 13px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Download size={18} style={{ color: '#b08d3e', flexShrink: 0 }} aria-hidden />
        <span style={{ flex: 1, fontSize: 13, color: '#55534b', lineHeight: 1.4 }}>
          Porta Carta Canta sulla schermata Home del telefono.
        </span>
        <button
          type="button"
          onClick={handleInstall}
          style={{ flexShrink: 0, border: 'none', borderRadius: 9, background: '#1a1a2e', color: '#fff', fontSize: 13, fontWeight: 600, padding: '8px 13px', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          {canPrompt ? 'Installa' : 'Come si fa'}
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Nascondi"
          style={{ flexShrink: 0, border: 'none', background: 'none', padding: 4, cursor: 'pointer', color: 'var(--cc-muted)' }}
        >
          <X size={16} />
        </button>
      </div>

      {sheet && (
        <InstallSheet variant={sheet} onClose={() => { setSheet(null); setShow(false) }} />
      )}
    </>
  )
}
