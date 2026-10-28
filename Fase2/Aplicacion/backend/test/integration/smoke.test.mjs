import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { request, login } from './helper.mjs';
import { seed } from '../../dev/seed.mjs';
import { assertEmulatorOnly } from '../../dev/safety.mjs';

test('El proceso responde health; no equivale a aceptación funcional', async () => {
  const r = await request('GET', '/health'); assert.equal(r.status, 200); assert.equal(r.json.status, 'ok');
});
test('Cuatro roles pueden iniciar sesión con cuentas exclusivas del emulador', async () => {
  for (const role of ['admin', 'support', 'finance', 'ops']) await login(role);
});
test('Las 26 operaciones protegidas rechazan solicitudes sin token', async () => {
  const endpoints = JSON.parse(await readFile(new URL('../../../docs/endpoints.json', import.meta.url), 'utf8')).filter(e => e.id !== 'E01');
  for (const e of endpoints) {
    const path = e.path.replace('{id}', 'missing').replace('{name}', 'missing');
    const r = await request(e.method, `/api/v1${path}`);
    assert.equal(r.status, 401, `${e.id} ${e.method} ${path}`);
  }
});
test('Lecturas de fixtures están disponibles con admin', async () => {
  const token = await login();
  for (const path of ['/users', '/tickets', '/questions', '/corrections', '/sponsors', '/plans', '/features', '/platforms']) {
    const r = await request('GET', `/api/v1/admin${path}`, { token });
    assert.equal(r.status, 200, path); assert.ok(r.json.data.length > 0, path);
  }
  for (const [path, configured] of [['/services', process.env.OPS_SERVICES_JSON], ['/containers', process.env.OPS_BRIDGE_URL]]) {
    const r = await request('GET', `/api/v1/admin${path}`, { token });
    assert.equal(r.status, configured ? 200 : 503, path);
    if (configured) assert.ok(r.json.data.length > 0, path);
    else assert.equal(r.json.data, null, 'Sin observaciones reales no presentar fixtures como servicio operativo');
  }
});
test('Escritura y lectura de un sponsor en la base de tests', async () => {
  const token = await login();
  const created = await request('POST', '/api/v1/admin/sponsors', { token, body: { name: 'Sponsor smoke ficticio', tier: 'Bronze', monthlyFee: 10 } });
  assert.equal(created.status, 201);
  const id = created.json.data.id;
  try {
    const rows = await request('GET', '/api/v1/admin/sponsors', { token });
    assert.ok(rows.json.data.some(r => r.id === id));
  } finally { await request('DELETE', `/api/v1/admin/sponsors/${id}`, { token }); }
});
test('Repetir seed conserva los registros existentes y no duplica fixtures', async () => {
  const result = await seed(assertEmulatorOnly(process.env, { testOnly: true }));
  assert.equal(result.inserted, 0); assert.ok(result.existing > 0);
});

test('Precio de plan cambia por API y se recupera en otra consulta', async () => {
  const token = await login();
  const initial = await request('GET', '/api/v1/admin/plans', { token });
  const before = initial.json.data.find(p => p.id === 'pl_demo_empty');
  assert.equal(before.price, 1000);
  try {
    const saved = await request('PUT', '/api/v1/admin/plans/pl_demo_empty', { token, body: { price: 1250 } });
    assert.equal(saved.status, 200);
    const after = await request('GET', '/api/v1/admin/plans', { token });
    assert.equal(after.json.data.find(p => p.id === before.id).price, 1250);
  } finally {
    const restored = await request('PUT', '/api/v1/admin/plans/pl_demo_empty', { token, body: { price: before.price } });
    assert.equal(restored.status, 200);
  }
});
