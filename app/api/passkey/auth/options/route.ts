// POST /api/passkey/auth/options
// Opzioni per lo SBLOCCO con impronta. La sessione è ancora valida (il blocco è
// una schermata sopra l'app, non un logout): l'endpoint è autenticato, quindi
// niente enumerazione utenti e nessun bisogno dell'email.

import { NextResponse } from 'next/server'
import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { createClient } from '@/lib/supabase/server'
import { getRp } from '@/lib/webauthn/rp'
import { setChallenge, listPasskeys } from '@/lib/webauthn/store'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { rpID } = await getRp()
  const passkeys = await listPasskeys(user.id)
  if (passkeys.length === 0) {
    return NextResponse.json({ error: 'Nessuna impronta registrata su questo account.' }, { status: 404 })
  }

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'required',
    allowCredentials: passkeys.map((p) => ({
      id: p.credential_id,
      transports: (p.transports ?? undefined) as AuthenticatorTransportFuture[] | undefined,
    })),
  })

  await setChallenge('auth', options.challenge)
  return NextResponse.json(options)
}

type AuthenticatorTransportFuture = 'ble' | 'cable' | 'hybrid' | 'internal' | 'nfc' | 'smart-card' | 'usb'
