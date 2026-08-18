-- ============================================================
-- LEXCODE — Ficha de Conciliación formato v3 (GDJ-GPO-FMT-005 v3)
-- Campos nuevos del encabezado. Idempotente.
-- ============================================================
alter table public.fichas_conciliacion
  add column if not exists causante_afiliado text null,   -- nombre + C.C. del causante/afiliado
  add column if not exists reconsideracion   text null,   -- 'SI' | 'NO'
  add column if not exists juez              text null;   -- nombre del juez de la autoridad
