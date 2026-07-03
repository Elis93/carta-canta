import Link from 'next/link'
import { CheckCircle2, Crown, Users, Infinity as InfinityIcon, Zap, Settings } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { FREE_DOC_LIMIT, FREE_TRIAL_DAYS, checkFreeBlock } from '@/lib/free-trial'
import { aiImportLabel } from '@/lib/stripe/plans'
import type { Database } from '@/types/database'

type Workspace = Database['public']['Tables']['workspaces']['Row']

const PLAN_FEATURES: Record<string, string[]> = {
  free: [
    '8 preventivi · 30 giorni di prova',
    '1 template',
    'PDF professionale',
    'Link di accettazione cliente',
    'Watermark Carta Canta',
  ],
  pro: [
    'Preventivi illimitati',
    'Template illimitati',
    aiImportLabel('AI Import (foto → preventivo)'),
    'Watermark rimovibile',
  ],
  team: [
    'Tutto di Pro',
    'Fino a 5 utenti nel team',
    'Workflow di approvazione',
    'Ruoli: admin / operatore / viewer',
    'Analytics avanzate',
  ],
  lifetime: [
    'Accesso Pro per sempre',
    'Preventivi illimitati',
    aiImportLabel('AI Import'),
    'Watermark rimovibile',
    'Aggiornamenti futuri inclusi',
  ],
}

const PLAN_ICON = {
  free: Zap,
  pro: Crown,
  team: Users,
  lifetime: InfinityIcon,
}

const PLAN_LABEL: Record<string, string> = {
  free: 'Piano Free',
  pro: 'Piano Pro',
  team: 'Piano Pro',
  lifetime: 'Piano Lifetime',
}

// ── Stili condivisi (mockup) ────────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  boxShadow: '0 1px 2px rgba(20,20,40,.05), 0 8px 24px -10px rgba(20,20,40,.15)',
  padding: '15px 15px',
}

function FeatureRow({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '5px 0', fontSize: 14, color: '#161616' }}>
      <CheckCircle2 size={17} style={{ color: '#2f8a63', flex: '0 0 auto' }} aria-hidden />
      {label}
    </div>
  )
}

export function ImpostazioniPiano({ workspace }: { workspace: Workspace }) {
  const plan = workspace.plan
  // Piano Team nascosto: mostrato come Pro nell'UI (Team ⊇ Pro)
  const displayPlan = plan === 'team' ? 'pro' : plan
  const Icon = PLAN_ICON[displayPlan] ?? Zap
  const features = PLAN_FEATURES[displayPlan] ?? []
  const isFree = displayPlan === 'free'
  const iconColor = isFree ? '#1a1a2e' : '#c9a44c'
  const freeStatus = checkFreeBlock({
    id: workspace.id,
    plan: workspace.plan,
    free_trial_expires_at: workspace.free_trial_expires_at,
    sent_quota_used: workspace.sent_quota_used ?? 0,
  })

  return (
    <div>
      {/* ── Piano corrente ── */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: isFree ? 13 : 11 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: '#eceef5', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
            <Icon size={20} style={{ color: iconColor }} aria-hidden />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: '#161616' }}>{PLAN_LABEL[displayPlan] ?? `Piano ${displayPlan}`}</span>
              {!isFree && (
                <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 600, color: '#2f8a63', background: '#d4efe2', borderRadius: 999, padding: '2px 9px' }}>
                  Attivo
                </span>
              )}
              {isFree && freeStatus.blocked && (
                <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 600, color: '#a32d2d', background: '#f7dede', borderRadius: 999, padding: '2px 9px' }}>
                  Scaduto
                </span>
              )}
            </div>
            {!isFree && displayPlan !== 'lifetime' && workspace.billing_interval && (
              <div style={{ fontSize: 12.5, color: '#8a887f', marginTop: 1 }}>
                Fatturazione {workspace.billing_interval === 'year' ? 'annuale' : 'mensile'}
              </div>
            )}
            {!isFree && workspace.subscription_ends_at && (
              <div style={{ fontSize: 12.5, color: '#8a887f', marginTop: 1 }}>
                Rinnovo il {formatDate(workspace.subscription_ends_at)}
              </div>
            )}
          </div>
        </div>

        {features.map((f) => (
          <FeatureRow key={f} label={f} />
        ))}

        {isFree && (() => {
          const used = workspace.sent_quota_used ?? 0
          const pct = Math.min(100, Math.round((used / FREE_DOC_LIMIT) * 100))
          const remaining = Math.max(0, FREE_DOC_LIMIT - used)
          const atLimit = used >= FREE_DOC_LIMIT
          return (
            <>
              <div style={{ height: '0.5px', background: '#eee', margin: '13px -15px' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}>
                <span style={{ color: '#8a887f' }}>Preventivi inviati</span>
                <span style={{ fontWeight: 600, color: atLimit ? '#b05656' : '#161616' }}>{used} / {FREE_DOC_LIMIT}</span>
              </div>
              <div style={{ height: 7, borderRadius: 999, background: '#ececef', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: atLimit ? '#b05656' : '#1a1a2e', borderRadius: 999 }} />
              </div>
              {/* Motivo documenti — rosso se limite raggiunto (non per il tempo) */}
              <div style={{ fontSize: 12, marginTop: 7, fontWeight: atLimit ? 600 : 400, color: atLimit ? '#b05656' : '#767676' }}>
                {atLimit
                  ? `Hai usato tutti gli ${FREE_DOC_LIMIT} preventivi del piano Free.`
                  : `${remaining} preventiv${remaining === 1 ? 'o rimanente' : 'i rimanenti'} nel piano Free.`}
              </div>

              {/* Motivo tempo — rosso se prova terminata */}
              {freeStatus.daysRemaining !== null && (
                <div style={{ fontSize: 12, marginTop: 4, fontWeight: freeStatus.daysRemaining <= 0 ? 600 : 400, color: freeStatus.daysRemaining <= 0 ? '#b05656' : '#767676' }}>
                  {freeStatus.daysRemaining > 0
                    ? `Periodo di prova: ${freeStatus.daysRemaining} ${freeStatus.daysRemaining === 1 ? 'giorno' : 'giorni'} rimanenti`
                    : `Periodo di prova di ${FREE_TRIAL_DAYS} giorni terminato`}
                </div>
              )}
            </>
          )
        })()}
      </div>

      {/* ── Azione ── */}
      {isFree ? (
        <div style={{ marginTop: 16 }}>
          <Link
            href="/abbonamento"
            style={{
              background: '#1a1a2e',
              color: '#fff',
              borderRadius: 12,
              height: 50,
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: 'none',
              boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)',
            }}
          >
            <Crown size={18} aria-hidden /> Scopri i piani Pro
          </Link>
        </div>
      ) : displayPlan === 'lifetime' ? (
        <p style={{ fontSize: 14, color: '#767676', margin: '14px 0 0' }}>
          Hai accesso Pro per sempre. Nessun rinnovo richiesto.
        </p>
      ) : (
        <div style={{ marginTop: 14 }}>
          <Link
            href="/abbonamento"
            style={{
              border: '1px solid #e7e7ea',
              color: '#1a1a2e',
              borderRadius: 12,
              height: 48,
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontSize: 14,
              fontWeight: 500,
              background: '#fff',
              textDecoration: 'none',
            }}
          >
            <Settings size={18} aria-hidden /> Gestisci abbonamento
          </Link>
        </div>
      )}
    </div>
  )
}
