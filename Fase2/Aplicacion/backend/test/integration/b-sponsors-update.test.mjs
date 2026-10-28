import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { request, login } from './helper.mjs';
import { assertEmulatorOnly, DEMO_JWT } from '../../dev/safety.mjs';
import { db } from '../../src/data/repo.js';

assertEmulatorOnly(process.env, { testOnly: true });
const path = '/api/v1/admin/sponsors';
const initial = {
  name: 'Sponsor ficticio E06', tier: 'Silver', monthlyFee: 1800, status: 'ok',
  benefitsOffered: 1, benefitsRedeemed: 7,
  benefits: [{ name: 'Cuaderno', description: 'Solo pruebas', costPlatinum: 5, stock: 20 }],
};
const snapshot = async () => (await db.collection('sponsors').get()).docs
  .map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.id.localeCompare(b.id));
async function withSponsor(fn) {
  const ref = db.collection('sponsors').doc('spo_e06_update');
  await ref.create(initial);
  try { await fn(ref); }
  finally { await ref.delete(); }
}

test('E06: admin cambia aporte y estado, persiste y conserva los campos omitidos', async () => {
  const token = await login();
  await withSponsor(async ref => {
    const patch = { monthlyFee: 2500, status: 'deg' };
    const result = await request('PATCH', `${path}/${ref.id}`, { token, body: patch });
    assert.equal(result.status, 200);
    assert.equal(result.json.error, null);
    assert.equal(typeof result.json.meta.requestId, 'string');
    assert.ok(Number.isFinite(Date.parse(result.json.meta.timestamp)));
    assert.deepEqual(result.json.data, { id: ref.id, ...initial, ...patch });
    assert.deepEqual((await ref.get()).data(), { ...initial, ...patch });
    const listed = await request('GET', path, { token });
    assert.deepEqual(listed.json.data.find(row => row.id === ref.id), result.json.data);
  });
});

test('E06: permite editar solo el nombre sin exigir otros campos', async () => {
  const token = await login();
  await withSponsor(async ref => {
    const result = await request('PATCH', `${path}/${ref.id}`, { token, body: { name: '  Nuevo nombre  ' } });
    assert.equal(result.status, 200);
    assert.deepEqual((await ref.get()).data(), { ...initial, name: 'Nuevo nombre' });
  });
});

test('E06: admite niveles y estados válidos, aporte cero y total cero', async () => {
  const token = await login();
  await withSponsor(async ref => {
    for (const [tier, status] of [['Bronze', 'down'], ['Gold', 'deg'], ['Silver', 'ok']]) {
      const patch = { name: 'Sponsor editado', tier, status, monthlyFee: 0, benefitsOffered: 0 };
      const result = await request('PATCH', `${path}/${ref.id}`, { token, body: patch });
      assert.equal(result.status, 200);
      assert.deepEqual(result.json.data, { id: ref.id, ...initial, ...patch });
      assert.deepEqual((await ref.get()).data(), { ...initial, ...patch });
    }
  });
});

for (const role of ['finance', 'support', 'ops']) {
  test(`E06: ${role} recibe 403 y no altera sponsors`, async () => {
    const token = await login(role);
    const before = await snapshot();
    const result = await request('PATCH', `${path}/spo_demo_01`, { token, body: { monthlyFee: 99 } });
    assert.equal(result.status, 403);
    assert.equal(result.json.error.code, 'AUTH_FORBIDDEN');
    assert.equal(result.json.data, null);
    assert.deepEqual(await snapshot(), before);
  });
}

test('E06: student recibe 403 y sin token recibe 401 sin modificar datos', async () => {
  const before = await snapshot();
  const token = jwt.sign({ sub: 'usr_demo_01', role: 'student', typ: 'access' }, DEMO_JWT, { expiresIn: 60 });
  for (const [candidate, status, code] of [[token, 403, 'AUTH_FORBIDDEN'], [undefined, 401, 'AUTH_REQUIRED']]) {
    const result = await request('PATCH', `${path}/spo_demo_01`, { token: candidate, body: { status: 'down' } });
    assert.equal(result.status, status);
    assert.equal(result.json.error.code, code);
    assert.equal(result.json.data, null);
  }
  assert.deepEqual(await snapshot(), before);
});

test('E06: valores inválidos y campos ajenos se rechazan sin actualizaciones parciales', async () => {
  const token = await login();
  await withSponsor(async ref => {
    const before = await snapshot();
    const bodies = [null, [], 'texto', {},
      ...['', '   ', null, false, 123, {}, [], 'x'.repeat(201)].map(name => ({ name })),
      ...['gold', '', null, 1, ['Gold']].map(tier => ({ tier })),
      ...['active', '', null, false, {}].map(status => ({ status })),
      ...[-1, '10', '', null, false, [], {}, Infinity].map(monthlyFee => ({ monthlyFee })),
      ...[-1, 1.5, '1', '', null, false, [], {}, Number.MAX_SAFE_INTEGER + 1].map(benefitsOffered => ({ benefitsOffered })),
      { id: 'otro' }, { benefits: [] }, { benefitsRedeemed: 0 },
      { monthlyFee: 999, status: 'incorrecto' },
      { name: 'No debe guardarse', benefitsRedeemed: 0 },
    ];
    for (const body of bodies) {
      const result = await request('PATCH', `${path}/${ref.id}`, { token, body });
      assert.equal(result.status, 400, JSON.stringify(body));
      assert.equal(result.json.error.code, 'VALIDATION_ERROR');
      assert.equal(result.json.data, null);
      assert.ok(Array.isArray(result.json.error.details));
    }
    assert.deepEqual(await snapshot(), before);
  });
});

test('E06: sponsor inexistente devuelve 404 y los identificadores inválidos 400; no crea registros', async () => {
  const token = await login();
  const before = await snapshot();
  const missing = await request('PATCH', `${path}/spo_e06_missing`, { token, body: { monthlyFee: 1 } });
  assert.equal(missing.status, 404);
  assert.equal(missing.json.error.code, 'NOT_FOUND');
  assert.equal(missing.json.data, null);
  for (const id of ['invalid.id', 'x'.repeat(129), '%20']) {
    const result = await request('PATCH', `${path}/${id}`, { token, body: { status: 'ok' } });
    assert.equal(result.status, 400);
    assert.equal(result.json.error.code, 'VALIDATION_ERROR');
    assert.equal(result.json.error.field, 'id');
  }
  assert.deepEqual(await snapshot(), before);
});
