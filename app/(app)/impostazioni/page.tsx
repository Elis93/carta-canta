import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ImpostazioniGenerali } from './tabs/generali'
import { ImpostazioniFiscali } from './tabs/fiscali'
import { ImpostazioniNotifiche } from './tabs/notifiche'
import { ImpostazioniPiano } from './tabs/piano'
import { ImpostazioniTeam } from './tabs/team'
import { getWorkspaceMembers } from '@/lib/actions/team'
import { PLAN_FEATURES } from '@/lib/stripe/plans'
import type { NotificationPrefs } from '@/lib/actions/workspace'

export default async function ImpostazioniPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let { data: workspace } = await supabase
    .from('workspaces')
    .select('*')
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
        .from('workspaces').select('*')
        .eq('id', membership.workspace_id)
        .maybeSingle()
      workspace = mw
    }
  }

  if (!workspace) redirect('/login')

  // Carica membri del team
  const members = await getWorkspaceMembers(workspace.id)
  const planFeatures = PLAN_FEATURES[workspace.plan]
  const canInvite = planFeatures.teamMembers > 0

  // Nome owner per la lista team
  const ownerName: string =
    user.user_metadata?.full_name ||
    `${user.user_metadata?.nome ?? ''} ${user.user_metadata?.cognome ?? ''}`.trim() ||
    user.email?.split('@')[0] ||
    'Proprietario'

  // Estrai e valida le preferenze notifiche dal workspace
  const rawPrefs = workspace.notification_prefs as Record<string, unknown> | null
  const notifPrefs: NotificationPrefs | null = rawPrefs
    ? {
        preventivo_accettato: rawPrefs.preventivo_accettato !== false,
        preventivo_rifiutato: rawPrefs.preventivo_rifiutato !== false,
        preventivo_scaduto: rawPrefs.preventivo_scaduto !== false,
        reminder_cliente: rawPrefs.reminder_cliente !== false,
        pagamento_ok: rawPrefs.pagamento_ok !== false,
        pagamento_fallito: rawPrefs.pagamento_fallito !== false,
      }
    : null

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Impostazioni</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Gestisci il tuo profilo, le impostazioni fiscali e il piano.
        </p>
      </div>

      <Tabs defaultValue="generale">
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="generale">Generale</TabsTrigger>
          <TabsTrigger value="fiscale">Fiscale</TabsTrigger>
          <TabsTrigger value="notifiche">Notifiche</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="piano">Piano</TabsTrigger>
        </TabsList>

        <TabsContent value="generale" className="mt-6">
          <ImpostazioniGenerali workspace={workspace} userEmail={user.email ?? ''} />
        </TabsContent>

        <TabsContent value="fiscale" className="mt-6">
          <ImpostazioniFiscali workspace={workspace} />
        </TabsContent>

        <TabsContent value="notifiche" className="mt-6">
          <ImpostazioniNotifiche initialPrefs={notifPrefs} />
        </TabsContent>

        <TabsContent value="team" className="mt-6">
          <ImpostazioniTeam
            ownerEmail={user.email ?? ''}
            ownerName={ownerName}
            members={members}
            canInvite={canInvite}
            maxMembers={planFeatures.teamMembers}
          />
        </TabsContent>

        <TabsContent value="piano" className="mt-6">
          <ImpostazioniPiano workspace={workspace} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
