'use client'

// ============================================================
// Impostazioni › Pagamenti — "Come ti pagano i clienti"
// (Pagamenti Fase 1 "bring your own" — mockup ciclo incasso 2a)
// IBAN (con QR bonifico EPC automatico sui documenti), PayPal.me,
// Satispay, note libere. Tutti facoltativi. Aiuto passo-passo
// per PayPal/Satispay pensato per utenti poco tecnologici.
// ============================================================

import { useActionState, useEffect, useState } from 'react'
import { Loader2, Save, HelpCircle, QrCode } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { updateWorkspacePayments } from '@/lib/actions/workspace'
import type { Database } from '@/types/database'

type Workspace = Database['public']['Tables']['workspaces']['Row']

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  boxShadow: '0 1px 2px rgba(20,20,40,.05), 0 8px 24px -10px rgba(20,20,40,.15)',
  padding: '15px 15px',
}
const sectionLabelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: '.07em',
  textTransform: 'uppercase',
  color: '#6f6d64',
  marginBottom: 12,
}
const fieldLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '.05em',
  textTransform: 'uppercase',
  color: 'var(--cc-muted)',
  marginBottom: 7,
}
const fieldStyle: React.CSSProperties = {
  border: '1px solid #e3e3e6',
  borderRadius: 10,
  padding: '11px 12px',
  fontSize: 14,
  color: '#161616',
  width: '100%',
  background: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

function HelpToggle({ title, steps }: { title: string; steps: string[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ marginTop: 7 }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 600, color: '#1a1a2e', cursor: 'pointer', fontFamily: 'inherit' }}
      >
        <HelpCircle size={14} /> {title}
      </button>
      {open && (
        <ol style={{ margin: '8px 0 0', paddingLeft: 18, background: '#fafafa', borderRadius: 10, padding: '10px 12px 10px 28px', fontSize: 12, color: '#55534b', lineHeight: 1.7 }}>
          {steps.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
      )}
    </div>
  )
}

export function ImpostazioniPagamenti({ workspace }: { workspace: Workspace }) {
  const [state, formAction, isPending] = useActionState(updateWorkspacePayments, null)

  useEffect(() => {
    if (state?.success) {
      toast.success('Impostazioni salvate', { description: 'I canali compariranno sui documenti che invii.', closeButton: true })
    }
  }, [state])

  // Colonne 038 non ancora in types/database.ts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 038 non ancora in types/database.ts
  const ws = workspace as any

  return (
    <form action={formAction}>
      {state?.error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div style={cardStyle}>
        <div style={sectionLabelStyle}>Come ti pagano i clienti</div>
        <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.5, margin: '0 0 12px' }}>
          Compila solo i canali che usi: compariranno in un riquadro &ldquo;Come pagare&rdquo; sulle
          fatture che invii e sui preventivi accettati. Tutti facoltativi.
        </p>

        <div style={fieldLabelStyle}>IBAN</div>
        <input
          name="payment_iban"
          defaultValue={ws.payment_iban ?? ''}
          placeholder="IT60 X054 2811 1010 0000 0123 456"
          autoComplete="off"
          spellCheck={false}
          style={{ ...fieldStyle, textTransform: 'uppercase' }}
        />
        <p style={{ display: 'flex', alignItems: 'flex-start', gap: 5, fontSize: 12, color: '#767676', lineHeight: 1.5, marginTop: 7 }}>
          <QrCode size={14} style={{ flexShrink: 0, marginTop: 2, color: 'var(--cc-muted)' }} />
          <span>
            Con l&rsquo;IBAN, sui documenti compare anche un <b>QR code bonifico</b>: il cliente lo
            inquadra con l&rsquo;app della sua banca e trova il bonifico già compilato con importo e causale. Gratis.
          </span>
        </p>

        <div style={{ ...fieldLabelStyle, marginTop: 14 }}>Intestatario del conto</div>
        <input
          name="payment_iban_holder"
          defaultValue={ws.payment_iban_holder ?? ''}
          placeholder="Es. Mario Bianchi Impianti"
          autoComplete="off"
          style={fieldStyle}
        />
        <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.5, marginTop: 7 }}>
          Il nome che compare nel bonifico: scrivi l&rsquo;intestazione esatta del conto
          (se vuoto usiamo il nome della tua attività).
        </p>

        <div style={{ ...fieldLabelStyle, marginTop: 14 }}>Link PayPal.me</div>
        <input
          name="payment_paypal_url"
          defaultValue={ws.payment_paypal_url ?? ''}
          placeholder="paypal.me/tuonome"
          autoComplete="off"
          spellCheck={false}
          style={fieldStyle}
        />
        <HelpToggle
          title="Come trovo il mio link PayPal.Me?"
          steps={[
            'Dal telefono o dal computer vai su paypal.com/paypalme (anche dal browser, non serve per forza l’app).',
            'Accedi con il tuo conto PayPal — se non ce l’hai, la registrazione è gratuita.',
            'Scegli il tuo nome utente: diventa il tuo link, es. paypal.me/mariobianchi.',
            'Copia il link e incollalo qui sopra.',
          ]}
        />

        <div style={{ ...fieldLabelStyle, marginTop: 14 }}>Link Satispay</div>
        <input
          name="payment_satispay_url"
          defaultValue={ws.payment_satispay_url ?? ''}
          placeholder="Link o QR dal tuo Satispay Business"
          autoComplete="off"
          spellCheck={false}
          style={fieldStyle}
        />
        <HelpToggle
          title="Come trovo il mio link Satispay?"
          steps={[
            'Ti serve un account Satispay Business: è gratuito ed è diverso dal Satispay che usi come privato.',
            'Registrati (o accedi) su dashboard.satispay.com, oppure con l’app “Satispay Business”.',
            'Nel tuo profilo Business trovi il link/QR per farti pagare a distanza: copialo e incollalo qui.',
            'Non lo trovi? Nessun problema: lascia vuoto e usa IBAN (col QR bonifico) o PayPal.',
          ]}
        />

        <div style={{ ...fieldLabelStyle, marginTop: 14 }}>Note per il cliente</div>
        <textarea
          name="payment_notes"
          defaultValue={ws.payment_notes ?? ''}
          placeholder="Accetto anche contanti in cantiere."
          rows={2}
          maxLength={300}
          style={{ ...fieldStyle, resize: 'none' }}
        />
        <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.5, marginTop: 7 }}>
          Compare in fondo al riquadro &ldquo;Come pagare&rdquo;. Se lo lasci vuoto non compare nulla.
        </p>
      </div>

      <div style={{ marginTop: 16 }}>
        <button
          type="submit"
          disabled={isPending}
          style={{
            width: '100%',
            background: '#1a1a2e',
            color: '#fff',
            borderRadius: 12,
            height: 50,
            boxSizing: 'border-box',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)',
          }}
        >
          {isPending ? (
            <><Loader2 className="size-4 animate-spin" /> Salvataggio…</>
          ) : (
            <><Save size={18} /> Salva</>
          )}
        </button>
      </div>
    </form>
  )
}
