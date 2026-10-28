import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { request, login } from './helper.mjs';
import { assertEmulatorOnly, DEMO_JWT } from '../../dev/safety.mjs';
import { db } from '../../src/data/repo.js';

assertEmulatorOnly(process.env, { testOnly: true });
const path = '/api/v1/admin/corrections';
const collection = db.collection('corrections');
const rows = async name => (await db.collection(name).get()).docs
  .map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.id.localeCompare(b.id, 'en'));
const snapshot = () => Promise.all(['corrections', 'users', 'questions'].map(rows));

for (const role of ['admin', 'support']) {
  test(`E17: ${role} obtiene solicitudes con referencias exactas y sin modificar datos`, async () => {
    const token = await login(role);
    const before = await snapshot();
    const result = await request('GET', path, { token });
    assert.equal(result.status, 200);
    assert.equal(result.json.error, null);
    assert.deepEqual(result.json.meta.pagination, { total: 3, limit: 20, nextCursor: null });
    assert.equal(result.json.meta.summary.pending, 1);
    assert.equal(typeof result.json.meta.requestId, 'string');
    assert.ok(Number.isFinite(Date.parse(result.json.meta.timestamp)));
    assert.deepEqual(result.json.data.map(({ user, question, ...row }) => row), before[0]);
    for (const row of result.json.data) {
      const user = before[1].find(u => u.id === row.userId);
      assert.deepEqual(row.user, { id: user.id, name: user.name });
      assert.deepEqual(row.question, before[2].find(q => q.id === row.questionId));
    }
    assert.deepEqual(await snapshot(), before);
  });
}

for (const role of ['finance', 'ops']) {
  test(`E17: ${role} recibe 403 sin solicitudes ni referencias`, async () => {
    const token = await login(role);
    const result = await request('GET', path, { token });
    assert.equal(result.status, 403);
    assert.equal(result.json.error.code, 'AUTH_FORBIDDEN');
    assert.equal(result.json.data, null);
  });
}

test('E17: student recibe 403 y falta de token 401', async () => {
  const token = jwt.sign({ sub: 'usr_demo_01', role: 'student', typ: 'access' }, DEMO_JWT, { expiresIn: 60 });
  for (const [candidate, status, code] of [[token, 403, 'AUTH_FORBIDDEN'], [undefined, 401, 'AUTH_REQUIRED']]) {
    const result = await request('GET', path, { token: candidate });
    assert.equal(result.status, status);
    assert.equal(result.json.error.code, code);
    assert.equal(result.json.data, null);
  }
});

