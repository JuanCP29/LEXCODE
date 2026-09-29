-- ============================================================
-- Prueba de integración RLS — actualización de casos (tipología)
-- Verifica, contra la base REAL y con impersonación de usuarios, que las políticas
-- RLS de public.casos permiten/deniegan el UPDATE como espera el fix de
-- app/api/casos/[id]/route.ts (que pasó de service-role a cliente RLS):
--   · sustanciador ASIGNADO            -> PERMITE
--   · coordinador de OTRA organización -> DENIEGA
--   · superadmin (Propietario)         -> PERMITE
--
-- Es NO destructivo: hace `set local role authenticated`, updates idempotentes
-- (tipologia_id = tipologia_id) y al final RAISE fuerza el ROLLBACK de todo.
--
-- Uso (Supabase MCP execute_sql, o el SQL Editor). Éxito = error con prefijo
-- "RLS_TEST_OK". Fallo = error "FALLO: ...". Datos insuficientes = "RLS_TEST_SKIP".
-- ============================================================
do $$
declare
  v_caso uuid; v_org uuid; v_sustanciador uuid;
  v_otra_org_coord uuid; v_super uuid;
  n int; res text := '';
begin
  -- Sujetos (auto-seleccionados de datos reales)
  select c.id, c.org_id, c.asignado_a into v_caso, v_org, v_sustanciador
  from public.casos c join public.perfiles p on p.id = c.asignado_a
  where p.rol = 'sustanciador' limit 1;

  select id into v_super from public.perfiles where rol = 'superadmin' limit 1;

  if v_caso is null or v_super is null then
    raise exception 'RLS_TEST_SKIP: faltan datos (caso asignado a sustanciador o superadmin)';
  end if;

  select id into v_otra_org_coord from public.perfiles
  where rol = 'coordinador' and org_id is distinct from v_org and org_id is not null limit 1;

  -- 1. Sustanciador asignado -> PERMITE
  perform set_config('request.jwt.claims', json_build_object('sub', v_sustanciador)::text, true);
  execute 'set local role authenticated';
  update public.casos set tipologia_id = tipologia_id where id = v_caso;
  get diagnostics n = row_count; execute 'reset role';
  assert n = 1, format('FALLO: sustanciador asignado deberia PODER, filas=%s', n);
  res := res || 'sustanciador_asignado=1 ';

  -- 2. Coordinador de otra org -> DENIEGA (si existe uno)
  if v_otra_org_coord is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', v_otra_org_coord)::text, true);
    execute 'set local role authenticated';
    update public.casos set tipologia_id = tipologia_id where id = v_caso;
    get diagnostics n = row_count; execute 'reset role';
    assert n = 0, format('FALLO: coordinador de otra org NO deberia poder, filas=%s', n);
    res := res || 'coord_otra_org=0 ';
  end if;

  -- 3. Superadmin -> PERMITE
  perform set_config('request.jwt.claims', json_build_object('sub', v_super)::text, true);
  execute 'set local role authenticated';
  update public.casos set tipologia_id = tipologia_id where id = v_caso;
  get diagnostics n = row_count; execute 'reset role';
  assert n = 1, format('FALLO: superadmin deberia PODER, filas=%s', n);
  res := res || 'superadmin=1 ';

  raise exception 'RLS_TEST_OK: % [rollback intencional]', res;
end $$;
