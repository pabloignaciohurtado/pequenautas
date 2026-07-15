-- #27 Pipeline de analítica agregada anonimizada — 020_rollups_schema.sql
-- Estado: DISEÑO. No desplegado. No hay proyecto Supabase real todavía (ver
-- 27-pipeline-analitica.md "Contrato de activación").
--
-- Tabla de conteos crudos por dispositivo, SIN ninguna columna de identidad de
-- niño/perfil/adulto. No hay FK a auth.users ni a "owner": este pipeline es
-- independiente del backend de sync por niño (#25, ver docs/backend-supabase.md).
-- Un mismo proyecto Supabase podría alojar ambos esquemas sin que se toquen.
--
-- anon_device_id: UUID aleatorio generado en el cliente (agg.js), rotable,
-- NUNCA derivado de datos del niño (no profile.id, no avatar, no nombre).
-- Es la única columna "identificadora" y no identifica a una persona, solo a
-- una instalación de la app durante la ventana de rotación vigente.

create table public.rollups_raw (
  id               bigint generated always as identity primary key,
  anon_device_id   uuid not null,
  bucket_day       date not null,
  game             text not null check (game in ('math','reading','science')),
  item             text not null check (char_length(item) <= 64),   -- p.ej. 'math-5','read-A','sci-water','sci-diet-herb','math-sub-3','math-cmp'
  age_band         text not null default '3-5' check (age_band in ('3-4','4-5','3-5')),
  n_events         smallint not null check (n_events between 1 and 500),
  n_first_try      smallint not null check (n_first_try between 0 and n_events),
  n_assisted       smallint not null check (n_assisted between 0 and n_events),
  sum_ms           integer  not null check (sum_ms >= 0),
  sum_attempts     integer  not null check (sum_attempts >= 0),
  app_version      text,
  received_at      timestamptz not null default now()
);

-- Índices para la vista agregada (ver 021_kanon_views.sql).
create index rollups_raw_bucket_idx on public.rollups_raw(bucket_day, game, item);
create index rollups_raw_device_idx on public.rollups_raw(anon_device_id);

-- Nota de minimización: NO se guarda IP, user-agent completo, ni ningún otro
-- metadato de red en esta tabla. Si el borde HTTP (edge function / proxy) los
-- expone por defecto en logs, deben desactivarse/purgarse por separado — ver
-- checklist en 27-pipeline-analitica.md.
