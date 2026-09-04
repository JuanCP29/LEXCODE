-- ============================================================================
-- FIX RLS — 'superadmin' cuenta como 'admin' dentro de las políticas RLS.
-- Las políticas de casos/perfiles/fichas dan acceso total con
-- get_user_rol() = 'admin'. Al cambiar el Propietario a 'superadmin', dejó de
-- ver sus datos. Este fix hace que get_user_rol() devuelva 'admin' para
-- superadmin (solo afecta RLS; el código de la app lee perfiles.rol directo).
-- Correr en: Supabase → SQL Editor.
-- ============================================================================
create or replace function public.get_user_rol()
returns text language sql security definer stable as $$
  select case when rol = 'superadmin' then 'admin' else rol end
  from public.perfiles where id = auth.uid();
$$;

-- Verificación (debería mostrar tus casos otra vez en la app tras esto):
--   select public.get_user_rol();
