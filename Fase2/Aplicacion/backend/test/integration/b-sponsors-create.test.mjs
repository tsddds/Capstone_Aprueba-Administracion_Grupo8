import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { request, login } from './helper.mjs';
import { assertEmulatorOnly, DEMO_JWT } from '../../dev/safety.mjs';
import { db } from '../../src/data/repo.js';

assertEmulatorOnly(process.env, { testOnly: true });
const path = '/api/v1/admin/sponsors';
const valid = { name: 'Sponsor ficticio E05', tier: 'Silver', monthlyFee: 1800 };
const benefit = { name: 'Cuaderno ficticio', description: 'Solo pruebas', costPlatinum: 5, stock: 20 };
const snapshot = async () => (await db.collection('sponsors').get()).docs
  .map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.id.localeCompare(b.id));

test('E05: admin crea sponsor, persiste los beneficios y puede recuperarlo en el listado', async () => {
  const token = await login();
  const before = await snapshot();
  let id;
  try {
    const result = await request('POST', path, { token, body: {
      ...valid, name: '  Sponsor ficticio E05  ', benefits: [
        { ...benefit, name: '  Cuaderno ficticio  ', description: '  Solo pruebas  ' },
        { name: 'Beneficio agotado', costPlatinum: 0, stock: 0 },
      ],
    } });
    assert.equal(result.status, 201);
    const data = result.json.data;
    id = data.id;
    assert.equal(typeof id, 'string');
    assert.equal(result.json.error, null);
    assert.equal(typeof result.json.meta.requestId, 'string');
    assert.ok(Number.isFinite(Date.parse(result.json.meta.timestamp)));
    assert.deepEqual(data, {
      id, ...valid, benefits: [benefit, { name: 'Beneficio agotado', costPlatinum: 0, stock: 0 }],
      benefitsOffered: 2, benefitsRedeemed: 0, status: 'ok',
    });
    assert.deepEqual((await db.collection('sponsors').doc(id).get()).data(),
      Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'id')));
    const listed = await request('GET', path, { token });
    assert.deepEqual(listed.json.data.find(row => row.id === id), data);
    assert.equal((await snapshot()).length, before.length + 1);
  } finally {
    if (id) await db.collection('sponsors').doc(id).delete();
  }
  assert.deepEqual(await snapshot(), before);
});

test('E05: todos los niveles admiten aporte cero y beneficios opcionales', async () => {
  const token = await login();
  for (const tier of ['Bronze', 'Silver', 'Gold']) {
    let id;
    try {
      const result = await request('POST', path, { token, body: { ...valid, tier, monthlyFee: 0 } });
      assert.equal(result.status, 201);
      id = result.json.data.id;
      assert.equal(result.json.data.tier, tier);
      assert.equal(result.json.data.monthlyFee, 0);
      assert.deepEqual(result.json.data.benefits, []);
      assert.equal(result.json.data.benefitsOffered, 0);
    } finally {
      if (id) await db.collection('sponsors').doc(id).delete();
    }
  }
});

for (const role of ['finance', 'support', 'ops']) {
  test(`E05: ${role} no puede crear sponsors ni modificar datos`, async () => {
    const token = await login(role);
    const before = await snapshot();
    const result = await request('POST', path, { token, body: valid });
    assert.equal(result.status, 403);
    assert.equal(result.json.error.code, 'AUTH_FORBIDDEN');
    assert.equal(result.json.data, null);
    assert.deepEqual(await snapshot(), before);
  });
}

test('E05: student recibe 403 y sin token recibe 401; no se escriben datos', async () => {
  const before = await snapshot();
  const token = jwt.sign({ sub: 'usr_demo_01', role: 'student', typ: 'access' }, DEMO_JWT, { expiresIn: 60 });
  for (const [candidate, status, code] of [[token, 403, 'AUTH_FORBIDDEN'], [undefined, 401, 'AUTH_REQUIRED']]) {
    const result = await request('POST', path, { token: candidate, body: valid });
    assert.equal(result.status, status);
    assert.equal(result.json.error.code, code);
    assert.equal(result.json.data, null);
  }
  assert.deepEqual(await snapshot(), before);
});

test('E05: rechaza cuerpos, campos obligatorios y tipos inválidos sin persistir', async () => {
  const token = await login();
  const before = await snapshot();
  const bodies = [null, [], 'texto', {}, { name: valid.name },
    { tier: 'Bronze', monthlyFee: 10 }, { name: valid.name, monthlyFee: 10 },
    { name: valid.name, tier: 'Bronze' },
    ...['', '   ', 3, false, [], {}, null, 'x'.repeat(201)].map(name => ({ ...valid, name })),
    ...['gold', '', null, 2, ['Gold']].map(tier => ({ ...valid, tier })),
    ...[-1, '1800', '', null, false, [], {}, 1e400].map(monthlyFee => ({ ...valid, monthlyFee })),
    { ...valid, benefitsOffered: 500 }, { ...valid, id: 'spo_demo_01' },
    { ...valid, benefitsRedeemed: 999 }, { ...valid, status: 'down' },
  ];
  for (const body of bodies) {
    const result = await request('POST', path, { token, body });
    assert.equal(result.status, 400, JSON.stringify(body));
    assert.equal(result.json.error.code, 'VALIDATION_ERROR');
    assert.equal(result.json.data, null);
    assert.ok(Array.isArray(result.json.error.details));
  }
  assert.deepEqual(await snapshot(), before);
});

test('E05: valida cada beneficio antes de escribir el sponsor completo', async () => {
  const token = await login();
  const before = await snapshot();
  const invalidBenefits = [null, 'beneficio', {}, [null], ['texto'], [[]], [{}],
    ...['', '   ', false, 2, null, 'x'.repeat(201)].map(name => [{ ...benefit, name }]),
    ...[null, 5, [], {}, 'x'.repeat(2001)].map(description => [{ ...benefit, description }]),
    ...['costPlatinum', 'stock'].flatMap(key => [undefined, null, -1, 1.5, '5', false, [], {}, Number.MAX_SAFE_INTEGER + 1]
      .map(value => [{ ...benefit, [key]: value }])),
    [{ ...benefit, active: true }], [{ ...benefit, id: 'ben_ajeno' }],
    [benefit, { ...benefit, stock: -1 }],
  ];
  for (const benefits of invalidBenefits) {
    const result = await request('POST', path, { token, body: { ...valid, benefits } });
    assert.equal(result.status, 400, JSON.stringify(benefits));
    assert.equal(result.json.error.code, 'VALIDATION_ERROR');
    assert.equal(result.json.data, null);
    assert.match(result.json.error.field, /^benefits/);
  }
  assert.deepEqual(await snapshot(), before);
});
