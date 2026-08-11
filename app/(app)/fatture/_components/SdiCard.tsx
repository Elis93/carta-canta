'use client'

// ============================================================
// SdiCard — fatturazione elettronica sul dettaglio fattura
// (mockup crescita §1). Il COSTO non viene MAI mostrato: per i Pro
// la dicitura è "Incluso nel piano Pro · Conservazione a norma inclusa";
// i Free hanno 8 invii di prova. Stati: Inviata / Consegnata al cliente /
// Emessa da ritirare nel cassetto fiscale / Scartata (+motivo e reinvio).
// ============================================================

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Loader2, CheckCircle2, AlertTriangle, Clock, Crown, Download, RefreshCw, Info } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { riferimentoTrasmissione, termineTrasmissione, scadenzaLabel } from '@/lib/sdi/termini'
import { spiegaErroreSdi } from '@/lib/sdi/errori-comuni'
import { annullaTrasmissioneAutomaticaAction } from '@/lib/actions/documents'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

const fieldLabel: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '.05em',
  textTransform: 'uppercase', color: 'var(--cc-muted)', marginBottom: 6,
}
const fieldStyle: React.CSSProperties = {
  width: '100%', border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 12px',
  fontSize: 14, fontFamily: 'inherit', color: '#161616', background: '#fff',
  boxSizing: 'border-box', outline: 'none',
}

export interface SdiCardProps {
  documentId: string
  sdiStatus: 'inviata' | 'consegnata' | 'mancata_consegna' | 'scartata' | null
  sdiError: string | null
  sdiSentAt: string | null
  isPro: boolean
  /** Invii di prova rimasti (solo Free; null = illimitato) */
  freeRemaining: number | null
  freeTotal: number
  /** Canale telematico già in rubrica */
  clientDestinatario: string | null
  clientPec: string | null
  /**
   * DOVE finisce davvero la trasmissione (lib/sdi → sdiAmbiente):
   * 'prova' provider finto · 'collaudo' OpenAPI ma non produzione ·
   * 'reale' arriva all'Agenzia. Sostituisce il vecchio `isMockProvider`,
   * che guardava solo se la chiave c'era e non dove puntava.
   */
  ambiente: 'prova' | 'collaudo' | 'reale'
  /**
   * true = orfana SBLOCCABILE (server-computed): 'inviata' senza sent_at, senza
   * marker "tentativo avviato" e ferma da più di 10 minuti. Se invece è
   * 'inviata' senza sent_at ma NON sbloccabile, la card mostra "in verifica".
   */
  sdiOrphan?: boolean
  /** true = marker "tentativo avviato" presente: la trasmissione potrebbe
   * essere partita → niente promessa "ricontrolla tra 10 minuti" (non si
   * risolverà da sola), solo l'invito a scriverci. */
  sdiAttempted?: boolean
  /** Motivo del blocco quota (server): differenzia i messaggi — il paywall
   * ha senso SOLO per free_used, non per errori transitori o kill-switch. */
  quotaReason?: 'free_used' | 'budget_paused' | 'pro_cap' | 'unavailable' | null
  /** true = nota di credito (TD04): stesso impianto, parole diverse. */
  isNotaCredito?: boolean
  /** Data del documento (finirà nel campo Data dell'XML) — per il timer dei 12 giorni */
  docCreatedAt?: string | null
  /** Primo incasso registrato: se precedente, anticipa l'effettuazione (art. 6) */
  docPaidAt?: string | null
  /** Trasmissione automatica programmata (080) — null = niente in programma */
  sdiAutoAt?: string | null
}

