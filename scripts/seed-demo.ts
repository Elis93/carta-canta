/**
 * ============================================================
 * SEED ACCOUNT DEMO — Carta Canta
 * ============================================================
 * Crea (o RIPRISTINA) un account dimostrativo con dati realistici:
 * un idraulico con clienti, catalogo, preventivi in vari stati,
 * una fattura pagata, spese (Bilancio), LAVORI nei vari stati (con
 * ore lavorate, rapportino firmato e promemoria di richiamo),
 * sopralluoghi con appuntamento e aperture del preventivo.
 *
 * A cosa serve:
 *  - Play Store: i revisori di Google devono poter ENTRARE e provare
 *    l'app → serve un account con email+password funzionanti.
 *  - Demo di vendita / video: mostrare l'app piena invece che vuota.
 *
 * È IDEMPOTENTE: rilanciandolo, azzera i dati del demo e li ricrea da
 * capo (utile perché revisori e demo modificano i dati).
 *
 * COME LANCIARLO (dal computer, nella cartella del progetto):
 *   npx tsx scripts/seed-demo.ts
 * Le variabili NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
 * vengono lette da .env.local (o .env) automaticamente.
 *
 * ⚠️ Scrive sul database di PRODUZIONE (crea un utente reale).
 *    Usa la SERVICE_ROLE_KEY: non committare mai output/credenziali.
 * ============================================================
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { calcolaDocumento } from '@/lib/fiscal/calcoli'
// NB: createAdminClient legge process.env solo quando viene CHIAMATO (dentro
// main), quindi l'import statico va bene anche prima di loadEnv().
import { createAdminClient } from '@/lib/supabase/admin'

// ── Credenziali dell'account demo (modificabili) ──────────────────────────
// Cambiale QUI se vuoi email/password diverse per il Play Store.
const DEMO_EMAIL = 'demo@cartacanta.app'
const DEMO_PASSWORD = 'CartaCanta-Demo-2026'
const DEMO_NOME = 'Luca'
const DEMO_COGNOME = 'Bianchi'
// Piano dell'account demo: 'pro' così la demo mostra tutte le funzioni
// (Bilancio, opzioni a livelli, niente watermark). Metti 'free' se preferisci
// far vedere l'esperienza gratuita.
const DEMO_PLAN = 'pro'

// ── Caricamento env da .env.local / .env (senza dipendenze) ────────────────
function loadEnv() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) return
  for (const file of ['.env.local', '.env']) {
    try {
      const raw = readFileSync(join(process.cwd(), file), 'utf8')
      for (const line of raw.split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
        if (!m) continue
        const key = m[1]
        let val = m[2].trim()
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1)
        }
        if (!process.env[key]) process.env[key] = val
      }
    } catch { /* file assente — proseguo */ }
  }
}
loadEnv()

const YEAR = new Date().getFullYear()
const todayIso = () => new Date().toISOString()
const daysAgoIso = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString()
const daysAheadIso = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString()
const dateOnly = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any

