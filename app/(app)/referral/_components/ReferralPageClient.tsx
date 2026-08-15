'use client'

// ============================================================
// ReferralPageClient — pagina "Porta un amico"
// ============================================================

import { useState } from 'react'
import { Copy, Check, Gift, Users, Star, Clock, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

interface ReferralPageClientProps {
  code:             string | null
  shareUrl:         string | null
  totalUses:        number
  totalRewards:     number
  pendingRewards:   number
  totalFreeMonths:  number
  plan:             string   // 'free' | 'pro' | 'team' | 'lifetime'
  billingInterval:  string | null  // 'month' | 'year' | null
}

// ── Dati beneficio per piano ──────────────────────────────────────────────────

interface Scenario {
  id:        'full' | 'partial'
  label:     string           // "Scenario completo"
  condition: string           // "almeno 3 inviti con Piano Team"
  benefit:   string           // "Rinnovo mensile non addebitato"
  detail:    string           // "(risparmio €49/mese)"
}

interface BenefitData {
  headline:     string           // frase principale per l'intestazione
  step2:        string           // testo step 2 "Come funziona"
  scenarios:    Scenario[]
  threshold:    string           // nota soglia per card
}

function getBenefitData(plan: string, billingInterval: string | null): BenefitData {
  const isAnnual = billingInterval === 'year'

  switch (plan) {
    case 'free':
      return {
        headline:  'Porta almeno 3 amici che attivano un abbonamento → ottieni 1 mese di Piano Pro gratuito.',
        step2:     'I tuoi amici si registrano e attivano il Piano Pro.',
        threshold: 'Almeno 3 inviti con qualsiasi abbonamento attivo, conteggiati il 1° di ogni mese.',
        scenarios: [
          {
            id:        'full',
            label:     'Beneficio',
            condition: 'almeno 3 inviti con qualsiasi abbonamento attivo',
            benefit:   '1 mese di Piano Pro gratuito',
            detail:    '(attivato automaticamente il 1° del mese successivo)',
          },
        ],
      }

    case 'pro':
    case 'lifetime':
      if (isAnnual) {
        return {
          headline:  'Porta almeno 3 amici con un abbonamento attivo ogni mese → la scadenza del tuo Pro annuale viene posticipata di 1 mese.',
          step2:     'I tuoi amici si registrano e attivano il Piano Pro.',
          threshold: 'Almeno 3 inviti con qualsiasi abbonamento attivo, conteggiati il 1° di ogni mese.',
          scenarios: [
            {
              id:        'full',
              label:     'Beneficio',
              condition: 'almeno 3 inviti con qualsiasi abbonamento attivo',
              benefit:   'Scadenza abbonamento posticipata di 1 mese',
              detail:    '(la data di rinnovo si sposta avanti di 30 giorni)',
            },
          ],
        }
      }
      return {
        headline:  'Porta almeno 3 amici con un abbonamento attivo ogni mese → il tuo rinnovo Pro di €19 non viene addebitato.',
        step2:     'I tuoi amici si registrano e attivano il Piano Pro.',
        threshold: 'Almeno 3 inviti con qualsiasi abbonamento attivo, conteggiati il 1° di ogni mese.',
        scenarios: [
          {
            id:        'full',
            label:     'Beneficio',
            condition: 'almeno 3 inviti con qualsiasi abbonamento attivo',
            benefit:   'Rinnovo mensile di €19 non addebitato',
            detail:    '(il mese è completamente gratuito)',
          },
        ],
      }

    // case 'team' removed — piano Team non più visibile nell'UI

    default:
      return {
        headline:  'Porta almeno 3 amici con un abbonamento attivo → ottieni un beneficio mensile.',
        step2:     'I tuoi amici si registrano e attivano qualsiasi piano a pagamento.',
        threshold: 'Almeno 3 inviti con qualsiasi abbonamento attivo.',
        scenarios: [
          {
            id:      'full',
            label:   'Beneficio',
            condition: 'almeno 3 inviti',
            benefit: '1 beneficio mensile',
            detail:  '',
          },
        ],
      }
  }
}

// ── Tabella sinottica (sempre visibile, compatta) ─────────────────────────────

const SYNOPTIC_RULES: {
  plan:  string
  rows:  { condition: string; benefit: string }[]
}[] = [
  {
    plan: 'Free',
    rows: [{ condition: 'almeno 3 inviti con qualsiasi piano', benefit: '→ 1 mese Piano Pro gratuito' }],
  },
  {
    plan: 'Pro mensile',
    rows: [{ condition: 'almeno 3 inviti con qualsiasi piano', benefit: '→ Rinnovo €19 non addebitato' }],
  },
  {
    plan: 'Pro annuale',
    rows: [{ condition: 'almeno 3 inviti con qualsiasi piano', benefit: '→ Scadenza posticipata di 1 mese' }],
  },
]

// ── Componente principale ─────────────────────────────────────────────────────

export function ReferralPageClient({
  code,
  shareUrl,
  totalUses,
  totalRewards,
  pendingRewards,
  totalFreeMonths,
  plan,
  billingInterval,
}: ReferralPageClientProps) {
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedUrl,  setCopiedUrl]  = useState(false)

  function copyText(text: string, setCopied: (v: boolean) => void) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      // Permessi clipboard negati / contesti non sicuri: senza questo
      // il tap non dava NESSUN feedback
      toast.error('Copia non riuscita — tieni premuto sul testo per copiarlo')
    })
  }

  const benefit = getBenefitData(plan, billingInterval)

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">

      {/* ── Intestazione ── */}
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Gift className="size-6 text-primary" />
          Porta un amico
        </h1>
        {/* Frase specifica per il piano — no genericità */}
        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
          {benefit.headline}
        </p>
      </div>

      {/* ── Beneficio per il tuo piano ── */}
      <div className="rounded-xl border-2 border-primary/25 bg-primary/5 p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary/70">
          Il tuo beneficio se porti un amico
        </p>

        {benefit.scenarios.map((s) => (
          <div key={s.id} className="space-y-0.5">
            <p className="text-base font-bold text-foreground">{s.benefit}</p>
            <p className="text-xs text-muted-foreground">{s.detail}</p>
          </div>
        ))}
      </div>

      {/* ── Come funziona ── */}
      <div className="rounded-lg border bg-card px-4 py-4 space-y-3">
        <p className="text-sm font-semibold">Come funziona</p>
        <ol className="space-y-2.5">
          {[
            'Condividi il tuo codice o link con colleghi artigiani, freelance o professionisti.',
            benefit.step2,
            'Il beneficio viene applicato automaticamente ogni mese — nessun codice da inserire.',
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

      {/* ── Codice + Link ── */}
      {code && shareUrl ? (
        <div className="rounded-lg border bg-card p-4 space-y-4">
          <p className="text-sm font-medium">Il tuo codice invito</p>

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
                ? <><Check className="size-4 text-[#2f8a63]" /> Copiato!</>
                : <><Copy className="size-4" /> Copia</>
              }
            </Button>
          </div>

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
                  ? <><Check className="size-4 text-[#2f8a63]" /> Copiato!</>
                  : <><Copy className="size-4" /> Copia</>
                }
              </Button>
            </div>
          </div>

          {/* Condivisione diretta WhatsApp — il canale n.1 per gli artigiani */}
          <a
            href={`https://wa.me/?text=${encodeURIComponent(
              `Ciao! Per preventivi e fatture dal telefono uso Carta Canta: il preventivo è fatto in un minuto e il cliente lo firma da un link. Provala gratis: ${shareUrl}`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', height: 46, borderRadius: 12, background: '#1a1a2e', color: '#fff',
              fontSize: 14, fontWeight: 600, textDecoration: 'none',
              boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)',
            }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Condividi su WhatsApp
          </a>

          <p className="text-xs text-muted-foreground">
            Oppure incolla il link su Telegram, SMS o email.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          Codice invito non ancora disponibile. Ricarica la pagina.
        </div>
      )}

      {/* ── Statistiche ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3 text-center">
          <Users className="size-5 text-muted-foreground mx-auto mb-1" />
          <p className="text-2xl font-bold">{totalUses}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Invitati registrati</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <Star className="size-5 text-amber-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-[#b0863e]">{totalRewards}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Invitati abbonati</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <TrendingUp className="size-5 text-[#2f8a63] mx-auto mb-1" />
          <p className="text-2xl font-bold text-[#2f8a63]">{totalFreeMonths}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Benefici applicati</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <Clock className="size-5 text-muted-foreground mx-auto mb-1" />
          <p className="text-2xl font-bold">{pendingRewards}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Benefici in attesa</p>
        </div>
      </div>

      {/* Banner premi in attesa */}
      {pendingRewards > 0 && (
        <div className="rounded-lg border border-[#e8d6ad] bg-[#f5e9d0] px-4 py-3 text-sm text-[#b0863e] flex items-center gap-2">
          <Clock className="size-4 shrink-0" />
          <span>
            Hai <strong>{pendingRewards}</strong>{' '}
            {pendingRewards === 1 ? 'beneficio in attesa' : 'benefici in attesa'}.
            {' '}Verrà applicato automaticamente il 1° del mese successivo.
          </span>
        </div>
      )}

      {/* Stato vuoto */}
      {totalUses === 0 && (
        <div className="text-center py-6 text-sm text-muted-foreground">
          <Gift className="size-10 mx-auto mb-3 text-muted-foreground/30" />
          <p>Non hai ancora inviti. Condividi il tuo codice per iniziare!</p>
        </div>
      )}

      {/* ── Regole per tutti i piani (sempre visibile, compatta) ── */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <p className="px-4 py-3 text-sm font-semibold border-b">
          Riepilogo benefici per piano
        </p>
        <div className="divide-y text-xs">
          {SYNOPTIC_RULES.map((rule) => {
            const isHighlighted =
              rule.plan.toLowerCase().startsWith(plan) ||
              (plan === 'pro'  && rule.plan.toLowerCase().startsWith('pro')) ||
              false // piano team rimosso dall'UI
            return (
              <div key={rule.plan} className={isHighlighted ? 'bg-primary/5' : ''}>
                {rule.rows.map((row, i) => (
                  <div
                    key={i}
                    className={[
                      'grid grid-cols-[90px_1fr_1fr] gap-2 px-4 py-2 items-start',
                      isHighlighted ? 'font-medium' : 'text-muted-foreground',
                    ].join(' ')}
                  >
                    <span className="font-semibold text-foreground">
                      {i === 0 ? rule.plan : ''}
                    </span>
                    <span className="text-muted-foreground">{row.condition}</span>
                    <span className="text-foreground">{row.benefit}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      <Separator />

      {/* ── Note legali ── */}
      <p className="text-xs text-muted-foreground leading-relaxed">
        Il beneficio viene calcolato il 1° di ogni mese in base agli inviti con abbonamento
        attivo in quel momento. Gli inviti con abbonamento scaduto o cancellato non contano.
        Per i piani mensili il credito viene scalato automaticamente dalla prossima fattura.
        Per i piani annuali la data di scadenza viene estesa direttamente.
        Non trasferibile. Carta Canta si riserva il diritto di modificare o interrompere
        il programma in qualsiasi momento con preavviso ragionevole.
      </p>
    </div>
  )
}