test('E17: tokens inválidos, expirados o de refresco no entregan datos', async () => {
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

test('E17: filtra cada estado y mantiene el contador global de pendientes', async () => {
  const token = await login('support');
  const before = await rows('corrections');
  for (const state of ['pending', 'confirmed', 'rejected']) {
    const result = await request('GET', `${path}?state=${state}`, { token });
    assert.equal(result.status, 200);
    assert.deepEqual(result.json.data.map(({ user, question, ...row }) => row), before.filter(c => c.state === state));
    assert.equal(result.json.meta.pagination.total, 1);
    assert.equal(result.json.meta.summary.pending, 1);
  }
});

test('E17: página y cursor recorren 106 pendientes sin duplicados y ordenan los empates', async () => {
  const token = await login('support');
  const before = await rows('corrections');
  const ids = Array.from({ length: 105 }, (_, i) => `cor_e17_${String(i).padStart(3, '0')}`);
  try {
    const batch = db.batch();
    ids.forEach(id => batch.create(collection.doc(id), {
      userId: 'usr_demo_01', questionId: 'qst_demo_02', state: 'pending',
      reason: 'wrong_answer', comment: 'Prueba E17', createdAt: '2026-01-01T00:00:00.000Z',
    }));
    await batch.commit();
    const seen = [];
    let cursor;
    let pages = 0;
    do {
      const params = new URLSearchParams({ state: 'pending' });
      if (cursor) params.set('cursor', cursor);
      const result = await request('GET', `${path}?${params}`, { token });
      assert.equal(result.status, 200);
      assert.equal(result.json.meta.pagination.total, 106);
      assert.equal(result.json.meta.summary.pending, 106);
      for (const row of result.json.data) {
        assert.equal(row.user.id, row.userId); assert.equal(row.question.id, row.questionId);
      }
      seen.push(...result.json.data.map(c => c.id));
      cursor = result.json.meta.pagination.nextCursor;
      assert.ok(++pages <= 6);
    } while (cursor);
    assert.deepEqual(seen, [...ids, 'cor_demo_01']);
    assert.equal(new Set(seen).size, 106);
    const second = await request('GET', `${path}?state=pending&page=2`, { token });
    assert.deepEqual(second.json.data.map(c => c.id), ids.slice(20, 40));
    const max = await request('GET', `${path}?state=pending&limit=100`, { token });
    assert.equal(max.json.data.length, 100);
    const end = await request('GET', `${path}?state=pending&page=100`, { token });
    assert.deepEqual(end.json.data, []); assert.equal(end.json.meta.pagination.nextCursor, null);
    const descending = await request('GET', `${path}?sort=-id&limit=100`, { token });
    assert.deepEqual(descending.json.data.map(c => c.id), [...ids].reverse().slice(0, 100));
    const incompatible = await request('GET', `${path}?state=confirmed&cursor=${encodeURIComponent(max.json.meta.pagination.nextCursor)}`, { token });
    assert.equal(incompatible.status, 400);
  } finally {
    const cleanup = db.batch(); ids.forEach(id => cleanup.delete(collection.doc(id))); await cleanup.commit();
  }
  assert.deepEqual(await rows('corrections'), before);
});

test('E17: parámetros inválidos se rechazan sin modificar solicitudes', async () => {
  const token = await login();
  const before = await snapshot();
  for (const query of [
    'state=', 'state=other', 'state=pending&state=confirmed', 'state[x]=pending',
    'limit=0', 'limit=-1', 'limit=101', 'limit=1.5', 'limit=2&limit=3',
    'page=0', 'page=no', 'page=1.5', 'page=1000001', 'page=1&cursor=abc',
    'sort=question', 'sort=', 'sort=id&sort=state', 'cursor=', 'cursor=invalid', 'cursor=e30', 'unknown=value',
  ]) {
    const result = await request('GET', `${path}?${query}`, { token });
    assert.equal(result.status, 400, query);
    assert.equal(result.json.error.code, 'VALIDATION_ERROR');
    assert.equal(result.json.data, null);
  }
  assert.deepEqual(await snapshot(), before);
});

test('E17: referencias ausentes o inválidas son null sin romper la cola', async () => {
  const token = await login('support');
  const ref = collection.doc('cor_e17_orphan');
  try {
    for (const links of [
      { userId: 'usr_missing', questionId: 'qst_missing' },
      { userId: null, questionId: 'bad/id' },
    ]) {
      await ref.set({ ...links, state: 'pending', reason: 'wrong_answer', createdAt: '2026-01-01T00:00:00.000Z' });
      const result = await request('GET', path, { token });
      assert.equal(result.status, 200);
      const row = result.json.data.find(c => c.id === ref.id);
      assert.equal(row.user, null); assert.equal(row.question, null);
      assert.equal(row.userId, links.userId); assert.equal(row.questionId, links.questionId);
    }
  } finally { await ref.delete(); }
});

test('E17: soporte ve la pregunta vinculada completa y no recibe campos privados de origen', async () => {
  const token = await login('support');
  const userRef = db.collection('users').doc('usr_e17_private');
  const questionRef = db.collection('questions').doc('qst_e17_structured');
  const ref = collection.doc('cor_e17_private');
  const explanation = { title: 'Título', subject: 'Materia', steps: [{ label: 'Paso', body: 'Texto' }], verification: 'Verificar', keyConcept: 'Clave' };
  try {
    await userRef.create({ name: 'Alumno ficticio privado', email: 'no-exponer@example.test', passwordHash: 'secreto-ficticio-no-exponer' });
    await questionRef.create({ statement: 'Pregunta vinculada E17', explanation, privateSource: 'campo-interno-no-exponer' });
    await ref.create({ userId: userRef.id, questionId: questionRef.id, state: 'pending', reason: 'wrong_answer' });
    const result = await request('GET', path, { token });
    const row = result.json.data.find(c => c.id === ref.id);
    assert.deepEqual(row.user, { id: userRef.id, name: 'Alumno ficticio privado' });
    assert.deepEqual(row.question, { id: questionRef.id, statement: 'Pregunta vinculada E17', explanation });
    assert.doesNotMatch(JSON.stringify(row), /no-exponer/);
    assert.equal((await request('GET', '/api/v1/admin/questions', { token })).status, 403);
  } finally { await Promise.all([ref.delete(), userRef.delete(), questionRef.delete()]); }
});

test('E17: cola vacía responde 200 con data vacía y metadatos en cero', async () => {
  const token = await login();
  const originals = (await collection.get()).docs.map(doc => ({ id: doc.id, data: doc.data() }));
  try {
    const clear = db.batch(); originals.forEach(doc => clear.delete(collection.doc(doc.id))); await clear.commit();
    const result = await request('GET', path, { token });
    assert.equal(result.status, 200); assert.deepEqual(result.json.data, []);
    assert.deepEqual(result.json.meta.pagination, { total: 0, limit: 20, nextCursor: null });
    assert.equal(result.json.meta.summary.pending, 0);
  } finally {
    const restore = db.batch(); originals.forEach(doc => restore.set(collection.doc(doc.id), doc.data)); await restore.commit();
  }
});
