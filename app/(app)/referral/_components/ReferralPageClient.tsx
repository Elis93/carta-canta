'use client'

// ============================================================
// ReferralPageClient — pagina "Porta un amico"
// ============================================================

import { useState } from 'react'
import { Copy, Check, Gift, Users, Star, Clock, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'

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
  condition: string           // "almeno 3 referral con Piano Team"
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
        step2:     'I tuoi amici si registrano e attivano qualsiasi piano a pagamento (Pro o Team).',
        threshold: 'Almeno 3 referral con qualsiasi abbonamento attivo, conteggiati il 1° di ogni mese.',
        scenarios: [
          {
            id:        'full',
            label:     'Beneficio',
            condition: 'almeno 3 referral con qualsiasi abbonamento attivo',
            benefit:   '1 mese di Piano Pro gratuito',
            detail:    '(attivato automaticamente il 1° del mese successivo)',
          },
        ],
      }

    case 'pro':
    case 'lifetime':
      if (isAnnual) {
        return {
          headline:  'Porta almeno 3 amici con un abbonamento attivo ogni mese → la scadenza del tuo Pro annuale si allunga di 1 mese.',
          step2:     'I tuoi amici si registrano e attivano qualsiasi piano a pagamento (Pro o Team).',
          threshold: 'Almeno 3 referral con qualsiasi abbonamento attivo, conteggiati il 1° di ogni mese.',
          scenarios: [
            {
              id:        'full',
              label:     'Beneficio',
              condition: 'almeno 3 referral con qualsiasi abbonamento attivo',
              benefit:   'Scadenza abbonamento annuale +1 mese',
              detail:    '(la data di rinnovo si sposta avanti di 30 giorni)',
            },
          ],
        }
      }
      return {
        headline:  'Porta almeno 3 amici con un abbonamento attivo ogni mese → il tuo rinnovo Pro di €19 non viene addebitato.',
        step2:     'I tuoi amici si registrano e attivano qualsiasi piano a pagamento (Pro o Team).',
        threshold: 'Almeno 3 referral con qualsiasi abbonamento attivo, conteggiati il 1° di ogni mese.',
        scenarios: [
          {
            id:        'full',
            label:     'Beneficio',
            condition: 'almeno 3 referral con qualsiasi abbonamento attivo',
            benefit:   'Rinnovo mensile di €19 non addebitato',
            detail:    '(il mese è completamente gratuito)',
          },
        ],
      }

    case 'team':
      if (isAnnual) {
        return {
          headline:  'Porta almeno 3 amici Team → scadenza annuale +1 mese. Con almeno 3 referral Pro → +2 settimane.',
          step2:     'I tuoi amici si registrano e attivano un Piano Team (beneficio completo) o Piano Pro (beneficio ridotto).',
          threshold: 'Almeno 3 referral Team o Pro attivi, conteggiati il 1° di ogni mese.',
          scenarios: [
            {
              id:        'full',
              label:     'Scenario completo',
              condition: 'almeno 3 referral con Piano Team attivo',
              benefit:   'Scadenza annuale +1 mese',
              detail:    '(la data di rinnovo si sposta avanti di 30 giorni)',
            },
            {
              id:        'partial',
              label:     'Scenario parziale',
              condition: 'almeno 3 referral con Piano Pro (senza Team)',
              benefit:   'Scadenza annuale +2 settimane',
              detail:    '(la data di rinnovo si sposta avanti di 14 giorni)',
            },
          ],
        }
      }
      return {
        headline:  'Porta almeno 3 amici Team → il tuo rinnovo di €49 non viene addebitato. Con almeno 3 referral Pro → 50% di sconto.',
        step2:     'I tuoi amici si registrano e attivano un Piano Team (beneficio completo) o Piano Pro (beneficio ridotto).',
        threshold: 'Almeno 3 referral Team o Pro attivi, conteggiati il 1° di ogni mese.',
        scenarios: [
          {
            id:        'full',
            label:     'Scenario completo',
            condition: 'almeno 3 referral con Piano Team attivo',
            benefit:   'Rinnovo mensile di €49 non addebitato',
            detail:    '(il mese è completamente gratuito)',
          },
          {
            id:        'partial',
            label:     'Scenario parziale',
            condition: 'almeno 3 referral con Piano Pro (senza Team)',
            benefit:   '50% di sconto sul rinnovo mensile',
            detail:    '(paghi €24,50 invece di €49)',
          },
        ],
      }

    default:
      return {
        headline:  'Porta almeno 3 amici con un abbonamento attivo → ottieni un beneficio mensile.',
        step2:     'I tuoi amici si registrano e attivano qualsiasi piano a pagamento.',
        threshold: 'Almeno 3 referral con qualsiasi abbonamento attivo.',
        scenarios: [
          {
            id:      'full',
            label:   'Beneficio',
            condition: 'almeno 3 referral',
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
    rows: [{ condition: 'almeno 3 referral con qualsiasi piano', benefit: '→ 1 mese Piano Pro gratuito' }],
  },
  {
    plan: 'Pro mensile',
    rows: [{ condition: 'almeno 3 referral con qualsiasi piano', benefit: '→ Rinnovo €19 non addebitato' }],
  },
  {
    plan: 'Pro annuale',
    rows: [{ condition: 'almeno 3 referral con qualsiasi piano', benefit: '→ Scadenza +1 mese' }],
  },
  {
    plan: 'Team mensile',
    rows: [
      { condition: 'almeno 3 referral con Piano Team', benefit: '→ Rinnovo €49 non addebitato' },
      { condition: 'almeno 3 referral con Piano Pro',  benefit: '→ 50% di sconto (€24,50)' },
    ],
  },
  {
    plan: 'Team annuale',
    rows: [
      { condition: 'almeno 3 referral con Piano Team', benefit: '→ Scadenza +1 mese' },
      { condition: 'almeno 3 referral con Piano Pro',  benefit: '→ Scadenza +2 settimane' },
    ],
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
    })
  }

  const benefit = getBenefitData(plan, billingInterval)
  const isTeam  = plan === 'team'

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
          Il tuo beneficio
        </p>

        {isTeam && benefit.scenarios.length === 2 ? (
          // Team: due scenari side-by-side — la condition serve per distinguerli
          <div className="grid sm:grid-cols-2 gap-3">
            {benefit.scenarios.map((s) => (
              <div
                key={s.id}
                className={[
                  'rounded-lg px-3 py-3 space-y-1 border',
                  s.id === 'full'
                    ? 'border-green-200 bg-green-50'
                    : 'border-amber-200 bg-amber-50',
                ].join(' ')}
              >
                <p className={[
                  'text-xs font-bold uppercase tracking-wide',
                  s.id === 'full' ? 'text-green-700' : 'text-amber-700',
                ].join(' ')}>
                  {s.label}
                </p>
                <p className="text-xs text-muted-foreground">{s.condition}</p>
                <p className="text-sm font-semibold text-foreground">{s.benefit}</p>
                <p className="text-xs text-muted-foreground">{s.detail}</p>
              </div>
            ))}
          </div>
        ) : (
          // Free / Pro: singolo scenario — condition già nell'headline, mostra solo beneficio
          benefit.scenarios.map((s) => (
            <div key={s.id} className="space-y-0.5">
              <p className="text-base font-bold text-foreground">{s.benefit}</p>
              <p className="text-xs text-muted-foreground">{s.detail}</p>
            </div>
          ))
        )}
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
          <p className="text-sm font-medium">Il tuo codice referral</p>

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

          <p className="text-xs text-muted-foreground">
            💡 Condividi su WhatsApp, Telegram o via email con i tuoi colleghi.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          Codice referral non ancora disponibile. Ricarica la pagina.
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
          <p className="text-2xl font-bold text-amber-600">{totalRewards}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Invitati abbonati</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <TrendingUp className="size-5 text-green-600 mx-auto mb-1" />
          <p className="text-2xl font-bold text-green-600">{totalFreeMonths}</p>
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
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
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
          <p>Non hai ancora referral. Condividi il tuo codice per iniziare!</p>
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
              (plan === 'team' && rule.plan.toLowerCase().startsWith('team'))
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
        Il beneficio viene calcolato il 1° di ogni mese in base ai referral con abbonamento
        attivo in quel momento. I referral con abbonamento scaduto o cancellato non contano.
        Per i piani mensili il credito viene scalato automaticamente dalla prossima fattura.
        Per i piani annuali la data di scadenza viene estesa direttamente.
        Non trasferibile. Carta Canta si riserva il diritto di modificare o interrompere
        il programma in qualsiasi momento con preavviso ragionevole.
      </p>
    </div>
  )
}
