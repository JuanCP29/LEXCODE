-- ============================================================================
-- FASE 2b — RLS de CONTESTACIONES por rol/asignación (mismo patrón que fichas en 006)
--   Problema: la policy vieja exigía casos.abogado_id = auth.uid() (el CREADOR del
--   caso). El sustanciador trabaja por casos.asignado_a, así que no podía guardar
--   ni exportar la contestación de un caso que le asignaron → error RLS que la app
--   mostraba como "Error interno".
--
--   Nuevo acceso a CONTESTACIONES:
--     · Propietario (superadmin) -> total
--     · Coordinador              -> contestaciones de casos de SU organización
--     · Sustanciador             -> contestaciones de sus casos ASIGNADOS
--   Requiere las funciones get_user_org() / get_user_rol_real() (creadas en 006).
--   Idempotente. Correr en: Supabase -> SQL Editor.
-- ============================================================================
begin;

-- Fuera el acceso 'admin' cruzado y el acceso por abogado_id (creador).
drop policy if exists "Admin total contestaciones" on public.contestaciones;
drop policy if exists "Abogado gestiona contestaciones de sus casos" on public.contestaciones;

-- Propietario: total (supervisión de plataforma).
drop policy if exists "Propietario total contestaciones" on public.contestaciones;
create policy "Propietario total contestaciones"
  on public.contestaciones for all
  using (public.get_user_rol_real() = 'superadmin')
  with check (public.get_user_rol_real() = 'superadmin');

-- Coordinador: contestaciones de casos de su organización.
drop policy if exists "Coordinador contestaciones de su org" on public.contestaciones;
create policy "Coordinador contestaciones de su org"
  on public.contestaciones for all
  using (
    public.get_user_rol_real() = 'coordinador'
    and exists (select 1 from public.casos c
                where c.id = contestaciones.caso_id and c.org_id = public.get_user_org())
  )
  with check (
    public.get_user_rol_real() = 'coordinador'
    and exists (select 1 from public.casos c
                where c.id = contestaciones.caso_id and c.org_id = public.get_user_org())
  );

-- Sustanciador: contestaciones de los casos ASIGNADOS a él.
drop policy if exists "Sustanciador contestaciones de casos asignados" on public.contestaciones;
create policy "Sustanciador contestaciones de casos asignados"
  on public.contestaciones for all
  using (
    exists (select 1 from public.casos c
            where c.id = contestaciones.caso_id and c.asignado_a = auth.uid())
  )
  with check (
    exists (select 1 from public.casos c
            where c.id = contestaciones.caso_id and c.asignado_a = auth.uid())
  );

commit;
