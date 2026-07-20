// POST /api/passkey/register/options
// Opzioni per registrare una passkey (sblocco con impronta). Richiede sessione:
// la registrazione avviene DOPO il login normale, dallo stesso dispositivo.

import { NextResponse } from 'next/server'
import { generateRegistrationOptions } from '@simplewebauthn/server'
import { createClient } from '@/lib/supabase/server'
import { getRp } from '@/lib/webauthn/rp'
import { setChallenge, listPasskeys } from '@/lib/webauthn/store'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { rpID, rpName } = await getRp()
  const existing = await listPasskeys(user.id)

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.email ?? 'utente',
    userID: new TextEncoder().encode(user.id),
    attestationType: 'none',
    // Non ri-registrare una passkey già presente sullo stesso autenticatore
    excludeCredentials: existing.map((p) => ({
      id: p.credential_id,
      transports: (p.transports ?? undefined) as AuthenticatorTransportFuture[] | undefined,
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'required',
      authenticatorAttachment: 'platform', // impronta/Face ID del dispositivo
    },
  })

  await setChallenge('register', options.challenge)
  return NextResponse.json(options)
}

// tipo transport importato solo per il cast sopra
type AuthenticatorTransportFuture = 'ble' | 'cable' | 'hybrid' | 'internal' | 'nfc' | 'smart-card' | 'usb'
