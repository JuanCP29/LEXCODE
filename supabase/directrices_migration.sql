-- ============================================================
-- LEGIUX — Directrices de Conciliación
-- Migration v1 — ejecutar en Supabase SQL Editor
-- ============================================================

-- Tabla principal
create table if not exists public.directrices_conciliacion (
  id               uuid primary key default uuid_generate_v4(),
  nombre           text not null,
  pretension       text not null check (pretension in (
                     'vejez', 'invalidez', 'sobrevivientes',
                     'indemnizacion', 'devolucion', 'general'
                   )),
  clase_pretension text,                      -- NULL = aplica a toda la pretensión
  storage_path     text,                      -- ruta en bucket directrices-lexcode
  nombre_original  text,                      -- nombre del PDF original
  texto_extraido   text,                      -- texto del PDF ya procesado
  activo           boolean not null default true,
  subido_por       uuid not null references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists directrices_pretension_idx on public.directrices_conciliacion(pretension);
create index if not exists directrices_activo_idx     on public.directrices_conciliacion(activo);

alter table public.directrices_conciliacion enable row level security;

-- Lectura: todos los usuarios autenticados pueden leer directrices activas
drop policy if exists "Usuarios leen directrices activas" on public.directrices_conciliacion;
create policy "Usuarios leen directrices activas"
  on public.directrices_conciliacion for select
  using (activo = true and auth.role() = 'authenticated');

-- Admin: acceso total
drop policy if exists "Admin gestiona directrices" on public.directrices_conciliacion;
create policy "Admin gestiona directrices"
  on public.directrices_conciliacion for all
  using (public.get_user_rol() = 'admin')
  with check (public.get_user_rol() = 'admin');

-- Trigger updated_at
drop trigger if exists directrices_updated_at on public.directrices_conciliacion;
create trigger directrices_updated_at
  before update on public.directrices_conciliacion
  for each row execute function public.set_updated_at();

-- ============================================================
-- Storage bucket para PDFs de directrices
-- ============================================================
insert into storage.buckets (id, name, public)
values ('directrices-lexcode', 'directrices-lexcode', false)
on conflict (id) do nothing;

-- Solo admin sube y elimina
drop policy if exists "Admin sube directrices" on storage.objects;
create policy "Admin sube directrices"
  on storage.objects for insert
  with check (
    bucket_id = 'directrices-lexcode' and
    public.get_user_rol() = 'admin'
  );

drop policy if exists "Admin elimina directrices" on storage.objects;
create policy "Admin elimina directrices"
  on storage.objects for delete
  using (
    bucket_id = 'directrices-lexcode' and
    public.get_user_rol() = 'admin'
  );

-- Todos los autenticados pueden leer (para descargar el PDF original)
drop policy if exists "Autenticados leen directrices storage" on storage.objects;
create policy "Autenticados leen directrices storage"
  on storage.objects for select
  using (
    bucket_id = 'directrices-lexcode' and
    auth.role() = 'authenticated'
  );
