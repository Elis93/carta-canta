import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft } from 'lucide-react'
import { DefaultSettingsForm } from './_components/DefaultSettingsForm'

export const metadata = { title: 'Personalizza template default' }

export default async function DefaultTemplatePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let { data: workspace } = await supabase
    .from('workspaces')
    .select('id, plan, name, ragione_sociale, logo_url')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!workspace) {
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .not('accepted_at', 'is', null)
      .limit(1)
      .maybeSingle()
    if (membership) {
      const { data: mw } = await supabase
        .from('workspaces').select('id, plan, name, ragione_sociale, logo_url')
        .eq('id', membership.workspace_id)
        .maybeSingle()
      workspace = mw
    }
  }
  if (!workspace) redirect('/login')

  // Questa pagina è solo per Pro/Team
  if (workspace.plan === 'free') redirect('/template')

  // Carica impostazioni del template is_default corrente (se esiste)
  const { data: defaultTemplate } = await supabase
    .from('templates')
    .select('show_watermark, show_logo, legal_notice')
    .eq('workspace_id', workspace.id)
    .eq('is_default', true)
    .maybeSingle()

  return (
    <div className="p-4 md:p-6 max-w-xl mx-auto space-y-6">
      {/* Breadcrumb + tasto indietro */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/template" className="flex items-center gap-1 hover:text-foreground transition-colors">
          <ArrowLeft className="size-3.5" /> Template
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Personalizza default</span>
      </div>

      <div>
        <h1 className="text-xl font-semibold">Personalizza template Default</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Branding e nota legale per il template Classico di default.
        </p>
      </div>

      <DefaultSettingsForm
        defaultShowWatermark={defaultTemplate?.show_watermark ?? true}
        defaultShowLogo={defaultTemplate?.show_logo ?? true}
        defaultLegalNotice={defaultTemplate?.legal_notice ?? ''}
        logoUrl={(workspace as { logo_url?: string | null }).logo_url ?? null}
      />
    </div>
  )
}
