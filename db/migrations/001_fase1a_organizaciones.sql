-- ============================================================================
-- FASE 1a — Multi-tenant scaffolding (organizaciones + org_id)
-- Seguro: NO toca roles. Solo crea la tabla de organizaciones, agrega org_id
-- (nullable) a perfiles y casos, y hace backfill a la organización por defecto.
-- Idempotente: se puede correr más de una vez sin efectos duplicados.
-- Correr en: Supabase → SQL Editor.
-- ============================================================================
begin;

-- 1) Tabla de organizaciones (tenants)
create table if not exists public.organizaciones (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null,
  creado_at timestamptz not null default now()
);

-- 2) Organización por defecto para los datos actuales (solo si no hay ninguna)
insert into public.organizaciones (nombre)
select 'Collegia Abogados'
where not exists (select 1 from public.organizaciones);

-- 3) org_id en PERFILES (nullable por ahora; se hará NOT NULL en una fase posterior)
alter table public.perfiles add column if not exists org_id uuid;

update public.perfiles
   set org_id = (select id from public.organizaciones order by creado_at asc limit 1)
 where org_id is null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'perfiles_org_fk') then
    alter table public.perfiles
      add constraint perfiles_org_fk
      foreign key (org_id) references public.organizaciones(id);
  end if;
end $$;

create index if not exists perfiles_org_idx on public.perfiles(org_id);

-- 4) org_id en CASOS
alter table public.casos add column if not exists org_id uuid;

update public.casos
   set org_id = (select id from public.organizaciones order by creado_at asc limit 1)
 where org_id is null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'casos_org_fk') then
    alter table public.casos
      add constraint casos_org_fk
      foreign key (org_id) references public.organizaciones(id);
  end if;
end $$;

create index if not exists casos_org_idx on public.casos(org_id);

commit;

-- Verificación rápida (opcional):
--   select id, nombre from public.organizaciones;
--   select count(*) filter (where org_id is null) as perfiles_sin_org from public.perfiles;
--   select count(*) filter (where org_id is null) as casos_sin_org    from public.casos;
