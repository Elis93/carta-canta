import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { ArrowLeft, AlertTriangle, X, FileText } from 'lucide-react'
import { PreventivoForm } from '../_components/PreventivoForm'
import { peekNextDocNumber } from '@/lib/actions/documents'
import { checkFreeBlock, FREE_DOC_LIMIT } from '@/lib/free-trial'
import { Avviso } from '@/components/shared/Avviso'

interface Props {
  searchParams: Promise<{ client_id?: string; titolo?: string; nota?: string; richiesta?: string }>
}

export default async function NuovoPreventivoPage({ searchParams }: Props) {
  const { client_id, titolo, nota, richiesta } = await searchParams
  // Contesto sessione condiviso (memoizzato per richiesta — vedi lib/workspace-context.ts)
  const { supabase, user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/login')

  // Piano gratuito: controlla blocco trial (scadenza o quota)
  const freeTrialStatus = workspace.plan === 'free'
    ? checkFreeBlock(workspace)
    : null

  // Carica template
  const { data: templates } = await supabase
    .from('templates')
    .select('id, name, is_default')
    .eq('workspace_id', workspace.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })

  // defaultTemplateId: template personalizzato con is_default=true (esclude "Template predefinito").
  const defaultTemplateId = templates?.find(
    (t) => t.is_default && t.name !== 'Template predefinito'
  )?.id ?? null

  // Anteprima del prossimo numero disponibile (senza incrementare la sequenza)
  const nextDocNumber = await peekNextDocNumber(workspace.id)

  // Acconto proposto dalle Impostazioni (077, richiesta Eli 9 ago). Query a
  // SÉ e tollerante: se la migration non c'è ancora, il form si comporta
  // esattamente come prima (nessun acconto preimpostato). Metterla nella
  // select principale avrebbe fatto fallire l'intera pagina.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 077 non ancora in types/database.ts
  const accontoRow = await (supabase as any)
    .from('workspaces')
    .select('deposit_default_type, deposit_default_value')
    .eq('id', workspace.id)
    .maybeSingle()
    .then((r: { data: { deposit_default_type?: string | null; deposit_default_value?: number | null } | null }) => r.data, () => null)
  // ⚠️ Nel database il tipo è 'fixed', nel form si chiama 'amount': la
  // traduzione sta QUI, in un punto solo.
  const accontoDefault =
    accontoRow?.deposit_default_type && accontoRow?.deposit_default_value != null
      ? {
          type: (accontoRow.deposit_default_type === 'fixed' ? 'amount' : 'percent') as 'percent' | 'amount',
          value: Number(accontoRow.deposit_default_value),
        }
      : null

  // Listini fornitori (063) — per l'avviso scadenza listino nel form.
  // Tollerante pre-migration: tabella assente → nessun avviso.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelle 063 non ancora in types/database.ts
  const supplierLists: Array<{ id: string; name: string; valid_until: string | null }> = await (supabase as any)
    .from('supplier_lists')
    .select('id, name, valid_until')
    .eq('workspace_id', workspace.id)
    .then((r: { data: Array<{ id: string; name: string; valid_until: string | null }> | null }) => r.data ?? [], () => [])

  // Pre-carica il cliente se client_id è presente nell'URL
  let defaultClient: { id: string; name: string; email: string | null; phone: string | null; piva: string | null } | null = null
  if (client_id) {
    const { data: cl } = await supabase
      .from('clients')
      .select('id, name, email, phone, piva')
      .eq('id', client_id)
      .eq('workspace_id', workspace.id)
      .maybeSingle()
    defaultClient = cl ?? null
  }

  // "Crea preventivo" da una RICHIESTA vetrina (Eli 3 ago sera): il cliente
  // entra in RUBRICA da solo (o si riusa quello esistente con la stessa
  // email/telefono) e arriva già selezionato nel riquadro Cliente — via il
  // vecchio ?titolo= che usciva troncato in testata. Best-effort: se
  // qualcosa fallisce il form si apre come sempre, coi recapiti nella nota.
  if (!defaultClient && richiesta && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(richiesta)) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelle 043/065 non ancora in types/database.ts
      const db = supabase as any
      // customer_phone (065) tollerante pre-migration
      let { data: req, error: reqErr } = await db
        .from('marketplace_requests')
        .select('customer_name, customer_contact, customer_phone')
        .eq('id', richiesta)
        .eq('workspace_id', workspace.id)
        .maybeSingle()
      if (reqErr && (reqErr.code === '42703' || reqErr.code === 'PGRST204')) {
        ;({ data: req } = await db
          .from('marketplace_requests')
          .select('customer_name, customer_contact')
          .eq('id', richiesta)
          .eq('workspace_id', workspace.id)
          .maybeSingle())
      }
      if (req?.customer_name) {
        const contact = String(req.customer_contact ?? '').trim()
        const isEmail = contact.includes('@')
        const email = isEmail ? contact : null
        const phone = (typeof req.customer_phone === 'string' && req.customer_phone.trim())
          || (!isEmail && contact ? contact : null)
        // Riusa un cliente esistente con la stessa email (o lo stesso numero):
        // niente doppioni in rubrica se il cliente ha già scritto altre volte.
        let found: typeof defaultClient = null
        if (email) {
          const esc = email.replace(/[%_\\]/g, (c) => `\\${c}`)
          ;({ data: found } = await supabase
            .from('clients')
            .select('id, name, email, phone, piva')
            .eq('workspace_id', workspace.id)
            .ilike('email', esc)
            .limit(1)
            .maybeSingle())
        }
        if (!found && phone) {
          ;({ data: found } = await supabase
            .from('clients')
            .select('id, name, email, phone, piva')
            .eq('workspace_id', workspace.id)
            .eq('phone', phone)
            .limit(1)
            .maybeSingle())
        }
        if (found) {
          defaultClient = found
        } else {
          const { data: created } = await supabase
            .from('clients')
            .insert({
              workspace_id: workspace.id,
              name: String(req.customer_name).trim().slice(0, 120),
              email,
              phone,
            })
            .select('id, name, email, phone, piva')
            .maybeSingle()
          defaultClient = created ?? null
        }
      }
    } catch { /* best-effort: il form resta utilizzabile senza preselezione */ }
  }

  if (freeTrialStatus?.blocked) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/preventivi" className="flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="size-3.5" /> Preventivi
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">Nuovo preventivo</span>
        </div>
        <Avviso gravita="errore">
          <div>
            <p className="font-medium mb-1">
              {freeTrialStatus.reason === 'trial_expired'
                ? 'Il periodo di prova è terminato'
                : `Limite di ${FREE_DOC_LIMIT} preventivi raggiunto`}
            </p>
            <p className="mb-3">
              {freeTrialStatus.reason === 'trial_expired'
                ? 'Il tuo periodo di prova gratuito è scaduto. Non puoi creare nuovi preventivi.'
                : `Hai già inviato ${freeTrialStatus.docsUsed} preventivi con il piano gratuito. Non puoi crearne altri.`}
            </p>
            <Link
              href="/abbonamento"
              className="inline-flex items-center rounded-md bg-[#1a1a2e] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#2a2a44]"
            >
              Passa a Pro — preventivi illimitati
            </Link>
          </div>
        </Avviso>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* ── Header mobile compatto (✕ · Titolo · spacer) ── */}
      <div className="lg:hidden" style={{ background: '#fff', borderBottom: '2px solid #c9a44c', padding: '12px 15px', display: 'flex', alignItems: 'center' }}>
        <Link href="/preventivi" style={{ width: 34, height: 34, borderRadius: '50%', background: '#f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <X size={19} style={{ color: '#55534b' }} />
        </Link>
        {/* Simbolo tipo documento (A2, 5 lug): foglio NAVY = preventivo */}
        <span style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 18, fontWeight: 600, fontFamily: "Georgia, 'Times New Roman', serif", color: '#1a1a2e' }}>
          <FileText size={18} style={{ color: '#1a1a2e', flexShrink: 0 }} aria-hidden />
          Nuovo preventivo
        </span>
        <div style={{ width: 34, flexShrink: 0 }} />
      </div>

      <div className="p-4 md:p-6 space-y-5">
        {/* Breadcrumb — desktop only */}
        <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/preventivi" className="flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="size-3.5" /> Preventivi
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">Nuovo preventivo</span>
        </div>

        <div className="hidden lg:block">
          <h1 className="text-2xl font-semibold">Nuovo preventivo</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Compila le voci e salva — il totale viene calcolato automaticamente.
          </p>
        </div>

      <PreventivoForm
        mode="create"
        templates={(templates ?? []) as Array<{ id: string; name: string; is_default: boolean | null }>}
        defaultTemplateId={defaultTemplateId}
        fiscalRegime={workspace.fiscal_regime}
        isProPlan={workspace.plan !== 'free'}
        nextDocNumber={nextDocNumber}
        defaultValidityDays={workspace.validity_days ?? 30}
        defaultDeposit={accontoDefault}
        defaultClient={defaultClient}
        initialTitle={titolo?.slice(0, 120)}
        initialInternalNotes={nota?.slice(0, 2000)}
        richiestaId={richiesta}
        supplierLists={supplierLists}
      />
      </div>
    </div>
  )
}
