-- ============================================================
-- LEXCODE — Collegia Abogados
-- Schema v3 — Esquema definitivo
-- Idempotente: ejecutar cuantas veces sea necesario
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- Limpieza de tablas anteriores (orden inverso por dependencias)
-- ============================================================
drop table if exists public.archivos_proceso cascade;
drop table if exists public.fichas_conciliacion cascade;
drop table if exists public.casos cascade;

-- ============================================================
-- Tabla: perfiles
-- ============================================================
create table if not exists public.perfiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  nombre_completo text,
  rol             text not null default 'abogado'
                    check (rol in ('admin', 'abogado', 'revisor')),
  activo          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.perfiles enable row level security;

drop policy if exists "Usuarios ven su propio perfil" on public.perfiles;
create policy "Usuarios ven su propio perfil"
  on public.perfiles for select using (auth.uid() = id);

drop policy if exists "Admin ve todos los perfiles" on public.perfiles;
create policy "Admin ve todos los perfiles"
  on public.perfiles for select
  using (public.get_user_rol() = 'admin');

drop policy if exists "Usuarios actualizan su propio perfil" on public.perfiles;
create policy "Usuarios actualizan su propio perfil"
  on public.perfiles for update using (auth.uid() = id);

drop policy if exists "Admin actualiza cualquier perfil" on public.perfiles;
create policy "Admin actualiza cualquier perfil"
  on public.perfiles for update
  using (public.get_user_rol() = 'admin');

-- Función helper: obtener rol del usuario actual
create or replace function public.get_user_rol()
returns text language sql security definer stable as $$
  select rol from public.perfiles where id = auth.uid();
$$;

