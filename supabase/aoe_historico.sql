-- ============================================================
-- LEXCODE — Base histórica estructurada de AOE (actos ancla de Colpensiones)
-- Alimenta el análisis de patrones, argumentos y vacíos del repositorio.
-- Separada del repositorio de fuentes (directrices_conciliacion).
-- Ejecutar en Supabase SQL Editor.
-- ============================================================

create table if not exists public.aoe_casos (
  id                        uuid primary key default gen_random_uuid(),
  -- Identificación / trazabilidad
  cedula                    text not null,
  radicado                  text,
  reparto                   text,
  ruta_origen               text,               -- ruta del PDF (trazabilidad)
  -- Clasificación del asunto
  tipo_prestacion           text,               -- vejez | sobrevivientes | invalidez | indemnizacion | administradora | otro
  tipo_solicitud            text,               -- reconocimiento | reliquidacion | retroactivo | sustitucion | correccion_hl | ...
  sentido_decision          text,               -- niega | reconoce | reliquida | modifica | confirma | otro
  es_desfavorable           boolean,            -- la decisión fue desfavorable al solicitante
  -- Sustancia jurídica del acto
  problema_juridico         text,
  causal_decision           text,               -- la razón concreta de la decisión
  requisitos_examinados     text[],
  hechos_relevantes         text,
  investigacion_administrativa text,             -- null si no existe
  normas_citadas            text[],             -- leyes/decretos/artículos
  fuentes_citadas           jsonb,              -- [{tipo, identificacion, fecha, emisor, fragmento}]
  argumentos_colpensiones   jsonb,              -- [{argumento, condiciones}]
  posibles_controversias    jsonb,              -- [{asunto, es_inferencia}]
  excepciones               text[],
  -- Metadatos de extracción
  estado_texto              text,               -- ok | ocr | sin_texto
  confianza                 text,               -- alta | media | baja (autoevaluación del modelo)
  extraido_modelo           text,
  extraido_at               timestamptz default now(),
  created_at                timestamptz default now(),
  unique (cedula, radicado)                     -- evita duplicar el mismo acto del mismo caso
);

create index if not exists aoe_casos_cedula_idx        on public.aoe_casos(cedula);
create index if not exists aoe_casos_tipo_prest_idx     on public.aoe_casos(tipo_prestacion);
create index if not exists aoe_casos_sentido_idx        on public.aoe_casos(sentido_decision);
create index if not exists aoe_casos_fuentes_gin        on public.aoe_casos using gin (fuentes_citadas);
create index if not exists aoe_casos_normas_gin         on public.aoe_casos using gin (normas_citadas);
