import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { request, login } from './helper.mjs';
import { assertEmulatorOnly, DEMO_JWT } from '../../dev/safety.mjs';
import { db } from '../../src/data/repo.js';

assertEmulatorOnly(process.env, { testOnly: true });
const path = '/api/v1/admin/questions';
const collection = db.collection('questions');
const snapshot = async () => (await collection.get()).docs
  .map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.id.localeCompare(b.id, 'en'));

test('E19: admin obtiene preguntas persistidas con metadatos y sin alterar datos', async () => {
  const token = await login();
  const before = await snapshot();
  const result = await request('GET', path, { token });
  assert.equal(result.status, 200);
  assert.equal(result.json.error, null);
  assert.deepEqual(result.json.data, before);
  assert.deepEqual(result.json.meta.pagination, { total: 3, limit: 20, nextCursor: null });
  assert.deepEqual(result.json.meta.summary, { published: 1, draft: 1, tests: 2 });
  assert.deepEqual(result.json.meta.filters.testIds, ['lectora', 'm1', 'm2', 'cien', 'hist', 'b1']);
  assert.deepEqual(result.json.meta.filters.axes, ['Números', 'Álgebra']);
  assert.equal(typeof result.json.meta.requestId, 'string');
  assert.ok(Number.isFinite(Date.parse(result.json.meta.timestamp)));
  assert.deepEqual(await snapshot(), before);
});

test('E19: filtros individuales y combinados y resultado vacío mantienen totales correctos', async () => {
  const token = await login();
  const before = await snapshot();
  for (const filters of [
    { testId: 'm1' }, { axis: 'Álgebra' }, { difficulty: 'd2' }, { status: 'flagged' },
    { testId: 'm1', axis: 'Álgebra', difficulty: 'd1', status: 'published' },
    { testId: 'hist' }, { difficulty: 'd4' }, { status: 'retired' }, { axis: 'Sin coincidencias' },
  ]) {
    const expected = before.filter(row => Object.entries(filters).every(([key, value]) => row[key] === value));
    const result = await request('GET', `${path}?${new URLSearchParams(filters)}`, { token });
    assert.equal(result.status, 200);
    assert.deepEqual(result.json.data, expected);
    assert.equal(result.json.meta.pagination.total, expected.length);
    assert.equal(result.json.meta.pagination.nextCursor, null);
    assert.deepEqual(result.json.meta.summary, {
      published: expected.filter(q => q.status === 'published').length,
      draft: expected.filter(q => q.status === 'draft').length,
      tests: new Set(expected.map(q => q.testId)).size,
    });
    assert.deepEqual(result.json.meta.filters.axes, ['Números', 'Álgebra']);
  }
  assert.deepEqual(await snapshot(), before);
});

for (const role of ['finance', 'support', 'ops']) {
  test(`E19: ${role} recibe 403 sin preguntas`, async () => {
    const token = await login(role);
    const result = await request('GET', path, { token });
    assert.equal(result.status, 403);
    assert.equal(result.json.error.code, 'AUTH_FORBIDDEN');
    assert.equal(result.json.data, null);
  });
}

test('E19: student recibe 403 y falta de token 401', async () => {
  const token = jwt.sign({ sub: 'usr_demo_01', role: 'student', typ: 'access' }, DEMO_JWT, { expiresIn: 60 });
  for (const [candidate, status, code] of [[token, 403, 'AUTH_FORBIDDEN'], [undefined, 401, 'AUTH_REQUIRED']]) {
    const result = await request('GET', path, { token: candidate });
    assert.equal(result.status, status);
    assert.equal(result.json.error.code, code);
    assert.equal(result.json.data, null);
  }
});

test('E19: tokens inválidos, expirados y de refresco no entregan preguntas', async () => {
  for (const [token, code] of [
    ['invalid-token', 'AUTH_REQUIRED'],
    [jwt.sign({ sub: 'adm_demo_admin', role: 'admin', typ: 'access' }, DEMO_JWT, { expiresIn: -1 }), 'AUTH_TOKEN_EXPIRED'],
    [jwt.sign({ sub: 'adm_demo_admin', role: 'admin', typ: 'refresh' }, DEMO_JWT, { expiresIn: 60 }), 'AUTH_REQUIRED'],
  ]) {
    const result = await request('GET', path, { token });
    assert.equal(result.status, 401);
    assert.equal(result.json.error.code, code);
    assert.equal(result.json.data, null);
  }
});