-- Trigger: crea perfil automáticamente al registrar usuario
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Función updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- Tabla: casos
-- ============================================================
create table if not exists public.casos (
  id                   uuid primary key default uuid_generate_v4(),
  radicado             text not null,
  radicado_bizagi      text,
  nombre_demandante    text not null,
  cedula_demandante    text,
  expediente_pensional text,
  despacho             text,
  pretension           text check (pretension in (
                         'vejez', 'invalidez', 'sobrevivientes',
                         'indemnizacion', 'devolucion'
                       )),
  clase_pretension     text,
  jurisdiccion         text check (jurisdiccion in ('ordinaria', 'contencioso')),
  estado               text not null default 'activo'
                         check (estado in ('activo', 'archivado')),
  abogado_id           uuid not null references auth.users(id) on delete restrict,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists casos_abogado_id_idx       on public.casos(abogado_id);
create index if not exists casos_estado_idx           on public.casos(estado);
create index if not exists casos_radicado_idx         on public.casos(radicado);
create index if not exists casos_cedula_demandante_idx on public.casos(cedula_demandante);

alter table public.casos enable row level security;

drop policy if exists "Admin acceso total casos" on public.casos;
create policy "Admin acceso total casos"
  on public.casos for all
  using (public.get_user_rol() = 'admin')
  with check (public.get_user_rol() = 'admin');

drop policy if exists "Abogados ven sus propios casos" on public.casos;
create policy "Abogados ven sus propios casos"
  on public.casos for select
  using (auth.uid() = abogado_id and public.get_user_rol() = 'abogado');

drop policy if exists "Abogados crean sus propios casos" on public.casos;
create policy "Abogados crean sus propios casos"
  on public.casos for insert
  with check (auth.uid() = abogado_id and public.get_user_rol() = 'abogado');

drop policy if exists "Abogados actualizan sus propios casos" on public.casos;
create policy "Abogados actualizan sus propios casos"
  on public.casos for update
  using (auth.uid() = abogado_id and public.get_user_rol() = 'abogado');

drop policy if exists "Abogados eliminan sus propios casos" on public.casos;
create policy "Abogados eliminan sus propios casos"
  on public.casos for delete
  using (auth.uid() = abogado_id and public.get_user_rol() = 'abogado');

drop policy if exists "Revisor ve todos los casos" on public.casos;
create policy "Revisor ve todos los casos"
  on public.casos for select
  using (public.get_user_rol() = 'revisor');

drop trigger if exists casos_updated_at on public.casos;
create trigger casos_updated_at
  before update on public.casos
  for each row execute function public.set_updated_at();

-- ============================================================
-- Tabla: fichas_conciliacion
-- Formato GDJ-GPO-FMT-005 v2 — 19 secciones
-- ============================================================
create table if not exists public.fichas_conciliacion (
  id                      uuid primary key default uuid_generate_v4(),
  caso_id                 uuid not null references public.casos(id) on delete cascade,

  -- Parámetros de configuración
  tipo_conciliacion       text check (tipo_conciliacion in ('parametrica', 'condicional')),
  conciliable             boolean,
  directriz_conciliacion  text,
  resolucion_prestacion   text,
  semanas_cotizadas       numeric,
  tasa_aplicada           numeric,
  tasa_solicitada         numeric,
  cuantia_tipo            text check (cuantia_tipo in ('determinada', 'indeterminada')),
  cuantia_valor           numeric,
  pretende_intereses      boolean default false,
  pretende_indexacion     boolean default false,
  hay_fallo               boolean default false,
  sintesis_fallo          text,

  -- 19 secciones generadas por IA
  sec_1_hechos            text,
  sec_2_pretensiones      text,
  sec_3_cuantia           text,
  sec_4_normas            text,
  sec_5_apelacion         text,
  sec_6_sentencia         text,
  sec_7_probatorio        text,
  sec_8_problema          text,
  sec_9_caducidad         text,
  sec_10_movimientos      text,
  sec_11_jurisprudencia   text,
  sec_12_doctrina         text,
  sec_13_comite_ext       text,
  sec_14_casos_similares  text,
  sec_15_politicas        text,
  sec_16_consideraciones  text,
  sec_17_riesgo           text,
  sec_18_recomendacion    text,
  sec_19_elaboro          text,

  -- Estado y documento
  estado                  text not null default 'borrador'
                            check (estado in ('borrador', 'en_revision', 'listo')),
  docx_url                text,

  -- Metadata IA
  ia_prompt_usado         text,
  ia_respuesta_cruda      text,

  -- Auditoría
  creado_por              uuid not null references auth.users(id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists fichas_caso_id_idx    on public.fichas_conciliacion(caso_id);
create index if not exists fichas_creado_por_idx on public.fichas_conciliacion(creado_por);
create index if not exists fichas_estado_idx     on public.fichas_conciliacion(estado);

alter table public.fichas_conciliacion enable row level security;

drop policy if exists "Admin acceso total fichas" on public.fichas_conciliacion;
create policy "Admin acceso total fichas"
  on public.fichas_conciliacion for all
  using (public.get_user_rol() = 'admin')
  with check (public.get_user_rol() = 'admin');

drop policy if exists "Abogados ven sus propias fichas" on public.fichas_conciliacion;
create policy "Abogados ven sus propias fichas"
  on public.fichas_conciliacion for select
  using (auth.uid() = creado_por and public.get_user_rol() = 'abogado');

drop policy if exists "Abogados crean sus propias fichas" on public.fichas_conciliacion;
create policy "Abogados crean sus propias fichas"
  on public.fichas_conciliacion for insert
  with check (auth.uid() = creado_por and public.get_user_rol() = 'abogado');

drop policy if exists "Abogados actualizan sus propias fichas" on public.fichas_conciliacion;
create policy "Abogados actualizan sus propias fichas"
  on public.fichas_conciliacion for update
  using (auth.uid() = creado_por and public.get_user_rol() = 'abogado');

drop policy if exists "Abogados eliminan sus propias fichas" on public.fichas_conciliacion;
create policy "Abogados eliminan sus propias fichas"
  on public.fichas_conciliacion for delete
  using (auth.uid() = creado_por and public.get_user_rol() = 'abogado');

drop policy if exists "Revisor ve todas las fichas" on public.fichas_conciliacion;
create policy "Revisor ve todas las fichas"
  on public.fichas_conciliacion for select
  using (public.get_user_rol() = 'revisor');

-- Políticas legacy (de versiones anteriores del schema)
drop policy if exists "Usuarios ven sus propias fichas" on public.fichas_conciliacion;
drop policy if exists "Usuarios crean sus propias fichas" on public.fichas_conciliacion;
drop policy if exists "Usuarios actualizan sus propias fichas" on public.fichas_conciliacion;
drop policy if exists "Usuarios eliminan sus propias fichas" on public.fichas_conciliacion;

drop trigger if exists fichas_updated_at on public.fichas_conciliacion;
create trigger fichas_updated_at
  before update on public.fichas_conciliacion
  for each row execute function public.set_updated_at();

-- ============================================================
-- Tabla: archivos_proceso
-- ============================================================
create table if not exists public.archivos_proceso (
  id              uuid primary key default uuid_generate_v4(),
  caso_id         uuid not null references public.casos(id) on delete cascade,
  tipo            text not null check (tipo in ('demanda_pdf', 'excel_proceso', 'lineamientos')),
  storage_path    text not null,
  nombre_original text not null,
  created_at      timestamptz not null default now()
);

create index if not exists archivos_caso_id_idx on public.archivos_proceso(caso_id);

alter table public.archivos_proceso enable row level security;

drop policy if exists "Admin acceso total archivos" on public.archivos_proceso;
create policy "Admin acceso total archivos"
  on public.archivos_proceso for all
  using (public.get_user_rol() = 'admin')
  with check (public.get_user_rol() = 'admin');

drop policy if exists "Abogados gestionan archivos de sus casos" on public.archivos_proceso;
create policy "Abogados gestionan archivos de sus casos"
  on public.archivos_proceso for all
  using (
    public.get_user_rol() = 'abogado' and
    exists (
      select 1 from public.casos c
      where c.id = caso_id and c.abogado_id = auth.uid()
    )
  )
  with check (
    public.get_user_rol() = 'abogado' and
    exists (
      select 1 from public.casos c
      where c.id = caso_id and c.abogado_id = auth.uid()
    )
  );

drop policy if exists "Revisor ve todos los archivos" on public.archivos_proceso;
create policy "Revisor ve todos los archivos"
  on public.archivos_proceso for select
  using (public.get_user_rol() = 'revisor');

-- ============================================================
-- Storage bucket para documentos
-- ============================================================
insert into storage.buckets (id, name, public)
values ('documentos-lexcode', 'documentos-lexcode', false)
on conflict (id) do nothing;

drop policy if exists "Usuarios acceden a sus propios documentos" on storage.objects;
create policy "Usuarios acceden a sus propios documentos"
  on storage.objects for select
  using (
    bucket_id = 'documentos-lexcode' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Admin accede a todos los documentos" on storage.objects;
create policy "Admin accede a todos los documentos"
  on storage.objects for select
  using (
    bucket_id = 'documentos-lexcode' and
    public.get_user_rol() = 'admin'
  );

drop policy if exists "Revisor accede a todos los documentos" on storage.objects;
create policy "Revisor accede a todos los documentos"
  on storage.objects for select
  using (
    bucket_id = 'documentos-lexcode' and
    public.get_user_rol() = 'revisor'
  );

drop policy if exists "Usuarios suben sus propios documentos" on storage.objects;
create policy "Usuarios suben sus propios documentos"
  on storage.objects for insert
  with check (
    bucket_id = 'documentos-lexcode' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Usuarios eliminan sus propios documentos" on storage.objects;
create policy "Usuarios eliminan sus propios documentos"
  on storage.objects for delete
  using (
    bucket_id = 'documentos-lexcode' and
    auth.uid()::text = (storage.foldername(name))[1]
  );
