const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');

// Execute the actual route handlers with isolated Auth, DB and AI boundaries.
// These tests never connect to Supabase or send requests to Claude.
function load(file, mocks = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  }}).outputText;
  const module = { exports: {} };
  const requireMock = (name) => {
    if (name in mocks) return mocks[name];
    if (name === 'next/server') return { NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) }};
    if (name === 'next/headers') return { cookies: () => ({ getAll: () => [], set() {} }) };
    if (name === '@/lib/auth/roles') return load('lib/auth/roles.ts');
    throw new Error(`Unmocked dependency: ${name}`);
  };
  vm.runInNewContext(code, { module, exports: module.exports, require: requireMock, process: { env: {} }, console });
  return module.exports;
}
function database(resolve, user = { id: 'worker' }) {
  const calls = [];
  return { calls, auth: { getUser: async () => ({ data: { user } }) }, from(table) {
    const call = { table, operation: 'select', filters: [], values: null };
    calls.push(call);
    const q = {};
    for (const method of ['select', 'update', 'insert', 'upsert', 'eq', 'not', 'order', 'limit']) {
      q[method] = (...args) => {
        if (['update', 'insert', 'upsert'].includes(method)) { call.operation = method; call.values = args[0]; }
        if (['eq', 'not'].includes(method)) call.filters.push([method, ...args]);
        return q;
      };
    }
    const result = () => Promise.resolve(resolve(call));
    q.single = result; q.maybeSingle = result;
    q.then = (yes, no) => result().then(yes, no);
    return q;
  }};
}
const request = (body) => ({ json: async () => body });
const typology = '11111111-1111-4111-8111-111111111111';

for (const scenario of [
  { name: 'assigned worker can edit a case created by someone else', role: 'sustanciador', org: 'A', assigned: 'worker', status: 200 },
  { name: 'a sustanciador who is neither assigned nor creator cannot edit', role: 'sustanciador', org: 'A', assigned: 'other', status: 404 },
  { name: 'original creator who is no longer assigned cannot edit', role: 'sustanciador', org: 'A', assigned: 'other', user: 'original', status: 404 },
  { name: 'inactive profile is rejected before updating', role: 'sustanciador', org: 'A', assigned: 'worker', activo: false, status: 403 },
  { name: 'coordinator can edit own organization', role: 'coordinador', org: 'A', assigned: 'other', status: 200 },
  { name: 'coordinator cannot edit another organization', role: 'coordinador', org: 'B', assigned: 'other', status: 404 },
  { name: 'superadmin retains platform access', role: 'superadmin', org: 'B', assigned: 'other', status: 200 },
]) test(scenario.name, async () => {
  const row = { id: 'case', org_id: scenario.org, asignado_a: scenario.assigned, abogado_id: 'original' };
  const db = database(c => {
    if (c.table === 'perfiles') return { data: { rol: scenario.role, org_id: 'A', activo: scenario.activo ?? true } };
    const matches = c.filters.every(([, key, value]) => row[key] === value);
    if (matches) row.tipologia_id = c.values.tipologia_id;
    return { data: matches ? { id: row.id } : null, error: null };
  }, { id: scenario.user ?? 'worker' });
  const route = load('app/api/casos/[id]/route.ts', { '@/lib/supabase/server': { createClient: () => db } });
  const response = await route.PATCH(request({ tipologia_id: typology }), { params: { id: 'case' } });
  assert.equal(response.status, scenario.status);
  assert.equal(row.tipologia_id, scenario.status === 200 ? typology : undefined);
});

test('assigned worker can clear the typology with null', async () => {
  const row = { id: 'case', org_id: 'A', asignado_a: 'worker', abogado_id: 'original', tipologia_id: 'old' };
  const db = database(c => {
    if (c.table === 'perfiles') return { data: { rol: 'sustanciador', org_id: 'A', activo: true } };
    const matches = c.filters.every(([, key, value]) => row[key] === value);
    if (matches) row.tipologia_id = c.values.tipologia_id;
    return { data: matches ? { id: row.id } : null, error: null };
  });
  const route = load('app/api/casos/[id]/route.ts', { '@/lib/supabase/server': { createClient: () => db } });
  const response = await route.PATCH(request({ tipologia_id: null }), { params: { id: 'case' } });
  assert.equal(response.status, 200);
  assert.equal(row.tipologia_id, null);
});

