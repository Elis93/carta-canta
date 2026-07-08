import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, Mic, PenLine, Wallet, ShieldCheck, MapPin, Clock } from 'lucide-react'

// Landing dedicata alle campagne (ads): 1 promessa, 1 CTA, prova sociale,
// zero distrazioni. Le UTM vengono catturate da UtmCapture (layout root)
// e allegate alla registrazione. Pagina PUBBLICA (in PUBLIC_PATHS).

export const metadata: Metadata = {
  title: 'Prova Carta Canta gratis — preventivi in 60 secondi',
  description: 'L\'app degli artigiani italiani: preventivo fatto dal telefono, firmato dal cliente con un tocco. Gratis durante la beta.',
}

const NAVY = '#1a1a2e'
const GOLD = '#c9a44c'

const STEPS = [
  { Icon: Mic, title: 'Detta le voci', text: 'In cantiere, col microfono o dal tuo catalogo. Il preventivo è pronto in 60 secondi.' },
  { Icon: PenLine, title: 'Il cliente firma dal telefono', text: 'Gli mandi un link su WhatsApp: lui guarda e tocca "Accetto". Firma registrata, con valore di prova.' },
  { Icon: Wallet, title: 'Incassi e tieni tutto sotto controllo', text: 'Acconti, QR di pagamento, lavori, spese e margine: l\'ufficio è in tasca.' },
]

const PROOF = [
  { Icon: Clock, text: 'Pensata per chi lavora in cantiere, non alla scrivania' },
  { Icon: ShieldCheck, text: 'Dati al sicuro su server in Europa — li esporti quando vuoi' },
  { Icon: MapPin, text: 'Fatta in Italia, per gli artigiani italiani' },
]

const FAQ = [
  { q: 'Quanto costa?', a: 'Niente: è gratis durante la beta, senza carta di credito. Chi entra ora avrà condizioni riservate al lancio.' },
  { q: 'Serve il computer?', a: 'No. Nasce per il telefono: crei, invii e fai firmare tutto da lì.' },
  { q: 'E i miei dati?', a: 'Server in Europa, protezioni attive, esporti tutto in un file quando vuoi. Il cliente vede solo quello che decidi tu.' },
]

function Cta({ label = 'Provala gratis' }: { label?: string }) {
  return (
    <Link
      href="/signup"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: 52, borderRadius: 13, background: NAVY, color: '#fff',
        fontSize: 16, fontWeight: 600, textDecoration: 'none',
        boxShadow: '0 8px 20px -6px rgba(26,26,46,.5)',
      }}
    >
      {label}
    </Link>
  )
}

export default function ProvaPage() {
  return (
    <div style={{ background: '#fafafa', minHeight: '100vh' }}>
      {/* Header minimale */}
      <div style={{ background: '#fff', borderBottom: '0.5px solid #eee', padding: '13px 16px' }}>
        <div className="max-w-xl mx-auto" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: NAVY }}>Carta Canta</span>
          <Link href="/login" style={{ fontSize: 13, fontWeight: 600, color: '#55534b', textDecoration: 'none' }}>Accedi</Link>
        </div>
      </div>

      <div className="max-w-xl mx-auto" style={{ padding: '26px 18px 30px' }}>
        {/* Hero: una promessa, un bottone */}
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: GOLD, textAlign: 'center' }}>
          Gratis durante la beta · niente carta di credito
        </p>
        <h1 style={{ fontSize: 30, lineHeight: 1.18, fontWeight: 800, color: '#161616', textAlign: 'center', margin: '10px 0 0' }}>
          Il preventivo è fatto<br />prima di risalire sul furgone.
        </h1>
        <p style={{ fontSize: 15, color: '#55534b', lineHeight: 1.55, textAlign: 'center', margin: '12px 0 0' }}>
          Detta le voci, invia il link, il cliente firma dal telefono.
          Professionale in 60 secondi — senza Excel, senza carta.
        </p>
        <div style={{ marginTop: 18 }}>
          <Cta />
        </div>
        <p style={{ fontSize: 12, color: '#8a887f', textAlign: 'center', marginTop: 9 }}>
          I primi artigiani della beta avranno condizioni riservate al lancio.
        </p>

        {/* 3 passi */}
        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {STEPS.map((s, i) => (
            <div key={s.title} style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)', padding: '15px 16px', display: 'flex', gap: 13 }}>
              <span style={{ width: 40, height: 40, borderRadius: 12, background: '#f5f0e2', color: '#b0863e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <s.Icon size={19} />
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: '#161616' }}>{i + 1}. {s.title}</span>
                <span style={{ display: 'block', fontSize: 13, color: '#55534b', lineHeight: 1.55, marginTop: 3 }}>{s.text}</span>
              </span>
            </div>
          ))}
        </div>

        {/* Proof strip */}
        <div style={{ marginTop: 16, background: '#fff', borderRadius: 14, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)', padding: '13px 16px', display: 'flex', flexDirection: 'column', gap: 9 }}>
          {PROOF.map((pItem) => (
            <span key={pItem.text} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: '#161616' }}>
              <pItem.Icon size={15} style={{ color: '#2f8a63', flexShrink: 0 }} /> {pItem.text}
            </span>
          ))}
        </div>

        {/* Cosa c'è dentro */}
        <div style={{ marginTop: 16, background: '#fff', borderRadius: 14, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)', padding: '15px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: 9 }}>
            Tutto l&rsquo;ufficio, in tasca
          </div>
          {['Preventivi e fatture professionali (4 stili)', 'Firma del cliente con un tocco, dal suo telefono', 'Sopralluoghi con foto e appuntamenti con navigazione', 'Lavori: da iniziare → in corso → finito, col margine', 'Bilancio con entrate, uscite e spese', 'Promemoria e solleciti automatici ai clienti'].map((f) => (
            <span key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13.5, color: '#161616', padding: '5px 0' }}>
              <Check size={15} style={{ color: GOLD, flexShrink: 0, marginTop: 2 }} /> {f}
            </span>
          ))}
        </div>

        {/* Mini FAQ */}
        <div style={{ marginTop: 16, background: '#fff', borderRadius: 14, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)', padding: '7px 16px' }}>
          {FAQ.map((item, i) => (
            <details key={item.q} style={{ borderBottom: i < FAQ.length - 1 ? '0.5px solid #eee' : 'none' }}>
              <summary style={{ padding: '11px 0', fontSize: 14, fontWeight: 600, color: '#161616', cursor: 'pointer', listStyle: 'none' }}>{item.q}</summary>
              <p style={{ fontSize: 13, color: '#55534b', lineHeight: 1.55, margin: '0 0 12px' }}>{item.a}</p>
            </details>
          ))}
        </div>

        {/* CTA finale */}
        <div style={{ marginTop: 20 }}>
          <Cta label="Inizia ora — è gratis" />
        </div>

        <p style={{ fontSize: 11, color: '#a5a39b', textAlign: 'center', marginTop: 16, lineHeight: 1.6 }}>
          <Link href="/privacy" style={{ color: '#8a887f' }}>Privacy</Link> · <Link href="/termini" style={{ color: '#8a887f' }}>Termini</Link> · © {new Date().getFullYear()} Carta Canta
        </p>
      </div>
    </div>
  )
}
