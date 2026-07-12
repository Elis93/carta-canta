import { redirect } from 'next/navigation'
import { Star } from 'lucide-react'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { BackButton } from '@/components/shared/BackButton'
import { ReportReviewButton } from './_components/ReportReviewButton'

export const metadata = { title: 'Recensioni' }

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

interface ReviewRow {
  id: string
  rating_puntualita: number
  rating_qualita: number
  rating_preventivo: number
  rating_pulizia: number
  recommends: boolean
  reviewer_name: string | null
  reviewer_city: string | null
  created_at: string
  reported_at: string | null
  removed_at: string | null
}

const QUESTIONS = [
  { key: 'rating_puntualita', label: 'Puntualità' },
  { key: 'rating_qualita', label: 'Qualità del lavoro' },
  { key: 'rating_preventivo', label: 'Rispetto del preventivo' },
  { key: 'rating_pulizia', label: 'Pulizia del cantiere' },
] as const

function avg(nums: number[]): number {
  if (nums.length === 0) return 0
  return Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 10) / 10
}

function fmtAvg(n: number): string {
  return n.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1  })
}

function Stars({ value, size = 15 }: { value: number; size?: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 1, verticalAlign: 'middle' }} aria-label={`${fmtAvg(value)} su 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} fill={n <= Math.round(value) ? '#c9a44c' : 'none'} style={{ color: n <= Math.round(value) ? '#c9a44c' : '#d8d8dc' }} />
      ))}
    </span>
  )
}

export default async function RecensioniPage() {
  const { supabase, user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/onboarding')

  let reviews: ReviewRow[] = []
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 042 non ancora in types/database.ts
    const { data } = await (supabase as any)
      .from('reviews')
      .select('id, rating_puntualita, rating_qualita, rating_preventivo, rating_pulizia, recommends, reviewer_name, reviewer_city, created_at, reported_at, removed_at')
      .eq('workspace_id', workspace.id)
      .is('removed_at', null)
      .order('created_at', { ascending: false })
      // Le medie in alto si calcolano su queste righe: 500 copre anni di
      // lavoro di una piccola impresa senza falsare gli aggregati.
      .limit(500)
    reviews = (data ?? []) as ReviewRow[]
  } catch { /* migration 042 non ancora applicata */ }

  const overallPerReview = reviews.map((r) =>
    (r.rating_puntualita + r.rating_qualita + r.rating_preventivo + r.rating_pulizia) / 4
  )
  const overall = avg(overallPerReview)
  const recommendPct = reviews.length > 0
    ? Math.round((reviews.filter((r) => r.recommends).length / reviews.length) * 100)
    : 0

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header — fascia bianca */}
      <div style={{ background: '#fff', borderBottom: '0.5px solid #eeeeee', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px' }}>
        <BackButton fallback="/altro" />
        <span style={{ flex: 1, fontSize: 17, fontWeight: 600, color: '#161616' }}>Recensioni</span>
        <span style={{ width: 24 }} />
      </div>

      {reviews.length === 0 ? (
        <div style={{ margin: '14px 15px 0', background: '#fff', borderRadius: 14, boxShadow: SH, padding: '30px 15px', textAlign: 'center' }}>
          <p style={{ fontWeight: 600, color: '#161616', fontSize: 14 }}>Nessuna recensione ancora</p>
          <p style={{ fontSize: 13, color: '#8a887f', marginTop: 6, lineHeight: 1.55, maxWidth: 320, marginLeft: 'auto', marginRight: 'auto' }}>
            Quando una fattura viene pagata per intero, il cliente può lasciare una recensione
            (solo valutazioni a stelle, niente commenti) dalla sua pagina. Si sblocca da sola: non devi chiedere nulla.
          </p>
        </div>
      ) : (
        <>
          {/* Aggregato generale */}
          <div style={{ margin: '14px 15px 0', background: '#fff', borderRadius: 14, boxShadow: SH, padding: '18px 15px', textAlign: 'center' }}>
            <div style={{ fontSize: 34, fontWeight: 700, color: '#161616', lineHeight: 1 }}>{fmtAvg(overall)}</div>
            <div style={{ marginTop: 6 }}><Stars value={overall} size={17} /></div>
            <p style={{ fontSize: 12, color: '#767676', marginTop: 8 }}>
              {reviews.length} recension{reviews.length === 1 ? 'e verificata' : 'i verificate'} da lavori reali ✓ · <b style={{ color: '#161616' }}>{recommendPct}% lo consiglia</b>
            </p>
          </div>

          {/* Medie per domanda */}
          <div style={{ margin: '13px 15px 0', background: '#fff', borderRadius: 14, boxShadow: SH, padding: '14px 15px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: 4 }}>
              Media per domanda
            </div>
            {QUESTIONS.map((q, i) => {
              const m = avg(reviews.map((r) => r[q.key]))
              return (
                <div key={q.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 0', borderBottom: i < QUESTIONS.length - 1 ? '0.5px solid #eee' : 'none' }}>
                  <span style={{ fontSize: 13, color: '#161616' }}>{q.label}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Stars value={m} size={13} />
                    <b style={{ fontSize: 13, color: '#161616' }}>{fmtAvg(m)}</b>
                  </span>
                </div>
              )
            })}
          </div>

          {/* Ultime recensioni */}
          <div style={{ margin: '13px 15px 0', background: '#fff', borderRadius: 14, boxShadow: SH, padding: '14px 15px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: 4 }}>
              Ultime recensioni
            </div>
            {reviews.slice(0, 20).map((r, i) => {
              const m = (r.rating_puntualita + r.rating_qualita + r.rating_preventivo + r.rating_pulizia) / 4
              return (
                <div key={r.id} style={{ padding: '11px 0', borderBottom: i < Math.min(reviews.length, 20) - 1 ? '0.5px solid #eee' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#161616' }}>
                      {r.reviewer_name ?? 'Cliente'}{r.reviewer_city ? ` · ${r.reviewer_city}` : ''}
                    </span>
                    <span style={{ fontSize: 12, color: '#a5a39b', flexShrink: 0 }}>
                      {new Date(r.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' , timeZone: 'Europe/Rome' }).replace('.', '')}
                    </span>
                  </div>
                  <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Stars value={m} size={13} />
                    <span style={{ fontSize: 12, color: '#767676' }}>
                      {fmtAvg(m)} · {r.recommends ? 'Lo consiglia ✓' : 'Non lo consiglia'}
                    </span>
                  </div>
                  <div style={{ marginTop: 7, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {r.reported_at ? (
                      <span style={{ border: '1px solid #e8d6ad', color: '#b0863e', borderRadius: 999, padding: '2px 9px', fontSize: 11, fontWeight: 600 }}>
                        Segnalata — in verifica
                      </span>
                    ) : (
                      <span style={{ border: '1px solid #bce3d2', color: '#2f8a63', borderRadius: 999, padding: '2px 9px', fontSize: 11, fontWeight: 600 }}>
                        ✓ Verificata
                      </span>
                    )}
                    {!r.reported_at && <ReportReviewButton reviewId={r.id} reviewerName={r.reviewer_name} />}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
      <div style={{ height: 16 }} />
    </div>
  )
}
