-- ============================================================
-- LEXCODE / FoQs — Vigilante Judicial · Calendario de audiencias
-- Audiencias derivadas automáticamente de las actuaciones (origen 'auto') o creadas a mano
-- ('manual'). Diferenciador vs. Lumy (allá es 100% manual). RLS por organización.
-- Ejecutar en el SQL Editor de Supabase (después de supabase/vigilancia.sql).
-- ============================================================

create table if not exists public.audiencias_vigilancia (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null,
  proceso_id    uuid not null references public.procesos_vigilados(id) on delete cascade,
  actuacion_id  uuid references public.actuaciones_vigilancia(id) on delete set null,
  fecha         timestamptz,                              -- fecha/hora; null = por confirmar
  tipo          text,                                     -- inicial (art. 77), trámite y juzgamiento, conciliación…
  despacho      text,
  enlace        text,                                     -- link de conexión (audiencia virtual)
  notas         text,
  origen        text not null default 'auto',             -- auto | manual
  estado        text not null default 'programada',       -- programada | por_confirmar | realizada | cancelada
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (actuacion_id)                                   -- idempotencia de la extracción automática
);

create index if not exists aud_org_idx     on public.audiencias_vigilancia(org_id);
create index if not exists aud_proceso_idx on public.audiencias_vigilancia(proceso_id);
create index if not exists aud_fecha_idx   on public.audiencias_vigilancia(fecha);

alter table public.audiencias_vigilancia enable row level security;

drop policy if exists aud_org on public.audiencias_vigilancia;
create policy aud_org on public.audiencias_vigilancia for all
  using      (org_id = (select org_id from public.perfiles where id = auth.uid()))
  with check (org_id = (select org_id from public.perfiles where id = auth.uid()));
