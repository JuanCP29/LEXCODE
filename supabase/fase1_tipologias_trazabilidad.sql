-- ============================================================
-- LEXCODE — Fase 1: Tipologías, documentos, trazabilidad
-- Idempotente: ejecutar cuantas veces sea necesario
-- Ejecutar en Supabase SQL Editor DESPUÉS de schema.sql
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. Tabla: tipologias (jerárquica: padre → hijas)
-- ============================================================
create table if not exists public.tipologias (
  id          uuid primary key default uuid_generate_v4(),
  nombre      text not null,
  parent_id   uuid references public.tipologias(id) on delete cascade,
  descripcion text,
  activa      boolean not null default true,
  orden       int not null default 0,
  created_at  timestamptz not null default now(),
  unique (nombre, parent_id)
);

create index if not exists tipologias_parent_idx on public.tipologias(parent_id);

-- Unicidad real para raíces (parent_id NULL no dispara la unique constraint)
create unique index if not exists tipologias_raiz_nombre_uq
  on public.tipologias(nombre) where parent_id is null;

alter table public.tipologias enable row level security;

drop policy if exists "Autenticados leen tipologias" on public.tipologias;
create policy "Autenticados leen tipologias"
  on public.tipologias for select
  using (auth.role() = 'authenticated');

drop policy if exists "Admin gestiona tipologias" on public.tipologias;
create policy "Admin gestiona tipologias"
  on public.tipologias for all
  using (public.get_user_rol() = 'admin')
  with check (public.get_user_rol() = 'admin');

-- ============================================================
-- 2. Ampliar directrices_conciliacion (columnas aditivas)
-- ============================================================
alter table public.directrices_conciliacion
  add column if not exists codigo                text,          -- ej. 'DIC-013'
  add column if not exists fecha_directriz       date,
  add column if not exists criterio_conciliacion text,          -- cuándo es conciliable
  add column if not exists recomendacion_base    text,          -- recomendación estándar
  add column if not exists riesgo_base           text,          -- evaluación de riesgo base
  add column if not exists fundamento_normativo  text,
  add column if not exists version               int not null default 1;

-- ============================================================
-- 3. Relación N:M directriz ↔ tipología
-- ============================================================
create table if not exists public.directriz_tipologias (
  directriz_id uuid not null references public.directrices_conciliacion(id) on delete cascade,
  tipologia_id uuid not null references public.tipologias(id) on delete cascade,
  primary key (directriz_id, tipologia_id)
);

alter table public.directriz_tipologias enable row level security;

drop policy if exists "Autenticados leen directriz_tipologias" on public.directriz_tipologias;
create policy "Autenticados leen directriz_tipologias"
  on public.directriz_tipologias for select
  using (auth.role() = 'authenticated');

drop policy if exists "Admin gestiona directriz_tipologias" on public.directriz_tipologias;
create policy "Admin gestiona directriz_tipologias"
  on public.directriz_tipologias for all
  using (public.get_user_rol() = 'admin')
  with check (public.get_user_rol() = 'admin');

-- ============================================================
-- 4. Tipología asignada al caso
-- ============================================================
alter table public.casos
  add column if not exists tipologia_id uuid references public.tipologias(id) on delete set null;

create index if not exists casos_tipologia_idx on public.casos(tipologia_id);

-- ============================================================
-- 5. Tabla: documentos_caso (traslado, actos administrativos, anexos)
-- ============================================================
create table if not exists public.documentos_caso (
  id                    uuid primary key default uuid_generate_v4(),
  caso_id               uuid not null references public.casos(id) on delete cascade,
  tipo_documento        text not null check (tipo_documento in (
                          'traslado_demanda', 'acto_administrativo',
                          'historia_laboral', 'anexo'
                        )),
  nombre_archivo        text not null,
  storage_path          text not null,
  mime_type             text,
  texto_extraido        text,
  extraccion_json       jsonb,
  estado_procesamiento  text not null default 'pendiente'
                          check (estado_procesamiento in ('pendiente', 'procesando', 'ok', 'error')),
  error_procesamiento   text,
  uploaded_by           uuid not null references auth.users(id),
  created_at            timestamptz not null default now()
);

create index if not exists documentos_caso_caso_idx on public.documentos_caso(caso_id);
create index if not exists documentos_caso_tipo_idx on public.documentos_caso(tipo_documento);

alter table public.documentos_caso enable row level security;

drop policy if exists "Admin acceso total documentos_caso" on public.documentos_caso;
create policy "Admin acceso total documentos_caso"
  on public.documentos_caso for all
  using (public.get_user_rol() = 'admin')
  with check (public.get_user_rol() = 'admin');

