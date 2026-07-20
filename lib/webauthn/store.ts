import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

// ============================================================
// Persistenza passkey (sblocco con impronta) e gestione della "sfida"
// WebAuthn. La tabella `passkeys` (migration 056) non è ancora nei tipi
// generati: le query passano dal client admin con cast controllato.
// ============================================================

const CHALLENGE_COOKIE = 'cc_wauth_chal'

export type PasskeyRow = {
  id: string
  user_id: string
  credential_id: string   // base64url
  public_key: string      // base64url
  counter: number
  transports: string[] | null
  device_label: string | null
}

/** Salva la sfida in un cookie httpOnly a vita breve (5 min), monouso. */
export async function setChallenge(purpose: 'register' | 'auth', challenge: string): Promise<void> {
  const jar = await cookies()
  jar.set(CHALLENGE_COOKIE, `${purpose}:${challenge}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 300,
  })
}

/** Legge e CONSUMA la sfida (single-use): la ritorna solo se lo scopo combacia. */
export async function takeChallenge(purpose: 'register' | 'auth'): Promise<string | null> {
  const jar = await cookies()
  const raw = jar.get(CHALLENGE_COOKIE)?.value
  jar.delete(CHALLENGE_COOKIE)
  if (!raw) return null
  const sep = raw.indexOf(':')
  if (sep < 0) return null
  const p = raw.slice(0, sep)
  const chal = raw.slice(sep + 1)
  if (p !== purpose || !chal) return null
  return chal
}

/** Passkey registrate dall'utente. */
export async function listPasskeys(userId: string): Promise<PasskeyRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 056 non ancora in types/database.ts
  const admin = createAdminClient() as any
  const { data } = await admin
    .from('passkeys')
    .select('id, user_id, credential_id, public_key, counter, transports, device_label')
    .eq('user_id', userId)
  return (data ?? []) as PasskeyRow[]
}

export async function findPasskeyByCredentialId(credentialId: string): Promise<PasskeyRow | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 056 non ancora in types/database.ts
  const admin = createAdminClient() as any
  const { data } = await admin
    .from('passkeys')
    .select('id, user_id, credential_id, public_key, counter, transports, device_label')
    .eq('credential_id', credentialId)
    .maybeSingle()
  return (data as PasskeyRow | null) ?? null
}

export async function insertPasskey(row: {
  userId: string
  credentialId: string
  publicKey: string
  counter: number
  transports: string[] | null
  deviceLabel: string | null
}): Promise<{ error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 056 non ancora in types/database.ts
  const admin = createAdminClient() as any
  const { error } = await admin.from('passkeys').insert({
    user_id: row.userId,
    credential_id: row.credentialId,
    public_key: row.publicKey,
    counter: row.counter,
    transports: row.transports,
    device_label: row.deviceLabel,
  })
  if (error) return { error: error.message }
  return {}
}

export async function updatePasskeyCounter(id: string, counter: number): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 056 non ancora in types/database.ts
  const admin = createAdminClient() as any
  await admin
    .from('passkeys')
    .update({ counter, last_used_at: new Date().toISOString() })
    .eq('id', id)
}
