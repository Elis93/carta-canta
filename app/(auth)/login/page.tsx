'use client'

import { Suspense, useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { PasswordInput } from '@/components/ui/password-input'
import { OAuthButtons } from '@/components/shared/OAuthButtons'
import { loginAction } from '../actions'

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

function LoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(loginAction, null)

  useEffect(() => {
    if (state?.success) router.push(state.success)
  }, [state, router])

  return (
    <form action={formAction}>
      <input type="hidden" name="redirect" value={redirectTo} />

      {/* Email */}
      <div style={fieldLabel}>Email</div>
      <input
        id="email"
        name="email"
        type="email"
        placeholder="mario@esempio.it"
        autoComplete="email"
        required
        disabled={isPending}
        style={fieldBox}
      />

      <div style={{ height: 14 }} />

      {/* Password */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: '#8a887f' }}>
          Password
        </span>
        <Link href="/reset-password" style={{ fontSize: 12, color: '#8a887f' }}>
          Hai dimenticato la password?
        </Link>
      </div>
      <PasswordInput
        id="password"
        name="password"
        autoComplete="current-password"
        required
        disabled={isPending}
        className="h-auto rounded-[10px] border-[#e3e3e6] px-3 py-[11px] pr-10 text-sm text-[#161616] md:text-sm"
      />

      {state?.error && (
        <div style={{ marginTop: 14 }} className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg space-y-1">
          <p>{state.error}</p>
          {state.suggestSignup ? (
            <p className="text-xs text-destructive/80">
              <Link href="/signup" className="font-medium underline underline-offset-2">
                Registrati gratis →
              </Link>
            </p>
          ) : (
            <p className="text-xs text-destructive/80">
              <Link href="/reset-password" className="underline underline-offset-2">
                Hai dimenticato la password?
              </Link>
            </p>
          )}
        </div>
      )}

      {/* Accedi */}
      <button
        type="submit"
        disabled={isPending}
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
          cursor: isPending ? 'default' : 'pointer',
          opacity: isPending ? 0.7 : 1,
        }}
      >
        {isPending && <Loader2 className="size-4 animate-spin" />}
        {isPending ? 'Accesso in corso…' : 'Accedi'}
      </button>
    </form>
  )
}

function LoginPageContent() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/dashboard'
  const errorParam = searchParams.get('error')

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
          <div style={{ fontSize: 19, fontWeight: 700, color: '#161616' }}>Bentornato</div>
          <div style={{ fontSize: 13, color: '#8a887f', marginTop: 3 }}>Accedi al tuo account Carta Canta</div>
        </div>
        <div style={{ height: 4 }} />

        {/* Errori da query param */}
        {errorParam === 'link_scaduto' && (
          <p className="mb-4 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
            Il link di conferma è scaduto o non è più valido.
            Accedi per riceverne uno nuovo.
          </p>
        )}
        {errorParam === 'oauth_failed' && (
          <p className="mb-4 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
            Accesso con Google non riuscito. Riprova o usa email e password.
          </p>
        )}

        {/* OAuth */}
        <OAuthButtons />

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '15px 0' }}>
          <div style={{ flex: 1, height: 1, background: '#eee' }} />
          <span style={{ fontSize: 12, color: '#8a887f' }}>oppure continua con email</span>
          <div style={{ flex: 1, height: 1, background: '#eee' }} />
        </div>

        {/* Form email/password */}
        <LoginForm redirectTo={redirectTo} />
      </div>

      {/* Footer link */}
      <div style={{ textAlign: 'center', fontSize: 13, color: '#8a887f', padding: '18px 0 16px' }}>
        Non hai un account?{' '}
        <Link href="/signup" style={{ color: '#1a1a2e', fontWeight: 600 }}>
          Registrati gratis
        </Link>
      </div>
    </>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageContent />
    </Suspense>
  )
}
