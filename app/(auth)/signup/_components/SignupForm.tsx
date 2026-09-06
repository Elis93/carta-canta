'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Mail, X, Gift } from 'lucide-react'
import { PasswordInput } from '@/components/ui/password-input'
import { OAuthButtons } from '@/components/shared/OAuthButtons'
import { PasswordStrength, isPasswordStrong } from '@/components/shared/PasswordStrength'
import { TurnstileWidget } from '@/components/shared/TurnstileWidget'
import { phCapture } from '@/lib/analytics'
import { signupAction } from '../../actions'

interface SignupFormProps {
  defaultRefCode?: string
}

// ── Stili condivisi mockup ──────────────────────────────────
const fieldLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '.05em',
  textTransform: 'uppercase',
  color: 'var(--cc-muted)',
  marginBottom: 7,
}
const fieldBox: React.CSSProperties = {
  width: '100%',
  border: '1px solid #e3e3e6',
  borderRadius: 10,
  padding: '11px 12px',
  fontSize: 14,
  color: '#161616',
  background: '#fff',
  outline: 'none',
}
const pwdInputClass =
  'h-auto rounded-[10px] border-[#e3e3e6] px-3 py-[11px] pr-10 text-sm text-[#161616] md:text-sm'

export function SignupForm({ defaultRefCode }: SignupFormProps) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(signupAction, null)
  // UTM catturate al primo atterraggio (misura campagne senza pixel)
  const [utm, setUtm] = useState<Record<string, string>>({})
  // Email dello studio che ha invitato (invito commercialista→artigiano)
  const [studioInvite, setStudioInvite] = useState('')
  useEffect(() => {
    // NB: si legge PRIMA l'URL (deterministico) e poi sessionStorage: quando
    // il primo atterraggio è direttamente /signup (link d'invito, ads),
    // l'effetto di UtmCapture nel layout root non è ancora stato eseguito.
    try {
      const params = new URLSearchParams(window.location.search)

      const raw = sessionStorage.getItem('cc_utm')
      if (raw) setUtm(JSON.parse(raw))
      else {
        const fromUrl: Record<string, string> = {}
        for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
          const v = params.get(k)
          if (v) fromUrl[k] = v.slice(0, 100)
        }
        if (Object.keys(fromUrl).length > 0) setUtm(fromUrl)
      }

      const studioUrl = (params.get('studio') ?? '').toLowerCase()
      const validStudio = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studioUrl) && studioUrl.length <= 200
      setStudioInvite(validStudio ? studioUrl : (sessionStorage.getItem('cc_studio') ?? ''))
    } catch { /* noop */ }
  }, [])

  // Stato password + validazione
  const [password, setPassword]               = useState('')
  // ⚠️ NIENTE campo «Conferma password» (decisione di Eli, 12 ago). Non
  // aggiunge sicurezza: protegge da un refuso, non da un attacco — e il refuso
  // lo previene già il tasto «mostra password» dentro il campo. È la stessa
  // scelta di Google e GitHub. In più chiudeva alla radice il difetto per cui
  // i gestori di password di Android riempivano il secondo campo mentre si
  // scriveva nel primo. Se una password sbagliata passasse comunque, resta il
  // recupero via email.
  const passwordStrong = isPasswordStrong(password)

  // FIX-21: pop-up di conferma email (no auto-dismiss, no redirect automatico).
  // Eli (15 ago): il messaggio «Account creato» deve comparire in un POP-UP
  // chiudibile con la X, non come banner in linea.
  const [emailBannerDismissed, setEmailBannerDismissed] = useState(false)
  // «Ho sbagliato indirizzo» riarma il form per UN nuovo tentativo (secondo
  // ricontrollo 24 ago: senza, chi aveva scritto l'email sbagliata restava
  // bloccato per sempre — il rinvio di /verifica-email non può aiutare un
  // indirizzo che non ha mai ricevuto nulla).
  const [riarmato, setRiarmato] = useState(false)
  const emailSent = state?.success === 'verifica-email' && !riarmato
  const showEmailBanner = emailSent && !emailBannerDismissed
  // Portal montato solo lato client (evita mismatch SSR).
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  // Chiusura con Esc, come ogni altro overlay dell'app.
  useEffect(() => {
    if (!showEmailBanner) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setEmailBannerDismissed(true) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [showEmailBanner])

  // FIX-14: flag "redirect in corso" solo per il flusso onboarding (email già confermata)
  const isRedirecting = state?.success === 'onboarding'

  // Turnstile: dopo un errore il token è consumato → rimonto il widget (nuovo token)
  const [captchaKey, setCaptchaKey] = useState(0)

  // Evita doppio invio dell'evento (l'effect può rieseguire)
  const signupTracked = useRef(false)

  useEffect(() => {
    if (state?.success === 'onboarding') router.push('/onboarding')
    if (state?.error) setCaptchaKey((k) => k + 1)
    // Un NUOVO invio riuscito (indirizzo corretto dopo «Ho sbagliato») riparte
    // pulito: pop-up di nuovo visibile, form di nuovo spento.
    if (state?.success === 'verifica-email') {
      setRiarmato(false)
      setEmailBannerDismissed(false)
    }
    // Registrazione completata (sia conferma-email in prod sia onboarding in dev):
    // evento top-of-funnel con le UTM → attribution delle sponsorizzate.
    if ((state?.success === 'verifica-email' || state?.success === 'onboarding') && !signupTracked.current) {
      signupTracked.current = true
      phCapture('signup_completed', utm)
    }
  }, [state, router, utm])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!passwordStrong) {
      e.preventDefault()
      return
    }
  }

  // ⚠️ A email di conferma inviata il form resta DISABILITATO anche dopo la
  // chiusura del pop-up: riarmarlo invitava a un secondo «Crea account» che —
  // per la regola anti-enumerazione — non manda nulla e non dice perché.
  const disabled = isPending || isRedirecting || emailSent

  return (
    <>
      {/* Logo */}
      <div style={{ padding: '30px 22px 2px', textAlign: 'center' }}>
        <svg viewBox="0 90 760 290" xmlns="http://www.w3.org/2000/svg"
          style={{ display: 'block', width: '100%', maxWidth: 280, height: 'auto', margin: '0 auto' }}>
          <g transform="translate(305,78) scale(0.293)">
            <rect width="512" height="512" rx="112" fill="#1a1a2e"/>
            <path d="M342 133 A150 150 0 1 0 342 379" fill="none" stroke="#c9a44c" strokeWidth="38" strokeLinecap="round"/>
            <path d="M307 175 A96 96 0 1 0 307 337" fill="none" stroke="#f3ede0" strokeWidth="30" strokeLinecap="round"/>
          </g>
          <text x="380" y="300" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="56" fill="#1a1a2e">
            {'Carta '}
            <tspan fill="#c9a44c">Canta</tspan>
          </text>
          <rect x="310" y="324" width="140" height="1.4" fill="#dcd3bf"/>
          <text x="380" y="368" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="28" fontStyle="italic" fill="#b08d3e">
            il tuo ufficio in tasca
          </text>
        </svg>
      </div>

      {/* Card */}
      <div
        style={{
          margin: '14px 18px 0',
          background: '#fff',
          borderRadius: 14,
          boxShadow: '0 1px 2px rgba(20,20,40,.05), 0 8px 24px -10px rgba(20,20,40,.15)',
          padding: '18px 16px',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 19, fontWeight: 700, color: '#161616' }}>Crea il tuo account</div>
          <div style={{ fontSize: 13, color: 'var(--cc-muted)', marginTop: 3 }}>Gratis. Nessuna carta di credito richiesta.</div>
        </div>
        <div style={{ height: 4 }} />

        {/* OAuth */}
        <OAuthButtons />

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '15px 0' }}>
          <div style={{ flex: 1, height: 1, background: '#eee' }} />
          <span style={{ fontSize: 12, color: 'var(--cc-muted)' }}>oppure</span>
          <div style={{ flex: 1, height: 1, background: '#eee' }} />
        </div>

        {/* Form */}
        <form action={formAction} onSubmit={handleSubmit}>
          {/* Nome + Cognome */}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={fieldLabel}>Nome</div>
              <input
                id="nome"
                name="nome"
                type="text"
                placeholder="esempio: Mario"
                autoComplete="given-name"
                required
                disabled={disabled}
                style={fieldBox}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={fieldLabel}>Cognome</div>
              <input
                id="cognome"
                name="cognome"
                type="text"
                placeholder="esempio: Rossi"
                autoComplete="family-name"
                required
                disabled={disabled}
                style={fieldBox}
              />
            </div>
          </div>

          <div style={{ height: 14 }} />

          {/* Email */}
          <div style={fieldLabel}>Email</div>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="esempio: nome@dominio.it"
            autoComplete="email"
            required
            disabled={disabled}
            style={fieldBox}
          />

          <div style={{ height: 14 }} />

          {/* Password */}
          <div style={fieldLabel}>Password</div>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            required
            disabled={disabled}
            className={pwdInputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {/* Checklist requisiti — sfondo mockup */}
          {password.length > 0 && (
            <div style={{ marginTop: 9, background: '#fafafa', borderRadius: 10, padding: '10px 12px' }}>
              <PasswordStrength password={password} />
            </div>
          )}

          <div style={{ height: 14 }} />


          {/* Codice invito */}
          <div style={fieldLabel}>Codice invito</div>
          <div style={{ ...fieldBox, display: 'flex', alignItems: 'center', gap: 8, padding: '11px 12px' }}>
            <Gift style={{ width: 17, height: 17, color: 'var(--cc-muted)', flex: '0 0 auto' }} />
            <input
              id="ref_code"
              name="ref_code"
              type="text"
              placeholder="esempio: AB3X7Z"
              autoComplete="off"
              defaultValue={defaultRefCode ?? ''}
              disabled={disabled}
              maxLength={6}
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: '#161616', background: 'transparent', textTransform: 'uppercase' }}
            />
          {Object.entries(utm).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          {studioInvite && <input type="hidden" name="studio_invite_email" value={studioInvite} />}
          </div>

          {/* Legal */}
          <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.45, marginTop: 13 }}>
            Registrandoti accetti i{' '}
            <Link href="/termini" style={{ textDecoration: 'underline' }}>Termini di servizio</Link>{' '}
            e l&rsquo;<Link href="/privacy" style={{ textDecoration: 'underline' }}>Informativa privacy</Link>.
          </p>

          {/* Captcha anti-bot — visibile solo se configurato (NEXT_PUBLIC_TURNSTILE_SITE_KEY) */}
          <TurnstileWidget key={captchaKey} />

          {state?.error && (
            <p style={{ marginTop: 14 }} className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
              {state.error}
            </p>
          )}

          {/* Crea account */}
          <button
            type="submit"
            disabled={disabled || (password.length > 0 && !passwordStrong)}
            style={{
              width: '100%',
              background: '#1a1a2e',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              height: 50,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontSize: 15,
              fontWeight: 600,
              marginTop: 16,
              boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)',
              cursor: disabled ? 'default' : 'pointer',
              opacity: (disabled || (password.length > 0 && !passwordStrong)) ? 0.7 : 1,
            }}
          >
            {(isPending || isRedirecting) && <Loader2 className="size-4 animate-spin" />}
            {isPending
              ? 'Creazione account…'
              : isRedirecting
                ? 'Reindirizzamento…'
                : emailSent
                  ? 'Email inviata ✓'
                  : 'Crea account'}
          </button>

          {/* Chiuso il pop-up, l'informazione resta a schermo: senza questo
              pannello restava un form pieno e spento, senza spiegazione. */}
          {emailSent && emailBannerDismissed && (
            <div style={{ marginTop: 14, borderRadius: 12, background: '#d4efe2', color: '#2f8a63', padding: '11px 13px', fontSize: 13.5, lineHeight: 1.5, textAlign: 'center' }}>
              <b>Email di conferma inviata.</b>{' '}Apri il link che ti abbiamo mandato
              per attivare l&rsquo;account.{' '}
              <Link href="/verifica-email" style={{ color: '#2f8a63', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 2 }}>
                Non arriva?
              </Link>
              <span style={{ display: 'block', marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setRiarmato(true)}
                  style={{ background: 'none', border: 'none', padding: '6px 4px', color: '#2f8a63', fontSize: 13, fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer' }}
                >
                  Ho sbagliato indirizzo: correggilo
                </button>
              </span>
            </div>
          )}
        </form>
      </div>

      {/* Footer link */}
      <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--cc-muted)', padding: '18px 0 16px' }}>
        Hai già un account?{' '}
        <Link href="/login" style={{ color: '#1a1a2e', fontWeight: 600 }}>
          Accedi
        </Link>
      </div>

      {/* ── POP-UP «Account creato» (Eli 15 ago) ─────────────────────────────
          Portal su body: un overlay a schermo intero non deve poter essere
          ritagliato da un antenato con transform/overflow (regola §B.2). Si
          chiude con la X, toccando lo sfondo o con Esc. */}
      {mounted && showEmailBanner && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Account creato"
          onClick={() => setEmailBannerDismissed(true)}
          style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(20,20,40,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'relative', width: '100%', maxWidth: 380, background: '#fff', borderRadius: 16, boxShadow: '0 20px 50px -12px rgba(20,20,40,.4)', padding: '26px 22px 22px', textAlign: 'center' }}
          >
            <button
              type="button"
              aria-label="Chiudi"
              // Porta il focus DENTRO il dialog all'apertura (a11y: chi usa la
              // tastiera/lo screen reader atterra qui, non sul form sotto).
              autoFocus
              onClick={() => setEmailBannerDismissed(true)}
              style={{ position: 'absolute', top: 12, right: 12, background: 'transparent', border: 'none', color: '#9a988f', cursor: 'pointer', display: 'flex', padding: 4, borderRadius: 8 }}
            >
              <X className="size-5" />
            </button>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#d4efe2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <Mail style={{ width: 30, height: 30, color: '#2f8a63' }} strokeWidth={1.8} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#161616', marginBottom: 8 }}>
              Account creato! Controlla la tua email
            </div>
            <p style={{ fontSize: 13.5, color: '#55534b', lineHeight: 1.55, margin: '0 0 16px' }}>
              Abbiamo inviato un link di conferma al tuo indirizzo. Clicca il link per
              attivare l&rsquo;account e completare l&rsquo;iscrizione.
            </p>
            <Link
              href="/verifica-email"
              style={{ display: 'inline-block', fontSize: 13, fontWeight: 600, color: '#1a1a2e', textDecoration: 'underline', textUnderlineOffset: 2 }}
            >
              Non hai ricevuto l&rsquo;email? Vai alla pagina di verifica →
            </Link>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
