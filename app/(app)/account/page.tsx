import { redirect } from 'next/navigation'
import Link from 'next/link'
import { UserRound } from 'lucide-react'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { BackButton } from '@/components/shared/BackButton'
import { DatiSections } from './_components/DatiSections'

export const metadata = { title: 'Account e sicurezza' }

// ============================================================
// Account e sicurezza — era la tab "Dati" di Impostazioni (richiesta Eli
// 14 lug: la sesta tab schiacciava la barra su mobile). Raggiungibile da
// Altro › Account.
//
// Dal 7 ago ospita anche il BLOCCO DELL'APP, che stava in Impostazioni ›
// Generale insieme a ragione sociale e indirizzo (Eli: "non mi piace dentro
// a generale"). Le due materie si alternano dalle pillole in cima:
// «Dati» e «Sicurezza».
// ============================================================

const SEZIONI = [
  { value: 'account',   label: 'Account'   },
  { value: 'sicurezza', label: 'Sicurezza' },
  { value: 'dati',      label: 'Dati'      },
] as const

type Sezione = (typeof SEZIONI)[number]['value']

export default async function AccountDatiPage({
  searchParams,
}: {
  searchParams: Promise<{ sez?: string }>
}) {
  const { sez } = await searchParams
  const { user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/onboarding')

  const attiva: Sezione = SEZIONI.find((s) => s.value === sez)?.value ?? 'account'

  return (
    <div className="max-w-3xl mx-auto">
      {/* ── Header mobile — fascia bianca con riga oro ── */}
      <div
        className="lg:hidden flex items-center"
        style={{ background: '#fff', borderBottom: '2px solid #c9a44c', gap: 10, padding: '12px 15px' }}
      >
        <BackButton fallback="/altro" />
        <span style={{ flex: 1, fontSize: 18, fontWeight: 600, fontFamily: "Georgia, 'Times New Roman', serif", color: '#1a1a2e' }}>Account e sicurezza</span>
        <span style={{ width: 24 }} />
      </div>

      {/* ── Header desktop ── */}
      <div className="hidden lg:flex items-center gap-3 min-w-0 p-6 pb-0">
        <UserRound className="size-6 text-primary shrink-0" />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Account e sicurezza</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Il tuo indirizzo di accesso, il blocco dell&rsquo;app e i tuoi dati.
          </p>
        </div>
      </div>

      {/* Pillole come in Impostazioni e nei filtri dei preventivi: la sezione
          scelta finisce nell'indirizzo, quindi il tasto Indietro si comporta
          come ci si aspetta. */}
      <div className="px-[15px] lg:px-6">
        <div className="cc-tabs cc-filter-scroll" style={{ marginTop: 14 }}>
          {SEZIONI.map(({ value, label }) => (
              // `replace` come in Impostazioni: cambiare sezione non impila
              // voci nella cronologia, così Indietro torna in Altro.
            <Link
              key={value}
              replace
              href={value === 'account' ? '/account' : `/account?sez=${value}`}
              className={attiva === value ? 'cc-tab-active' : 'cc-tab'}
              style={{ textDecoration: 'none', display: 'block' }}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      <div className="px-[15px] pb-12 lg:px-6 lg:pb-6">
        <DatiSections section={attiva} userEmail={user.email ?? ''} />
      </div>
    </div>
  )
}
