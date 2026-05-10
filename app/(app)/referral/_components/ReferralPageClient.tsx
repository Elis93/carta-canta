'use client'

// ============================================================
// ReferralPageClient — pagina "Porta un amico"
//
// Mostra:
//   • Beneficio specifico per il piano dell'utente
//   • Codice referral personale + link di condivisione
//   • Come funziona (3 step)
//   • Tabella completa delle regole per tutti i piani
//   • Statistiche: iscritti, conversioni, benefici maturati
// ============================================================

import { useState } from 'react'
import { Copy, Check, Gift, Users, Star, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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

// ── Logica benefici per piano ─────────────────────────────────────────────────

interface PlanBenefit {
  pianoDiplay: string
  threshold: string
  rows: { condition: string; benefit: string }[]
}

function getPlanBenefit(plan: string, billingInterval: string | null): PlanBenefit {
  const isAnnual = billingInterval === 'year'

  switch (plan) {
    case 'free':
      return {
        pianoDiplay: 'Free',
        threshold: '3 amici con qualsiasi abbonamento attivo',
        rows: [
          {
            condition: '3 referral con qualsiasi piano',
            benefit: '1 mese di Piano Pro gratuito',
          },
        ],
      }

    case 'pro':
    case 'lifetime':
      if (isAnnual) {
        return {
          pianoDiplay: 'Pro annuale',
          threshold: '3 amici con qualsiasi abbonamento attivo',
          rows: [
            {
              condition: '3 referral con qualsiasi piano',
              benefit: 'Scadenza abbonamento +1 mese',
            },
          ],
        }
      }
      return {
        pianoDiplay: 'Pro mensile',
        threshold: '3 amici con qualsiasi abbonamento attivo',
        rows: [
          {
            condition: '3 referral con qualsiasi piano',
            benefit: 'Rinnovo mensile non addebitato',
          },
        ],
      }

    case 'team':
      if (isAnnual) {
        return {
          pianoDiplay: 'Team annuale',
          threshold: '3 amici con Piano Team o Pro attivo',
          rows: [
            {
              condition: '3+ referral con Piano Team',
              benefit: 'Scadenza abbonamento +1 mese',
            },
            {
              condition: '3+ referral con Piano Pro (senza Team)',
              benefit: 'Scadenza abbonamento +2 settimane',
            },
          ],
        }
      }
      return {
        pianoDiplay: 'Team mensile',
        threshold: '3 amici con Piano Team o Pro attivo',
        rows: [
          {
            condition: '3+ referral con Piano Team',
            benefit: 'Rinnovo mensile non addebitato',
          },
          {
            condition: '3+ referral con Piano Pro (senza Team)',
            benefit: '50% di sconto sul rinnovo mensile',
          },
        ],
      }

    default:
      return {
        pianoDiplay: '—',
        threshold: '3 amici con qualsiasi abbonamento attivo',
        rows: [{ condition: '3 referral', benefit: '1 mese gratuito' }],
      }
  }
}

// ── Tabella completa di tutte le regole (per tutti i piani) ───────────────────

const ALL_RULES = [
  {
    plan: 'Free',
    rows: [
      { condition: '3 referral con qualsiasi piano', benefit: '1 mese di Piano Pro gratuito' },
    ],
  },
  {
    plan: 'Pro mensile',
    rows: [
      { condition: '3 referral con qualsiasi piano', benefit: 'Rinnovo mensile non addebitato' },
    ],
  },
  {
    plan: 'Pro annuale',
    rows: [
      { condition: '3 referral con qualsiasi piano', benefit: 'Scadenza abbonamento +1 mese' },
    ],
  },
  {
    plan: 'Team mensile',
    rows: [
      { condition: '3+ referral con Piano Team', benefit: 'Rinnovo mensile non addebitato' },
      { condition: '3+ referral con Piano Pro (senza Team)', benefit: '50% di sconto sul rinnovo' },
    ],
  },
  {
    plan: 'Team annuale',
    rows: [
      { condition: '3+ referral con Piano Team', benefit: 'Scadenza abbonamento +1 mese' },
      { condition: '3+ referral con Piano Pro (senza Team)', benefit: 'Scadenza abbonamento +2 settimane' },
    ],
  },
]

// ── Componente ────────────────────────────────────────────────────────────────

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
  const [showAllRules, setShowAllRules] = useState(false)

  function copyText(text: string, setCopied: (v: boolean) => void) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const benefit = getPlanBenefit(plan, billingInterval)

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">

      {/* ── Intestazione ── */}
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Gift className="size-6 text-primary" />
          Porta un amico
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Porta 3 amici con un abbonamento attivo ogni mese e ricevi un beneficio
          in base al tuo piano. Nessun limite al numero di mesi.
        </p>
      </div>

      {/* ── Il tuo beneficio (plan-aware) ── */}
      <div className="rounded-xl border-2 border-primary/30 bg-primary/5 px-5 py-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-primary">
            Il tuo beneficio — Piano {benefit.pianoDiplay}
          </p>
          <span className="text-xs text-muted-foreground">
            ogni mese con 3+ referral
          </span>
        </div>

        <div className="space-y-2">
          {benefit.rows.map((row, i) => (
            <div key={i} className="flex items-start gap-3 text-sm">
              {/* Scenario indicator — solo per piani con due scenari */}
              {benefit.rows.length > 1 && (
                <span className="shrink-0 mt-0.5 text-xs font-semibold text-primary/60 w-4 text-right">
                  {i === 0 ? 'A' : 'B'}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <span className="text-muted-foreground">{row.condition}</span>
                <span className="mx-2 text-muted-foreground/40">→</span>
                <strong className="text-foreground">{row.benefit}</strong>
              </div>
            </div>
          ))}
        </div>

        {/* Threshold reminder */}
        <p className="text-xs text-muted-foreground border-t border-primary/10 pt-2">
          Soglia: <strong>{benefit.threshold}</strong>, conteggiati il 1° di ogni mese.
        </p>
      </div>

      {/* ── Come funziona ── */}
      <div className="rounded-lg border bg-card px-4 py-4 space-y-3">
        <p className="text-sm font-semibold">Come funziona</p>
        <ol className="space-y-2.5">
          {[
            'Condividi il tuo codice o link con colleghi artigiani, freelance o professionisti.',
            'I tuoi amici si registrano e attivano un piano a pagamento (qualsiasi piano).',
            'Il 1° di ogni mese contiamo i referral con abbonamento attivo: se sono almeno 3, il beneficio viene applicato automaticamente.',
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
          <p className="text-xs text-muted-foreground mt-0.5">Mesi ottenuti</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <Clock className="size-5 text-muted-foreground mx-auto mb-1" />
          <p className="text-2xl font-bold">{pendingRewards}</p>
          <p className="text-xs text-muted-foreground mt-0.5">In attesa</p>
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

      {/* ── Tutte le regole (accordion) ── */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAllRules((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/40 transition-colors"
        >
          <span>Regole complete per tutti i piani</span>
          {showAllRules
            ? <ChevronUp className="size-4 text-muted-foreground" />
            : <ChevronDown className="size-4 text-muted-foreground" />
          }
        </button>

        {showAllRules && (
          <div className="border-t divide-y text-sm">
            {ALL_RULES.map((group) => (
              <div key={group.plan} className="px-4 py-3 space-y-1.5">
                <p className="font-semibold text-foreground">{group.plan}</p>
                {group.rows.map((row, i) => (
                  <div key={i} className="flex items-start gap-2 text-muted-foreground pl-2">
                    {group.rows.length > 1 && (
                      <span className="text-xs font-bold text-primary/60 shrink-0 mt-0.5">
                        {i === 0 ? 'A' : 'B'}
                      </span>
                    )}
                    <span>{row.condition}</span>
                    <span className="text-muted-foreground/40 shrink-0">→</span>
                    <strong className="text-foreground">{row.benefit}</strong>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Note legali ── */}
      <p className="text-xs text-muted-foreground border-t pt-4 leading-relaxed">
        Il beneficio viene calcolato il 1° di ogni mese in base ai referral con abbonamento attivo
        in quel momento. I referral con abbonamento scaduto o cancellato non contano per la soglia.
        Il credito su abbonamenti mensili viene scalato automaticamente dalla fattura Stripe.
        Sugli abbonamenti annuali la scadenza viene estesa direttamente.
        Non trasferibile. Carta Canta si riserva il diritto di modificare
        o interrompere il programma referral in qualsiasi momento.
      </p>
    </div>
  )
}
