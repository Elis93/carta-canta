'use client'

// ============================================================
// ChiediRecensioneButton — "Chiedi una recensione" sulla fattura saldata.
//
// PERCHÉ (7 ago 2026). La recensione si poteva già lasciare, ma era di fatto
// INVISIBILE: il riquadro compare sul link pubblico solo DOPO che la fattura
// è segnata pagata, e a quel punto il cliente quel link l'ha già chiuso da un
// pezzo. Nessuna email lo avvisava. Risultato: funzione viva nel codice e
// morta nella realtà.
//
// PERCHÉ MANUALE E NON AUTOMATICO. La ricerca dice che la richiesta di
// recensione converte molto meglio su WhatsApp che via email, e che va
// mandata subito dopo il lavoro con il link diretto. Ma un'email automatica
// verso il cliente FINALE dell'artigiano è fra le cose bloccate dalla regola
// B.0 (consenso, spam) finché non risponde l'avvocato. Quindi: il messaggio
// lo scrive l'app, a mandarlo è l'artigiano, quando vuole lui — stessa scelta
// già fatta per i solleciti.
//
// ⚠️ Compare solo con la VETRINA PUBBLICATA: senza, la recensione la
// leggerebbe soltanto l'artigiano e chiederla al cliente sarebbe una cortesia
// a vuoto.
// ============================================================

import { useState } from 'react'
import { Star, MessageCircle, Mail, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { waMeHref, whatsappUtilizzabile } from '@/lib/whatsapp'
import { SpiegaCampo } from '@/components/shared/SpiegaCampo'

export function ChiediRecensioneButton({
  publicUrl,
  clientName,
  clientPhone,
  clientEmail,
  workspaceName,
}: {
  publicUrl: string
  clientName: string | null
  clientPhone: string | null
  clientEmail: string | null
  workspaceName: string
}) {
  const [copied, setCopied] = useState(false)

  // Nome proprio se c'è: "Ciao Mario" funziona meglio di "Buongiorno".
  const saluto = clientName?.trim() ? `Ciao ${clientName.trim().split(' ')[0]}` : 'Buongiorno'
  const testo =
    `${saluto}, grazie per aver scelto ${workspaceName}. ` +
    `Se ti sei trovato bene, mi aiuti molto con una breve recensione: ` +
    `basta un minuto da qui — ${publicUrl}`

  // Il bottone compare solo se wa.me sa a chi mandare: numero con prefisso
  // internazionale (qualunque paese) oppure mobile italiano. Un numero
  // straniero salvato senza +41/+33 non è indovinabile → resta Email/Copia.
  const canWhatsapp = whatsappUtilizzabile(clientPhone)

  async function copia() {
    try {
      await navigator.clipboard.writeText(testo)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
      toast.success('Messaggio copiato', { description: 'Incollalo dove preferisci.', closeButton: true })
    } catch {
      toast.error('Non sono riuscito a copiare. Tieni premuto sul testo per selezionarlo.', { closeButton: true })
    }
  }

  const btn: React.CSSProperties = {
    flex: 1, minWidth: 0, height: 44, borderRadius: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit',
    border: '1px solid #e7e7ea', background: '#fff', color: '#1a1a2e',
    cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap',
    boxShadow: '0 1px 2px rgba(20,20,40,.05)',
  }

  return (
    <div style={{ background: '#fff', borderRadius: 14, boxShadow: 'var(--cc-shadow)', padding: '14px 15px' }}>
      {/* La spiegazione sta nel punto ⓘ (Eli, 11 ago) */}
      <SpiegaCampo
        etichetta={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <Star size={15} style={{ color: '#b08d3e' }} />
            <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64' }}>
              Chiedi una recensione
            </span>
          </span>
        }
        style={{ marginBottom: 11 }}
      >
        Il messaggio è già pronto, con il link alla recensione. Su WhatsApp i clienti
        rispondono molto più spesso che via email.
      </SpiegaCampo>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {canWhatsapp && (
          <a href={waMeHref(clientPhone!, testo)} target="_blank" rel="noopener noreferrer" style={btn}>
            <MessageCircle size={16} /> WhatsApp
          </a>
        )}
        {clientEmail && (
          <a
            href={`mailto:${clientEmail}?subject=${encodeURIComponent(`Grazie da ${workspaceName}`)}&body=${encodeURIComponent(testo)}`}
            style={btn}
          >
            <Mail size={16} /> Email
          </a>
        )}
        <button type="button" onClick={copia} style={btn}>
          {copied ? <Check size={16} style={{ color: '#2f8a63' }} /> : <Copy size={16} />}
          {copied ? 'Copiato' : 'Copia testo'}
        </button>
      </div>
    </div>
  )
}
