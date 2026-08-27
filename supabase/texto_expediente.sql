-- ============================================================
-- LEXCODE — Fase 1: texto del expediente persistido en el caso
-- Guarda el texto ya extraído de los PDF (traslado + resoluciones) para que
-- las demás secciones (consideraciones, regenerar-seccion) lo reutilicen sin
-- volver a descargar ni re-parsear/re-vision. Aditiva y no destructiva.
-- Ejecutar en Supabase SQL Editor.
-- ============================================================

alter table public.casos
  add column if not exists texto_expediente text;
