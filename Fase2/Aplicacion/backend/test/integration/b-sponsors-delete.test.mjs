import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { request, login } from './helper.mjs';
import { assertEmulatorOnly, DEMO_JWT } from '../../dev/safety.mjs';
import { db } from '../../src/data/repo.js';

assertEmulatorOnly(process.env, { testOnly: true });
const path = '/api/v1/admin/sponsors';
const initial = {
  name: 'Sponsor ficticio E07', tier: 'Silver', monthlyFee: 2500, status: 'ok',
  benefitsOffered: 2, benefitsRedeemed: 7,
  benefits: [
    { id: 'ben_e07_a', name: 'Cuaderno', costPlatinum: 5, stock: 20, active: true },
    { id: 'ben_e07_b', name: 'Agotado', costPlatinum: 2, stock: 0, active: false },
  ],
};
const snapshot = async () => (await db.collection('sponsors').get()).docs
  .map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.id.localeCompare(b.id));
async function withSponsor(fn, data = initial) {
  const ref = db.collection('sponsors').doc('spo_e07_delete');
  await ref.create(data);
  try { await fn(ref); }
  finally { await ref.delete(); }
}

test('E07: admin recibe 204, retira sponsor y beneficios y conserva historia y referencias', async () => {
  const token = await login();
  await withSponsor(async ref => {
    // Referencia histórica ficticia: esta prueba no implementa el API de canjes.
    const historyRef = db.collection('redemptions').doc('rdm_e07_preserve');
    const history = { sponsorId: ref.id, benefitId: 'ben_e07_a', platinumSpent: 5, couponCode: 'SOLO-PRUEBAS' };
    await historyRef.create(history);
    try {
      const before = await request('GET', path, { token });
      const result = await request('DELETE', `${path}/${ref.id}`, { token });
      assert.equal(result.status, 204);
      assert.equal(result.json, null);
      const stored = (await ref.get()).data();
      assert.ok(stored.deletedAt.toMillis() > 0);
      assert.deepEqual({ ...stored, deletedAt: undefined }, {
        ...initial, status: 'down', benefitsOffered: 0, deletedAt: undefined,
        benefits: initial.benefits.map(b => ({ ...b, active: false })),
      });
      assert.deepEqual((await historyRef.get()).data(), history);
      const after = await request('GET', path, { token });
      assert.equal(after.status, 200);
      assert.deepEqual(after.json.data, before.json.data.filter(s => s.id !== ref.id));
      assert.equal(after.json.meta.pagination.total, before.json.meta.pagination.total - 1);
      assert.equal(after.json.data.reduce((sum, s) => sum + s.monthlyFee, 0),
        before.json.data.reduce((sum, s) => sum + s.monthlyFee, 0) - initial.monthlyFee);
      const ids = [];
      let cursor;
      do {
        const query = new URLSearchParams({ limit: '1' });
        if (cursor) query.set('cursor', cursor);
        const page = await request('GET', `${path}?${query}`, { token });
        assert.equal(page.status, 200);
        ids.push(...page.json.data.map(row => row.id));
        cursor = page.json.meta.pagination.nextCursor;
        assert.ok(ids.length <= after.json.meta.pagination.total);
      } while (cursor);
      assert.deepEqual(ids, after.json.data.map(s => s.id));
    } finally { await historyRef.delete(); }
  });
});

test('E07: baja sin beneficios devuelve 204 y repetirla devuelve 404 sin alterar la baja', async () => {
  const token = await login();
  await withSponsor(async ref => {
    const first = await request('DELETE', `${path}/${ref.id}`, { token });
    assert.equal(first.status, 204);
    assert.equal(first.json, null);
    const before = (await ref.get()).data();
    const second = await request('DELETE', `${path}/${ref.id}`, { token });
    assert.equal(second.status, 404);
    assert.equal(second.json.error.code, 'NOT_FOUND');
    assert.equal(second.json.data, null);
    assert.deepEqual((await ref.get()).data(), before);
  }, { name: 'Sin beneficios', tier: 'Bronze', monthlyFee: 0, status: 'ok', benefitsRedeemed: 0 });
});

test('E07: dos bajas simultáneas producen un 204 y un 404', async () => {
  const token = await login();
  await withSponsor(async ref => {
    const results = await Promise.all([
      request('DELETE', `${path}/${ref.id}`, { token }),
      request('DELETE', `${path}/${ref.id}`, { token }),
    ]);
    assert.deepEqual(results.map(r => r.status).sort(), [204, 404]);
    assert.ok((await ref.get()).data().deletedAt);
  });
});

test('E07: PATCH no reactiva ni modifica un sponsor dado de baja', async () => {
  const token = await login();
  await withSponsor(async ref => {
    assert.equal((await request('DELETE', `${path}/${ref.id}`, { token })).status, 204);
    const before = (await ref.get()).data();
    const result = await request('PATCH', `${path}/${ref.id}`, { token, body: { status: 'ok', monthlyFee: 99 } });
    assert.equal(result.status, 404);
    assert.equal(result.json.error.code, 'NOT_FOUND');
    assert.deepEqual((await ref.get()).data(), before);
  });
});

for (const role of ['finance', 'support', 'ops']) {
  test(`E07: ${role} recibe 403 y conserva sponsor y beneficios`, async () => {
    const token = await login(role);
    const before = await snapshot();
    const result = await request('DELETE', `${path}/spo_demo_01`, { token });
    assert.equal(result.status, 403);
    assert.equal(result.json.error.code, 'AUTH_FORBIDDEN');
    assert.equal(result.json.data, null);
    assert.deepEqual(await snapshot(), before);
  });
}

test('E07: student recibe 403 y sin token recibe 401 sin alterar datos', async () => {
  const before = await snapshot();
  const token = jwt.sign({ sub: 'usr_demo_01', role: 'student', typ: 'access' }, DEMO_JWT, { expiresIn: 60 });
  for (const [candidate, status, code] of [[token, 403, 'AUTH_FORBIDDEN'], [undefined, 401, 'AUTH_REQUIRED']]) {
    const result = await request('DELETE', `${path}/spo_demo_01`, { token: candidate });
    assert.equal(result.status, status);
    assert.equal(result.json.error.code, code);
    assert.equal(result.json.data, null);
  }
  assert.deepEqual(await snapshot(), before);
});

test('E07: inexistente devuelve 404 e identificadores inválidos 400 sin modificar datos', async () => {
  const token = await login();
  const before = await snapshot();
  const missing = await request('DELETE', `${path}/spo_e07_missing`, { token });
  assert.equal(missing.status, 404);
  assert.equal(missing.json.error.code, 'NOT_FOUND');
  assert.equal(missing.json.data, null);
  for (const id of ['invalid.id', 'x'.repeat(129), '%20']) {
    const result = await request('DELETE', `${path}/${id}`, { token });
    assert.equal(result.status, 400);
    assert.equal(result.json.error.code, 'VALIDATION_ERROR');
    assert.equal(result.json.error.field, 'id');
  }
  assert.deepEqual(await snapshot(), before);
});

test('E07: retira también beneficios de texto de la interfaz heredada', async () => {
  const token = await login();
  await withSponsor(async ref => {
    assert.equal((await request('DELETE', `${path}/${ref.id}`, { token })).status, 204);
    const stored = (await ref.get()).data();
    assert.deepEqual(stored.benefits, [{ name: 'Beneficio antiguo', active: false }]);
    assert.equal(stored.benefitsOffered, 0);
  }, { ...initial, benefits: ['Beneficio antiguo'], benefitsOffered: 1 });
});
