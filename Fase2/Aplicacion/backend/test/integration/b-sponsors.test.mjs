import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { request, login } from './helper.mjs';
import { assertEmulatorOnly, DEMO_JWT } from '../../dev/safety.mjs';
import { buildFixtures } from '../../dev/fixtures.mjs';

const target = assertEmulatorOnly(process.env, { testOnly: true });
const path = '/api/v1/admin/sponsors';
const fields = ['id', 'name', 'tier', 'monthlyFee', 'benefitsOffered', 'benefitsRedeemed', 'status'];

test('E04: admin obtiene sponsors persistidos e indicadores sin modificar datos', async () => {
  const token = await login();
  const before = await request('GET', path, { token });
  assert.equal(before.status, 200);
  assert.equal(before.json.error, null);
  assert.equal(typeof before.json.meta.requestId, 'string');
  assert.ok(Number.isFinite(Date.parse(before.json.meta.timestamp)));
  const project = sponsor => Object.fromEntries(fields.map(field => [field, sponsor[field]]));
  const expected = buildFixtures().sponsors.map(project).sort((a, b) => a.name.localeCompare(b.name));
  assert.deepEqual(before.json.data.map(project), expected);
  const again = await request('GET', path, { token });
  assert.equal(again.status, 200);
  assert.deepEqual(again.json.data, before.json.data);
});

for (const role of ['finance', 'support', 'ops']) {
  test(`E04: ${role} recibe 403 sin datos`, async () => {
    const token = await login(role);
    const result = await request('GET', path, { token });
    assert.equal(result.status, 403);
    assert.equal(result.json.error.code, 'AUTH_FORBIDDEN');
    assert.equal(result.json.data, null);
  });
}

test('E04: student recibe 403 sin datos', async () => {
  const token = jwt.sign({ sub: 'usr_demo_01', role: 'student', typ: 'access' }, DEMO_JWT, { expiresIn: 60 });
  const result = await request('GET', path, { token });
  assert.equal(result.status, 403);
  assert.equal(result.json.error.code, 'AUTH_FORBIDDEN');
  assert.equal(result.json.data, null);
});

test('E04: sin token devuelve 401 AUTH_REQUIRED', async () => {
  const result = await request('GET', path);
  assert.equal(result.status, 401);
  assert.equal(result.json.error.code, 'AUTH_REQUIRED');
  assert.equal(result.json.data, null);
});

for (const [name, token] of [
  ['inválido', 'invalid-local-test-token'],
  ['expirado', jwt.sign({ sub: 'adm_demo_admin', role: 'admin', typ: 'access' }, DEMO_JWT, { expiresIn: -1 })],
  ['de refresco', jwt.sign({ sub: 'adm_demo_admin', role: 'admin', typ: 'refresh' }, DEMO_JWT, { expiresIn: 60 })],
]) {
  test(`E04: token ${name} devuelve 401 sin datos`, async () => {
    const result = await request('GET', path, { token });
    assert.equal(result.status, 401);
    assert.equal(result.json.data, null);
    assert.equal(result.json.error.code, name === 'expirado' ? 'AUTH_TOKEN_EXPIRED' : 'AUTH_REQUIRED');
  });
}

test('E04: colección vacía devuelve 200 con data=[]', async () => {
  const token = await login();
  // Solo documentos ficticios del proyecto aislado de TESTS; restaurar aun si falla el assert.
  const { default: admin } = await import('firebase-admin');
  const app = admin.initializeApp({ projectId: target.project }, 'b-sponsors-empty');
  const collection = app.firestore().collection('sponsors');
  const snapshots = await collection.get();
  const originals = snapshots.docs.map(doc => ({ id: doc.id, data: doc.data() }));
  try {
    const batch = app.firestore().batch();
    for (const doc of snapshots.docs) batch.delete(doc.ref);
    await batch.commit();
    const result = await request('GET', path, { token });
    assert.equal(result.status, 200);
    assert.equal(result.json.error, null);
    assert.deepEqual(result.json.data, []);
  } finally {
    try {
      const batch = app.firestore().batch();
      for (const doc of originals) batch.set(collection.doc(doc.id), doc.data);
      await batch.commit();
    } finally { await app.delete(); }
  }
});

