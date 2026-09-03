-- ============================================================================
-- FASE 1b — Roles (perfiles.rol es TEXT con CHECK; no es enum)
-- 1) Amplía el CHECK para permitir los roles nuevos (mantiene los legados
--    'admin'/'abogado'/'asistente'/'revisor' durante la transición).
-- 2) Deja tu cuenta (collegiaabogados@gmail.com) como 'superadmin' (Propietario).
-- Seguro/transaccional. Correr en Supabase → SQL Editor.
-- ============================================================================
begin;

-- 1) Reemplazar el CHECK de rol
alter table public.perfiles drop constraint if exists perfiles_rol_check;
alter table public.perfiles
  add constraint perfiles_rol_check
  check (rol in (
    'superadmin', 'coordinador', 'sustanciador',   -- roles nuevos
    'admin', 'abogado', 'asistente', 'revisor'      -- legados (transición)
  ));

-- 2) Propietario (superadmin) = tu cuenta
update public.perfiles
   set rol = 'superadmin'
 where id = (select id from auth.users where email = 'collegiaabogados@gmail.com');

commit;

-- Verificación (pégame el resultado):
--   select p.id, u.email, p.rol
--   from public.perfiles p join auth.users u on u.id = p.id;
