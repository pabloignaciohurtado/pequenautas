-- #26 Panel nube · cohortes — vistas de agregación (SCAFFOLD, no aplicado).
-- Reproducen en SQL, para el futuro panel del educador EN LA NUBE, la misma lógica que
-- hoy corre 100% en el cliente sobre profile.ev[] (ver ship/app.js: aggregate(),
-- renderEducator(), eduFaceOf()). Ninguna vista se consulta hoy: no hay proyecto real,
-- no hay fetch en runtime (ver ../cohorts.js). Aplicar DESPUÉS de 001..005.
--
-- `security_invoker = on` (Postgres 15+ / Supabase) es explícito a propósito: sin esto,
-- una vista puede comportarse como SECURITY DEFINER implícito según el dueño de la vista
-- y saltarse RLS. Con security_invoker=on, cada consulta a estas vistas se evalúa con los
-- privilegios (y las políticas RLS de 002/005) del usuario autenticado que consulta, igual
-- que si consultara las tablas base directamente. Nunca exponer estas vistas vía
-- `service_role`; siempre a través del anon/authenticated role del adulto dueño.

-- 1) Resumen por cohorte: nº de niños, rondas, % aciertos a la primera, tiempo medio.
--    Espejo de la sección "Resumen global" de renderEducator(), pero acotada a una cohorte.
create or replace view public.v_cohort_overview
  with (security_invoker = on) as
select
  c.id                                              as cohort_id,
  c.owner                                           as owner,
  c.name                                            as cohort_name,
  count(distinct cm.profile_id)                     as child_count,
  count(e.id)                                       as rounds,
  coalesce(avg((e.first_try)::int), 0)::numeric(5,4) as first_try_rate,
  coalesce(avg(e.ms), 0)::numeric(10,1)             as avg_ms
from public.cohorts c
left join public.cohort_members cm on cm.cohort_id = c.id
left join public.events         e  on e.profile_id = cm.profile_id
group by c.id, c.owner, c.name;

-- 2) Resumen por materia dentro de cada cohorte (math/reading/science): rondas y
--    % de "error" (intento fallido o pista usada), espejo de aggregate().byGame.
create or replace view public.v_cohort_by_game
  with (security_invoker = on) as
select
  c.id                                                        as cohort_id,
  c.owner                                                     as owner,
  e.game                                                       as game,
  count(*)                                                     as rounds,
  sum(case when e.attempts > 1 or e.assisted then 1 else 0 end) as error_rounds
from public.cohorts c
join public.cohort_members cm on cm.cohort_id = c.id
join public.events         e  on e.profile_id = cm.profile_id
group by c.id, c.owner, e.game;

-- 3) Resumen por niño dentro de cada cohorte: rondas y % aciertos a la primera,
--    espejo del bloque "Por niño" de renderEducator() (sin exponer nombre real, solo
--    alias, coherente con la minimización de datos de #25).
create or replace view public.v_cohort_child_stats
  with (security_invoker = on) as
select
  cm.cohort_id                                      as cohort_id,
  c.owner                                           as owner,
  p.id                                               as profile_id,
  p.alias                                            as alias,
  p.avatar                                           as avatar,
  count(e.id)                                        as rounds,
  coalesce(avg((e.first_try)::int), 0)::numeric(5,4) as first_try_rate,
  coalesce(avg(e.ms), 0)::numeric(10,1)              as avg_ms
from public.cohort_members cm
join public.cohorts  c on c.id = cm.cohort_id
join public.profiles p on p.id = cm.profile_id
left join public.events e on e.profile_id = p.id
group by cm.cohort_id, c.owner, p.id, p.alias, p.avatar;

-- 4) Top de items con más fallos por cohorte (hasta 3 por cohorte), espejo exacto de
--    aggregate().topFails: sólo cuenta rondas con attempts>1, peso = attempts-1.
create or replace view public.v_cohort_top_fails
  with (security_invoker = on) as
with weighted as (
  select
    cm.cohort_id                        as cohort_id,
    c.owner                             as owner,
    e.game                              as game,
    e.item                              as item,
    sum(e.attempts - 1)                 as fail_weight
  from public.cohort_members cm
  join public.cohorts c on c.id = cm.cohort_id
  join public.events  e on e.profile_id = cm.profile_id
  where e.attempts > 1
  group by cm.cohort_id, c.owner, e.game, e.item
),
ranked as (
  select
    w.*,
    row_number() over (partition by w.cohort_id order by w.fail_weight desc, w.item asc) as rnk
  from weighted w
)
select cohort_id, owner, game, item, fail_weight
from ranked
where rnk <= 3;

-- Nota de activación: estas 4 vistas son la fuente de datos que el futuro panel en la
-- nube consultaría (p. ej. vía PostgREST vía Supabase JS client: `.from('v_cohort_overview')`)
-- una vez existan las 6 condiciones descritas en ../26-panel-nube-cohortes.md y en
-- ../../25-backend-supabase/25-backend-supabase.md. Hoy no se consultan desde ningún
-- cliente: ../cohorts.js no hace fetch bajo ningún escenario (ver ese archivo, §"nube").
