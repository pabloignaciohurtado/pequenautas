-- #25 Backend Supabase — Row Level Security (SCAFFOLD, no aplicado).
-- Un adulto solo ve/escribe lo suyo. Ningún cliente puede leer datos de otros
-- niños/otros adultos. `service_role` (solo servidor) nunca se expone al cliente.
-- Aplicar DESPUÉS de 001_schema.sql, antes de habilitar cualquier tráfico real.

alter table public.profiles enable row level security;
alter table public.events   enable row level security;

-- profiles: dueño = usuario autenticado
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (owner = auth.uid());

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert with check (owner = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (owner = auth.uid()) with check (owner = auth.uid());

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles
  for delete using (owner = auth.uid());

-- events: dueño = usuario autenticado; el perfil debe pertenecer al mismo dueño.
-- Append-only a propósito: sin policy de UPDATE (eventos inmutables).
drop policy if exists events_select on public.events;
create policy events_select on public.events
  for select using (owner = auth.uid());

drop policy if exists events_insert on public.events;
create policy events_insert on public.events
  for insert with check (
    owner = auth.uid()
    and exists (select 1 from public.profiles pr
                where pr.id = events.profile_id and pr.owner = auth.uid())
  );

drop policy if exists events_delete on public.events;
create policy events_delete on public.events
  for delete using (owner = auth.uid());
