-- ============================================================================
-- FASE 2 — Aislamiento por organización (RLS por org_id)
--   Objetivo: que un Coordinador vea SOLO los casos y fichas de SU organización.
--   Antes: get_user_rol() mapeaba coordinador+superadmin -> 'admin' y la policy
--   "Admin acceso total" daba acceso a TODAS las organizaciones (fuga cruzada).
--
--   Nuevo modelo de acceso a CASOS y FICHAS:
--     · Propietario (superadmin)  -> acceso total (supervisión de plataforma)
--     · Coordinador               -> solo su organización (org_id = su org)
--     · Sustanciador              -> solo los casos ASIGNADOS a él (asignado_a)
--
--   Requisito previo: cada caso debe tener org_id (001 hizo backfill; el código
--   estampa org_id del creador en cada alta/importación a partir de esta fase).
--
--   Idempotente. Correr en: Supabase -> SQL Editor.
-- ============================================================================
begin;

-- ─── Helpers: org y rol REAL (sin el mapeo a 'admin' de get_user_rol) ───────
create or replace function public.get_user_org()
returns uuid language sql security definer stable as $$
  select org_id from public.perfiles where id = auth.uid();
$$;

create or replace function public.get_user_rol_real()
returns text language sql security definer stable as $$
  select rol from public.perfiles where id = auth.uid();
$$;

-- ─────────────────────────────── CASOS ─────────────────────────────────────
-- Fuera el acceso total de 'admin' (cruzaba organizaciones).
drop policy if exists "Admin acceso total casos" on public.casos;

-- Propietario: acceso total (no opera casos, pero conserva supervisión).
drop policy if exists "Propietario acceso total casos" on public.casos;
create policy "Propietario acceso total casos"
  on public.casos for all
  using (public.get_user_rol_real() = 'superadmin')
  with check (public.get_user_rol_real() = 'superadmin');

-- Coordinador: SOLO los casos de su organización.
drop policy if exists "Coordinador casos de su org" on public.casos;
create policy "Coordinador casos de su org"
  on public.casos for all
  using (public.get_user_rol_real() = 'coordinador' and org_id = public.get_user_org())
  with check (public.get_user_rol_real() = 'coordinador' and org_id = public.get_user_org());

-- Sustanciador: las policies "Ve/Actualiza casos asignados" (migración 004,
-- asignado_a = auth.uid()) se conservan tal cual.

-- ─────────────────────────────── FICHAS ────────────────────────────────────
drop policy if exists "Admin acceso total fichas" on public.fichas_conciliacion;

drop policy if exists "Propietario acceso total fichas" on public.fichas_conciliacion;
create policy "Propietario acceso total fichas"
  on public.fichas_conciliacion for all
  using (public.get_user_rol_real() = 'superadmin')
  with check (public.get_user_rol_real() = 'superadmin');

-- Coordinador: fichas cuyo caso pertenece a su organización.
drop policy if exists "Coordinador fichas de su org" on public.fichas_conciliacion;
create policy "Coordinador fichas de su org"
  on public.fichas_conciliacion for all
  using (
    public.get_user_rol_real() = 'coordinador'
    and exists (select 1 from public.casos c
                where c.id = fichas_conciliacion.caso_id and c.org_id = public.get_user_org())
  )
  with check (
    public.get_user_rol_real() = 'coordinador'
    and exists (select 1 from public.casos c
                where c.id = fichas_conciliacion.caso_id and c.org_id = public.get_user_org())
  );

-- Sustanciador: fichas de los casos ASIGNADOS a él (independiente de quién la creó).
drop policy if exists "Sustanciador fichas de casos asignados" on public.fichas_conciliacion;
create policy "Sustanciador fichas de casos asignados"
  on public.fichas_conciliacion for all
  using (
    exists (select 1 from public.casos c
            where c.id = fichas_conciliacion.caso_id and c.asignado_a = auth.uid())
  )
  with check (
    exists (select 1 from public.casos c
            where c.id = fichas_conciliacion.caso_id and c.asignado_a = auth.uid())
  );

commit;

-- Verificación (opcional):
--   -- Casos por organización:
--   select org_id, count(*) from public.casos group by org_id;
--   -- Como coordinador, en la app, Reparto/Historial deben mostrar SOLO su org.
