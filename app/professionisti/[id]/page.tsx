import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Star } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { RequestForm } from '../_components/RequestForm'
import { ReportProfileButton } from '../_components/ReportProfileButton'

export const dynamic = 'force-dynamic'

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

const QUESTIONS = [
  { key: 'rating_puntualita', label: 'Puntualità' },
  { key: 'rating_qualita', label: 'Qualità del lavoro' },
  { key: 'rating_preventivo', label: 'Rispetto del preventivo' },
  { key: 'rating_pulizia', label: 'Pulizia del cantiere' },
] as const

function fmtAvg(n: number): string {
  return n.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 1, verticalAlign: 'middle' }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} fill={n <= Math.round(value) ? '#c9a44c' : 'none'} style={{ color: n <= Math.round(value) ? '#c9a44c' : '#d8d8dc' }} />
      ))}
    </span>
  )
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 043 non ancora in types/database.ts
    const { data } = await (createAdminClient() as any)
      .from('marketplace_profiles')
      .select('public_name, trade, city')
      .eq('workspace_id', id)
      .maybeSingle()
    if (data?.public_name) {
      return {
        title: `${data.public_name} — ${data.trade} a ${data.city}`,
        description: `Richiedi un preventivo gratis a ${data.public_name} su Carta Canta.`,
      }
    }
  } catch { /* ignora */ }
  return { title: 'Professionista' }
}

export default async function ProfessionistaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelle 042/043 non ancora in types/database.ts
  const db = admin as any

  let profile: { public_name: string; trade: string; city: string; radius_km: number; bio: string | null } | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let reviews: any[] = []
  try {
    const [{ data: p }, { data: r }] = await Promise.all([
      db
        .from('marketplace_profiles')
        .select('public_name, trade, city, radius_km, bio, enabled, published_at')
        .eq('workspace_id', id)
        .maybeSingle(),
      db
        .from('reviews')
        .select('rating_puntualita, rating_qualita, rating_preventivo, rating_pulizia, recommends')
        .eq('workspace_id', id)
        .is('removed_at', null),
    ])
    if (!p?.enabled || !p.published_at) notFound()
    profile = p
    reviews = r ?? []
  } catch {
    notFound()
  }
  if (!profile) notFound()

  const overallPer = reviews.map((r) => (r.rating_puntualita + r.rating_qualita + r.rating_preventivo + r.rating_pulizia) / 4)
  const overall = overallPer.length > 0 ? Math.round((overallPer.reduce((s, n) => s + n, 0) / overallPer.length) * 10) / 10 : null
  const recommendPct = reviews.length > 0 ? Math.round((reviews.filter((r) => r.recommends).length / reviews.length) * 100) : null
  const initials = profile.public_name.split(/\s+/).slice(0, 2).map((w: string) => w[0] ?? '').join('').toUpperCase() || '?'

  return (
    <div style={{ background: '#fafafa', minHeight: '100vh' }}>
      <div style={{ background: '#fff', borderBottom: '0.5px solid #eee', padding: '13px 16px' }}>
        <div className="max-w-2xl mx-auto" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/professionisti" aria-label="Torna alla ricerca" style={{ width: 32, height: 32, borderRadius: '50%', background: '#f4f4f5', color: '#55534b', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', flexShrink: 0 }}>‹</Link>
          <span style={{ fontSize: 17, fontWeight: 600, color: '#161616' }}>{profile.public_name}</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto" style={{ padding: '14px 15px 24px', display: 'flex', flexDirection: 'column', gap: 13 }}>
        {/* Intestazione profilo */}
        <div style={{ background: '#fff', borderRadius: 14, boxShadow: SH, padding: '18px 15px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: '#1a1a2e', color: '#fff', fontSize: 19, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
            {initials}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#161616' }}>{profile.public_name}</div>
          <p style={{ fontSize: 12, color: 'var(--cc-muted)', marginTop: 3, lineHeight: 1.5 }}>
            {profile.trade}<br />{profile.city} · raggio {profile.radius_km} km
          </p>
          {overall != null && (
            <div style={{ marginTop: 8, fontSize: 13 }}>
              <Stars value={overall} /> <b>{fmtAvg(overall)}</b>{' '}
              <span style={{ color: 'var(--cc-muted)', fontSize: 12 }}>
                · {reviews.length} recension{reviews.length === 1 ? 'e verificata' : 'i verificate'} ✓{recommendPct != null ? ` · ${recommendPct}% lo consiglia` : ''}
              </span>
            </div>
          )}
          {profile.bio && (
            <p style={{ fontSize: 13, color: '#55534b', lineHeight: 1.55, marginTop: 10 }}>{profile.bio}</p>
          )}
        </div>

        {/* Medie recensioni */}
        {reviews.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 14, boxShadow: SH, padding: '14px 15px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: 4 }}>
              Recensioni — medie per domanda
            </div>
            {QUESTIONS.map((q, i) => {
              const m = Math.round((reviews.reduce((s, r) => s + r[q.key], 0) / reviews.length) * 10) / 10
              return (
                <div key={q.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 0', borderBottom: i < QUESTIONS.length - 1 ? '0.5px solid #eee' : 'none' }}>
                  <span style={{ fontSize: 13, color: '#161616' }}>{q.label}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Stars value={m} size={12} /><b style={{ fontSize: 13 }}>{fmtAvg(m)}</b>
                  </span>
                </div>
              )
            })}
            <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.5, marginTop: 10, borderTop: '0.5px solid #eee', paddingTop: 10 }}>
              Come verifichiamo: la recensione si sblocca <b>solo</b> per il cliente di un lavoro
              fatturato e pagato tramite Carta Canta, una volta per fattura. Sole domande chiuse,
              niente commenti liberi. Per segnalare una recensione scrivi a segnalazioni@cartacanta.app.
            </p>
          </div>
        )}

        {/* Richiedi un preventivo */}
        <div style={{ background: '#fff', borderRadius: 14, boxShadow: SH, padding: '14px 15px' }}>
          <RequestForm workspaceId={id} publicName={profile.public_name} />
        </div>

        {/* Disclaimer + segnala */}
        <div style={{ background: '#fff', borderRadius: 14, boxShadow: SH, padding: '14px 15px' }}>
          <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.5 }}>
            Carta Canta non risponde della qualità o dell&rsquo;esito del lavoro dei professionisti.
          </p>
          <ReportProfileButton workspaceId={id} publicName={profile.public_name} />
        </div>
      </div>
    </div>
  )
}
