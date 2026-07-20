// POST /api/passkey/register/verify
// Verifica la registrazione della passkey e la salva. Richiede sessione.

import { NextRequest, NextResponse } from 'next/server'
import { verifyRegistrationResponse } from '@simplewebauthn/server'
import { createClient } from '@/lib/supabase/server'
import { getRp } from '@/lib/webauthn/rp'
import { takeChallenge, insertPasskey, listPasskeys } from '@/lib/webauthn/store'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  let body: { response?: unknown; deviceLabel?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Richiesta non valida' }, { status: 400 }) }
  if (!body.response) return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 })

  const challenge = await takeChallenge('register')
  if (!challenge) return NextResponse.json({ error: 'Sessione di registrazione scaduta. Riprova.' }, { status: 400 })

  const { rpID, origin } = await getRp()
  let verification
  try {
    verification = await verifyRegistrationResponse({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- il payload arriva dal browser (startRegistration)
      response: body.response as any,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    })
  } catch {
    return NextResponse.json({ error: 'Impronta non registrata. Riprova.' }, { status: 400 })
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: 'Impronta non registrata. Riprova.' }, { status: 400 })
  }

  const cred = verification.registrationInfo.credential
  const label = (body.deviceLabel ?? '').toString().trim().slice(0, 60) || 'Questo dispositivo'

  const res = await insertPasskey({
    userId: user.id,
    credentialId: cred.id,
    publicKey: Buffer.from(cred.publicKey).toString('base64url'),
    counter: cred.counter,
    transports: cred.transports ?? null,
    deviceLabel: label,
  })
  if (res.error) {
    // credential_id duplicato → passkey già registrata su questo dispositivo
    if (/duplicate|unique/i.test(res.error)) {
      return NextResponse.json({ error: 'Questo dispositivo ha già lo sblocco con impronta.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Salvataggio non riuscito. La migration 056 potrebbe non essere applicata.' }, { status: 500 })
  }

  const count = (await listPasskeys(user.id)).length
  return NextResponse.json({ verified: true, count })
}
