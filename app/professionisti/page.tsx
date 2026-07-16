import type { Metadata } from 'next'
import Link from 'next/link'
import { Search, MapPin, ChevronRight, Star } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata: Metadata = {
  title: 'Trova un professionista',
  description: 'Cerca artigiani e professionisti verificati nella tua zona e richiedi un preventivo gratis.',
}

export const dynamic = 'force-dynamic'

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

interface ProfileRow {
  workspace_id: string
  public_name: string
  trade: string
  city: string
  radius_km: number
  bio: string | null
}

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase() || '?'
}

function fmtAvg(n: number): string {
  return n.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

export default async function ProfessionistiPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; city?: string }>
}) {
  const { q = '', city = '' } = await searchParams
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelle 042/043 non ancora in types/database.ts
  const db = admin as any

  let profiles: Array<ProfileRow & { isPro: boolean; avg: number | null; count: number; recommendPct: number | null }> = []
  try {
    let query = db
      .from('marketplace_profiles')
      .select('workspace_id, public_name, trade, city, radius_km, bio')
      .eq('enabled', true)
      .not('published_at', 'is', null)
      .limit(60)
    if (q.trim()) {
      // Virgole/parentesi romperebbero la sintassi del filtro .or() di PostgREST
      const safe = q.trim().replace(/[,()]/g, ' ').replace(/[%_\\]/g, (c) => `\\${c}`)
      query = query.or(`trade.ilike.%${safe}%,public_name.ilike.%${safe}%`)
    }
    if (city.trim()) query = query.ilike('city', `%${city.trim()}%`)
    const { data: rows } = await query
    const base = (rows ?? []) as ProfileRow[]

    if (base.length > 0) {
      const ids = base.map((p) => p.workspace_id)
      const [{ data: workspaces }, { data: reviews }] = await Promise.all([
        admin.from('workspaces').select('id, plan').in('id', ids),
        db
          .from('reviews')
          .select('workspace_id, rating_puntualita, rating_qualita, rating_preventivo, rating_pulizia, recommends')
          .in('workspace_id', ids)
          .is('removed_at', null),
      ])
      const planById = new Map((workspaces ?? []).map((w: { id: string; plan: string }) => [w.id, w.plan]))
      const revByWs = new Map<string, Array<{ avg: number; recommends: boolean }>>()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const r of (reviews ?? []) as any[]) {
        const list = revByWs.get(r.workspace_id) ?? []
        list.push({
          avg: (r.rating_puntualita + r.rating_qualita + r.rating_preventivo + r.rating_pulizia) / 4,
          recommends: r.recommends,
        })
        revByWs.set(r.workspace_id, list)
      }
      profiles = base.map((p) => {
        const revs = revByWs.get(p.workspace_id) ?? []
        const avg = revs.length > 0 ? Math.round((revs.reduce((s, r) => s + r.avg, 0) / revs.length) * 10) / 10 : null
        const recommendPct = revs.length > 0 ? Math.round((revs.filter((r) => r.recommends).length / revs.length) * 100) : null
        return {
          ...p,
          isPro: planById.get(p.workspace_id) !== 'free' && planById.has(p.workspace_id),
          avg,
          count: revs.length,
          recommendPct,
        }
      })
      // Pro in cima ("In evidenza"), poi per numero di recensioni
      profiles.sort((a, b) => (Number(b.isPro) - Number(a.isPro)) || (b.count - a.count))
    }
  } catch { /* migration 043 non ancora applicata */ }

  return (
    <div style={{ background: '#fafafa', minHeight: '100vh' }}>
      <div style={{ background: '#fff', borderBottom: '0.5px solid #eee', padding: '14px 16px' }}>
        <div className="max-w-2xl mx-auto">
          <div style={{ fontSize: 20, fontWeight: 600, color: '#161616' }}>Trova un professionista</div>
          <div style={{ fontSize: 12, color: '#8a887f', marginTop: 2 }}>
            Artigiani verificati su <Link href="https://cartacanta.app" style={{ color: '#1a1a2e', fontWeight: 600, textDecoration: 'none' }}>Carta Canta</Link>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto" style={{ padding: '14px 15px 24px' }}>
        {/* Ricerca: mestiere + comune */}
        <form method="get" style={{ background: '#fff', borderRadius: 14, boxShadow: SH, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#fff', border: '1px solid #e3e3e6', boxShadow: '0 1px 2px rgba(20,20,40,.04)', borderRadius: 11, padding: '11px 13px' }}>
            <Search size={17} style={{ color: '#8a887f', flexShrink: 0 }} />
            <input name="q" defaultValue={q} placeholder="Mestiere (es. idraulico)" style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', fontSize: 16, color: '#161616' }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {/* minWidth: 0 sul wrapper E sull'input: senza, l'input impone la sua
                larghezza minima intrinseca (~200px) e spinge "Cerca" fuori schermo */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 9, background: '#fff', border: '1px solid #e3e3e6', boxShadow: '0 1px 2px rgba(20,20,40,.04)', borderRadius: 11, padding: '11px 13px' }}>
              <MapPin size={17} style={{ color: '#8a887f', flexShrink: 0 }} />
              <input name="city" defaultValue={city} placeholder="Comune (es. Verona)" style={{ flex: 1, minWidth: 0, width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: 16, color: '#161616' }} />
            </div>
            <button type="submit" style={{ border: 'none', borderRadius: 11, background: '#1a1a2e', color: '#fff', fontSize: 13, fontWeight: 600, padding: '0 18px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
              Cerca
            </button>
          </div>
        </form>

        {/* Risultati */}
        <div style={{ background: '#fff', borderRadius: 14, boxShadow: SH, padding: '4px 15px', marginTop: 13 }}>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', padding: '10px 0 2px' }}>
            {profiles.length > 0
              ? `${profiles.length} professionist${profiles.length === 1 ? 'a' : 'i'}${city.trim() ? ` vicino a ${city.trim()}` : ''}`
              : 'Nessun risultato'}
          </div>
          {profiles.length === 0 && (
            <p style={{ fontSize: 13, color: '#55534b', padding: '8px 0 14px', lineHeight: 1.5 }}>
              {q.trim() || city.trim()
                ? 'Prova con un altro mestiere o un altro comune.'
                : 'I primi professionisti si stanno registrando: torna a trovarci tra qualche giorno.'}
            </p>
          )}
          {profiles.map((p, i) => (
            <Link
              key={p.workspace_id}
              href={`/professionisti/${p.workspace_id}`}
              style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 0', borderBottom: i < profiles.length - 1 ? '0.5px solid #eee' : 'none', textDecoration: 'none', color: 'inherit' }}
            >
              <span style={{ width: 40, height: 40, borderRadius: 10, background: p.isPro ? '#1a1a2e' : '#f2f2f5', color: p.isPro ? '#fff' : '#55534b', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {initials(p.public_name)}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#161616' }}>{p.public_name}</span>
                  {p.isPro && (
                    <span style={{ border: '1px solid #e8d6ad', color: '#b0863e', borderRadius: 999, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>
                      In evidenza
                    </span>
                  )}
                </span>
                <span style={{ display: 'block', fontSize: 12, color: '#8a887f', marginTop: 2 }}>
                  {p.avg != null
                    ? <><Star size={11} fill="#c9a44c" style={{ color: '#c9a44c', display: 'inline', verticalAlign: '-1px' }} /> {fmtAvg(p.avg)} ({p.count}){p.recommendPct != null ? ` · ${p.recommendPct}% consiglia` : ''} · </>
                    : 'Nuovo su Carta Canta · '}
                  {p.trade} · {p.city}
                </span>
              </span>
              <ChevronRight size={16} style={{ color: '#c2c1bd', flexShrink: 0 }} />
            </Link>
          ))}
        </div>

        <p style={{ fontSize: 12, color: '#767676', textAlign: 'center', marginTop: 12, lineHeight: 1.5 }}>
          Carta Canta non risponde del lavoro dei professionisti.
        </p>
      </div>
    </div>
  )
}
