'use client'

// ============================================================
// "Esci da tutti i dispositivi" — chiude ogni sessione aperta, ovunque.
//
// PERCHÉ SERVE: se il telefono viene perso o rubato, o se si sospetta che
// qualcuno sia entrato nell'account, cambiare la password non basta — le
// sessioni già aperte restano valide. Questo bottone le revoca tutte in una
// volta, compresa quella corrente (si rientra con le proprie credenziali).
// ============================================================

import { useState, useTransition } from 'react'
import { LogOut, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { runActionVoid } from '@/lib/run-action'
import { signOutEverywhereAction } from '@/lib/actions/sessions'

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  boxShadow: '0 1px 2px rgba(20,20,40,.05), 0 8px 24px -10px rgba(20,20,40,.15)',
  padding: '14px 15px',
  marginTop: 16,
}

export function SignOutEverywhereCard() {
  const [confirming, setConfirming] = useState(false)
  const [pending, start] = useTransition()

  function esci() {
    start(async () => {
      // runActionVoid ritorna il messaggio d'errore (o null): l'action fa
      // redirect al login, quindi in caso di successo qui non si arriva.
      const err = await runActionVoid(() => signOutEverywhereAction(), 'chiudere le sessioni')
      if (err) toast.error(err)
    })
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <LogOut size={20} style={{ color: 'var(--cc-muted)', flexShrink: 0 }} aria-hidden />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#161616' }}>Esci da tutti i dispositivi</div>
          <div style={{ fontSize: 12, color: '#767676', marginTop: 1, lineHeight: 1.45 }}>
            Chiude l&rsquo;accesso ovunque: telefono, computer, tablet. Usalo se hai perso il
            telefono o temi che qualcuno sia entrato nel tuo account.
          </div>
        </div>
        {!confirming && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            style={{ flexShrink: 0, border: '1px solid #e7e7ea', borderRadius: 10, background: '#fff', color: '#1a1a2e', fontSize: 13, fontWeight: 600, padding: '9px 14px', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Esci
          </button>
        )}
      </div>

      {confirming && (
        <div style={{ marginTop: 12, borderTop: '0.5px solid #eee', paddingTop: 12 }}>
          <p style={{ fontSize: 13, color: '#55534b', lineHeight: 1.5, margin: '0 0 10px' }}>
            Verrai disconnesso <b>anche da qui</b>: dovrai rientrare con email e password.
            I tuoi dati non vengono toccati.
          </p>
          <div style={{ display: 'flex', gap: 9 }}>
            <button
              type="button"
              onClick={esci}
              disabled={pending}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 10, height: 44, fontSize: 14, fontWeight: 600, cursor: pending ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: pending ? 0.7 : 1 }}
            >
              {pending ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
              Esci da tutti i dispositivi
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              style={{ border: '1px solid #e7e7ea', borderRadius: 10, background: '#fff', color: '#55534b', fontSize: 14, fontWeight: 600, padding: '0 16px', height: 44, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Annulla
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
