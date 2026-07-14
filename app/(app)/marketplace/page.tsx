import { redirect } from 'next/navigation'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { BackButton } from '@/components/shared/BackButton'
import { MarketplaceProfileForm, type MarketplaceProfileDefaults } from './_components/MarketplaceProfileForm'

export const metadata = { title: 'Profilo pubblico' }

export default async function MarketplacePage() {
  const { supabase, user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/onboarding')

  let defaults: MarketplaceProfileDefaults = {
    public_name: workspace.ragione_sociale ?? workspace.name ?? '',
    trade: '',
    city: workspace.citta ?? '',
    radius_km: 30,
    phone: workspace.phone ?? '',
    bio: '',
    published: false,
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 043 non ancora in types/database.ts
    const { data: profile } = await (supabase as any)
      .from('marketplace_profiles')
      .select('public_name, trade, city, radius_km, phone, bio, enabled, published_at')
      .eq('workspace_id', workspace.id)
      .maybeSingle()
    if (profile) {
      defaults = {
        public_name: profile.public_name || defaults.public_name,
        trade: profile.trade ?? '',
        city: profile.city || defaults.city,
        radius_km: profile.radius_km ?? 30,
        phone: profile.phone ?? defaults.phone,
        bio: profile.bio ?? '',
        published: !!profile.enabled && !!profile.published_at,
      }
    }
  } catch { /* migration 043 non ancora applicata */ }

  return (
    <div className="max-w-3xl mx-auto">
      <div style={{ background: '#fff', borderBottom: '2px solid #c9a44c', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px' }}>
        <BackButton fallback="/altro" />
        <span style={{ flex: 1, fontSize: 18, fontWeight: 600, fontFamily: "Georgia, 'Times New Roman', serif", color: '#1a1a2e' }}>Profilo pubblico</span>
        <span style={{ width: 24 }} />
      </div>
      <div style={{ padding: '14px 15px 16px' }}>
        <MarketplaceProfileForm defaults={defaults} isPro={workspace.plan !== 'free'} workspaceId={workspace.id} />
      </div>
    </div>
  )
}
