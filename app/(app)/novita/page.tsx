import { Sparkles } from 'lucide-react'
import { BackButton } from '@/components/shared/BackButton'

export const metadata = { title: 'Novità' }

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

const AI_ATTIVA = process.env.NEXT_PUBLIC_AI_IMPORT_ENABLED === 'true'

// Changelog utente: voci in ordine cronologico inverso, linguaggio semplice.
// Aggiungere una voce qui a ogni rilascio rilevante per l'utente.
const NOVITA: Array<{ data: string; titolo: string; punti: string[] }> = [
  {
    data: 'Luglio 2026',
    titolo: AI_ATTIVA ? 'Calendario, foto scontrino e ufficio in tasca' : 'Calendario, Lavori e ufficio in tasca',
    punti: [
      'Nuova sezione Lavori: dal preventivo accettato segui il cantiere — da iniziare, in corso, finito, fatturato — con note, foto e margine (preventivato vs speso).',
      'Rapportino di fine lavoro: a lavoro finito scrivi cosa hai fatto e mandi al cliente un link da firmare dal telefono — la prova che il lavoro è stato consegnato.',
      'Pacchetto per il commercialista: da Fatture (o Impostazioni) scarichi il registro delle fatture del periodo — con imponibile, IVA, bollo e incassato — pronto da girare allo studio.',
      'Calendario settimanale in Altro: sopralluoghi e lavori con data e ora, navigazione Google Maps e messaggio "sto arrivando" su WhatsApp.',
      // Solo se la funzione AI è attiva in produzione (flag)
      ...(AI_ATTIVA ? ['Foto allo scontrino nel Bilancio: l\'AI compila importo, data e categoria della spesa.'] : []),
      'Follow-up automatici (da attivare in Impostazioni › Notifiche): un promemoria gentile al cliente che non risponde entro 3 giorni.',
      'Bilancio: mesi scorrevoli col grafico, salto rapido a qualsiasi mese/anno, esporta CSV per il commercialista.',
      '"Scarica i tuoi dati" in Impostazioni: tutti i tuoi dati in un file.',
      'App più veloce e installabile sul telefono, con pagina offline.',
    ],
  },
  {
    data: 'Giugno 2026',
    titolo: 'Sopralluoghi, recensioni e marketplace',
    punti: [
      'Sopralluoghi con foto e dettatura, trasformabili in preventivo con un tocco.',
      'Foto prima/dopo sui lavori, visibili al cliente solo se vuoi tu.',
      'Opzioni a livelli (base/premium) nei preventivi Pro.',
      'Recensioni verificate dei clienti e directory pubblica dei professionisti.',
      'Acconti sui preventivi e pagamenti con IBAN/QR, PayPal o Satispay.',
    ],
  },
]

export default function NovitaPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <div style={{ background: '#fff', borderBottom: '0.5px solid #eeeeee', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px' }}>
        <BackButton fallback="/altro" />
        <span style={{ flex: 1, fontSize: 17, fontWeight: 600, color: '#161616' }}>Novità</span>
        <span style={{ width: 24 }} />
      </div>

      {NOVITA.map((rel) => (
        <div key={rel.data} style={{ margin: '14px 15px 0', background: '#fff', borderRadius: 14, boxShadow: SH, padding: '14px 15px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: '#b0863e' }}>{rel.data}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 15, fontWeight: 700, color: '#161616', margin: '4px 0 8px' }}>
            <Sparkles size={16} style={{ color: '#c9a44c' }} /> {rel.titolo}
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rel.punti.map((p) => (
              <li key={p} style={{ fontSize: 13, color: '#55534b', lineHeight: 1.55 }}>{p}</li>
            ))}
          </ul>
        </div>
      ))}

      <div style={{ height: 24 }} />
    </div>
  )
}