drop policy if exists "Abogados gestionan documentos de sus casos" on public.documentos_caso;
create policy "Abogados gestionan documentos de sus casos"
  on public.documentos_caso for all
  using (
    public.get_user_rol() = 'abogado' and
    exists (select 1 from public.casos c where c.id = caso_id and c.abogado_id = auth.uid())
  )
  with check (
    public.get_user_rol() = 'abogado' and
    exists (select 1 from public.casos c where c.id = caso_id and c.abogado_id = auth.uid())
  );

drop policy if exists "Revisor ve documentos_caso" on public.documentos_caso;
create policy "Revisor ve documentos_caso"
  on public.documentos_caso for select
  using (public.get_user_rol() = 'revisor');

-- ============================================================
-- 6. Tabla: actos_administrativos (datos estructurados extraídos)
-- ============================================================
create table if not exists public.actos_administrativos (
  id               uuid primary key default uuid_generate_v4(),
  caso_id          uuid not null references public.casos(id) on delete cascade,
  documento_id     uuid references public.documentos_caso(id) on delete set null,
  numero_acto      text,
  fecha_acto       date,
  tipo_acto        text,          -- 'resolucion_reconoce' | 'resolucion_niega' | 'resuelve_recurso' | 'certificacion' | 'otro'
  sentido_decision text,
  prestacion       text,
  semanas_reconocidas numeric,
  tasa_aplicada    numeric,
  ingreso_base     numeric,
  resumen          text,
  datos_extraidos  jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists actos_adm_caso_idx on public.actos_administrativos(caso_id);

alter table public.actos_administrativos enable row level security;

drop policy if exists "Admin acceso total actos_adm" on public.actos_administrativos;
create policy "Admin acceso total actos_adm"
  on public.actos_administrativos for all
  using (public.get_user_rol() = 'admin')
  with check (public.get_user_rol() = 'admin');

drop policy if exists "Abogados gestionan actos de sus casos" on public.actos_administrativos;
create policy "Abogados gestionan actos de sus casos"
  on public.actos_administrativos for all
  using (
    public.get_user_rol() = 'abogado' and
    exists (select 1 from public.casos c where c.id = caso_id and c.abogado_id = auth.uid())
  )
  with check (
    public.get_user_rol() = 'abogado' and
    exists (select 1 from public.casos c where c.id = caso_id and c.abogado_id = auth.uid())
  );

drop policy if exists "Revisor ve actos_adm" on public.actos_administrativos;
create policy "Revisor ve actos_adm"
  on public.actos_administrativos for select
  using (public.get_user_rol() = 'revisor');

-- ============================================================
-- 7. Tabla: ficha_seccion_fuentes (trazabilidad por sección)
-- ============================================================
create table if not exists public.ficha_seccion_fuentes (
  id             uuid primary key default uuid_generate_v4(),
  ficha_id       uuid not null references public.fichas_conciliacion(id) on delete cascade,
  seccion        int not null check (seccion between 1 and 19),
  fuente_tipo    text not null check (fuente_tipo in (
                   'excel_csv', 'traslado_demanda', 'acto_administrativo',
                   'directriz_colpensiones', 'manual', 'mixta'
                 )),
  fuente_id      uuid,           -- id del documento/directriz/acto usado (nullable para excel_csv/manual)
  modelo_ia      text,           -- ej. 'claude-sonnet-4-6'
  prompt_version text,
  advertencias   jsonb,          -- campos faltantes, inconsistencias
  detalle        jsonb,          -- campos concretos usados
  creado_por     uuid not null references auth.users(id),
  created_at     timestamptz not null default now()
);

create index if not exists fsf_ficha_idx on public.ficha_seccion_fuentes(ficha_id);

alter table public.ficha_seccion_fuentes enable row level security;

drop policy if exists "Admin acceso total fsf" on public.ficha_seccion_fuentes;
create policy "Admin acceso total fsf"
  on public.ficha_seccion_fuentes for all
  using (public.get_user_rol() = 'admin')
  with check (public.get_user_rol() = 'admin');

drop policy if exists "Abogados gestionan fuentes de sus fichas" on public.ficha_seccion_fuentes;
create policy "Abogados gestionan fuentes de sus fichas"
  on public.ficha_seccion_fuentes for all
  using (
    public.get_user_rol() = 'abogado' and
    exists (select 1 from public.fichas_conciliacion f where f.id = ficha_id and f.creado_por = auth.uid())
  )
  with check (
    public.get_user_rol() = 'abogado' and
    exists (select 1 from public.fichas_conciliacion f where f.id = ficha_id and f.creado_por = auth.uid())
  );

drop policy if exists "Revisor ve fsf" on public.ficha_seccion_fuentes;
create policy "Revisor ve fsf"
  on public.ficha_seccion_fuentes for select
  using (public.get_user_rol() = 'revisor');

-- ============================================================
-- 8. Tabla: ficha_versiones (snapshots)
-- ============================================================
create table if not exists public.ficha_versiones (
  id         uuid primary key default uuid_generate_v4(),
  ficha_id   uuid not null references public.fichas_conciliacion(id) on delete cascade,
  version    int not null,
  secciones  jsonb not null,     -- snapshot de las 19 secciones
  parametros jsonb,              -- snapshot de parámetros
  fuentes    jsonb,              -- snapshot de trazabilidad
  motivo     text,               -- 'generacion' | 'regeneracion_seccion' | 'edicion' | 'aprobacion'
  creado_por uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (ficha_id, version)
);

create index if not exists fv_ficha_idx on public.ficha_versiones(ficha_id);

alter table public.ficha_versiones enable row level security;

drop policy if exists "Admin acceso total fv" on public.ficha_versiones;
create policy "Admin acceso total fv"
  on public.ficha_versiones for all
  using (public.get_user_rol() = 'admin')
  with check (public.get_user_rol() = 'admin');

drop policy if exists "Abogados gestionan versiones de sus fichas" on public.ficha_versiones;
create policy "Abogados gestionan versiones de sus fichas"
  on public.ficha_versiones for all
  using (
    public.get_user_rol() = 'abogado' and
    exists (select 1 from public.fichas_conciliacion f where f.id = ficha_id and f.creado_por = auth.uid())
  )
  with check (
    public.get_user_rol() = 'abogado' and
    exists (select 1 from public.fichas_conciliacion f where f.id = ficha_id and f.creado_por = auth.uid())
  );

drop policy if exists "Revisor ve fv" on public.ficha_versiones;
create policy "Revisor ve fv"
  on public.ficha_versiones for select
  using (public.get_user_rol() = 'revisor');

-- ============================================================
-- 9. Tabla: exportaciones (registro de cada export)
-- ============================================================
create table if not exists public.exportaciones (
  id           uuid primary key default uuid_generate_v4(),
  ficha_id     uuid not null references public.fichas_conciliacion(id) on delete cascade,
  tipo         text not null check (tipo in ('docx', 'xlsx', 'pdf')),
  storage_path text,
  generado_por uuid not null references auth.users(id),
  created_at   timestamptz not null default now()
);

create index if not exists exportaciones_ficha_idx on public.exportaciones(ficha_id);

alter table public.exportaciones enable row level security;

drop policy if exists "Admin acceso total exportaciones" on public.exportaciones;
create policy "Admin acceso total exportaciones"
  on public.exportaciones for all
  using (public.get_user_rol() = 'admin')
  with check (public.get_user_rol() = 'admin');

drop policy if exists "Abogados gestionan sus exportaciones" on public.exportaciones;
create policy "Abogados gestionan sus exportaciones"
  on public.exportaciones for all
  using (
    public.get_user_rol() = 'abogado' and
    exists (select 1 from public.fichas_conciliacion f where f.id = ficha_id and f.creado_por = auth.uid())
  )
  with check (
    public.get_user_rol() = 'abogado' and
    exists (select 1 from public.fichas_conciliacion f where f.id = ficha_id and f.creado_por = auth.uid())
  );

drop policy if exists "Revisor ve exportaciones" on public.exportaciones;
create policy "Revisor ve exportaciones"
  on public.exportaciones for select
  using (public.get_user_rol() = 'revisor');

-- ============================================================
-- 10. Ampliar estados de fichas_conciliacion
--     (borrador → generada → en_revision → aprobada → exportada)
-- ============================================================
alter table public.fichas_conciliacion drop constraint if exists fichas_conciliacion_estado_check;
alter table public.fichas_conciliacion add constraint fichas_conciliacion_estado_check
  check (estado in ('borrador', 'generada', 'en_revision', 'listo', 'aprobada', 'exportada'));

alter table public.fichas_conciliacion
  add column if not exists version_actual int not null default 1,
  add column if not exists aprobada_por   uuid references auth.users(id),
  add column if not exists aprobada_at    timestamptz;

-- ============================================================
-- 11. Seed de tipologías (lista oficial Collegia)
-- ============================================================
do $$
declare
  v_padre uuid;
begin
  -- Indemnización Sustitutiva
  insert into public.tipologias (nombre, orden)
  select 'Indemnización Sustitutiva', 1
  where not exists (select 1 from public.tipologias where nombre = 'Indemnización Sustitutiva' and parent_id is null);
  select id into v_padre from public.tipologias where nombre = 'Indemnización Sustitutiva' and parent_id is null;
  insert into public.tipologias (nombre, parent_id, orden) values
    ('Reliquidación', v_padre, 1),
    ('Requisitos - Magisterio', v_padre, 2),
    ('Requisitos - Incompatibilidad', v_padre, 3)
    on conflict (nombre, parent_id) do nothing;

  -- Auxilios funerarios
  insert into public.tipologias (nombre, orden)
  select 'Auxilios Funerarios', 2
  where not exists (select 1 from public.tipologias where nombre = 'Auxilios Funerarios' and parent_id is null);
  select id into v_padre from public.tipologias where nombre = 'Auxilios Funerarios' and parent_id is null;
  insert into public.tipologias (nombre, parent_id, orden) values
    ('Requisitos - No activo', v_padre, 1),
    ('Requisitos - Contrato', v_padre, 2),
    ('Requisitos - VP (Verificación Preliminar)', v_padre, 3)
    on conflict (nombre, parent_id) do nothing;

  -- Vejez - Reliquidación
  insert into public.tipologias (nombre, orden)
  select 'Vejez - Reliquidación', 3
  where not exists (select 1 from public.tipologias where nombre = 'Vejez - Reliquidación' and parent_id is null);
  select id into v_padre from public.tipologias where nombre = 'Vejez - Reliquidación' and parent_id is null;
  insert into public.tipologias (nombre, parent_id, orden) values
    ('Reliquidación 80%', v_padre, 1),
    ('Reliquidación Ley 797 de 2003', v_padre, 2),
    ('Reliquidación Decreto 758 de 1990', v_padre, 3),
    ('Reliquidación Ley 71 de 1988', v_padre, 4),
    ('Reliquidación Ley 33 de 1985', v_padre, 5)
    on conflict (nombre, parent_id) do nothing;

  -- Vejez
  insert into public.tipologias (nombre, orden)
  select 'Vejez', 4
  where not exists (select 1 from public.tipologias where nombre = 'Vejez' and parent_id is null);
  select id into v_padre from public.tipologias where nombre = 'Vejez' and parent_id is null;
  insert into public.tipologias (nombre, parent_id, orden) values
    ('Retroactivo', v_padre, 1),
    ('Intereses Moratorios', v_padre, 2),
    ('Alto Riesgo', v_padre, 3),
    ('Decreto 758 de 1990', v_padre, 4),
    ('Ley 797 de 2003 - Hijo Inválido', v_padre, 5),
    ('Incrementos pensionales 7%', v_padre, 6),
    ('Incrementos pensionales 14%', v_padre, 7),
    ('Incrementos pensionales 7% y 14%', v_padre, 8)
    on conflict (nombre, parent_id) do nothing;

  -- Sobrevivientes
  insert into public.tipologias (nombre, orden)
  select 'Sobrevivientes', 5
  where not exists (select 1 from public.tipologias where nombre = 'Sobrevivientes' and parent_id is null);
  select id into v_padre from public.tipologias where nombre = 'Sobrevivientes' and parent_id is null;
  insert into public.tipologias (nombre, parent_id, orden) values
    ('Hijo Inválido', v_padre, 1),
    ('Ley 797 de 2003', v_padre, 2),
    ('Conflicto de convivencia', v_padre, 3),
    ('No acredita convivencia', v_padre, 4),
    ('Intereses Moratorios', v_padre, 5)
    on conflict (nombre, parent_id) do nothing;

  -- Afiliación – Traslado de régimen
  insert into public.tipologias (nombre, orden)
  select 'Afiliación - Traslado de régimen', 6
  where not exists (select 1 from public.tipologias where nombre = 'Afiliación - Traslado de régimen' and parent_id is null);
  select id into v_padre from public.tipologias where nombre = 'Afiliación - Traslado de régimen' and parent_id is null;
  insert into public.tipologias (nombre, parent_id, orden) values
    ('10 años', v_padre, 1),
    ('Consentimiento', v_padre, 2),
    ('SU062', v_padre, 3)
    on conflict (nombre, parent_id) do nothing;

  -- Transversales (aplican a todas las pretensiones)
  insert into public.tipologias (nombre, orden)
  select 'Transversales - Todas las pretensiones', 7
  where not exists (select 1 from public.tipologias where nombre = 'Transversales - Todas las pretensiones' and parent_id is null);
  select id into v_padre from public.tipologias where nombre = 'Transversales - Todas las pretensiones' and parent_id is null;
  insert into public.tipologias (nombre, parent_id, orden) values
    ('Silencio Administrativo', v_padre, 1),
    ('Petición incompleta', v_padre, 2)
    on conflict (nombre, parent_id) do nothing;
end $$;
