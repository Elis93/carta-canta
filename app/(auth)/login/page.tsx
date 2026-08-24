'use client'

import { Suspense, useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { PasswordInput } from '@/components/ui/password-input'
import { OAuthButtons } from '@/components/shared/OAuthButtons'
import { TurnstileWidget } from '@/components/shared/TurnstileWidget'
import { loginAction } from '../actions'
import { createClient } from '@/lib/supabase/client'
import { markActive } from '@/lib/biometric/local'

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

function LoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(loginAction, null)
  // Una volta superata la soglia di tentativi, il captcha resta visibile fino
  // al login riuscito (che naviga via da questa pagina).
  const [showCaptcha, setShowCaptcha] = useState(false)
  // I token Turnstile sono MONOUSO: dopo ogni tentativo (anche fallito per
  // password sbagliata) il token è consumato da siteverify → il widget va
  // rimontato, altrimenti il submit successivo rimanda un token bruciato e
  // l'utente vede "completa la verifica" pur avendola completata.
  const [captchaKey, setCaptchaKey] = useState(0)

  useEffect(() => {
    if (state?.success) {
      // Un login riuscito CONTA come attività per il blocco impronta: senza,
      // AppLock montava con il marker stantio e chiedeva l'impronta SUBITO
      // dopo aver appena messo la password (audit 17 ago).
      try { markActive() } catch { /* storage bloccato */ }
      router.push(state.success)
    }
    if (state?.needsCaptcha) setShowCaptcha(true)
    if (state?.error) setCaptchaKey((k) => k + 1)
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
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--cc-muted)' }}>
          Password
        </span>
        {/* Padding + margini negativi: area toccabile ~40px senza spostare il testo */}
        <Link href="/reset-password" style={{ fontSize: 12, color: 'var(--cc-muted)', padding: '12px 4px', margin: '-12px -4px', display: 'inline-block' }}>
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
          {/* Messaggio di login generico (non rivela se l'email esiste): mostriamo
              entrambe le vie utili senza indicare quale sia il problema. */}
          <p className="text-xs text-destructive/80">
            <Link href="/reset-password" className="underline underline-offset-2">
              Hai dimenticato la password?
            </Link>
            {' · '}
            <Link href="/signup" className="font-medium underline underline-offset-2">
              Non hai un account?
            </Link>
          </p>
        </div>
      )}

      {/* Captcha anti-bot: appare solo dopo troppi tentativi falliti.
          key = rimonta il widget a ogni esito (token monouso). */}
      {showCaptcha && (
        <div style={{ marginTop: 14 }}>
          <p style={{ fontSize: 13, color: '#55534b', lineHeight: 1.5, margin: 0 }}>
            Per sicurezza, dopo alcuni tentativi serve una verifica veloce:
            completa la casella qui sotto e riprova.
          </p>
          <TurnstileWidget key={captchaKey} action="login" />
          <p style={{ fontSize: 12, color: 'var(--cc-muted)', lineHeight: 1.5, marginTop: 8 }}>
            La verifica non compare o non funziona?{' '}
            <Link href="/reset-password" style={{ color: '#1a1a2e', fontWeight: 600, textDecoration: 'underline' }}>
              Reimposta la password
            </Link>
            {' '}oppure riprova tra 15 minuti.
          </p>
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
  const rawRedirect = searchParams.get('redirect') || '/dashboard'
  // ⚠️ Il valore finisce in un href: senza questo filtro un link costruito ad
  // arte (`/login?error=x&redirect=https://finto-sito.it`) farebbe puntare
  // «Vai all'app» fuori dal nostro dominio — un open redirect servito dalla
  // nostra pagina di accesso. Stesse regole del proxy.
  const redirectTo =
    rawRedirect.startsWith('/') && !rawRedirect.startsWith('//')
      && !rawRedirect.includes(':') && !rawRedirect.includes('\\')
      && !rawRedirect.startsWith('/api/') && rawRedirect !== '/login' && rawRedirect !== '/signup'
      ? rawRedirect
      : '/dashboard'
  const errorParam = searchParams.get('error')

  // ⚠️ Chi arriva qui CON UN ERRORE può essere già connesso: è il caso del
  // link di reset scaduto (12 ago). Prima il proxy lo spediva dritto in app e
  // sembrava che fosse entrato senza password. Ora la pagina si carica e lo
  // dice, con le due uscite possibili — continuare, oppure uscire davvero.
  const [giaConnesso, setGiaConnesso] = useState<string | null>(null)
  useEffect(() => {
    if (!errorParam) return
    let vivo = true
    createClient().auth.getUser().then(({ data }) => {
      if (vivo && data.user?.email) setGiaConnesso(data.user.email)
    }, () => undefined)
    return () => { vivo = false }
  }, [errorParam])

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
          <div style={{ fontSize: 13, color: 'var(--cc-muted)', marginTop: 3 }}>Accedi al tuo account Carta Canta</div>
        </div>
        <div style={{ height: 4 }} />

        {/* Errori da query param */}
        {errorParam === 'link_scaduto' && (
          <p className="mb-4 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
            Link non più valido: è scaduto oppure è già stato utilizzato. Ogni link vale
            una sola volta e resta valido solo l&rsquo;ultimo ricevuto.
            {' '}Se era il link di <b>conferma della registrazione</b>, fattene inviare
            un altro dalla{' '}
            <Link href="/verifica-email" className="font-semibold underline underline-offset-2">
              pagina di verifica email
            </Link>
            ; altrimenti accedi qui sotto per richiederne uno nuovo.
          </p>
        )}
        {giaConnesso && (
          <div className="mb-4 rounded-lg px-3 py-2.5 text-sm" style={{ color: '#7a5a1e', background: '#fdf6e7', border: '1px solid #e8c98a' }}>
            <p style={{ fontWeight: 600 }}>Risulti già connesso come {giaConnesso}</p>
            <p style={{ fontSize: 13, marginTop: 3, lineHeight: 1.45 }}>
              Questo dispositivo ha una sessione aperta: entrando ora non ti verrà chiesta
              la password. Se non sei tu, chiudi la sessione prima di proseguire.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <a
                href={redirectTo}
                style={{ flex: 1, textAlign: 'center', padding: '9px 12px', borderRadius: 9, background: '#1a1a2e', color: '#fff', fontWeight: 600, fontSize: 13.5, textDecoration: 'none' }}
              >
                Vai all&rsquo;app
              </a>
              <button
                type="button"
                onClick={async () => {
                  // ⚠️ signOut non lancia: RITORNA { error }. Ignorarlo (come
                  // faceva la prima stesura) significava che su un errore di
                  // rete l'utente veniva mandato su /login SENZA ?error= — e il
                  // proxy, vedendo la sessione ancora viva, lo spediva DENTRO
                  // l'app: l'esatto opposto di «Esci», sul dispositivo
                  // condiviso in cui conta di più. Stessa classe del bug del
                  // 5 ago su «Esci da tutti i dispositivi».
                  const { error } = await createClient().auth.signOut({ scope: 'local' })
                  window.location.replace(error ? '/login?error=uscita_non_riuscita' : '/login')
                }}
                style={{ flex: 1, padding: '9px 12px', borderRadius: 9, border: '1px solid #e8c98a', background: '#fff', color: '#7a5a1e', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Esci
              </button>
            </div>
          </div>
        )}
        {errorParam === 'uscita_non_riuscita' && (
          <p className="mb-4 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
            Uscita non riuscita: controlla la connessione e riprova.
          </p>
        )}
        {errorParam === 'oauth_failed' && (
          <p className="mb-4 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
            Accesso con Google non riuscito. Riprova o usa email e password.
          </p>
        )}
        {/* Conferma dell'uscita da tutti i dispositivi: senza, chi ha appena
            toccato quel bottone atterra su un login qualsiasi e non sa se ha
            funzionato — proprio nel momento in cui ha bisogno di saperlo. */}
        {searchParams.get('uscito') === '1' && (
          <p className="mb-4 text-sm px-3 py-2 rounded-lg" style={{ color: '#2f6d4f', background: '#e8f4ec' }}>
            Fatto: l&rsquo;accesso è stato chiuso su tutti i dispositivi. Rientra con la tua password.
          </p>
        )}

        {/* OAuth */}
        <OAuthButtons />

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '15px 0' }}>
          <div style={{ flex: 1, height: 1, background: '#eee' }} />
          <span style={{ fontSize: 12, color: 'var(--cc-muted)' }}>oppure continua con email</span>
          <div style={{ flex: 1, height: 1, background: '#eee' }} />
        </div>

        {/* Form email/password */}
        <LoginForm redirectTo={redirectTo} />
      </div>

      {/* Footer link */}
      <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--cc-muted)', padding: '18px 0 16px' }}>
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
