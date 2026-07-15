-- #25 Backend Supabase — esquema de datos (SCAFFOLD, no aplicado a ningún proyecto).
-- Reproduce el diseño ya documentado en ship/docs/backend-supabase.md §2.
-- Minimización de datos: solo alias seudónimo + eventos {g,k,ft,at,ms,as}, sin PII.
-- No ejecutar contra un proyecto real hasta cumplir el checklist de
-- ship/docs/backend-supabase.md §6 (consentimiento, región de datos, retención).

create extension if not exists pgcrypto; -- gen_random_uuid()

-- Un adulto (auth.users) posee perfiles (los niños).
create table if not exists public.profiles (
  id           uuid primary key default gen_random_uuid(),
  owner        uuid not null references auth.users(id) on delete cascade,
  -- Alias seudónimo del niño (NO el nombre real). Máx 24 chars.
  alias        text not null check (char_length(alias) between 1 and 24),
  avatar       text not null default '🦊',
  -- Sólo grupo de edad, nunca fecha exacta (minimización).
  age_band     text not null default '3-5' check (age_band in ('3-4','4-5','3-5')),
  -- ID del perfil local (para de-dup/upsert desde el dispositivo).
  local_id     text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (owner, local_id)
);

create index if not exists profiles_owner_idx on public.profiles(owner);

-- Eventos de aprendizaje, reflejan profile.ev[] local: {g,k,ft,at,ms,as}. Sin PII.
create table if not exists public.events (
  id          bigint generated always as identity primary key,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  -- Desnormalizado para que RLS sea una comparación directa (sin JOIN) y para
  -- que la purga/borrado por adulto sea eficiente.
  owner       uuid not null references auth.users(id) on delete cascade,
  game        text not null check (game in ('math','reading','science')),
  item        text not null,                    -- clave de contenido, p.ej. 'math-3'
  first_try   boolean not null,
  attempts    smallint not null check (attempts between 1 and 20),
  ms          integer not null check (ms >= 0),
  assisted    boolean not null default false,
  -- Anti-duplicado idempotente (mismo evento reenviado no se duplica).
  client_uid  text not null,
  occurred_at timestamptz not null default now(),
  unique (owner, client_uid)
);

create index if not exists events_profile_idx on public.events(profile_id);
create index if not exists events_owner_time_idx on public.events(owner, occurred_at);