test('E19: recorre 105 preguntas sin duplicados, orden estable y resumen de todas las páginas', async () => {
  const token = await login();
  const before = await snapshot();
  const ids = Array.from({ length: 105 }, (_, i) => `qst_e19_${String(i).padStart(3, '0')}`);
  try {
    const batch = db.batch();
    ids.forEach((id, i) => batch.create(collection.doc(id), {
      testId: 'hist', axis: 'E19 axis', difficulty: 'd4',
      statement: `Empate ${String(Math.floor(i / 2)).padStart(3, '0')}`,
      status: ['published', 'draft', 'flagged', 'retired'][i % 4],
    }));
    await batch.commit();
    const first = await request('GET', `${path}?axis=E19%20axis`, { token });
    assert.equal(first.status, 200);
    assert.equal(first.json.data.length, 20);
    assert.equal(first.json.meta.pagination.total, 105);
    assert.deepEqual(first.json.meta.summary, { published: 27, draft: 26, tests: 1 });
    assert.ok(first.json.meta.filters.axes.includes('E19 axis'));
    const seen = [];
    let cursor;
    let pages = 0;
    do {
      const params = new URLSearchParams({ axis: 'E19 axis', sort: 'statement' });
      if (cursor) params.set('cursor', cursor);
      const result = await request('GET', `${path}?${params}`, { token });
      assert.equal(result.status, 200);
      seen.push(...result.json.data.map(q => q.id));
      cursor = result.json.meta.pagination.nextCursor;
      assert.ok(++pages <= 6);
    } while (cursor);
    assert.deepEqual(seen, ids);
    assert.equal(new Set(seen).size, 105);
    const second = await request('GET', `${path}?axis=E19%20axis&sort=statement&page=2`, { token });
    assert.deepEqual(second.json.data.map(q => q.id), ids.slice(20, 40));
    const max = await request('GET', `${path}?axis=E19%20axis&limit=100`, { token });
    assert.equal(max.json.data.length, 100);
    const end = await request('GET', `${path}?axis=E19%20axis&page=100`, { token });
    assert.deepEqual(end.json.data, []);
    assert.equal(end.json.meta.pagination.total, 105);
    assert.equal(end.json.meta.pagination.nextCursor, null);
    const descending = await request('GET', `${path}?axis=E19%20axis&sort=-id&limit=100`, { token });
    assert.deepEqual(descending.json.data.map(q => q.id), [...ids].reverse().slice(0, 100));
    const next = max.json.meta.pagination.nextCursor;
    for (const params of [
      { axis: 'Álgebra', cursor: next }, { axis: 'E19 axis', status: 'draft', cursor: next },
      { axis: 'E19 axis', sort: '-id', cursor: next },
    ]) {
      assert.equal((await request('GET', `${path}?${new URLSearchParams(params)}`, { token })).status, 400);
    }
  } finally {
    const cleanup = db.batch();
    ids.forEach(id => cleanup.delete(collection.doc(id)));
    await cleanup.commit();
  }
  assert.deepEqual(await snapshot(), before);
});

test('E19: rechaza filtros, orden y paginación inválidos sin modificar el banco', async () => {
  const token = await login();
  const before = await snapshot();
  for (const query of [
    'testId=unknown', 'testId=', 'testId=m1&testId=m2', 'testId[x]=m1',
    'axis=', 'axis=%20', 'axis=a&axis=b', `axis=${'x'.repeat(201)}`,
    'difficulty=d5', 'difficulty=1', 'difficulty=', 'difficulty=d1&difficulty=d2',
    'status=archived', 'status=', 'status=published&status=draft',
    'limit=0', 'limit=-1', 'limit=101', 'limit=1.5', 'limit=2&limit=3',
    'page=0', 'page=no', 'page=1.5', 'page=1000001', 'page=1&cursor=abc',
    'sort=explanation', 'sort=', 'sort=id&sort=status', 'cursor=', 'cursor=invalid',
    'cursor=e30', 'unknown=value',
  ]) {
    const result = await request('GET', `${path}?${query}`, { token });
    assert.equal(result.status, 400, query);
    assert.equal(result.json.error.code, 'VALIDATION_ERROR');
    assert.equal(result.json.data, null);
  }
  assert.deepEqual(await snapshot(), before);
});

test('E19: devuelve explanation de texto u objeto sin transformar ni perder sus campos', async () => {
  const token = await login();
  const ref = collection.doc('qst_e19_explanation');
  const explanation = {
    title: 'Explicación ficticia', subject: 'Matemática',
    steps: [{ label: 'Paso 1', body: 'Dividir ambos lados.' }],
    verification: 'Reemplazar el resultado.', keyConcept: 'Ecuación',
  };
  const data = { testId: 'm1', axis: 'Álgebra', difficulty: 'd1', status: 'draft', explanation };
  await ref.create(data);
  try {
    const result = await request('GET', `${path}?testId=m1`, { token });
    assert.equal(result.status, 200);
    assert.deepEqual(result.json.data.find(q => q.id === ref.id).explanation, explanation);
    assert.equal(typeof result.json.data.find(q => q.id === 'qst_demo_01').explanation, 'string');
    assert.deepEqual((await ref.get()).data(), data);
  } finally { await ref.delete(); }
});
