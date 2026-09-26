'use client'

// ============================================================
// AccontoCard — dettaglio preventivo accettato con acconto richiesto
// (mockup ciclo incasso 3c): acconto richiesto/saldo + "Acconto ricevuto".
// Dalla Fase 2 acconti (24 set) la registrazione CREA anche la fattura
// di acconto TD02 (sezionale ACC), già pronta da trasmettere: la card
// la linka e il promemoria dei 12 giorni parla della trasmissione.
// ============================================================

import { useState, useTransition } from 'react'
import { runAction } from '@/lib/run-action'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, Clock } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { registerDepositReceivedAction } from '@/lib/actions/documents'
import { parseImportoIt } from '@/lib/utils'
import { giornoItaliano, termineTrasmissione, scadenzaLabel } from '@/lib/sdi/termini'
import { Avviso } from '@/components/shared/Avviso'

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

const fieldStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #e3e3e6',
  borderRadius: 10,
  padding: '0 12px',
  height: 44,
  boxSizing: 'border-box',
  fontSize: 14,
  fontFamily: 'inherit',
  color: '#161616',
  background: '#fff',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  color: 'var(--cc-muted)',
  marginBottom: 6,
}

function fmtEuro(v: number): string {
  return `€\u00A0${v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}


export function AccontoCard({
  documentId,
  acconto,
  saldo,
  received,
  fatturaAcconto = null,
  bare = false,
}: {
  documentId: string
  acconto: number
  saldo: number
  /** Senza la cornice bianca: dentro una CardTendina «Acconto» (pagina A). */
  bare?: boolean
  /** Acconto già registrato: importo + data ISO (payment_status 'partial') */
  received: { amount: number; at: string | null } | null
  /** La fattura di acconto TD02 nata dalla registrazione (Fase 2, 24 set).
   *  Null anche sugli acconti registrati PRIMA della Fase 2: lì resta la
   *  vecchia strada («Converti in fattura» col trasferimento dell'acconto). */
  fatturaAcconto?: { id: string; numero: string | null; trasmessa: boolean } | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  // Acconto non richiesto nel preventivo (acconto = 0): campo vuoto, la cifra
  // la scrive l'artigiano — un «0,00» precompilato sarebbe un invito sbagliato.
  const [amount, setAmount] = useState(
    acconto > 0 ? acconto.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''
  )
  const [date, setDate] = useState(new Date().toLocaleDateString('sv-SE'))
  const [error, setError] = useState<string | null>(null)

  function handleConfirm() {
    setError(null)
    const parsed = parseImportoIt(amount)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Inserisci un importo valido (es. 549,00).')
      return
    }
    startTransition(async () => {
      const result = await runAction(() => registerDepositReceivedAction(documentId, parsed, date || undefined), 'registrare l’acconto')
      if (result?.error) {
        setError(result.error)
        return
      }
      toast.success('Acconto registrato', {
        description: 'L’incasso entra nelle Entrate del Bilancio.',
        closeButton: true,
      })
      // ⚠️ L'INCASSO dell'acconto è un fatto fiscale (art. 6 DPR 633/1972):
      // da quel giorno decorrono i 12 giorni per trasmettere la fattura di
      // acconto — che dalla Fase 2 (24 set) l'app CREA da sé, già pronta.
      // L'artigiano deve saperlo NEL MOMENTO in cui registra (Eli, 11 ago).
      if (result?.accontoNumero) {
        toast.info(`Fattura di acconto ${result.accontoNumero} creata`, {
          description: 'È già pronta: trasmettila allo SdI entro 12 giorni dall’incasso. La trovi fra le Fatture.',
          duration: 12000,
          closeButton: true,
        })
      } else {
        toast.info('Da oggi hai 12 giorni per la fattura d’acconto', {
          description: 'Incassare un acconto obbliga a emettere la fattura per la parte incassata.',
          duration: 12000,
          closeButton: true,
        })
      }
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <div style={bare ? undefined : { background: '#fff', borderRadius: 14, boxShadow: SH, padding: '13px 14px' }}>
      {/* Promemoria dei 12 giorni: compare finché l'acconto è incassato —
          il toast lo si legge una volta sola, questo resta. Con la TD02
          già creata (Fase 2) il promemoria riguarda la TRASMISSIONE;
          trasmessa → nessun avviso, è tutto a posto. */}
      {received && !fatturaAcconto?.trasmessa && (() => {
        const rif = giornoItaliano(received.at ? new Date(received.at) : new Date())
        const t = termineTrasmissione(rif)
        const numeroAcc = fatturaAcconto?.numero ?? null
        return (
          <Avviso gravita={t.fuoriTermine ? 'errore' : t.giorniRimasti <= 3 ? 'attenzione' : 'info'} icon={<Clock size={16} />} dentro style={{ marginBottom: 11 }}>
            <span>
              {fatturaAcconto ? (
                t.fuoriTermine ? (
                  <><b>Fattura di acconto oltre il termine</b>: andava trasmessa entro il{' '}
                    {scadenzaLabel(t.scadenza)}.{' '}
                    <a href={`/fatture/${fatturaAcconto.id}#sdi`} style={{ textDecoration: 'underline' }}>
                      Trasmettila comunque
                    </a>{' '}
                    e segnala il ritardo al commercialista.</>
                ) : (
                  <>La <b>fattura di acconto{numeroAcc ? ` ${numeroAcc}` : ''}</b>{' '}è pronta:{' '}
                    <a href={`/fatture/${fatturaAcconto.id}#sdi`} style={{ textDecoration: 'underline' }}>
                      trasmettila allo SdI
                    </a>{' '}
                    <b>entro il {scadenzaLabel(t.scadenza)}</b>{' '}
                    ({t.giorniRimasti === 0 ? 'oggi è l’ultimo giorno' : t.giorniRimasti === 1 ? 'manca 1 giorno' : `mancano ${t.giorniRimasti} giorni`}).</>
                )
              ) : t.fuoriTermine ? (
                <><b>Fattura d’acconto oltre il termine</b>: andava emessa entro il{' '}
                  {scadenzaLabel(t.scadenza)}. Falla comunque e parlane col commercialista.</>
              ) : (
                <>Per l’acconto incassato va emessa la <b>fattura d’acconto</b>{' '}
                  <b>entro il {scadenzaLabel(t.scadenza)}</b>{' '}
                  ({t.giorniRimasti === 0 ? 'oggi è l’ultimo giorno' : t.giorniRimasti === 1 ? 'manca 1 giorno' : `mancano ${t.giorniRimasti} giorni`}).</>
              )}
            </span>
          </Avviso>
        )
      })()}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#161616' }}>
            {received
              ? `Acconto ${fmtEuro(received.amount)} ricevuto${received.at ? ` il ${new Date(received.at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }).replace('.', '')}` : ''}`
              : acconto > 0 ? `Acconto richiesto: ${fmtEuro(acconto)}` : 'Nessun acconto richiesto nel preventivo'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--cc-muted)', marginTop: 2 }}>
            Saldo restante: {fmtEuro(received ? Math.max(0, acconto + saldo - received.amount) : saldo)}
          </div>
        </div>
        {received ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#d4efe2', color: '#2b2b2b', borderRadius: 999, padding: '3px 11px', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
            <CheckCircle2 size={13} style={{ color: '#2f8a63' }} /> Acconto
          </span>
        ) : acconto > 0 ? (
          <span style={{ background: '#f5e9d0', color: '#2b2b2b', borderRadius: 999, padding: '3px 11px', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
            In attesa
          </span>
        ) : null}
      </div>

      {!received && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            width: '100%', marginTop: 11, height: 44, border: 'none', borderRadius: 12,
            background: '#1a1a2e', color: '#fff', fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <CheckCircle2 size={16} /> Acconto ricevuto
        </button>
      )}

      {received && (
        <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.5, marginTop: 9 }}>
          {fatturaAcconto ? (
            <>La fattura di acconto{fatturaAcconto.numero ? <> <b>{fatturaAcconto.numero}</b></> : null}{' '}
              {fatturaAcconto.trasmessa ? 'è stata trasmessa allo SdI.' : 'è pronta fra le Fatture.'}{' '}
              <a href={`/fatture/${fatturaAcconto.id}`} style={{ textDecoration: 'underline', color: 'inherit' }}>
                Aprila
              </a></>
          ) : (
            <>All&rsquo;incasso di un acconto va emessa la <b>fattura d&rsquo;acconto</b>: puoi crearla
              con &ldquo;Converti in fattura&rdquo; indicando l&rsquo;importo dell&rsquo;acconto.</>
          )}
        </p>
      )}

      <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setError(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontSize: 17, fontWeight: 600 }}>Acconto ricevuto</DialogTitle>
            <DialogDescription style={{ fontSize: 13 }}>
              Registra l&rsquo;incasso dell&rsquo;acconto: entra nel Bilancio del mese.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label style={labelStyle} htmlFor="deposit-amount">Importo ricevuto</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="deposit-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  autoComplete="off"
                  style={{ ...fieldStyle, paddingRight: 28 }}
                  onKeyDown={(e) => { if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault() }}
                />
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--cc-muted)', fontSize: 14 }}>€</span>
              </div>
            </div>
            <div>
              <label style={labelStyle} htmlFor="deposit-date">Data incasso</label>
              <input id="deposit-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={fieldStyle} />
            </div>
            {error && <p style={{ fontSize: 13, color: '#dc2626', fontWeight: 500 }}>{error}</p>}
            <button
              type="button"
              onClick={handleConfirm}
              disabled={pending}
              style={{
                width: '100%', height: 48, border: 'none', borderRadius: 12,
                background: '#1a1a2e', color: '#fff', fontSize: 14, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)',
                opacity: pending ? 0.6 : 1, cursor: pending ? 'wait' : 'pointer', fontFamily: 'inherit',
              }}
            >
              {pending ? <Loader2 size={18} className="animate-spin" /> : null}
              Conferma
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
