-- #27 Pipeline de analítica agregada anonimizada — 023_retention.sql
-- Estado: DISEÑO. No desplegado.
--
-- Retención corta para el detalle crudo por dispositivo (rollups_raw): aunque no
-- contiene PII, es el nivel más "fino" de esta cadena (un anon_device_id repetido
-- día tras día podría, en teoría, describir un patrón de uso). Se purga a los 90
-- días. Los agregados semanales con k-anonimato (insights_weekly) no dependen de
-- guardar el crudo para siempre: si se necesita retención larga de tendencias, se
-- debe materializar insights_weekly en una tabla de snapshots (fuera de alcance de
-- este scaffold) que YA no contiene anon_device_id en absoluto.

-- Cron programado en Supabase (pg_cron o Scheduled Function):
delete from public.rollups_raw where bucket_day < (current_date - interval '90 days');

-- Nota: a diferencia de docs/backend-supabase.md (retención 365 días para eventos
-- pseudonimizados del backup por niño), aquí el umbral es más corto a propósito:
-- este pipeline es telemetría de producto agregable, no un respaldo que el adulto
-- espera recuperar; no hay expectativa de "restaurar mi progreso" desde aquí.
