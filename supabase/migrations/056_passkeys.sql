-- 056 — Passkey per lo "sblocco con impronta" (WebAuthn).
-- Ogni riga è una credenziale registrata da un dispositivo dell'utente.
-- La chiave PRIVATA non lascia mai il telefono: qui salviamo solo la chiave
-- PUBBLICA e i metadati necessari alla verifica.

create table if not exists public.passkeys (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  credential_id text not null unique,          -- base64url
  public_key    text not null,                 -- base64url
  counter       bigint not null default 0,     -- contatore anti-clonazione
  transports    text[],
  device_label  text,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);

create index if not exists passkeys_user_idx on public.passkeys(user_id);

alter table public.passkeys enable row level security;

-- L'utente vede ed elimina SOLO le proprie passkey. Inserimento e
-- aggiornamento del contatore passano dal server (service role), che
-- scavalca la RLS: così una passkey si registra solo dopo la verifica WebAuthn.
drop policy if exists "passkeys_select_own" on public.passkeys;
create policy "passkeys_select_own" on public.passkeys
  for select using (auth.uid() = user_id);

drop policy if exists "passkeys_delete_own" on public.passkeys;
create policy "passkeys_delete_own" on public.passkeys
  for delete using (auth.uid() = user_id);
