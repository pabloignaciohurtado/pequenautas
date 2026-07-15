-- #26 Panel nube · cohortes — Row Level Security (SCAFFOLD, no aplicado).
-- Mismo principio que ../../25-backend-supabase/sql/002_rls.sql: un adulto solo ve/edita
-- sus propias cohortes y sólo puede meter en ellas perfiles que ya le pertenecen.
-- Aplicar DESPUÉS de 004_cohorts_schema.sql, antes de habilitar cualquier tráfico real.

alter table public.cohorts        enable row level security;
alter table public.cohort_members enable row level security;

-- cohorts: dueño = usuario autenticado
drop policy if exists cohorts_select on public.cohorts;
create policy cohorts_select on public.cohorts
  for select using (owner = auth.uid());

drop policy if exists cohorts_insert on public.cohorts;
create policy cohorts_insert on public.cohorts
  for insert with check (owner = auth.uid());

drop policy if exists cohorts_update on public.cohorts;
create policy cohorts_update on public.cohorts
  for update using (owner = auth.uid()) with check (owner = auth.uid());

drop policy if exists cohorts_delete on public.cohorts;
create policy cohorts_delete on public.cohorts
  for delete using (owner = auth.uid());

-- cohort_members: dueño = usuario autenticado; tanto la cohorte como el perfil deben
-- pertenecer a ese mismo dueño (evita que un adulto meta un perfil ajeno en su cohorte,
-- o su propio perfil en una cohorte ajena).
drop policy if exists cohort_members_select on public.cohort_members;
create policy cohort_members_select on public.cohort_members
  for select using (owner = auth.uid());

drop policy if exists cohort_members_insert on public.cohort_members;
create policy cohort_members_insert on public.cohort_members
  for insert with check (
    owner = auth.uid()
    and exists (select 1 from public.cohorts  c  where c.id  = cohort_members.cohort_id  and c.owner  = auth.uid())
    and exists (select 1 from public.profiles pr where pr.id = cohort_members.profile_id and pr.owner = auth.uid())
  );

drop policy if exists cohort_members_delete on public.cohort_members;
create policy cohort_members_delete on public.cohort_members
  for delete using (owner = auth.uid());
