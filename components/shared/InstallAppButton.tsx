'use client'

// ============================================================
// InstallAppButton — riga "Installa l'app" sempre disponibile in Altro.
//
// - Android / desktop Chrome-Edge: apre il POPUP NATIVO di installazione
//   (l'evento beforeinstallprompt viene catturato presto da uno script
//   inline nel layout e conservato in window.__ccInstallPrompt).
// - iPhone/iPad (Safari non espone quell'evento): mostra le istruzioni
//   "Condividi → Aggiungi a Home".
// - Altri browser senza supporto: istruzioni generiche dal menu del browser.
// - App già installata: la riga NON compare (Eli 2 ago: era solo rumore).
// ============================================================

import { useEffect, useState } from 'react'
import { Download, Share, Plus, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

declare global {
  interface Window {
    __ccInstallPrompt?: BeforeInstallPromptEvent | null
  }
}

type Sheet = null | 'ios' | 'generic'

export function InstallAppButton() {
  const [canPrompt, setCanPrompt] = useState(false)
  const [installed, setInstalled] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [sheet, setSheet] = useState<Sheet>(null)

  useEffect(() => {
    // Già installata? (avviata come app a schermo intero)
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Safari iOS
      (navigator as any).standalone === true
    if (standalone) { setInstalled(true); return }

    const ua = navigator.userAgent
    const ios =
      /iphone|ipad|ipod/i.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    setIsIOS(ios)

    // Popup nativo già catturato dallo script inline del layout?
    if (window.__ccInstallPrompt) setCanPrompt(true)

    const onAvailable = () => setCanPrompt(true)
    const onInstalled = () => { setInstalled(true); setCanPrompt(false); setSheet(null) }
    window.addEventListener('cc-install-available', onAvailable)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('cc-install-available', onAvailable)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function handleClick() {
    const evt = window.__ccInstallPrompt
    if (evt) {
      // prompt() è usabile UNA volta sola: un doppio tap veloce farebbe
      // lanciare la seconda chiamata (NotAllowedError) → fallback istruzioni.
      try {
        await evt.prompt()
        try { await evt.userChoice } catch { /* l'utente ha chiuso */ }
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

  // 2 ago sera (Eli): ad app installata la riga "App già installata" era solo
  // rumore → non si mostra proprio niente.
  if (installed) return null

  const label = 'Installa l’app sul telefono'

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 13,
          padding: '13px 0',
          background: 'transparent',
          border: 'none',
          textAlign: 'left',
          cursor: 'pointer',
          color: 'inherit',
        }}
      >
        <Download size={20} strokeWidth={1.75} style={{ flexShrink: 0, color: '#1a1a2e' }} aria-hidden />
        <span style={{ flex: 1, fontSize: 15, color: '#161616' }}>{label}</span>
        <span style={{ flexShrink: 0, marginRight: 8, fontSize: 12, fontWeight: 600, color: '#b0863e' }}>
          {canPrompt ? 'Installa' : 'Come si fa'}
        </span>
      </button>

      {sheet && (
        <InstallSheet variant={sheet} onClose={() => setSheet(null)} />
      )}
    </>
  )
}

// ── Foglio istruzioni (iOS o generico) ─────────────────────────────────────
// export: usato anche dal banner "Installa l'app" in Home (InstallHomeBanner)
export function InstallSheet({ variant, onClose }: { variant: 'ios' | 'generic'; onClose: () => void }) {
  // Blocca lo scroll di fondo (stesso pattern di CalcQuantitaButton)
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(20,20,40,.5)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 460, background: '#fff',
          borderRadius: '16px 16px 0 0', padding: '18px 18px calc(18px + env(safe-area-inset-bottom))',
          boxShadow: '0 -8px 30px rgba(20,20,40,.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ flex: 1, fontSize: 17, fontWeight: 700, color: '#161616' }}>
            Installa Carta Canta
          </span>
          <button type="button" onClick={onClose} aria-label="Chiudi" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={20} style={{ color: 'var(--cc-muted)' }} />
          </button>
        </div>

        {variant === 'ios' ? (
          <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Step n={1}>
              Tocca il tasto <b>Condividi</b>{' '}
              <Share size={15} style={{ verticalAlign: '-2px', color: '#3f6fb0' }} />{' '}
              in fondo a Safari (il quadrato con la freccia verso l&rsquo;alto).
            </Step>
            <Step n={2}>
              Scorri e tocca <b>&laquo;Aggiungi a Home&raquo;</b>{' '}
              <Plus size={15} style={{ verticalAlign: '-2px', color: '#1a1a2e' }} />.
            </Step>
            <Step n={3}>
              Conferma con <b>&laquo;Aggiungi&raquo;</b>: l&rsquo;icona compare nella schermata Home.
            </Step>
          </ol>
        ) : (
          <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Step n={1}>
              Apri il <b>menu del browser</b> (i tre puntini in alto a destra).
            </Step>
            <Step n={2}>
              Scegli <b>&laquo;Installa Carta Canta&raquo;</b> o <b>&laquo;Installa app&raquo;</b>.
              Su Chrome ed Edge c&rsquo;è anche un&rsquo;icona di installazione nella barra dell&rsquo;indirizzo.
            </Step>
          </ol>
        )}

        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%', marginTop: 16, height: 46, borderRadius: 11,
            background: '#1a1a2e', color: '#fff', border: 'none',
            fontSize: 15, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Ho capito
        </button>
      </div>
    </div>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
      <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: '50%', background: '#f3ede0', color: '#b0863e', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {n}
      </span>
      <span style={{ flex: 1, fontSize: 14, lineHeight: 1.5, color: '#161616' }}>{children}</span>
    </li>
  )
}
