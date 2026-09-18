-- ============================================================
-- LEXCODE / FoQs — Vigilante Judicial · Documento de la última actuación (F2 Publicaciones)
-- Guarda el link del documento (auto/sentencia individual o estado consolidado) obtenido de
-- Publicaciones Procesales para la última actuación, cuando es estado o providencia.
-- Ejecutar en el SQL Editor de Supabase (después de supabase/vigilancia.sql).
-- ============================================================

alter table public.procesos_vigilados
  add column if not exists documento_url       text,
  add column if not exists documento_nombre    text,
  add column if not exists documento_tipo      text,  -- individual | estado
  add column if not exists documento_fecha      timestamptz,
  add column if not exists documento_buscado_at timestamptz;