export function SdiCard({
  documentId,
  sdiStatus,
  sdiError,
  sdiSentAt,
  isPro,
  freeRemaining,
  freeTotal,
  clientDestinatario,
  clientPec,
  ambiente,
  sdiOrphan = false,
  sdiAttempted = false,
  quotaReason = null,
  isNotaCredito = false,
  docCreatedAt = null,
  docPaidAt = null,
  sdiAutoAt = null,
}: SdiCardProps) {
  const nomeDoc = isNotaCredito ? 'nota di credito' : 'fattura'
  const router = useRouter()
  // Punto ⓘ (richiesta Eli 2 ago): spiegazione in parole semplici di cosa
  // è lo SdI e perché la trasmissione serve — chiusa di default.
  const [infoOpen, setInfoOpen] = useState(false)
  // ⓘ del timer dei 12 giorni (Eli, 11 ago): spiegazione di cosa vuol dire
  // «emessa» e da quando corre il termine — accanto alla funzione, come chiesto.
  const [termineInfoOpen, setTermineInfoOpen] = useState(false)
  const [annullandoAuto, setAnnullandoAuto] = useState(false)
  // Il pilota è «in programma» finché sdi_auto_at è valorizzato e non si è
  // trasmesso nulla. ⚠️ NIENTE confronto col futuro: il cron gira ogni ora
  // in punto, quindi fra l'orario programmato e il giro successivo passano
  // fino a 59 minuti — in quella finestra la trasmissione è ancora in coda
  // (e annullabile!), e nascondere riquadro e tasto Annulla proprio lì
  // sarebbe il momento peggiore. Quando il cron agisce, azzera il campo
  // comunque (successo O fallimento) e il riquadro sparisce da solo.
  const autoProgrammata = !!sdiAutoAt && sdiStatus === null
  // L'ora da DIRE non è sdi_auto_at spaccato al minuto (il cron non parte a
  // quell'ora): è l'ora piena successiva — «verso le 15:00».
  const autoMs = sdiAutoAt ? Date.parse(sdiAutoAt) : NaN
  const autoVersoMs = Number.isFinite(autoMs) ? Math.ceil(autoMs / 3_600_000) * 3_600_000 : NaN
  const autoImminente = Number.isFinite(autoVersoMs) && autoVersoMs <= Date.now()

  async function annullaAuto() {
    setAnnullandoAuto(true)
    try {
      const res = await annullaTrasmissioneAutomaticaAction(documentId)
      if (res?.error) { toast.error(res.error, { closeButton: true }); return }
      toast.success('Trasmissione automatica annullata', { description: 'Questa fattura la trasmetti tu, quando vuoi: il conto dei 12 giorni resta qui a ricordartelo.', closeButton: true })
      router.refresh()
    } finally {
      setAnnullandoAuto(false)
    }
  }
  const [open, setOpen] = useState(false)
  const [dest, setDest] = useState(clientDestinatario ?? '')
  const [pec, setPec] = useState(clientPec ?? '')
  const [sending, setSending] = useState(false)
  const [checking, setChecking] = useState(false)
  const [reclaiming, setReclaiming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fattura senza conferma d'invio: 'inviata' ma senza sent_at. Se il server
  // ha stabilito che è sbloccabile (sdiOrphan), si offre "Sbloccala per
  // reinviare"; altrimenti si mostra "in verifica" (invio in corso, o caso
  // ambiguo dove sbloccare rischierebbe una doppia trasmissione).
  const isOrphan = sdiStatus === 'inviata' && !sdiSentAt && sdiOrphan
  const isUnconfirmed = sdiStatus === 'inviata' && !sdiSentAt && !sdiOrphan

  async function handleReclaim() {
    setReclaiming(true)
    try {
      const res = await fetch(`/api/fatture/${documentId}/sdi/reclaim`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Sblocco non riuscito. Riprova.', { closeButton: true })
        return
      }
      toast.success('Fattura sbloccata', { description: 'Ora puoi trasmetterla di nuovo.', closeButton: true })
      router.refresh()
    } catch {
      toast.error('Errore di rete. Controlla la connessione e riprova.')
    } finally {
      setReclaiming(false)
    }
  }

  // Pull dell'esito dal provider (23 lug): utile quando il webhook tarda o
  // non è configurato. Esito trovato → la card si aggiorna col refresh.
  async function checkEsito() {
    setChecking(true)
    try {
      const res = await fetch(`/api/fatture/${documentId}/sdi/esito`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Verifica non riuscita. Riprova.', { closeButton: true })
        return
      }
      if (!data.esito) {
        toast.info('Ancora in attesa: lo SdI non ha ancora emesso l’esito.', { closeButton: true })
        return
      }
      toast.success('Esito ricevuto', { description: 'Lo stato della fattura è stato aggiornato.', closeButton: true })
      router.refresh()
    } catch {
      toast.error('Errore di rete. Controlla la connessione e riprova.')
    } finally {
      setChecking(false)
    }
  }

  async function handleSend() {
    setError(null)
    setSending(true)
    try {
      const res = await fetch(`/api/fatture/${documentId}/sdi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codice_destinatario: dest.trim() || undefined,
          pec: pec.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Invio non riuscito. Riprova.')
        return
      }
      // Caso raro "trasmessa ma conferma non salvata" (review 25 lug A1):
      // l'avviso NON deve essere scambiato per il successo standard.
      if (data.warning) {
        toast.warning('Fattura trasmessa — attenzione', {
          description: data.warning,
          duration: 30_000,
          closeButton: true,
        })
        setOpen(false)
        router.refresh()
        return
      }
      // ⚠️ Il titolo dice DOVE è andata. `data.mock` copre solo il provider
      // finto: senza l'ambiente, una trasmissione di COLLAUDO annunciava
      // «Riceverai l'esito del Sistema di Interscambio» come una vera.
      const titoloOk = isNotaCredito ? 'Nota di credito inviata allo SdI' : 'Fattura inviata allo SdI'
      const suffisso = ambiente === 'prova' ? ' (PROVA)' : ambiente === 'collaudo' ? ' (COLLAUDO)' : ''
      toast.success(`${titoloOk}${suffisso}`, {
        description: ambiente === 'prova'
          ? 'Provider di prova: non è uscito nulla dall’app.'
          : ambiente === 'collaudo'
            ? 'Ambiente di collaudo: NON è arrivata all’Agenzia delle Entrate.'
            : `Riceverai l’esito del Sistema di Interscambio qui sulla ${nomeDoc}.`,
        closeButton: true,
      })
      setOpen(false)
      router.refresh()
    } catch {
      setError('Errore di rete. Controlla la connessione e riprova.')
    } finally {
      setSending(false)
    }
  }

  const statusView = (() => {
    switch (sdiStatus) {
      case 'inviata':
        // Senza conferma d'invio i due sotto-stati raccontano la verità al
        // posto del generico "Inviata" (che contraddirebbe il resto della card).
        if (isOrphan) {
          return { bg: '#f5e9d0', color: '#b0863e', icon: <AlertTriangle size={15} />, label: 'Invio interrotto', sub: 'Sembra che la trasmissione non sia partita: puoi sbloccare la fattura e ritrasmetterla. Se però poco fa hai letto “fattura trasmessa: NON reinviarla”, non sbloccarla — scrivici da Aiuto e controlliamo noi.' }
        }
        if (isUnconfirmed) {
          // Col marker "tentativo avviato" l'attesa NON si risolve da sola:
          // niente promessa dei 10 minuti, solo la via d'uscita vera.
          return { bg: '#f5e9d0', color: '#b0863e', icon: <Clock size={15} />, label: 'Invio in verifica', sub: sdiAttempted
            ? 'Non riesco a confermare se la trasmissione è partita. Non reinviarla: scrivici da Aiuto e la verifichiamo noi.'
            : 'Sto ancora controllando se la trasmissione è partita. Ricontrolla tra 10 minuti; se resta così, scrivici da Aiuto.' }
        }
        return { bg: '#d8e8fb', color: '#3f6fb0', icon: <Clock size={15} />, label: 'Inviata allo SdI', sub: 'In attesa dell’esito del Sistema di Interscambio.' }
      case 'consegnata':
        // Copy rifatta (feedback Eli 26 lug: "non si capisce cosa è
        // successo, se è inviata al cliente o altro"). "Destinatario" è
        // gergo SdI = il canale fiscale del cliente, non l'email che manda
        // l'artigiano: qui vanno distinte le due cose, e va detto che
        // l'incasso è un'altra faccenda.
        return {
          bg: '#d4efe2', color: '#2f8a63', icon: <CheckCircle2 size={15} />,
          label: 'Consegnata al cassetto fiscale',
          sub: 'Il Sistema di Interscambio l’ha depositata nel cassetto fiscale del cliente: per l’Agenzia delle Entrate la fattura è emessa. Il pagamento è un’altra cosa: quando i soldi arrivano, ricordati di premere “Segna pagata”.',
        }
      case 'mancata_consegna':
        // Gemello di 'consegnata': "Mancata consegna" da solo suona come un
        // fallimento, mentre la fattura è a tutti gli effetti emessa.
        return {
          bg: '#f5e9d0', color: '#b0863e', icon: <AlertTriangle size={15} />,
          label: 'Emessa, da ritirare nel cassetto fiscale',
          sub: 'Il cliente non ha un canale elettronico attivo, quindi il Sistema di Interscambio l’ha lasciata nel suo cassetto fiscale: la fattura è valida ed emessa lo stesso. Avvisalo che la trova lì. Il pagamento è un’altra cosa: quando arriva, premi “Segna pagata”.',
        }
      case 'scartata':
        // Termine dei 5 giorni: la prassi vuole la fattura corretta e
        // ritrasmessa entro 5 giorni dallo scarto, MANTENENDO numero e data
        // originali. Senza dirlo, l'artigiano non sa di avere una scadenza.
        return {
          bg: '#f5dede', color: '#b05656', icon: <AlertTriangle size={15} />,
          label: 'Scartata dallo SdI',
          sub: `${sdiError ?? 'Il Sistema di Interscambio ha rifiutato la fattura.'} Correggi il dato segnalato e reinviala: va fatto entro 5 giorni, tenendo lo stesso numero e la stessa data.`,
        }
      default:
        return null
    }
  })()

  // ── TIMER DEI 12 GIORNI (art. 21 c.4 DPR 633/1972 — ricerca 11 ago) ──
  // Corre dalla data del documento (o dal primo incasso, se precedente) e
  // vale finché la trasmissione non è partita: una bozza NON è emessa, e
  // nemmeno il documento mandato al cliente — emessa = trasmessa allo SdI.
  const riferimento12gg = riferimentoTrasmissione(docCreatedAt, docPaidAt)
  const termine = sdiStatus === null && riferimento12gg ? termineTrasmissione(riferimento12gg) : null

  const quotaExhausted = !isPro && freeRemaining !== null && freeRemaining <= 0
  const canSend = !sdiStatus || sdiStatus === 'scartata'
  // Il riquadro del pilota si mostra solo se la trasmissione può DAVVERO
  // partire: con la quota bloccata (Free esaurito, tetto, pausa) il cron
  // rifiuterebbe — promettere «non devi fare niente» sopra un paywall
  // sarebbe una contraddizione in 12 pixel (review 11 ago).
  const pilotaVisibile = autoProgrammata && !quotaExhausted && !quotaReason

  // Traduzione dello scarto (11 ago): i 10 errori più comuni spiegati in
  // parole semplici, con cosa fare. Errore non riconosciuto → null, e resta
  // solo il consiglio generico del riquadro di stato.
  const erroreSpiegato = sdiStatus === 'scartata' ? spiegaErroreSdi(sdiError) : null

  return (
    <div style={{ background: '#fff', borderRadius: 14, boxShadow: SH, padding: '14px 15px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64' }}>
          {isNotaCredito ? 'Nota di credito elettronica (SdI)' : 'Fattura elettronica (SdI)'}
          <button
            type="button"
            onClick={() => setInfoOpen((o) => !o)}
            aria-expanded={infoOpen}
            aria-label="Cosa significa la trasmissione SdI"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', border: '1px solid #d9d7d0', background: infoOpen ? '#f2f2f4' : '#fff', color: '#6f6d64', cursor: 'pointer', padding: 0 }}
          >
            <Info size={13} />
          </button>
        </span>
        {ambiente !== 'reale' && (
          <span
            title={ambiente === 'prova'
              ? 'Provider di prova: non esce nulla dall’app.'
              : 'Ambiente di collaudo: la fattura NON arriva all’Agenzia delle Entrate.'}
            style={{ border: '1px solid #e8d6ad', color: '#b0863e', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}
          >
            {ambiente === 'prova' ? 'PROVA' : 'COLLAUDO'}
          </span>
        )}
      </div>

      {/* ⚠️ Il `title` della pillola non esiste sul telefono, e l'app si usa dal
          telefono: se l'ambiente non è quello vero, va scritto per esteso. */}
      {ambiente !== 'reale' && (
        <p style={{ fontSize: 12, color: '#b0863e', margin: '-2px 0 10px', lineHeight: 1.45 }}>
          {ambiente === 'prova'
            ? 'Modalità di prova: puoi provare tutto il giro, ma dall’app non esce nulla.'
            : 'Ambiente di collaudo: le trasmissioni partono davvero, ma NON arrivano all’Agenzia delle Entrate. Servono a provare, non a emettere.'}
        </p>
      )}

      {infoOpen && (
        <div style={{ background: '#f7f6f2', border: '1px solid #e8e6e0', borderRadius: 10, padding: '11px 13px', marginBottom: 11, fontSize: 12.5, color: '#3f3d36', lineHeight: 1.55 }}>
          <p style={{ margin: 0, fontWeight: 600, color: '#161616' }}>Cos&rsquo;&egrave; la trasmissione SdI?</p>
          {isNotaCredito ? (
            <p style={{ margin: '6px 0 0' }}>
              La nota di credito storna la fattura <b>solo se viene trasmessa</b>: finché
              resta qui dentro, per l&rsquo;Agenzia delle Entrate quella fattura &egrave;
              ancora intera. Il Sistema di Interscambio (SdI) &egrave; il canale che la
              riceve e la recapita al cliente.
            </p>
          ) : (
            <p style={{ margin: '6px 0 0' }}>
              Per legge la fattura va emessa in formato ELETTRONICO: il PDF che mandi al
              cliente &egrave; solo una copia di cortesia. Il Sistema di Interscambio (SdI)
              &egrave; il canale dell&rsquo;Agenzia delle Entrate che riceve la fattura
              elettronica e la recapita al cliente.
            </p>
          )}
          <p style={{ margin: '6px 0 0' }}>
            Da qui la trasmetti con un tocco. Dopo l&rsquo;invio arriva l&rsquo;esito:{' '}
            <b>Consegnata</b> (tutto a posto) oppure <b>Scartata</b> (c&rsquo;&egrave; un
            dato da correggere: sistemi e reinvii entro 5 giorni, con lo stesso numero e
            la stessa data).
          </p>
          <p style={{ margin: '6px 0 0' }}>
            In alternativa puoi trasmetterla come hai sempre fatto (cassetto fiscale o
            commercialista): l&rsquo;importante &egrave; che ogni documento venga trasmesso
            una volta sola.
          </p>
        </div>
      )}

      {/* Promemoria di trasparenza (feedback Eli 26 lug: "andrebbe messo
          nella sezione Fattura Elettronica"): finché non c'è stata alcuna
          trasmissione, il posto giusto per dire "questo PDF non è la
          fattura elettronica" è QUI, accanto al bottone che la trasmette —
          non un banner sperso in fondo alla pagina. Con un esito SdI
          (anche scartata) lo stato racconta già tutto. */}
      {/* ⚠️ Non compare quando il pilota è attivo: «ricordati di trasmetterla»
          sopra «non devi fare niente» sono due ordini contrari a 12px di
          distanza (review 11 ago). */}
      {sdiStatus === null && !pilotaVisibile && (
        <div style={{ background: '#f5e9d0', borderRadius: 10, padding: '10px 12px', display: 'flex', gap: 9, alignItems: 'flex-start', marginBottom: 11 }}>
          <AlertTriangle size={15} style={{ color: '#b0863e', flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 12, color: '#8a6a2f', lineHeight: 1.45 }}>
            {isNotaCredito
              ? 'Finché non la trasmetti, per l’Agenzia delle Entrate la fattura è ancora intera: la nota storna solo dopo l’invio, qui sotto oppure tramite il cassetto fiscale o il commercialista.'
              : 'Il documento che invii al cliente non sostituisce la fattura elettronica: ricordati di trasmetterla qui sotto, oppure tramite il cassetto fiscale o il commercialista.'}
          </span>
        </div>
      )}

      {/* ── Pilota automatico (Eli, 11 ago: «automatico deve essere default e
          sia chiaro all'artigiano»): la trasmissione è GIÀ in programma —
          qui si vede quando parte e si può annullare. ── */}
      {pilotaVisibile && sdiAutoAt && (
        <div style={{ background: '#eef2f7', borderRadius: 10, padding: '10px 12px', display: 'flex', gap: 9, alignItems: 'flex-start', marginBottom: 11 }}>
          <Send size={15} style={{ color: '#1a1a2e', flexShrink: 0, marginTop: 1 }} />
          <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.45, color: '#2b2b2b' }}>
            <b>Trasmissione automatica attiva</b>: la {nomeDoc} parte da sola{' '}
            {autoImminente ? (
              <>a minuti, al prossimo controllo automatico.</>
            ) : (
              <>
                {new Date(autoVersoMs).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', timeZone: 'Europe/Rome' })} verso le{' '}
                {new Date(autoVersoMs).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })}.
              </>
            )}{' '}
            Non devi fare niente.
          </span>
          <button
            type="button"
            onClick={annullaAuto}
            disabled={annullandoAuto}
            style={{ border: '1px solid #d9d7d0', borderRadius: 9, background: '#fff', color: '#55534b', fontSize: 12, fontWeight: 600, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, opacity: annullandoAuto ? 0.6 : 1 }}
          >
            {annullandoAuto ? <Loader2 size={13} className="animate-spin" /> : 'Annulla'}
          </button>
        </div>
      )}

      {/* ── Il conto alla rovescia dei 12 giorni (Eli, 11 ago: «voglio che
          abbia sotto controllo la situazione e sia guidato») ── */}
      {termine && (
        <>
          <div
            style={{
              background: termine.fuoriTermine ? '#f5dede' : termine.giorniRimasti <= 3 ? '#f5e9d0' : '#f4f3ef',
              borderRadius: 10, padding: '10px 12px', display: 'flex', gap: 9, alignItems: 'flex-start', marginBottom: 11,
            }}
          >
            <Clock size={15} style={{ color: termine.fuoriTermine ? '#b05656' : termine.giorniRimasti <= 3 ? '#b0863e' : '#6f6d64', flexShrink: 0, marginTop: 1 }} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.45, color: termine.fuoriTermine ? '#8a3d3d' : termine.giorniRimasti <= 3 ? '#8a6a2f' : '#55534b' }}>
              {termine.fuoriTermine ? (
                <>
                  <b>Termine di trasmissione superato da {-termine.giorniRimasti === 1 ? 'un giorno' : `${-termine.giorniRimasti} giorni`}</b>{' '}
                  (andava trasmessa entro il {scadenzaLabel(termine.scadenza)}). Trasmettila
                  comunque — meglio tardi che mai — e parlane col commercialista: col
                  ravvedimento la sanzione si riduce.
                </>
              ) : termine.giorniRimasti === 0 ? (
                <><b>Da trasmettere entro OGGI</b>: è l&rsquo;ultimo giorno utile dei 12 previsti dalla legge.</>
              ) : (
                <>
                  Da trasmettere <b>entro il {scadenzaLabel(termine.scadenza)}</b>{' '}
                  · {termine.giorniRimasti === 1 ? <b>manca 1 giorno</b> : <>mancano <b>{termine.giorniRimasti} giorni</b></>}
                </>
              )}
            </span>
            <button
              type="button"
              onClick={() => setTermineInfoOpen((o) => !o)}
              aria-expanded={termineInfoOpen}
              aria-label="Perché c'è un termine di 12 giorni?"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', border: '1px solid #d9d7d0', background: termineInfoOpen ? '#f2f2f4' : '#fff', color: '#6f6d64', cursor: 'pointer', padding: 0, flexShrink: 0 }}
            >
              <Info size={13} />
            </button>
          </div>
          {termineInfoOpen && (
            <div style={{ background: '#f7f6f2', border: '1px solid #e8e6e0', borderRadius: 10, padding: '11px 13px', marginBottom: 11, fontSize: 12.5, color: '#3f3d36', lineHeight: 1.55 }}>
              <p style={{ margin: 0, fontWeight: 600, color: '#161616' }}>Quando {isNotaCredito ? 'la nota' : 'una fattura'} &egrave; davvero &laquo;emessa&raquo;?</p>
              <p style={{ margin: '6px 0 0' }}>
                Una <b>bozza non &egrave; emessa</b>. E non lo &egrave; nemmeno quando la mandi
                al cliente: quel documento &egrave; una <b>copia di cortesia</b>. Per la legge{' '}
                {isNotaCredito ? 'la nota' : 'la fattura'} &egrave; emessa <b>solo quando viene
                trasmessa allo SdI</b>.
              </p>
              <p style={{ margin: '6px 0 0' }}>
                La trasmissione va fatta <b>entro 12 giorni</b>{' '}dalla data del documento
                (o dal primo incasso, se arriva prima): &egrave; da l&igrave; che parte il
                conto alla rovescia qui sopra.
              </p>
              <p style={{ margin: '6px 0 0' }}>
                Oltre il termine il documento <b>vale comunque</b>, ma &egrave;
                un&rsquo;emissione tardiva sanzionabile: trasmettilo lo stesso e parlane col
                commercialista — col ravvedimento operoso la sanzione si riduce.
              </p>
            </div>
          )}
        </>
      )}

      {statusView && (
        <div style={{ background: statusView.bg, borderRadius: 10, padding: '10px 12px', display: 'flex', gap: 9, alignItems: 'flex-start', marginBottom: canSend ? 11 : 0 }}>
          <span style={{ color: statusView.color, flexShrink: 0, marginTop: 1 }}>{statusView.icon}</span>
          <span>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#2b2b2b' }}>
              {statusView.label}
              {sdiSentAt && sdiStatus === 'inviata' && (
                <span style={{ fontWeight: 400, color: '#55534b' }}> · {new Date(sdiSentAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }).replace('.', '')}</span>
              )}
            </span>
            <span style={{ display: 'block', fontSize: 12, color: '#55534b', marginTop: 2, lineHeight: 1.45 }}>{statusView.sub}</span>
          </span>
        </div>
      )}

      {/* Scarto tradotto in parole semplici (Eli, 11 ago: «rafforziamo aiuto
          artigiano per rifiuti sui 10 errori più comuni»). Compare solo se
          l'errore è uno di quelli riconosciuti: mai una spiegazione
          inventata sotto un errore che non conosciamo. */}
      {erroreSpiegato && (
        <div style={{ background: '#f7f6f2', border: '1px solid #e8e6e0', borderRadius: 10, padding: '11px 13px', marginBottom: canSend ? 11 : 0, fontSize: 12.5, color: '#3f3d36', lineHeight: 1.55 }}>
          <p style={{ margin: 0, fontWeight: 600, color: '#161616' }}>{erroreSpiegato.titolo}</p>
          <p style={{ margin: '5px 0 0' }}>{erroreSpiegato.spiegazione}</p>
          <p style={{ margin: '5px 0 0' }}>
            <b>Cosa fare:</b>{' '}
            {erroreSpiegato.rimedio}
          </p>
        </div>
      )}

      {canSend && (
        quotaReason && quotaReason !== 'free_used' ? (
          // Blocco NON legato al limite Free (review 25 lug M5): errore
          // transitorio, pausa del servizio o tetto Pro — il paywall qui
          // sarebbe falso e scorretto. Messaggio onesto, niente bottone.
          <p style={{ fontSize: 12, color: '#55534b', lineHeight: 1.5, margin: 0, background: '#f5e9d0', borderRadius: 10, padding: '10px 12px' }}>
            {quotaReason === 'unavailable'
              ? 'Non riesco a verificare le e-fatture disponibili in questo momento: riprova tra qualche minuto.'
              : quotaReason === 'budget_paused'
                ? 'Le e-fatture di prova del piano Free sono momentaneamente in pausa: riprendono il mese prossimo. Con Pro sono sempre disponibili.'
                : 'Per protezione, il tuo account ha un tetto di sicurezza mensile sugli invii e questo mese è stato raggiunto. Non hai fatto niente di sbagliato: scrivici da Aiuto (supporto@cartacanta.app) e lo alziamo subito.'}
          </p>
        ) : quotaExhausted ? (
          <>
            <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.5, margin: '0 0 11px' }}>
              Hai usato le {freeTotal} e-fatture di prova del piano Free. <b>Con Pro le e-fatture sono illimitate</b>, con conservazione a norma inclusa.
            </p>
            <Link
              href="/abbonamento"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, height: 44, borderRadius: 12, background: '#1a1a2e', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none', boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)' }}
            >
              <Crown size={15} style={{ color: 'var(--cc-gold)' }} /> Passa a Pro
            </Link>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => { setError(null); setOpen(true) }}
              style={{ width: '100%', height: 46, border: 'none', borderRadius: 12, background: '#1a1a2e', color: '#fff', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <Send size={16} /> {sdiStatus === 'scartata' ? 'Reinvia allo SdI' : 'Invia allo SdI'}
            </button>
            <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.5, marginTop: 9 }}>
              {isPro
                ? 'Incluso nel piano Pro · Conservazione a norma inclusa.'
                : `${freeRemaining} di ${freeTotal} e-fatture di prova disponibili · Conservazione a norma inclusa.`}
            </p>
          </>
        )
      )}

      {/* "Controlla l'esito ora" (23 lug): PULL dell'esito dal provider —
          funziona anche se il webhook non arriva. Solo se è stata trasmessa
          davvero (ha una data di invio). */}
      {sdiStatus === 'inviata' && sdiSentAt && (
        <button
          type="button"
          onClick={checkEsito}
          disabled={checking}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', marginTop: 10, minHeight: 42, borderRadius: 11, border: '1px solid #e3e3e6', background: '#fff', color: '#1a1a2e', fontSize: 13, fontWeight: 600, cursor: checking ? 'wait' : 'pointer', opacity: checking ? 0.7 : 1, fontFamily: 'inherit' }}
        >
          {checking ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={15} />} Controlla l&rsquo;esito ora
        </button>
      )}

      {/* Sblocco della fattura orfana (crash PRIMA della chiamata al provider,
          verificato dal server): nulla è partito, la riportiamo pronta da
          inviare. Il messaggio esplicativo è nel badge di stato qui sopra. */}
      {isOrphan && (
        <button
          type="button"
          onClick={handleReclaim}
          disabled={reclaiming}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', marginTop: 10, minHeight: 42, borderRadius: 11, border: '1px solid #e3e3e6', background: '#fff', color: '#1a1a2e', fontSize: 13, fontWeight: 600, cursor: reclaiming ? 'wait' : 'pointer', opacity: reclaiming ? 0.7 : 1, fontFamily: 'inherit' }}
        >
          {reclaiming ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={15} />} Sbloccala per reinviare
        </button>
      )}

      {/* Scarica l'XML per il commercialista, senza passare da OpenAPI
          (feedback Eli 22 lug #20). */}
      <a
        href={`/api/fatture/${documentId}/xml`}
        target="_blank"
        rel="noopener"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', marginTop: 10, minHeight: 42, borderRadius: 11, border: '1px solid #e3e3e6', background: '#fff', color: '#1a1a2e', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
      >
        <Download size={16} /> Scarica XML (per il commercialista)
      </a>

      <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.5, marginTop: 9, borderTop: '0.5px solid #f0f0f0', paddingTop: 9 }}>
        Carta Canta non fornisce consulenza fiscale e non sostituisce il commercialista:
        la correttezza dei dati resta responsabilità dell&rsquo;utente.
      </p>

      {/* Dialog invio: canale telematico del cliente */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontSize: 17, fontWeight: 600 }}>Invia allo SdI</DialogTitle>
            <DialogDescription style={{ fontSize: 13 }}>
              Serve il canale telematico del cliente. Se è un privato senza canale, lascia vuoto: useremo <b>0000000</b> (la fattura finisce nel suo cassetto fiscale).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Avviso fiscale SEMPRE visibile (regola di Eli sui ⓘ): chi sta
                per trasmettere fuori termine deve saperlo PRIMA del tocco. */}
            {termine?.fuoriTermine && (
              <div style={{ background: '#f5e9d0', borderRadius: 10, padding: '10px 12px', display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                <AlertTriangle size={15} style={{ color: '#b0863e', flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 12, color: '#8a6a2f', lineHeight: 1.45 }}>
                  I 12 giorni per la trasmissione sono passati (andava trasmessa entro il{' '}
                  {scadenzaLabel(termine.scadenza)}): è un&rsquo;emissione tardiva. Trasmettila
                  comunque e parlane col commercialista per il ravvedimento.
                </span>
              </div>
            )}
            <div>
              <label style={fieldLabel} htmlFor="sdi-dest">Codice destinatario (7 caratteri)</label>
              <input
                id="sdi-dest"
                value={dest}
                onChange={(e) => setDest(e.target.value.toUpperCase())}
                placeholder="Es. M5UXCR1"
                maxLength={7}
                autoComplete="off"
                spellCheck={false}
                style={{ ...fieldStyle, textTransform: 'uppercase' }}
              />
            </div>
            <div>
              <label style={fieldLabel} htmlFor="sdi-pec">oppure PEC del cliente</label>
              <input
                id="sdi-pec"
                value={pec}
                onChange={(e) => setPec(e.target.value)}
                placeholder="Es. cliente@pec.it"
                autoComplete="off"
                spellCheck={false}
                style={fieldStyle}
              />
            </div>
            {error && <p style={{ fontSize: 13, color: '#dc2626', fontWeight: 500 }}>{error}</p>}
            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              style={{ width: '100%', height: 48, border: 'none', borderRadius: 12, background: '#1a1a2e', color: '#fff', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)', cursor: sending ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: sending ? 0.7 : 1 }}
            >
              {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={16} />}
              Trasmetti
            </button>
            <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.5 }}>
              Il canale viene salvato in rubrica per le prossime fatture a questo cliente.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