async function main() {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any

  console.log('→ Account demo:', DEMO_EMAIL)

  // ── 1. Utente demo: crea o riusa (email già confermata) ──────────────────
  const userId = await getOrCreateDemoUser(admin)
  console.log('  utente ok:', userId)

  // ── 2. Reset: cancella i workspace esistenti di questo utente ────────────
  await wipeUserWorkspaces(db, userId)
  console.log('  reset dati precedenti ok')

  // ── 3. Workspace ─────────────────────────────────────────────────────────
  const wsId = randomUUID()
  const { error: wsErr } = await db.from('workspaces').insert({
    id: wsId,
    owner_id: userId,
    name: 'Idraulica Bianchi',
    ragione_sociale: 'Idraulica Bianchi di Luca Bianchi',
    slug: `idraulica-bianchi-demo-${wsId.slice(0, 8)}`,
    plan: DEMO_PLAN,
    fiscal_regime: 'forfettario',
    ateco_codes: ['43.22.01'],
    piva: '12345678903',
    indirizzo: 'Via Roma 1',
    citta: 'Milano',
    provincia: 'MI',
    cap: '20100',
    phone: '+39 340 1234567',
    validity_days: 30,
    sent_quota_used: 4,
    bollo_auto: true,
  })
  if (wsErr) throw new Error('Creazione workspace fallita: ' + wsErr.message)
  console.log('  workspace ok:', wsId)

  // Costo orario manodopera (colonna 052) — tollerante pre-migration:
  // serve alla card "Economia del lavoro" per calcolare il margine reale.
  {
    const { error } = await db.from('workspaces').update({ hourly_cost: 30 }).eq('id', wsId)
    if (error) console.warn('  ⚠️ hourly_cost non impostato (migration 052 assente?) — non bloccante')
  }

  // ── 4. Clienti ─────────────────────────────────────────────────────────
  const clients = [
    { name: 'Mario', surname: 'Rossi', email: 'mario.rossi@example.com', phone: '+39 333 1112223', citta: 'Milano', provincia: 'MI', indirizzo: 'Via Torino 15' },
    { name: 'Condominio Via Verdi 12', surname: null, email: 'amministratore@example.com', phone: '+39 02 4567890', citta: 'Milano', provincia: 'MI', indirizzo: 'Via Verdi 12' },
    { name: 'Ristorante Da Gino', surname: null, email: 'info@dagino.example.com', phone: '+39 039 998877', citta: 'Monza', provincia: 'MB', indirizzo: 'Corso Milano 88', piva: '09876543210' },
    { name: 'Anna', surname: 'Ferrari', email: 'anna.ferrari@example.com', phone: '+39 347 5556677', citta: 'Sesto San Giovanni', provincia: 'MI', indirizzo: 'Via Marconi 3' },
  ]
  const clientIds: Record<string, string> = {}
  for (const c of clients) {
    const id = randomUUID()
    const { error } = await db.from('clients').insert({ id, workspace_id: wsId, paese: 'IT', ...c })
    if (error) throw new Error(`Cliente ${c.name} fallito: ` + error.message)
    clientIds[c.name] = id
  }
  console.log('  clienti ok:', Object.keys(clientIds).length)

  // ── 5. Catalogo ──────────────────────────────────────────────────────────
  const catalog = [
    { name: 'Manodopera idraulica', description: 'Intervento tecnico specializzato', unit: 'ora', unit_price: 35, category: 'Manodopera' },
    { name: 'Sostituzione rubinetto miscelatore', description: 'Fornitura e posa miscelatore', unit: 'cad', unit_price: 120, category: 'Sanitari' },
    { name: 'Riparazione perdita tubazione', description: 'Individuazione e riparazione perdita', unit: 'a corpo', unit_price: 90, category: 'Riparazioni' },
    { name: 'Installazione scaldabagno', description: 'Fornitura e installazione scaldabagno elettrico', unit: 'cad', unit_price: 280, category: 'Impianti' },
    { name: 'Sblocco scarico', description: 'Disostruzione scarico con sonda', unit: 'a corpo', unit_price: 70, category: 'Riparazioni' },
    { name: 'Sostituzione sifone', description: 'Sostituzione sifone sottolavello', unit: 'cad', unit_price: 45, category: 'Sanitari' },
  ]
  for (let i = 0; i < catalog.length; i++) {
    const { error } = await db.from('catalog_items').insert({
      id: randomUUID(), workspace_id: wsId, is_active: true, sort_order: i, vat_rate: 22, ...catalog[i],
    })
    if (error) throw new Error(`Voce catalogo ${catalog[i].name} fallita: ` + error.message)
  }
  console.log('  catalogo ok:', catalog.length)

  // ── 6. Documenti (preventivi + fattura) ──────────────────────────────────
  // Forfettario: IVA=0, bollo €2 se imponibile > 77,47.
  const fiscalOpts = { fiscal_regime: 'forfettario' as const, currency: 'EUR' as const, vat_rate_default: 0 }

  // Helper: crea un documento con le sue voci e i totali dal motore fiscale.
  async function createDoc(opts: {
    docType: 'preventivo' | 'fattura'
    seq: number
    clientName: string
    title: string
    status: string
    items: Array<{ description: string; quantity: number; unit: string; unit_price: number }>
    sentDaysAgo?: number
    expiresInDays?: number | null
    acceptedDaysAgo?: number
    signerName?: string
    paid?: boolean
    draft?: boolean
    notes?: string
  }) {
    const docId = randomUUID()
    const itemsForCalc = opts.items.map((it) => ({ ...it, discount_pct: 0, vat_rate: 0 })) as never[]
    const fiscal = calcolaDocumento(itemsForCalc, fiscalOpts)
    const num = `${String(opts.seq).padStart(3, '0')}/${YEAR}`
    const isSentLike = ['sent', 'viewed', 'accepted', 'expired'].includes(opts.status)

    const row: Record<string, unknown> = {
      id: docId,
      workspace_id: wsId,
      client_id: clientIds[opts.clientName],
      created_by: userId,
      doc_type: opts.docType,
      title: opts.title,
      status: opts.status,
      // doc_year e doc_seq sono colonne GENERATED (migration 002): le calcola
      // Postgres dal doc_number — scriverle a mano fa fallire l'INSERT
      // ("cannot insert a non-DEFAULT value into column doc_year").
      doc_number: opts.draft ? null : num,
      subtotal: fiscal.subtotal,
      tax_amount: fiscal.taxAmount,
      bollo_amount: fiscal.bollo,
      total: fiscal.total,
      vat_rate_default: 0,
      currency: 'EUR',
      validity_days: 30,
      notes: opts.notes ?? null,
      created_at: opts.sentDaysAgo != null ? daysAgoIso(opts.sentDaysAgo + 1) : daysAgoIso(1),
    }
    if (isSentLike) {
      row.public_token = randomUUID()
      row.sent_at = daysAgoIso(opts.sentDaysAgo ?? 5)
      row.expires_at = opts.expiresInDays === null ? null
        : opts.expiresInDays! < 0 ? daysAgoIso(-opts.expiresInDays!) : daysAheadIso(opts.expiresInDays ?? 20)
    }
    if (opts.status === 'accepted') {
      row.accepted_at = daysAgoIso(opts.acceptedDaysAgo ?? 2)
      row.signer_name = opts.signerName ?? null
      row.accepted_ua = 'Mozilla/5.0 (demo)'
    }
    if (opts.paid) {
      row.payment_status = 'paid'
      row.paid_at = daysAgoIso(1)
      row.paid_amount = fiscal.total
    }

    const { error: dErr } = await db.from('documents').insert(row)
    if (dErr) throw new Error(`Documento ${num} (${opts.title}) fallito: ` + dErr.message)

    for (let i = 0; i < opts.items.length; i++) {
      const it = opts.items[i]
      const lineTotal = Math.round(it.quantity * it.unit_price * 100) / 100
      const { error: iErr } = await db.from('document_items').insert({
        id: randomUUID(), document_id: docId, sort_order: i,
        description: it.description, unit: it.unit, quantity: it.quantity,
        unit_price: it.unit_price, discount_pct: 0, vat_rate: 0, total: lineTotal,
      })
      if (iErr) throw new Error(`Voce documento ${num} fallita: ` + iErr.message)
    }
    return docId
  }

  // Fattura PAGATA
  await createDoc({
    docType: 'fattura', seq: 1, clientName: 'Ristorante Da Gino',
    title: 'Manutenzione impianto cucina', status: 'accepted',
    sentDaysAgo: 12, expiresInDays: null, paid: true,
    items: [
      { description: 'Installazione scaldabagno', quantity: 1, unit: 'cad', unit_price: 280 },
      { description: 'Manodopera idraulica', quantity: 3, unit: 'ora', unit_price: 35 },
    ],
  })
  // Preventivo SCADUTO
  await createDoc({
    docType: 'preventivo', seq: 1, clientName: 'Anna Ferrari',
    title: 'Sblocco scarico bagno', status: 'expired',
    sentDaysAgo: 40, expiresInDays: -10,
    items: [{ description: 'Sblocco scarico', quantity: 1, unit: 'a corpo', unit_price: 70 }],
  })
  // Preventivo ACCETTATO firmato (l'id serve per il Lavoro collegato e le aperture)
  const acceptedPrevId = await createDoc({
    docType: 'preventivo', seq: 2, clientName: 'Condominio Via Verdi 12',
    title: 'Riparazione perdita colonna montante', status: 'accepted',
    sentDaysAgo: 8, expiresInDays: 20, acceptedDaysAgo: 3,
    signerName: 'Giuseppe Verdi (amministratore)',
    items: [
      { description: 'Riparazione perdita tubazione', quantity: 1, unit: 'a corpo', unit_price: 90 },
      { description: 'Sostituzione sifone', quantity: 2, unit: 'cad', unit_price: 45 },
      { description: 'Manodopera idraulica', quantity: 4, unit: 'ora', unit_price: 35 },
    ],
  })
  // Preventivo INVIATO (in attesa)
  await createDoc({
    docType: 'preventivo', seq: 3, clientName: 'Mario Rossi',
    title: 'Sostituzione rubinetteria bagno', status: 'sent',
    sentDaysAgo: 4, expiresInDays: 20,
    items: [
      { description: 'Sostituzione rubinetto miscelatore', quantity: 2, unit: 'cad', unit_price: 120 },
      { description: 'Manodopera idraulica', quantity: 2, unit: 'ora', unit_price: 35 },
    ],
  })
  // Preventivo BOZZA
  await createDoc({
    docType: 'preventivo', seq: 4, clientName: 'Mario Rossi',
    title: 'Nuovo scaldabagno cucina', status: 'draft', draft: true,
    notes: 'Da confermare la marca dello scaldabagno con il cliente.',
    items: [{ description: 'Installazione scaldabagno', quantity: 1, unit: 'cad', unit_price: 280 }],
  })
  console.log('  documenti ok: 5 (1 fattura pagata, 1 accettato, 1 inviato, 1 scaduto, 1 bozza)')

  // ── 7. invoice_sequences: così i prossimi numeri continuano puliti ────────
  for (const [docType, last] of [['preventivo', 4], ['fattura', 1]] as const) {
    const { error } = await db.from('invoice_sequences').upsert(
      { workspace_id: wsId, year: YEAR, doc_type: docType, seq_type: docType, last_number: last },
      { onConflict: 'workspace_id,year,doc_type' }
    )
    if (error) console.warn(`  ⚠️ invoice_sequences ${docType}: ${error.message} (non bloccante)`)
  }

  // ── 8. Spese (Bilancio) — tollerante se la tabella 038 non c'è ────────────
  const expenses = [
    { date: dateOnly(3), description: 'Tubi e raccordi in rame', amount: 145.5, category: 'Materiali' },
    { date: dateOnly(6), description: 'Rifornimento furgone', amount: 62.0, category: 'Carburante' },
    { date: dateOnly(34), description: 'Trapano a percussione', amount: 89.9, category: 'Attrezzatura' },
    { date: dateOnly(38), description: 'Sanitari e miscelatori (fornitore)', amount: 210.0, category: 'Materiali' },
  ]
  let expOk = 0
  for (const e of expenses) {
    const { error } = await db.from('expenses').insert({ id: randomUUID(), workspace_id: wsId, ...e })
    if (!error) expOk++
  }
  console.log(`  spese ok: ${expOk}/${expenses.length}${expOk === 0 ? ' (tabella expenses assente?)' : ''}`)

  // ── 9. Lavori (048/049/052) — tollerante se le migration mancano ──────────
  // Tre stati diversi + ore lavorate + rapportino firmato + richiamo:
  // così la demo mostra tutto il ciclo del cantiere.
  const lavori = [
    {
      id: randomUUID(),
      client_id: clientIds['Condominio Via Verdi 12'],
      document_id: acceptedPrevId, // nato dal preventivo accettato
      title: 'Riparazione perdita colonna montante',
      address: 'Via Verdi 12, Milano',
      status: 'in_corso',
      notes: 'Colonna del terzo piano. Portare il tubo da 32.',
      started_at: daysAgoIso(2),
      scheduled_at: daysAheadIso(2), // prossimo intervento (compare nel Calendario)
      labor_minutes: 150, // 2h30 già registrate col timer
    },
    {
      id: randomUUID(),
      client_id: clientIds['Ristorante Da Gino'],
      title: 'Manutenzione impianto cucina',
      address: 'Corso Milano 88, Monza',
      status: 'finito',
      started_at: daysAgoIso(8),
      finished_at: daysAgoIso(5),
      labor_minutes: 240,
      // Rapportino di fine lavoro GIÀ FIRMATO dal cliente
      report_token: randomUUID(),
      report_text: 'Sostituito scaldabagno da 80 litri, verificati gli scarichi della linea di lavaggio e ripristinata la pressione dell’impianto. Collaudo eseguito con il titolare.',
      report_sent_at: daysAgoIso(5),
      report_signed_at: daysAgoIso(4),
      report_signer_name: 'Gino Esposito',
      // Richiamo GIÀ SCATTATO (ieri) → in demo si vede la notifica in campanella
      recall_at: daysAgoIso(1),
      recall_note: 'Proporre il contratto di manutenzione semestrale dell’impianto cucina.',
    },
    {
      id: randomUUID(),
      client_id: clientIds['Anna Ferrari'],
      title: 'Sblocco scarico bagno',
      address: 'Via Marconi 3, Sesto San Giovanni',
      status: 'da_iniziare',
      scheduled_at: daysAheadIso(3),
      notes: 'Portare la sonda lunga: scarico condominiale.',
    },
  ]
  let lavOk = 0
  for (const l of lavori) {
    const { error } = await db.from('lavori').insert({ workspace_id: wsId, ...l })
    if (!error) lavOk++
    else console.warn(`  ⚠️ lavoro "${l.title}": ${error.message} (non bloccante)`)
  }
  console.log(`  lavori ok: ${lavOk}/${lavori.length}`)

  // Spesa COLLEGATA al lavoro in corso → la card "Economia del lavoro"
  // mostra preventivato/speso/margine con dati veri (colonna 049).
  if (lavOk > 0) {
    const { error } = await db.from('expenses').insert({
      id: randomUUID(), workspace_id: wsId, lavoro_id: lavori[0].id,
      date: dateOnly(1), description: 'Tubo multistrato 32 e raccordi', amount: 48.5, category: 'Materiali',
    })
    if (error) console.warn('  ⚠️ spesa collegata al lavoro: ' + error.message + ' (non bloccante)')
    else console.log('  spesa collegata al lavoro ok')
  }

  // ── 10. Sopralluoghi (041/047) — tollerante ───────────────────────────────
  const sopralluoghi = [
    {
      id: randomUUID(),
      client_id: clientIds['Mario Rossi'],
      title: 'Bagno da rifare — Rossi',
      address: 'Via Torino 15, Milano',
      notes: 'Vasca da sostituire con box doccia. Il cliente vuole due fasce di prezzo (base e premium). Misure: 2,10 × 1,70.',
      scheduled_at: daysAheadIso(1), // appuntamento di domani → compare in agenda e Calendario
    },
    {
      id: randomUUID(),
      client_id: clientIds['Condominio Via Verdi 12'],
      title: 'Controllo autoclave condominio',
      address: 'Via Verdi 12, Milano',
      notes: 'Pressione bassa ai piani alti. Verificare vaso di espansione.',
    },
  ]
  let sopOk = 0
  for (const s of sopralluoghi) {
    const { error } = await db.from('sopralluoghi').insert({ workspace_id: wsId, ...s })
    if (!error) sopOk++
    else console.warn(`  ⚠️ sopralluogo "${s.title}": ${error.message} (non bloccante)`)
  }
  console.log(`  sopralluoghi ok: ${sopOk}/${sopralluoghi.length}`)

  // ── 11. Aperture del preventivo accettato (storico "visto dal cliente") ───
  let viewsOk = 0
  for (const v of [
    { viewed_at: daysAgoIso(5), user_agent: 'Mozilla/5.0 (iPhone; demo)', ip_address: '93.45.12.34' },
    { viewed_at: daysAgoIso(3), user_agent: 'Mozilla/5.0 (iPhone; demo)', ip_address: '93.45.12.34' },
  ]) {
    const { error } = await db.from('document_views').insert({ document_id: acceptedPrevId, ...v })
    if (!error) viewsOk++
  }
  console.log(`  aperture preventivo ok: ${viewsOk}/2`)

  console.log('\n✅ ACCOUNT DEMO PRONTO')
  console.log('   Email:    ' + DEMO_EMAIL)
  console.log('   Password: ' + DEMO_PASSWORD)
  console.log('   Piano:    ' + DEMO_PLAN)
  console.log('   Accesso:  ' + (process.env.NEXT_PUBLIC_APP_URL ?? 'https://cartacanta.app') + '/login')
}

