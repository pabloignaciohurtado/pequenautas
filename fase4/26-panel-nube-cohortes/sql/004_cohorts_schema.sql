-- #26 Panel nube · cohortes — esquema de datos (SCAFFOLD, no aplicado a ningún proyecto).
-- Extiende el modelo de #25 (ver ../../25-backend-supabase/sql/001_schema.sql), que debe
-- aplicarse ANTES que este archivo (depende de public.profiles y auth.users).
-- Una "cohorte" es un grupo de perfiles (p.ej. una clase/salón) que un mismo adulto
-- (owner = auth.uid()) organiza para ver un resumen agregado en el panel del educador
-- en la nube. Minimización de datos: una cohorte solo agrupa profile_id ya existentes;
-- no introduce ninguna columna de PII nueva.

create table if not exists public.cohorts (
  id           uuid primary key default gen_random_uuid(),
  owner        uuid not null references auth.users(id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 40),
  -- ID de cohorte local (para de-dup/upsert desde el dispositivo, mismo patrón que
  -- profiles.local_id en 001_schema.sql).
  local_id     text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (owner, local_id)
);

create index if not exists cohorts_owner_idx on public.cohorts(owner);

-- Relación N:M perfil <-> cohorte. Un perfil puede estar en varias cohortes
-- (p.ej. "Sala Azul 2026" y "Refuerzo lectura"); una cohorte tiene varios perfiles.
-- owner desnormalizado (igual que public.events en 001_schema.sql) para que RLS sea
-- una comparación directa sin JOIN adicional.
create table if not exists public.cohort_members (
  cohort_id   uuid not null references public.cohorts(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  owner       uuid not null references auth.users(id) on delete cascade,
  added_at    timestamptz not null default now(),
  primary key (cohort_id, profile_id)
);

create index if not exists cohort_members_cohort_idx on public.cohort_members(cohort_id);
create index if not exists cohort_members_profile_idx on public.cohort_members(profile_id);
create index if not exists cohort_members_owner_idx on public.cohort_members(owner);
