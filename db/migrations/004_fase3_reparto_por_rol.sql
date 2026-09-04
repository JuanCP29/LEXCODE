-- ============================================================================
-- FASE 3 — Reparto por rol (RLS)
--  · get_user_rol() mapea roles nuevos a los antiguos que entienden las policies:
--       superadmin / coordinador -> 'admin'  (acceso total; org-scoping en Fase 2)
--       sustanciador             -> 'abogado'
--  · El usuario ve/gestiona los casos ASIGNADOS a él (columna asignado_a).
-- Resultado: sustanciador ve solo sus casos; coordinador/propietario ven todo.
-- Correr en: Supabase → SQL Editor.
-- IMPORTANTe: mientras haya una sola organización esto es correcto. Antes de
-- dar de alta un SEGUNDO cliente, hay que hacer la Fase 2 (RLS por org_id), o el
-- coordinador de un cliente podría ver casos de otro. (Hoy: una sola org.)
-- ============================================================================
create or replace function public.get_user_rol()
returns text language sql security definer stable as $$
  select case rol
    when 'superadmin'   then 'admin'
    when 'coordinador'  then 'admin'
    when 'sustanciador' then 'abogado'
    else rol
  end
  from public.perfiles where id = auth.uid();
$$;

drop policy if exists "Ve casos asignados" on public.casos;
create policy "Ve casos asignados"
  on public.casos for select
  using (asignado_a = auth.uid());

drop policy if exists "Actualiza casos asignados" on public.casos;
create policy "Actualiza casos asignados"
  on public.casos for update
  using (asignado_a = auth.uid())
  with check (asignado_a = auth.uid());
