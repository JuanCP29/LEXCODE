-- ============================================================================
-- FASE 5 — Devolver caso mal asignado
-- Columnas para registrar la devolución. El caso vuelve al pool (asignado_a=null,
-- cola_estado='pendiente') y guarda el motivo/quién/cuándo, hasta que un
-- coordinador lo reasigna (ahí se limpia el motivo).
-- Correr en: Supabase → SQL Editor.
-- ============================================================================
alter table public.casos add column if not exists devolucion_motivo text;
alter table public.casos add column if not exists devuelto_at       timestamptz;
alter table public.casos add column if not exists devuelto_por      uuid;
