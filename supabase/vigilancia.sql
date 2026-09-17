-- ============================================================
-- LEXCODE / FoQs — Vigilante Judicial (MVP)
-- Monitoreo de procesos de la Rama Judicial (Fuente 1: CPNU) con persistencia,
-- detección de novedades por hash y bandeja de novedades. RLS por organización.
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================================

-- 1. Procesos en vigilancia
create table if not exists public.procesos_vigilados (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null,
  caso_id                uuid references public.casos(id) on delete set null,   -- enlace opcional al caso/ficha
  radicado               text not null,                                         -- 23 dígitos
  id_proceso_externo     text,                                                  -- idProceso de la Rama
  despacho               text,
  sujetos                text,                                                  -- "Demandante: X | Demandado: Y"
  ciudad                 text,
  departamento           text,
  pagina_origen          text default 'rama_unificada',                         -- rama_unificada | samai | siglo_xxi | tyba
  estado                 text not null default 'activo',                        -- activo | privado | no_encontrado
  ultimo_movimiento      timestamptz,                                           -- fecha de la última actuación (Rama)
  ultima_actuacion_hash  text,
  backfill_completo      boolean not null default false,                        -- true tras la carga inicial del historial
  activo                 boolean not null default true,
  creado_por             uuid,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (org_id, radicado)
);

-- 2. Actuaciones de cada proceso (una fila por actuación de la Rama)
create table if not exists public.actuaciones_vigilancia (
  id                uuid primary key default gen_random_uuid(),
  proceso_id        uuid not null references public.procesos_vigilados(id) on delete cascade,
  fecha_rama        timestamptz,          -- fecha oficial de la actuación
  actuacion         text,                 -- tipo de actuación
  anotacion         text,
  fecha_registro    timestamptz,          -- registro en la Rama
  fecha_sistema     timestamptz not null default now(),   -- cuándo la capturó FoQs
  hash              text not null,        -- sha1(fecha_rama + actuacion + anotacion)
  leida             boolean not null default false,
  created_at        timestamptz not null default now(),
  unique (proceso_id, hash)
);

-- 3. Novedades (actuaciones nuevas detectadas tras la carga inicial)
create table if not exists public.novedades_vigilancia (
  id             uuid primary key default gen_random_uuid(),
  proceso_id     uuid not null references public.procesos_vigilados(id) on delete cascade,
  actuacion_id   uuid not null references public.actuaciones_vigilancia(id) on delete cascade,
  resumen        text,
  nivel          text not null default 'info',   -- info | accion (p. ej. corre traslado / fija audiencia)
  atendida       boolean not null default false,
  created_at     timestamptz not null default now()
);

create index if not exists pv_org_idx        on public.procesos_vigilados(org_id);
create index if not exists pv_radicado_idx    on public.procesos_vigilados(radicado);
create index if not exists av_proceso_idx     on public.actuaciones_vigilancia(proceso_id);
create index if not exists nv_proceso_idx     on public.novedades_vigilancia(proceso_id);
create index if not exists nv_atendida_idx    on public.novedades_vigilancia(atendida);

-- ============================================================
-- RLS por organización (misma organización del perfil del usuario)
-- ============================================================
alter table public.procesos_vigilados    enable row level security;
alter table public.actuaciones_vigilancia enable row level security;
alter table public.novedades_vigilancia   enable row level security;

drop policy if exists pv_org on public.procesos_vigilados;
create policy pv_org on public.procesos_vigilados for all
  using      (org_id = (select org_id from public.perfiles where id = auth.uid()))
  with check (org_id = (select org_id from public.perfiles where id = auth.uid()));

drop policy if exists av_org on public.actuaciones_vigilancia;
create policy av_org on public.actuaciones_vigilancia for all
  using      (proceso_id in (select id from public.procesos_vigilados
                             where org_id = (select org_id from public.perfiles where id = auth.uid())))
  with check (proceso_id in (select id from public.procesos_vigilados
                             where org_id = (select org_id from public.perfiles where id = auth.uid())));

drop policy if exists nv_org on public.novedades_vigilancia;
create policy nv_org on public.novedades_vigilancia for all
  using      (proceso_id in (select id from public.procesos_vigilados
                             where org_id = (select org_id from public.perfiles where id = auth.uid())))
  with check (proceso_id in (select id from public.procesos_vigilados
                             where org_id = (select org_id from public.perfiles where id = auth.uid())));