test('E04: paginación, orden estable, validaciones y metadatos', async () => {
  const token = await login();
  const { default: admin } = await import('firebase-admin');
  const app = admin.initializeApp({ projectId: target.project }, 'b-sponsors-pagination');
  const collection = app.firestore().collection('sponsors');
  const ids = Array.from({ length: 105 }, (_, i) => `spo_e04_page_${String(i).padStart(3, '0')}`);
  try {
    const batch = app.firestore().batch();
    for (const [i, id] of ids.entries()) batch.set(collection.doc(id), {
      name: `Z prueba ${String(Math.floor(i / 2)).padStart(3, '0')}`, tier: 'Bronze',
      monthlyFee: i, benefitsOffered: 0, benefitsRedeemed: 0, status: 'ok',
    });
    await batch.commit();
    const first = await request('GET', path, { token });
    assert.equal(first.status, 200);
    assert.equal(first.json.data.length, 20);
    assert.equal(first.json.meta.pagination.limit, 20);
    assert.equal(first.json.meta.pagination.total, 107);
    assert.equal(typeof first.json.meta.pagination.nextCursor, 'string');

    const seen = [];
    let cursor;
    let pages = 0;
    do {
      const suffix = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
      const result = await request('GET', `${path}${suffix}`, { token });
      assert.equal(result.status, 200);
      seen.push(...result.json.data.map(row => row.id));
      cursor = result.json.meta.pagination.nextCursor;
      assert.ok(++pages <= 6, 'El cursor debe avanzar y terminar');
    } while (cursor);
    assert.equal(seen.length, 107);
    assert.equal(new Set(seen).size, 107);
    const expected = (await collection.get()).docs.map(doc => ({ id: doc.id, ...doc.data() }));
    expected.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    assert.deepEqual(seen, expected.map(row => row.id));
    const second = await request('GET', `${path}?page=2`, { token });
    assert.equal(second.status, 200);
    assert.deepEqual(second.json.data.map(row => row.id), seen.slice(20, 40));
    const max = await request('GET', `${path}?limit=100`, { token });
    assert.equal(max.json.data.length, 100);
    assert.equal(max.json.meta.pagination.limit, 100);
    const end = await request('GET', `${path}?page=999`, { token });
    assert.deepEqual(end.json.data, []);
    assert.equal(end.json.meta.pagination.nextCursor, null);
    const descending = await request('GET', `${path}?sort=-name`, { token });
    assert.deepEqual(descending.json.data.map(row => row.id), [...seen].reverse().slice(0, 20));
    const descendingNext = await request('GET', `${path}?sort=-name&cursor=${encodeURIComponent(descending.json.meta.pagination.nextCursor)}`, { token });
    assert.deepEqual(descendingNext.json.data.map(row => row.id), [...seen].reverse().slice(20, 40));
    const numeric = await request('GET', `${path}?sort=monthlyFee`, { token });
    assert.deepEqual(numeric.json.data.map(row => row.monthlyFee), Array.from({ length: 20 }, (_, i) => i));

    const invalidPositions = [
      { version: 1, offset: -1, sort: 'name' },
      { version: 1, offset: 1.5, sort: 'name' },
      { version: 1, offset: '20', sort: 'name' },
      { version: 1, offset: 20, sort: '-name' },
      { version: 2, offset: 20, sort: 'name' },
    ];
    const invalidQueries = ['limit=0', 'limit=-1', 'limit=101', 'limit=1.5', 'limit=no', 'limit=2&limit=3',
      'page=0', 'page=-1', 'page=1.5', 'page=no', 'page=9007199254740991',
      'cursor=', 'cursor=not-a-cursor', 'page=1&cursor=abc', 'sort=unknown', 'sort=name&sort=id',
      ...invalidPositions.map(position => `cursor=${Buffer.from(JSON.stringify(position)).toString('base64url')}`)];
    for (const query of invalidQueries) {
      const result = await request('GET', `${path}?${query}`, { token });
      assert.equal(result.status, 400, query);
      assert.equal(result.json.error.code, 'VALIDATION_ERROR', query);
      assert.equal(result.json.data, null, query);
    }
  } finally {
    try {
      const cleanup = app.firestore().batch();
      for (const id of ids) cleanup.delete(collection.doc(id));
      await cleanup.commit();
    } finally { await app.delete(); }
  }
});
