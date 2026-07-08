'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Mail, X, Gift } from 'lucide-react'
import { PasswordInput } from '@/components/ui/password-input'
import { OAuthButtons } from '@/components/shared/OAuthButtons'
import { PasswordStrength, isPasswordStrong } from '@/components/shared/PasswordStrength'
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
  color: '#8a887f',
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
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('cc_utm')
      if (raw) setUtm(JSON.parse(raw))
    } catch { /* noop */ }
  }, [])

  // Stato password + validazione
  const [password, setPassword]               = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [confirmError, setConfirmError]       = useState<string | null>(null)
  const passwordStrong = isPasswordStrong(password)

  // FIX-21: banner persistente per email di verifica (no auto-dismiss, no redirect automatico)
  const [emailBannerDismissed, setEmailBannerDismissed] = useState(false)
  const showEmailBanner = state?.success === 'verifica-email' && !emailBannerDismissed

  // FIX-14: flag "redirect in corso" solo per il flusso onboarding (email già confermata)
  const isRedirecting = state?.success === 'onboarding'

  useEffect(() => {
    if (state?.success === 'onboarding') router.push('/onboarding')
  }, [state, router])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!passwordStrong) {
      e.preventDefault()
      return
    }
    if (password !== confirmPassword) {
      e.preventDefault()
      setConfirmError('Le password non corrispondono')
    } else {
      setConfirmError(null)
    }
  }

  const disabled = isPending || isRedirecting || showEmailBanner

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
          <div style={{ fontSize: 13, color: '#8a887f', marginTop: 3 }}>Gratis. Nessuna carta di credito richiesta.</div>
        </div>
        <div style={{ height: 4 }} />

        {/* OAuth */}
        <OAuthButtons />

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '15px 0' }}>
          <div style={{ flex: 1, height: 1, background: '#eee' }} />
          <span style={{ fontSize: 12, color: '#8a887f' }}>oppure</span>
          <div style={{ flex: 1, height: 1, background: '#eee' }} />
        </div>

        {/* FIX-21: banner persistente di conferma email */}
        {showEmailBanner && (
          <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 mb-4">
            <Mail className="size-4 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="font-semibold">Account creato! Controlla la tua email</p>
              <p className="text-xs text-green-700">
                Abbiamo inviato un link di conferma al tuo indirizzo.
                Clicca il link per attivare l&apos;account e completare l&apos;iscrizione.
              </p>
              <Link
                href="/verifica-email"
                className="text-xs text-green-700 underline underline-offset-2 hover:text-green-900"
              >
                Non hai ricevuto l&apos;email? Vai alla pagina di verifica →
              </Link>
            </div>
            <button
              type="button"
              aria-label="Chiudi"
              onClick={() => setEmailBannerDismissed(true)}
              className="shrink-0 rounded p-0.5 text-green-600 hover:text-green-900 hover:bg-green-100 transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

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
                placeholder="Mario"
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
                placeholder="Rossi"
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
            placeholder="mario@esempio.it"
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
            onChange={(e) => {
              setPassword(e.target.value)
              if (confirmPassword) {
                setConfirmError(
                  e.target.value !== confirmPassword ? 'Le password non corrispondono' : null
                )
              }
            }}
          />
          {/* Checklist requisiti — sfondo mockup */}
          {password.length > 0 && (
            <div style={{ marginTop: 9, background: '#fafafa', borderRadius: 10, padding: '10px 12px' }}>
              <PasswordStrength password={password} />
            </div>
          )}

          <div style={{ height: 14 }} />

          {/* Conferma password */}
          <div style={fieldLabel}>Conferma password</div>
          <PasswordInput
            id="confirm_password"
            name="confirm_password"
            autoComplete="new-password"
            required
            disabled={disabled}
            className={pwdInputClass}
            aria-invalid={confirmError ? true : undefined}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value)
              if (confirmError) {
                setConfirmError(
                  password !== e.target.value ? 'Le password non corrispondono' : null
                )
              }
            }}
            onBlur={(e) => {
              if (e.target.value && password !== e.target.value) {
                setConfirmError('Le password non corrispondono')
              } else {
                setConfirmError(null)
              }
            }}
          />
          {confirmError && (
            <p style={{ fontSize: 12, color: '#b05656', marginTop: 6 }}>{confirmError}</p>
          )}

          <div style={{ height: 14 }} />

          {/* Codice referral */}
          <div style={fieldLabel}>Codice referral</div>
          <div style={{ ...fieldBox, display: 'flex', alignItems: 'center', gap: 8, padding: '11px 12px' }}>
            <Gift style={{ width: 17, height: 17, color: '#8a887f', flex: '0 0 auto' }} />
            <input
              id="ref_code"
              name="ref_code"
              type="text"
              placeholder="es. AB3X7Z"
              autoComplete="off"
              defaultValue={defaultRefCode ?? ''}
              disabled={disabled}
              maxLength={6}
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: '#161616', background: 'transparent', textTransform: 'uppercase' }}
            />
          {Object.entries(utm).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          </div>

          {/* Legal */}
          <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.45, marginTop: 13 }}>
            Registrandoti accetti i{' '}
            <Link href="/termini" style={{ textDecoration: 'underline' }}>Termini di servizio</Link>{' '}
            e l&rsquo;{' '}
            <Link href="/privacy" style={{ textDecoration: 'underline' }}>Informativa privacy</Link>.
          </p>

          {state?.error && (
            <p style={{ marginTop: 14 }} className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
              {state.error}
            </p>
          )}

          {/* Crea account */}
          <button
            type="submit"
            disabled={disabled || !!confirmError || (password.length > 0 && !passwordStrong)}
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
              opacity: (disabled || !!confirmError || (password.length > 0 && !passwordStrong)) ? 0.7 : 1,
            }}
          >
            {(isPending || isRedirecting) && <Loader2 className="size-4 animate-spin" />}
            {isPending
              ? 'Creazione account…'
              : isRedirecting
                ? 'Reindirizzamento…'
                : showEmailBanner
                  ? 'Email inviata ✓'
                  : 'Crea account'}
          </button>
        </form>
      </div>

      {/* Footer link */}
      <div style={{ textAlign: 'center', fontSize: 13, color: '#8a887f', padding: '18px 0 16px' }}>
        Hai già un account?{' '}
        <Link href="/login" style={{ color: '#1a1a2e', fontWeight: 600 }}>
          Accedi
        </Link>
      </div>
    </>
  )
}
