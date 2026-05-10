'use client'

// ============================================================
// ReferralPageClient — pagina "Porta un amico"
//
// Mostra:
//   • Codice referral personale + pulsante copia
//   • Link di condivisione
//   • Statistiche: iscrizioni, conversioni, mesi gratuiti
//   • Banner con spiegazione del programma
// ============================================================

import { useState } from 'react'
import { Copy, Check, Gift, Users, Star, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface ReferralPageClientProps {
  code:             string | null
  shareUrl:         string | null
  totalUses:        number
  totalRewards:     number
  pendingRewards:   number
  totalFreeMonths:  number
}

export function ReferralPageClient({
  code,
  shareUrl,
  totalUses,
  totalRewards,
  pendingRewards,
  totalFreeMonths,
}: ReferralPageClientProps) {
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedUrl,  setCopiedUrl]  = useState(false)

  function copyText(text: string, setCopied: (v: boolean) => void) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Gift className="size-6 text-primary" />
          Porta un amico
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ogni amico che si iscrive e passa a Pro ti regala{' '}
          <strong>1 mese gratuito di Carta Canta Pro</strong>.
        </p>
      </div>

      {/* Come funziona */}
      <div className="rounded-lg border bg-primary/5 border-primary/20 px-4 py-4 space-y-3">
        <p className="text-sm font-semibold text-primary">Come funziona</p>
        <ol className="space-y-2">
          {[
            'Condividi il tuo link o codice con un collega artigiano.',
            'Il tuo amico si registra e prova Carta Canta gratuitamente.',
            'Appena attiva il piano Pro, tu ottieni 1 mese gratuito.',
            'Il credito viene scalato automaticamente dalla tua prossima fattura.',
          ].map((step, i) => (
            <li key={i} className="flex gap-3 text-sm text-muted-foreground">
              <span className="size-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0 font-semibold mt-0.5">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      {/* Codice + Link */}
      {code && shareUrl ? (
        <div className="rounded-lg border bg-card p-4 space-y-4">
          <p className="text-sm font-medium">Il tuo codice referral</p>

          {/* Codice */}
          <div className="flex gap-2 items-center">
            <div className="flex-1 rounded-md border bg-muted/50 px-3 py-2 font-mono text-lg font-bold tracking-widest text-center">
              {code}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyText(code, setCopiedCode)}
              className="shrink-0 gap-1.5"
            >
              {copiedCode
                ? <><Check className="size-4 text-green-600" /> Copiato!</>
                : <><Copy className="size-4" /> Copia</>
              }
            </Button>
          </div>

          {/* Link condivisione */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Oppure condividi il link diretto:</p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={shareUrl}
                className="text-xs h-8 font-mono bg-muted/50"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyText(shareUrl, setCopiedUrl)}
                className="shrink-0 gap-1.5"
              >
                {copiedUrl
                  ? <><Check className="size-4 text-green-600" /> Copiato!</>
                  : <><Copy className="size-4" /> Copia</>
                }
              </Button>
            </div>
          </div>

          {/* Suggerimenti condivisione */}
          <p className="text-xs text-muted-foreground">
            💡 Condividi su WhatsApp, Telegram o via email con i tuoi colleghi artigiani.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          Codice referral non ancora disponibile. Ricarica la pagina.
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3 text-center">
          <Users className="size-5 text-muted-foreground mx-auto mb-1" />
          <p className="text-2xl font-bold">{totalUses}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Iscritti</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <Star className="size-5 text-amber-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-amber-600">{totalRewards}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Conversioni</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <Gift className="size-5 text-green-600 mx-auto mb-1" />
          <p className="text-2xl font-bold text-green-600">{totalFreeMonths}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Mesi gratuiti</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <Clock className="size-5 text-muted-foreground mx-auto mb-1" />
          <p className="text-2xl font-bold">{pendingRewards}</p>
          <p className="text-xs text-muted-foreground mt-0.5">In attesa</p>
        </div>
      </div>

      {/* Badge premi in attesa */}
      {pendingRewards > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
          <Clock className="size-4 shrink-0" />
          <span>
            Hai <strong>{pendingRewards}</strong>{' '}
            {pendingRewards === 1 ? 'premio in attesa' : 'premi in attesa'}.
            {' '}Il credito verrà applicato automaticamente il 1° del mese,
            non appena la tua sottoscrizione Pro è attiva.
          </span>
        </div>
      )}

      {/* Nessuna conversione ancora */}
      {totalUses === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <Gift className="size-10 mx-auto mb-3 text-muted-foreground/30" />
          <p>Non hai ancora referral. Condividi il tuo codice per iniziare!</p>
        </div>
      )}

      {/* Note legali */}
      <p className="text-xs text-muted-foreground border-t pt-4">
        Il credito viene calcolato il 1° di ogni mese ed è applicabile solo al piano Pro mensile (€19/mese).
        Non trasferibile. Carta Canta si riserva il diritto di modificare o terminare il programma referral in qualsiasi momento.
      </p>
    </div>
  )
}
