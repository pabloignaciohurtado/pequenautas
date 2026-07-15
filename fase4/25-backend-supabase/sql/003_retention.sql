-- #25 Backend Supabase — retención mínima + borrado total (SCAFFOLD, no aplicado).
-- Retención por defecto: 365 días. Programar como cron job de Supabase
-- (Dashboard > Database > Cron, o pg_cron) apuntando a este statement.
-- No hay backups indefinidos de datos de menores (ship/docs/backend-supabase.md §1.6).

delete from public.events where occurred_at < now() - interval '365 days';

-- Borrado total ("olvídame"), invocado desde el área de adultos del dispositivo
-- vía la sesión del propio adulto (auth.uid() = owner); la cascada de la FK en
-- events (on delete cascade) se encarga de los eventos asociados.
-- delete from public.profiles where owner = auth.uid();
