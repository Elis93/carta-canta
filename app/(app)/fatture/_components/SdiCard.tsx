'use client'

// ============================================================
// SdiCard — fatturazione elettronica sul dettaglio fattura
// (mockup crescita §1). Il COSTO non viene MAI mostrato: per i Pro
// la dicitura è "Incluso nel piano Pro · Conservazione a norma inclusa";
// i Free hanno 8 invii di prova. Stati: Inviata / Consegnata al cliente /
// Emessa da ritirare nel cassetto fiscale / Scartata (+motivo e reinvio).
// ============================================================

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Loader2, CheckCircle2, AlertTriangle, Clock, Crown, Download, RefreshCw, Info, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { riferimentoTrasmissione, termineTrasmissione, scadenzaLabel } from '@/lib/sdi/termini'
import { spiegaErroreSdi } from '@/lib/sdi/errori-comuni'
import { annullaTrasmissioneAutomaticaAction } from '@/lib/actions/documents'
import { Avviso } from '@/components/shared/Avviso'
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
  const [annullandoAuto, setAnnullandoAuto] = useState(false)
  // Card a TENDINA (Eli 25 ago sera): chiusa di default, APERTA d'ufficio
  // quando c'è qualcosa che non può aspettare — scartata o termine superato
  // (gli avvisi fiscali non si nascondono, regola §B.2). Il riepilogo di
  // stato resta comunque leggibile nella testata da chiusa.
  const [cardOpen, setCardOpen] = useState<boolean>(() => {
    if (sdiStatus === 'scartata') return true
    const rif = riferimentoTrasmissione(docCreatedAt, docPaidAt)
    const t = sdiStatus === null && rif ? termineTrasmissione(rif) : null
    return !!t?.fuoriTermine
  })
  // Deep-link #sdi (campanella): la card deve trovarsi APERTA, non solo
  // scrollata a schermo. Dopo il mount (window non esiste sul server).
  useEffect(() => {
    if (window.location.hash === '#sdi') setCardOpen(true)
  }, [])
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
          return { gravita: 'attenzione' as const, icon: <AlertTriangle size={16} />, label: 'Invio interrotto', sub: 'Sembra che la trasmissione non sia partita: puoi sbloccare la fattura e ritrasmetterla. Se però poco fa hai letto “fattura trasmessa: NON reinviarla”, non sbloccarla — scrivici da Aiuto e controlliamo noi.' }
        }
        if (isUnconfirmed) {
          // Col marker "tentativo avviato" l'attesa NON si risolve da sola:
          // niente promessa dei 10 minuti, solo la via d'uscita vera.
          return { gravita: 'attenzione' as const, icon: <Clock size={16} />, label: 'Invio in verifica', sub: sdiAttempted
            ? 'Non riesco a confermare se la trasmissione è partita. Non reinviarla: scrivici da Aiuto e la verifichiamo noi.'
            : 'Sto ancora controllando se la trasmissione è partita. Ricontrolla tra 10 minuti; se resta così, scrivici da Aiuto.' }
        }
        return { gravita: 'info' as const, icon: <Clock size={16} />, label: 'Inviata allo SdI', sub: 'In attesa dell’esito del Sistema di Interscambio.' }
      case 'consegnata':
        // Copy rifatta (feedback Eli 26 lug: "non si capisce cosa è
        // successo, se è inviata al cliente o altro"). "Destinatario" è
        // gergo SdI = il canale fiscale del cliente, non l'email che manda
        // l'artigiano: qui vanno distinte le due cose, e va detto che
        // l'incasso è un'altra faccenda.
        return {
          gravita: 'ok' as const, icon: <CheckCircle2 size={16} />,
          label: 'Consegnata al cassetto fiscale',
          sub: 'Il Sistema di Interscambio l’ha depositata nel cassetto fiscale del cliente: per l’Agenzia delle Entrate la fattura è emessa. Il pagamento è un’altra cosa: quando i soldi arrivano, ricordati di premere “Segna pagata”.',
        }
      case 'mancata_consegna':
        // Gemello di 'consegnata': "Mancata consegna" da solo suona come un
        // fallimento, mentre la fattura è a tutti gli effetti emessa.
        return {
          gravita: 'attenzione' as const, icon: <AlertTriangle size={16} />,
          label: 'Emessa, da ritirare nel cassetto fiscale',
          sub: 'Il cliente non ha un canale elettronico attivo, quindi il Sistema di Interscambio l’ha lasciata nel suo cassetto fiscale: la fattura è valida ed emessa lo stesso. Avvisalo che la trova lì. Il pagamento è un’altra cosa: quando arriva, premi “Segna pagata”.',
        }
      case 'scartata':
        // Termine dei 5 giorni: la prassi vuole la fattura corretta e
        // ritrasmessa entro 5 giorni dallo scarto, MANTENENDO numero e data
        // originali. Senza dirlo, l'artigiano non sa di avere una scadenza.
        return {
          gravita: 'errore' as const, icon: <AlertTriangle size={16} />,
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

  // Stato in UNA riga per la testata della tendina chiusa.
  const riepilogoChiuso = sdiStatus === 'scartata' ? 'Scartata — da correggere'
    : sdiStatus === 'consegnata' ? 'Consegnata'
    : sdiStatus === 'inviata' ? 'Inviata — attendo esito'
    : sdiStatus === 'mancata_consegna' ? 'Emessa'
    : termine?.fuoriTermine ? 'Termine superato'
    : pilotaVisibile ? 'Parte da sola'
    : termine ? `Entro il ${scadenzaLabel(termine.scadenza)}`
    : 'Da trasmettere'
  const riepilogoColore = sdiStatus === 'scartata' || termine?.fuoriTermine ? '#b05656'
    : sdiStatus === 'consegnata' ? '#2f8a63'
    : (termine && termine.giorniRimasti <= 3) ? '#b0863e'
    : '#55534b'

  return (
    <div style={{ background: '#fff', borderRadius: 14, boxShadow: SH, padding: '14px 15px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: cardOpen ? 8 : 0 }}>
        {/* ⚠️ L'etichetta è lunga (211px misurati, 272 sulla nota di credito) e
            NON può stare su una riga con lo stato: sommata a chevron e ⓘ sborda
            dai 330px interni della card — era il chevron tagliato visto da Eli.
            Quindi: riga 1 = etichetta + comandi (l'etichetta può andare a capo),
            riga 2 = lo stato, che ha così tutta la larghezza. */}
        <button
          type="button"
          onClick={() => setCardOpen((v) => !v)}
          aria-expanded={cardOpen}
          style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', minHeight: 28, textAlign: 'left' }}
        >
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64' }}>
            {isNotaCredito ? 'Nota di credito elettronica (SdI)' : 'Fattura elettronica (SdI)'}
          </span>
          <ChevronDown size={18} style={{ color: '#1a1a2e', flexShrink: 0, transform: cardOpen ? 'rotate(180deg)' : 'none', transition: 'transform .18s' }} />
        </button>
        <button
          type="button"
          onClick={() => { setCardOpen(true); setInfoOpen((o) => !o) }}
          aria-expanded={infoOpen}
          aria-label="Cosa significa la trasmissione SdI"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', border: '1px solid #d9d7d0', background: infoOpen ? '#f2f2f4' : '#fff', color: '#6f6d64', cursor: 'pointer', padding: 0, flexShrink: 0 }}
        >
          <Info size={13} />
        </button>
      </div>

      {!cardOpen && (
        <p style={{ margin: '4px 0 0', fontSize: 12.5, fontWeight: 600, color: riepilogoColore, lineHeight: 1.4 }}>
          {riepilogoChiuso}
        </p>
      )}

      {cardOpen && (<>

      {/* ⚠️ Dal 26 ago la pillola PROVA/COLLAUDO non sta più nella testata (rubava
          la riga al chevron e allo stato): questa riga è l'UNICO avviso che
          l'ambiente non è quello vero. Non toglierla — e resta la prima cosa
          della card aperta, perché per trasmettere bisogna comunque aprirla. */}
      {ambiente !== 'reale' && (
        <p style={{ fontSize: 12, color: '#b0863e', margin: '-2px 0 10px', lineHeight: 1.45 }}>
          {ambiente === 'prova'
            ? 'Modalità di prova: puoi provare tutto il giro, ma dall’app non esce nulla.'
            : 'Ambiente di collaudo: le trasmissioni partono davvero, ma NON arrivano all’Agenzia delle Entrate. Servono a provare, non a emettere.'}
        </p>
      )}

      {/* ⓘ CONCISO (Eli 26 ago: «lascerei una descrizione più concisa dei 12
          giorni e dei 5 giorni, ma prima di tutto punterei a fargli tenere
          attivo il flag di trasmissione automatica, con link, e rimando alle
          FAQ»): il testo per esteso vive nelle Domande frequenti. */}
      {infoOpen && (
        <div style={{ background: '#f7f6f2', border: '1px solid #e8e6e0', borderRadius: 10, padding: '11px 13px', marginBottom: 11, fontSize: 12.5, color: '#3f3d36', lineHeight: 1.55 }}>
          {isNotaCredito ? (
            <>
              <p style={{ margin: 0 }}>
                La nota di credito storna la fattura <b>solo se viene trasmessa</b>{' '}allo
                SdI, il canale dell&rsquo;Agenzia delle Entrate: finché resta qui dentro,
                quella fattura per il fisco è ancora intera.
              </p>
              <p style={{ margin: '6px 0 0' }}>
                Anche per la nota valgono i <b>12 giorni</b>{' '}dal giorno in cui la mandi
                al cliente; se viene <b>scartata</b>, la correggi e la ritrasmetti entro{' '}
                <b>5 giorni</b>, con lo stesso numero e la stessa data. La trasmissione
                automatica non la riguarda: la nota la trasmetti sempre tu.
              </p>
            </>
          ) : (
            <>
              <p style={{ margin: 0 }}>
                Il modo più semplice per non pensarci: tieni attiva la{' '}
                <Link href="/impostazioni/fiscale" style={{ fontWeight: 600, color: '#1a1a2e', textDecoration: 'underline' }}>trasmissione automatica</Link>{' '}
                — la fattura parte da sola 24 ore dopo la conferma.
              </p>
              <p style={{ margin: '6px 0 0' }}>
                In breve: la fattura è <b>emessa</b>{' '}solo quando passa dallo SdI (il PDF
                al cliente è una copia di cortesia). Il conto alla rovescia parte dal
                giorno dell&rsquo;<b>invio al cliente</b>{' '}— o del <b>primo incasso</b>,
                se arriva prima: l&rsquo;app non vede i pagamenti che ricevi, quindi
                l&rsquo;incasso lo registri tu sulla fattura — e dà <b>12 giorni</b>{' '}per
                trasmetterla. Se viene{' '}
                <b>scartata</b>, la correggi e la ritrasmetti entro <b>5 giorni</b>, con lo
                stesso numero e la stessa data.
              </p>
            </>
          )}
          {/* I link aprono GIÀ la domanda giusta, con la risposta per intero
              (deep-link #slug, CercaFaq): «quando clicco su vai a Domande
              frequenti, mi si apre già la domanda» — Eli 26 ago. */}
          <p style={{ margin: '6px 0 0' }}>
            Tutti i dettagli sono nelle Domande frequenti:{' '}
            <Link href="/aiuto#trasmissione-sdi" style={{ fontWeight: 600, color: '#1a1a2e', textDecoration: 'underline' }}>cos&rsquo;è lo SdI</Link>{' '}·{' '}
            <Link href="/aiuto#dodici-giorni" style={{ fontWeight: 600, color: '#1a1a2e', textDecoration: 'underline' }}>i 12 giorni</Link>{isNotaCredito ? null : (<>{' '}·{' '}
            <Link href="/aiuto#trasmissione-automatica" style={{ fontWeight: 600, color: '#1a1a2e', textDecoration: 'underline' }}>la trasmissione automatica</Link></>)}.
          </p>
        </div>
      )}

      {/* Il promemoria giallo «Il documento che invii al cliente non
          sostituisce la fattura elettronica…» (26 lug) è stato TOLTO da Eli
          il 26 ago: la stessa cosa la dicono già il ⓘ conciso, il conto alla
          rovescia dei 12 giorni e le FAQ — era un terzo modo di dirla. */}

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
          <Avviso
            gravita={termine.fuoriTermine ? 'errore' : termine.giorniRimasti <= 3 ? 'attenzione' : 'info'}
            icon={<Clock size={16} />}
            dentro
            style={{ marginBottom: 11 }}
          >
            <span>
              {termine.fuoriTermine ? (
                <>
                  <b>Termine di trasmissione superato da {-termine.giorniRimasti === 1 ? 'un giorno' : `${-termine.giorniRimasti} giorni`}</b>{' '}
                  (andava trasmessa entro il {scadenzaLabel(termine.scadenza)}). Trasmettila
                  comunque: la fattura resta valida. Segnala il ritardo al commercialista —
                  con il ravvedimento operoso la sanzione si riduce.
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
          </Avviso>
        </>
      )}

      {statusView && (
        <Avviso gravita={statusView.gravita} icon={statusView.icon} dentro style={{ marginBottom: canSend ? 11 : 0 }} sotto={statusView.sub}>
          <b>{statusView.label}</b>
          {sdiSentAt && sdiStatus === 'inviata' && (
            <span style={{ color: '#55534b' }}> · {new Date(sdiSentAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }).replace('.', '')}</span>
          )}
        </Avviso>
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
          <Avviso gravita="attenzione" dentro>
            {quotaReason === 'unavailable'
              ? 'Non riesco a verificare le e-fatture disponibili in questo momento: riprova tra qualche minuto.'
              : quotaReason === 'budget_paused'
                ? 'Le e-fatture di prova del piano gratuito sono momentaneamente in pausa: riprendono il mese prossimo. Con Pro sono sempre disponibili.'
                : 'Per protezione, il tuo account ha un tetto di sicurezza mensile sugli invii e questo mese è stato raggiunto. Non hai fatto niente di sbagliato: scrivici da Aiuto (supporto@cartacanta.app) e lo alziamo subito.'}
          </Avviso>
        ) : quotaExhausted ? (
          <>
            <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.5, margin: '0 0 11px' }}>
              Hai usato le {freeTotal} e-fatture di prova del piano gratuito. <b>Con Pro le e-fatture sono illimitate</b>, con conservazione a norma inclusa.
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
              <Avviso gravita="attenzione" icon={<AlertTriangle size={16} />} dentro sotto="Trasmettila comunque e parlane col commercialista per il ravvedimento.">
                <b>I 12 giorni per la trasmissione sono passati</b> (andava trasmessa entro il{' '}
                {scadenzaLabel(termine.scadenza)}): è un&rsquo;emissione tardiva.
              </Avviso>
            )}
            <div>
              <label style={fieldLabel} htmlFor="sdi-dest">Codice destinatario (7 caratteri)</label>
              <input
                id="sdi-dest"
                value={dest}
                onChange={(e) => setDest(e.target.value.toUpperCase())}
                placeholder="esempio: M5UXCR1"
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
                placeholder="esempio: cliente@pec.it"
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
      </>)}
    </div>
  )
}