test('unauthenticated edits and invalid typologies are rejected before writing', async () => {
  for (const [user, body, status] of [[null, { tipologia_id: typology }, 401], [{ id: 'worker' }, { tipologia_id: 123 }, 400], [{ id: 'worker' }, null, 400]]) {
    const db = database(() => { throw new Error('Unexpected DB query'); }, user);
    const route = load('app/api/casos/[id]/route.ts', { '@/lib/supabase/server': { createClient: () => db } });
    assert.equal((await route.PATCH(request(body), { params: { id: 'case' } })).status, status);
    assert.equal(db.calls.length, 0);
  }
});

test('existing accounts, including pending accounts in another org, are never deleted', async () => {
  for (const code of ['email_exists', 'user_already_exists']) {
    const db = database(() => ({ data: { rol: 'coordinador', org_id: 'A' } }));
    let creates = 0;
    db.auth.admin = {
      createUser: async () => { creates++; return { data: {}, error: { code } }; },
      deleteUser: () => { throw new Error('Account deletion is forbidden'); },
      listUsers: () => { throw new Error('Global enumeration is unnecessary'); },
    };
    const route = load('app/api/equipo/route.ts', {
      '@supabase/ssr': { createServerClient: () => db },
      '@/lib/auth/password': { generarPassword: () => 'test-only' },
    });
    assert.equal((await route.POST(request({ email: 'pending@example.test' }))).status, 409);
    assert.equal(creates, 1);
    assert.equal(db.calls.filter(c => c.operation !== 'select').length, 0);
  }
});

test('new accounts are created in the caller organization', async () => {
  const db = database(c => c.operation === 'select' ? { data: { rol: 'coordinador', org_id: 'A' } } : { error: null });
  db.auth.admin = { createUser: async (input) => {
    assert.equal(input.user_metadata.org_id, 'A');
    assert.equal(input.user_metadata.rol, 'sustanciador');
    return { data: { user: { id: 'new-user' } }, error: null };
  }};
  const route = load('app/api/equipo/route.ts', {
    '@supabase/ssr': { createServerClient: () => db },
    '@/lib/auth/password': { generarPassword: () => 'test-only' },
  });
  assert.equal((await route.POST(request({ email: 'new@example.test', rol: 'superadmin' }))).status, 200);
  assert.equal(db.calls.find(c => c.operation === 'upsert').values.org_id, 'A');
});

for (const draft of [true, false]) test(draft ? 'saving draft preserves queue state and skips AI' : 'generation still completes queued cases', async () => {
  let aiCalls = 0;
  const db = database(c => ({ data: c.table === 'casos' ? { id: 'case' } : { id: 'ficha' }, error: null }));
  const route = load('app/api/generar-ficha/route.ts', {
    '@supabase/ssr': { createServerClient: () => db },
    '@anthropic-ai/sdk': class { messages = { create: async () => { aiCalls++; return { content: [{ type: 'text', text: '{}' }] }; } }; },
    '@/lib/ficha/construir-contexto': { construirContexto: async () => ({ actos: [], traslado: null, directriz: null }) },
    '@/lib/ficha/construir-prompt-v2': {
      construirPromptV2: () => 'test prompt', parsearRespuestaV2: () => ({}), planificarSecciones: () => [], PROMPT_VERSION: 'test',
    },
  });
  const response = await route.POST(request({ caso_id: 'case', params: {}, solo_guardar: draft }));
  assert.equal(response.status, 200);
  assert.equal(db.calls.find(c => c.table === 'fichas_conciliacion' && c.operation === 'insert').values.estado, 'borrador');
  assert.equal(db.calls.filter(c => c.table === 'casos' && c.values?.cola_estado === 'completado').length, draft ? 0 : 1);
  assert.equal(aiCalls, draft ? 0 : 1);
});
