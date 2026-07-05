import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { ArrowLeft } from 'lucide-react'
import { DefaultSettingsForm } from './_components/DefaultSettingsForm'

export const metadata = { title: 'Personalizza template default' }

export default async function DefaultTemplatePage() {
  const { supabase, user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
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
