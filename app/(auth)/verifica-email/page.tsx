'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Mail, RefreshCw } from 'lucide-react'
import { resendVerificationEmailAction } from '@/app/(auth)/actions'

export default function VerificaEmailPage() {
  const [state, action, pending] = useActionState(resendVerificationEmailAction, null)

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

      {/* Icona + testo */}
      <div style={{ padding: '14px 28px 10px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: 68, height: 68, borderRadius: '50%', background: '#d8e8fb', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Mail style={{ width: 34, height: 34, color: '#3f6fb0' }} strokeWidth={1.8} />
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#161616', marginBottom: 8 }}>
          Controlla la tua email
        </div>
        <div style={{ fontSize: 14, color: '#55534b', lineHeight: 1.5, maxWidth: 290 }}>
          Ti abbiamo inviato un link di conferma. Aprilo per attivare il tuo account.
        </div>
      </div>

      {/* ⚠️ IL CASO IN CUI L'EMAIL NON ARRIVA MAI, ed è normale.
          Con un'email GIÀ registrata — tipicamente perché l'account è stato
          creato con Google — Supabase non manda una seconda conferma, e per
          non trasformare la registrazione in un oracolo che rivela quali
          indirizzi esistono (regola anti-enumerazione, audit 24 lug) la
          risposta è identica a quella di un'email nuova.
          Il prezzo lo pagava l'utente: schermata «controlla la posta» e poi
          il vuoto, senza sapere perché (feedback di Eli, 12 ago: «ad ogni
          modo devo essere avvisata»).
          Questo riquadro lo spiega a TUTTI, sempre: chi ha un account lo
          capisce, chi non ce l'ha non impara nulla sugli indirizzi altrui. */}
      <div style={{ padding: '0 28px', marginTop: 16 }}>
        <div style={{ borderRadius: 12, border: '1px solid #e8c98a', background: '#fdf6e7', padding: '11px 13px', color: '#7a5a1e', fontSize: 13, lineHeight: 1.5 }}>
          <b>Non arriva nulla?</b>{' '}Controlla la posta indesiderata. Se hai già un
          account con questo indirizzo — per esempio creato con <b>Accedi con Google</b>{' '}—
          la conferma non viene inviata una seconda volta:{' '}
          <Link href="/login" style={{ color: '#7a5a1e', textDecoration: 'underline', fontWeight: 600 }}>accedi da qui</Link>.
        </div>
      </div>

      {/* Resend — il form resta visibile anche dopo un invio riuscito: chi ha
          sbagliato indirizzo al primo tentativo deve poterne provare un altro
          senza ricaricare la pagina. */}
      <div style={{ padding: '0 28px', marginTop: 18 }}>
        <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {state?.success && (
            <p style={{ background: '#d4efe2', color: '#2f8a63', borderRadius: 12, padding: '11px 12px', textAlign: 'center', fontSize: 14 }}>
              {state.success}
            </p>
          )}
            <input
              type="email"
              name="email"
              placeholder="La tua email"
              autoComplete="email"
              required
              style={{
                width: '100%',
                border: '1px solid #e3e3e6',
                borderRadius: 10,
                padding: '11px 12px',
                fontSize: 14,
                color: '#161616',
                textAlign: 'center',
                outline: 'none',
              }}
            />
            {state?.error && (
              <p style={{ textAlign: 'center', fontSize: 13, color: '#b05656' }}>{state.error}</p>
            )}
            <button
              type="submit"
              disabled={pending}
              style={{
                border: '1px solid #e7e7ea',
                borderRadius: 12,
                height: 48,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                fontSize: 14,
                fontWeight: 500,
                color: '#1a1a2e',
                background: '#fff',
                cursor: pending ? 'default' : 'pointer',
                opacity: pending ? 0.6 : 1,
              }}
            >
              <RefreshCw className={`size-[18px] ${pending ? 'animate-spin' : ''}`} />
              {pending ? 'Invio in corso…' : 'Rinvia email'}
            </button>
          </form>
      </div>

      {/* Footer link */}
      <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--cc-muted)', padding: '16px 0' }}>
        Email sbagliata?{' '}
        <Link href="/login" style={{ color: '#1a1a2e', fontWeight: 600 }}>
          Torna al login
        </Link>
      </div>
    </>
  )
}
