-- #27 Pipeline de analítica agregada anonimizada — 022_rls_rollups.sql
-- Estado: DISEÑO. No desplegado.
--
-- rollups_raw: INSERT anónimo permitido (vía edge function, ver edge/agg-ingest.ts,
-- que aplica validación de forma/tamaño antes de tocar la base), pero SIN policy de
-- SELECT/UPDATE/DELETE para el rol anon. Nadie puede leer conteos crudos por
-- dispositivo desde el cliente; solo se puede escribir "hacia adelante" (append-only)
-- y solo se lee a través de la vista agregada con k-anonimato (021_kanon_views.sql),
-- consultada por un rol distinto (reporting), nunca por anon.

alter table public.rollups_raw enable row level security;

-- Solo INSERT, y solo con anon_device_id no nulo (evita filas "huérfanas" sin
-- ningún identificador de agregación; sigue sin ser información personal).
create policy rollups_raw_insert_anon on public.rollups_raw
  for insert
  to anon
  with check (anon_device_id is not null);

-- Explícitamente NO se crean policies de select/update/delete para "anon" ni para
-- "authenticated": por defecto RLS deniega todo lo no permitido explícitamente.
-- Lectura agregada: exponer únicamente insights_weekly / insights_weekly_k() a un
-- rol de solo-lectura interno (p. ej. "reporting"), nunca al rol anon del cliente.
-- create role reporting nologin;
-- grant select on public.insights_weekly to reporting;
-- grant execute on function public.insights_weekly_k(int) to reporting;

-- service_role (solo servidor/cron) puede purgar por retención (ver 023_retention.sql)
-- y no está sujeto a RLS por diseño de Supabase; nunca se expone al cliente.
