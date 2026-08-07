-- ============================================================
-- LEXCODE — Cola de casos (trabajo por lotes en equipo)
-- Idempotente: ejecutar cuantas veces sea necesario
-- ============================================================

-- Campos de cola en la tabla casos
alter table public.casos
  add column if not exists asignado_a  uuid references auth.users(id) on delete set null,
  add column if not exists cola_estado text
    check (cola_estado in ('pendiente', 'en_proceso', 'completado')),
  add column if not exists cola_lote   text,          -- id/nombre del lote de importación CSV
  add column if not exists cola_at     timestamptz;    -- cuándo entró a la cola

create index if not exists casos_asignado_a_idx on public.casos(asignado_a);
create index if not exists casos_cola_estado_idx on public.casos(cola_estado);

-- Política: un abogado puede VER los casos que le fueron asignados
-- (además de los propios que ya cubre la política existente).
drop policy if exists "Abogados ven casos asignados" on public.casos;
create policy "Abogados ven casos asignados"
  on public.casos for select
  using (auth.uid() = asignado_a and public.get_user_rol() = 'abogado');

-- Política: un abogado puede ACTUALIZAR el estado de cola de casos asignados
drop policy if exists "Abogados actualizan casos asignados" on public.casos;
create policy "Abogados actualizan casos asignados"
  on public.casos for update
  using (auth.uid() = asignado_a and public.get_user_rol() = 'abogado');
