-- ============================================================
-- LEXCODE — Repositorio: nuevos tipos de documento (v2)
-- Agrega 'concepto' y 'jurisprudencia'; renombra 'lineamiento' -> 'circular'
-- y migra las filas existentes de 'lineamiento' a 'concepto'.
-- Ejecutar en Supabase SQL Editor. Aditiva y reversible en datos.
-- ============================================================

-- 1. Quitar el CHECK anterior (autogenerado al crear la columna).
alter table public.directrices_conciliacion
  drop constraint if exists directrices_conciliacion_tipo_documento_check;

-- 2. Migrar datos: lo que hoy está como 'lineamiento' pasa a 'concepto'.
update public.directrices_conciliacion
  set tipo_documento = 'concepto'
  where tipo_documento = 'lineamiento';

-- 3. Nuevo CHECK con el conjunto ampliado. 'circular' queda disponible (antes 'lineamiento').
alter table public.directrices_conciliacion
  add constraint directrices_conciliacion_tipo_documento_check
  check (tipo_documento in ('directriz','memorando','concepto','circular','jurisprudencia','otro'));

-- Recordatorio de naturalezas para el método de Consideraciones:
--   'directriz'      -> REGLA de cuándo procede la CONCILIACIÓN (rama conciliable = SÍ).
--   memorando/concepto/circular/jurisprudencia/otro -> CRITERIOS DE DEFENSA (rama conciliable = NO).
