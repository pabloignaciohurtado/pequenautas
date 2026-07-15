-- #27 Pipeline de analítica agregada anonimizada — 021_kanon_views.sql
-- Estado: DISEÑO. No desplegado.
--
-- Aquí vive la supresión de k-anonimato real: la ÚNICA superficie de lectura
-- pensada para reporting/dashboards es esta vista, nunca rollups_raw directamente
-- (ver 022_rls_rollups.sql: rollups_raw no tiene policy de SELECT para roles no
-- privilegiados). Un bucket (día/semana × juego × ítem × franja de edad) solo
-- aparece en la vista si participaron al menos K dispositivos anónimos DISTINTOS;
-- si no, la fila entera se omite (supresión, no se pone en null ni se aproxima).
--
-- K por defecto = 5, igual que agg.js:DEFAULT_K (mismo valor documentado en dos
-- lugares para que el cliente y el servidor razonen sobre el mismo umbral; si se
-- cambia aquí, debe cambiarse también en agg.js y en este comentario).

create or replace view public.insights_weekly as
select
  date_trunc('week', bucket_day)::date as bucket_week,
  game,
  item,
  age_band,
  count(distinct anon_device_id)                              as n_devices,
  sum(n_events)                                                as n_events,
  sum(n_first_try)                                             as n_first_try,
  sum(n_assisted)                                              as n_assisted,
  sum(sum_ms)                                                  as sum_ms,
  sum(sum_attempts)                                            as sum_attempts,
  round(sum(n_first_try)::numeric / nullif(sum(n_events),0), 3) as first_try_rate,
  round((sum(sum_ms)::numeric / nullif(sum(n_events),0)))       as avg_ms
from public.rollups_raw
group by 1,2,3,4
having count(distinct anon_device_id) >= 5   -- <-- umbral k-anonimato (K=5)
order by bucket_week desc, game, item;

comment on view public.insights_weekly is
  'Analítica agregada anonimizada. Cada fila requiere >=5 dispositivos anónimos '
  'distintos (k-anonimato); buckets con menos participantes se OMITEN, no se '
  'muestran con valores aproximados. Sin columnas de identidad de niño/adulto/'
  'dispositivo individual. Fuente de verdad de diseño: '
  'ship/fase4/27-pipeline-analitica/27-pipeline-analitica.md.';

-- Variante paramétrica para explorar distintos umbrales k en análisis interno
-- (NO exponer esta función a un rol público; solo a analistas internos vía
-- service_role o un rol de solo-lectura restringido, distinto del rol anon).
create or replace function public.insights_weekly_k(min_devices int default 5)
returns table (
  bucket_week date, game text, item text, age_band text,
  n_devices bigint, n_events bigint, n_first_try bigint, n_assisted bigint,
  sum_ms bigint, sum_attempts bigint, first_try_rate numeric, avg_ms numeric
) language sql stable as $$
  select
    date_trunc('week', bucket_day)::date, game, item, age_band,
    count(distinct anon_device_id), sum(n_events), sum(n_first_try), sum(n_assisted),
    sum(sum_ms), sum(sum_attempts),
    round(sum(n_first_try)::numeric / nullif(sum(n_events),0), 3),
    round((sum(sum_ms)::numeric / nullif(sum(n_events),0)))
  from public.rollups_raw
  group by 1,2,3,4
  having count(distinct anon_device_id) >= greatest(min_devices, 1)
  order by 1 desc, 2, 3;
$$;