// ── Utente demo: crea (email confermata) o riusa aggiornando la password ────
async function getOrCreateDemoUser(admin: ReturnType<typeof createAdminClient>): Promise<string> {
  const meta = { nome: DEMO_NOME, cognome: DEMO_COGNOME, full_name: `${DEMO_NOME} ${DEMO_COGNOME}` }
  const { data: created, error } = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true, // niente conferma via email: login immediato per i revisori
    user_metadata: meta,
  })
  if (!error && created?.user) return created.user.id

  // Esiste già → trovalo e aggiorna password + conferma.
  // Pagina finché la pagina non è VUOTA (non "< perPage": GoTrue può limitare
  // perPage server-side, e un break su "< 200" salterebbe l'utente su pagine
  // successive). Cap di sicurezza a 100 pagine.
  const perPage = 200
  for (let page = 1; page <= 100; page++) {
    const { data, error: listErr } = await admin.auth.admin.listUsers({ page, perPage })
    if (listErr) throw new Error('Ricerca utente demo fallita: ' + listErr.message)
    if (data.users.length === 0) break
    const found = data.users.find((u) => u.email?.toLowerCase() === DEMO_EMAIL.toLowerCase())
    if (found) {
      await admin.auth.admin.updateUserById(found.id, {
        password: DEMO_PASSWORD, email_confirm: true, user_metadata: meta,
      })
      return found.id
    }
  }
  throw new Error('Utente demo non creabile né trovabile: ' + (error?.message ?? 'errore sconosciuto'))
}

