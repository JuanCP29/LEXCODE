-- ============================================================
-- LEXCODE — Repositorio de documentos (directrices / memorandos / lineamientos)
-- Migration: añade el tipo de documento al repositorio existente.
-- Aditiva y no destructiva: conserva todo el modelo actual
-- (pretensión, clase, tipologías) y solo agrega la dimensión "tipo".
-- Ejecutar en Supabase SQL Editor.
-- ============================================================

-- 1. Nueva columna: tipo de documento del repositorio.
--    'directriz' es el valor por defecto para conservar el comportamiento
--    de todos los registros ya existentes.
alter table public.directrices_conciliacion
  add column if not exists tipo_documento text not null default 'directriz'
    check (tipo_documento in ('directriz', 'memorando', 'lineamiento', 'otro'));

create index if not exists directrices_tipo_documento_idx
  on public.directrices_conciliacion(tipo_documento);

-- Nota: la columna 'pretension' se mantiene como está (not null) para no
-- romper el modelo. En la UI la pretensión pasa a ser opcional para tipos
-- que no son directrices de conciliación, defaulteando a 'general'.
