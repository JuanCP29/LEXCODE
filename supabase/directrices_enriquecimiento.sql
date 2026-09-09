-- ============================================================
-- LEXCODE — Repositorio: enriquecimiento (ficha de criterio) · Fase 2, Paso 1
-- Agrega columnas para la "ficha de criterio" que genera la IA por documento.
-- Ejecutar en Supabase SQL Editor. Aditiva y no destructiva.
-- ============================================================

alter table public.directrices_conciliacion
  add column if not exists resumen_criterio        text,
  add column if not exists prestaciones            text[],
  add column if not exists escenarios              text[],
  add column if not exists jurisprudencia_acogida  jsonb,
  add column if not exists condiciones_aplicacion  text[],
  add column if not exists es_regla_conciliacion   boolean,
  add column if not exists enriquecido_at          timestamptz;

-- Índices para el pre-filtro por prestación/escenario del selector (Componente 2).
create index if not exists directrices_prestaciones_idx
  on public.directrices_conciliacion using gin (prestaciones);
create index if not exists directrices_escenarios_idx
  on public.directrices_conciliacion using gin (escenarios);

-- Nota: enriquecido_at = null significa "pendiente de enriquecer" (lo usa el backfill).