// ── Reset: elimina i workspace del demo e tutti i dati collegati ────────────
async function wipeUserWorkspaces(db: DB, userId: string): Promise<void> {
  const { data: wss } = await db.from('workspaces').select('id').eq('owner_id', userId)
  for (const ws of (wss ?? []) as Array<{ id: string }>) {
    const { data: docs } = await db.from('documents').select('id').eq('workspace_id', ws.id)
    const docIds = ((docs ?? []) as Array<{ id: string }>).map((d) => d.id)
    if (docIds.length) await db.from('document_items').delete().in('document_id', docIds)
    await db.from('documents').delete().eq('workspace_id', ws.id)
    await db.from('clients').delete().eq('workspace_id', ws.id)
    await db.from('catalog_items').delete().eq('workspace_id', ws.id)
    await db.from('invoice_sequences').delete().eq('workspace_id', ws.id)
    // Tabelle opzionali (migration successive) — ignora se assenti
    for (const t of ['expenses', 'sopralluoghi', 'lavori', 'work_photos', 'document_views']) {
      try { await db.from(t).delete().eq('workspace_id', ws.id) } catch { /* tabella assente */ }
    }
    await db.from('workspaces').delete().eq('id', ws.id)
  }
}

main().catch((e) => {
  console.error('\n❌ Seed fallito:', e instanceof Error ? e.message : e)
  process.exit(1)
})
