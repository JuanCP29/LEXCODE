-- ============================================================
-- LEXCODE — Contestación de la Demanda (segundo documento)
-- Se genera después de cerrar la Ficha de Conciliación.
-- Por ahora 3 secciones: pronunciamiento a los hechos, a las pretensiones,
-- y hechos/fundamentos/razones de la defensa. Ejecutar en Supabase SQL Editor.
-- ============================================================

create table if not exists public.contestaciones (
  id               uuid primary key default uuid_generate_v4(),
  caso_id          uuid not null references public.casos(id) on delete cascade,
  ficha_id         uuid references public.fichas_conciliacion(id) on delete set null,
  sec_hechos       text,   -- Pronunciamiento frente a los hechos
  sec_pretensiones text,   -- Pronunciamiento frente a las pretensiones
  sec_defensa      text,   -- Hechos, fundamentos y razones de la defensa
  estado           text not null default 'borrador',
  creado_por       uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (caso_id)         -- una contestación por caso (upsert por caso_id)
);

create index if not exists contestaciones_caso_id_idx on public.contestaciones(caso_id);

alter table public.contestaciones enable row level security;

-- Acceso por rol/organización (ver db/migrations/007_contestaciones_rls_asignado.sql).
drop policy if exists "Admin total contestaciones" on public.contestaciones;
drop policy if exists "Abogado gestiona contestaciones de sus casos" on public.contestaciones;

drop policy if exists "Propietario total contestaciones" on public.contestaciones;
create policy "Propietario total contestaciones" on public.contestaciones for all
  using (public.get_user_rol_real() = 'superadmin')
  with check (public.get_user_rol_real() = 'superadmin');

drop policy if exists "Coordinador contestaciones de su org" on public.contestaciones;
create policy "Coordinador contestaciones de su org" on public.contestaciones for all
  using (public.get_user_rol_real() = 'coordinador'
         and exists (select 1 from public.casos c where c.id = caso_id and c.org_id = public.get_user_org()))
  with check (public.get_user_rol_real() = 'coordinador'
         and exists (select 1 from public.casos c where c.id = caso_id and c.org_id = public.get_user_org()));

drop policy if exists "Sustanciador contestaciones de casos asignados" on public.contestaciones;
create policy "Sustanciador contestaciones de casos asignados" on public.contestaciones for all
  using (exists (select 1 from public.casos c where c.id = caso_id and c.asignado_a = auth.uid()))
  with check (exists (select 1 from public.casos c where c.id = caso_id and c.asignado_a = auth.uid()));

drop policy if exists "Revisor lee contestaciones" on public.contestaciones;
create policy "Revisor lee contestaciones" on public.contestaciones for select
  using (public.get_user_rol() = 'revisor');

drop trigger if exists contestaciones_updated_at on public.contestaciones;
create trigger contestaciones_updated_at
  before update on public.contestaciones
  for each row execute function public.set_updated_at();
