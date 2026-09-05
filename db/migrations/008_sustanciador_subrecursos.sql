-- ============================================================================
-- FASE 2c — El sustanciador puede gestionar los sub-recursos de sus casos ASIGNADOS
--   Las tablas ligadas a un caso/ficha usaban casos.abogado_id (creador) o
--   fichas.creado_por, así que un sustanciador con un caso ASIGNADO (asignado_a)
--   —pero creado/importado por otra persona— quedaba bloqueado al generar/guardar
--   la ficha (fuentes, versiones, exportaciones) o subir/leer documentos.
--
--   Enfoque ADITIVO: solo AGREGA una política por tabla (las de admin/coordinador
--   existentes se conservan; las policies RLS se combinan con OR, nadie pierde acceso).
--   Cada una habilita al usuario cuyo caso (directo o vía ficha) le está asignado.
--   Idempotente. Correr en: Supabase -> SQL Editor.
-- ============================================================================
begin;

-- ── Tablas ligadas directamente al caso (caso_id) ──────────────────────────
drop policy if exists "Sustanciador gestiona archivos de casos asignados" on public.archivos_proceso;
create policy "Sustanciador gestiona archivos de casos asignados"
  on public.archivos_proceso for all
  using (exists (select 1 from public.casos c
                 where c.id = archivos_proceso.caso_id and c.asignado_a = auth.uid()))
  with check (exists (select 1 from public.casos c
                 where c.id = archivos_proceso.caso_id and c.asignado_a = auth.uid()));

drop policy if exists "Sustanciador gestiona documentos de casos asignados" on public.documentos_caso;
create policy "Sustanciador gestiona documentos de casos asignados"
  on public.documentos_caso for all
  using (exists (select 1 from public.casos c
                 where c.id = documentos_caso.caso_id and c.asignado_a = auth.uid()))
  with check (exists (select 1 from public.casos c
                 where c.id = documentos_caso.caso_id and c.asignado_a = auth.uid()));

drop policy if exists "Sustanciador gestiona actos de casos asignados" on public.actos_administrativos;
create policy "Sustanciador gestiona actos de casos asignados"
  on public.actos_administrativos for all
  using (exists (select 1 from public.casos c
                 where c.id = actos_administrativos.caso_id and c.asignado_a = auth.uid()))
  with check (exists (select 1 from public.casos c
                 where c.id = actos_administrativos.caso_id and c.asignado_a = auth.uid()));

-- ── Tablas ligadas a la ficha (ficha_id -> fichas.caso_id -> casos.asignado_a) ──
drop policy if exists "Sustanciador gestiona fuentes de fichas asignadas" on public.ficha_seccion_fuentes;
create policy "Sustanciador gestiona fuentes de fichas asignadas"
  on public.ficha_seccion_fuentes for all
  using (exists (select 1 from public.fichas_conciliacion f
                 join public.casos c on c.id = f.caso_id
                 where f.id = ficha_seccion_fuentes.ficha_id and c.asignado_a = auth.uid()))
  with check (exists (select 1 from public.fichas_conciliacion f
                 join public.casos c on c.id = f.caso_id
                 where f.id = ficha_seccion_fuentes.ficha_id and c.asignado_a = auth.uid()));

drop policy if exists "Sustanciador gestiona versiones de fichas asignadas" on public.ficha_versiones;
create policy "Sustanciador gestiona versiones de fichas asignadas"
  on public.ficha_versiones for all
  using (exists (select 1 from public.fichas_conciliacion f
                 join public.casos c on c.id = f.caso_id
                 where f.id = ficha_versiones.ficha_id and c.asignado_a = auth.uid()))
  with check (exists (select 1 from public.fichas_conciliacion f
                 join public.casos c on c.id = f.caso_id
                 where f.id = ficha_versiones.ficha_id and c.asignado_a = auth.uid()));

drop policy if exists "Sustanciador gestiona exportaciones de fichas asignadas" on public.exportaciones;
create policy "Sustanciador gestiona exportaciones de fichas asignadas"
  on public.exportaciones for all
  using (exists (select 1 from public.fichas_conciliacion f
                 join public.casos c on c.id = f.caso_id
                 where f.id = exportaciones.ficha_id and c.asignado_a = auth.uid()))
  with check (exists (select 1 from public.fichas_conciliacion f
                 join public.casos c on c.id = f.caso_id
                 where f.id = exportaciones.ficha_id and c.asignado_a = auth.uid()));

commit;
