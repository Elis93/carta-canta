import Link from 'next/link'
import {
  FileText,
  CheckCircle,
  Zap,
  Link2,
  Sparkles,
  ArrowRight,
  ChevronDown,
} from 'lucide-react'

// ── Brand (stessa palette del logo: navy #1a1a2e · oro #c9a44c · crema #f3ede0)
const NAVY = '#1a1a2e'
const GOLD = '#c9a44c'
const GOLD_DARK = '#b08d3e'
const CREAM = '#f5f0e2'

/** Marchio: quadrato navy con la doppia C oro/crema (stesso disegno del login). */
function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} aria-hidden="true">
      <rect width="512" height="512" rx="112" fill={NAVY} />
      <path d="M342 133 A150 150 0 1 0 342 379" fill="none" stroke={GOLD} strokeWidth="38" strokeLinecap="round" />
      <path d="M307 175 A96 96 0 1 0 307 337" fill="none" stroke="#f3ede0" strokeWidth="30" strokeLinecap="round" />
    </svg>
  )
}

// Pagina statica: il redirect degli utenti autenticati verso /dashboard
// è gestito interamente dal middleware, non qui.
export default function HomePage() {
  return (
    <div className="flex min-h-svh flex-col" style={{ background: '#fff' }}>
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-white/85 backdrop-blur" style={{ borderColor: '#eeeeee' }}>
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <span style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 19, color: NAVY, fontWeight: 600 }}>
              Carta <span style={{ color: GOLD }}>Canta</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              style={{ fontSize: 13, fontWeight: 600, color: '#55534b', padding: '8px 10px', textDecoration: 'none' }}
            >
              Accedi
            </Link>
            <Link
              href="/signup"
              style={{
                fontSize: 13, fontWeight: 600, color: '#fff', background: NAVY,
                borderRadius: 999, padding: '8px 16px', textDecoration: 'none',
                boxShadow: '0 4px 12px -4px rgba(26,26,46,.45)',
              }}
            >
              Prova gratis
            </Link>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {/* Hero — occupa il viewport meno header, con ~72px di peek della sezione Features */}
        <section className="flex min-h-[calc(100svh-3.5rem-72px)] flex-col items-center">
          {/* Contenuto centrato verticalmente */}
          <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-6 px-4 py-12 text-center">
            <span
              style={{
                fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
                color: GOLD_DARK, background: CREAM, border: '1px solid #ecdfc0',
                borderRadius: 999, padding: '6px 14px',
              }}
            >
              Per artigiani e freelance italiani
            </span>
            <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl" style={{ color: NAVY }}>
              Preventivi professionali in pochi minuti
            </h1>
            <p className="max-w-xl text-lg" style={{ color: '#55534b' }}>
              Crea, invia e fai firmare preventivi direttamente online. Carta
              Canta gestisce IVA, ritenute e regime forfettario al posto tuo.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center gap-1.5"
                style={{
                  background: NAVY, color: '#fff', fontSize: 15, fontWeight: 600,
                  borderRadius: 12, padding: '14px 26px', textDecoration: 'none',
                  boxShadow: '0 8px 20px -8px rgba(26,26,46,.55)',
                }}
              >
                Inizia gratis
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center"
                style={{
                  background: '#fff', color: NAVY, fontSize: 15, fontWeight: 500,
                  border: '1px solid #e7e7ea', borderRadius: 12, padding: '14px 22px',
                  textDecoration: 'none', boxShadow: '0 1px 2px rgba(20,20,40,.05)',
                }}
              >
                Hai già un account? Accedi
              </Link>
            </div>
            <p className="text-xs" style={{ color: '#8a887f' }}>
              Nessuna carta di credito · 8 preventivi gratuiti · gratis durante la beta
            </p>
          </div>

          {/* Scroll cue */}
          <div className="flex flex-col items-center gap-1 pb-8" style={{ color: '#8a887f' }}>
            <span className="text-xs">Scorri per scoprire</span>
            <ChevronDown className="h-5 w-5 animate-bounce" />
          </div>
        </section>

        {/* Features */}
        <section className="border-t" style={{ background: '#fafaf8', borderColor: '#eeeeee' }}>
          <div className="mx-auto grid max-w-5xl gap-8 px-4 py-20 sm:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              icon={<FileText className="h-5 w-5" />}
              title="Preventivi e fatture"
              description="Numerazione automatica, PDF scaricabile, gestione IVA e regimi fiscali italiani."
            />
            <FeatureCard
              icon={<Link2 className="h-5 w-5" />}
              title="Link pubblico"
              description="Invia un link al cliente: può accettare o rifiutare direttamente dal browser, senza app."
            />
            <FeatureCard
              icon={<Sparkles className="h-5 w-5" />}
              title="AI Import"
              description="Fotografa un preventivo cartaceo o carica un PDF: l'AI lo converte in bozza in secondi."
            />
            <FeatureCard
              icon={<Zap className="h-5 w-5" />}
              title="Template riutilizzabili"
              description="Salva le voci ricorrenti come template e riusale con un clic."
            />
          </div>
        </section>

        {/* Checklist + CTA */}
        <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-4 py-20 text-center">
          <div className="flex flex-col items-center gap-2">
            {[
              'Regime forfettario, ordinario e minimi',
              'Bollo virtuale e ritenuta d\'acconto automatici',
              'Accettazione digitale con firma cliente',
              'Nessuna installazione — funziona da browser',
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 text-sm"
                style={{ color: '#55534b' }}
              >
                <CheckCircle className="h-4 w-4 shrink-0" style={{ color: GOLD_DARK }} />
                {item}
              </div>
            ))}
          </div>
          <Link
            href="/signup"
            className="mt-4 inline-flex items-center gap-1.5"
            style={{
              background: NAVY, color: '#fff', fontSize: 15, fontWeight: 600,
              borderRadius: 12, padding: '14px 26px', textDecoration: 'none',
              boxShadow: '0 8px 20px -8px rgba(26,26,46,.55)',
            }}
          >
            Crea il tuo primo preventivo
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-6" style={{ borderColor: '#eeeeee' }}>
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-4 text-xs sm:flex-row sm:justify-between" style={{ color: '#8a887f' }}>
          <span className="whitespace-nowrap">© {new Date().getFullYear()} Carta Canta</span>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            <Link href="/professionisti" className="hover:text-foreground">
              Trova un professionista
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/termini" className="hover:text-foreground">
              Termini
            </Link>
            <Link href="/login" className="hover:text-foreground">
              Accedi
            </Link>
            <Link href="/signup" className="hover:text-foreground">
              Registrati
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex h-9 w-9 items-center justify-center rounded-lg"
        style={{ background: CREAM, color: GOLD_DARK }}
      >
        {icon}
      </div>
      <h3 className="font-semibold" style={{ color: '#161616' }}>{title}</h3>
      <p className="text-sm" style={{ color: '#55534b' }}>{description}</p>
    </div>
  )
}
