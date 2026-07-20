// POST /api/passkey/auth/verify
// Verifica lo sblocco con impronta. La passkey verificata deve appartenere
// all'utente della sessione corrente (nessun accesso cross-account).

import { NextRequest, NextResponse } from 'next/server'
import { verifyAuthenticationResponse } from '@simplewebauthn/server'
import { createClient } from '@/lib/supabase/server'
import { getRp } from '@/lib/webauthn/rp'
import { takeChallenge, findPasskeyByCredentialId, updatePasskeyCounter } from '@/lib/webauthn/store'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  let body: { response?: { id?: string } & Record<string, unknown> }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Richiesta non valida' }, { status: 400 }) }
  const credId = body.response?.id
  if (!body.response || !credId) return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 })

  const challenge = await takeChallenge('auth')
  if (!challenge) return NextResponse.json({ error: 'Sblocco scaduto. Riprova.' }, { status: 400 })

  const passkey = await findPasskeyByCredentialId(credId)
  // La passkey deve esistere ED essere di questo utente: senza il secondo
  // controllo l'impronta di un altro account sbloccherebbe questa sessione.
  if (!passkey || passkey.user_id !== user.id) {
    return NextResponse.json({ error: 'Impronta non riconosciuta.' }, { status: 401 })
  }

  const { rpID, origin } = await getRp()
  let verification
  try {
    verification = await verifyAuthenticationResponse({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload dal browser (startAuthentication)
      response: body.response as any,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: passkey.credential_id,
        publicKey: new Uint8Array(Buffer.from(passkey.public_key, 'base64url')),
        counter: passkey.counter,
        transports: (passkey.transports ?? undefined) as ('ble' | 'cable' | 'hybrid' | 'internal' | 'nfc' | 'smart-card' | 'usb')[] | undefined,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Impronta non riconosciuta.' }, { status: 401 })
  }

  if (!verification.verified) {
    return NextResponse.json({ error: 'Impronta non riconosciuta.' }, { status: 401 })
  }

  // Aggiorna il contatore anti-clonazione (best-effort)
  await updatePasskeyCounter(passkey.id, verification.authenticationInfo.newCounter)
  return NextResponse.json({ verified: true })
}
