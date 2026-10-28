import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertEmulatorOnly } from '../../dev/safety.mjs';
import { buildFixtures } from '../../dev/fixtures.mjs';

test('Guardia de seed permite únicamente destinos demo explícitos', () => {
  const safe = { GCLOUD_PROJECT: 'demo-aprueba-equipo', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' };
  assert.equal(assertEmulatorOnly(safe).project, safe.GCLOUD_PROJECT);
  for (const patch of [{ GCLOUD_PROJECT: 'aprueba-admin-pruebas' }, { FIRESTORE_EMULATOR_HOST: '' }, { FIRESTORE_EMULATOR_HOST: 'external.example:8080' }, { FIRESTORE_EMULATOR_HOST: '127.0.0.1:99999' }, { FIREBASE_SERVICE_ACCOUNT_JSON: '{}' }, { GOOGLE_APPLICATION_CREDENTIALS: 'private.json' }, { STRIPE_SECRET_KEY: 'not-a-real-key' }]) {
    assert.throws(() => assertEmulatorOnly({ ...safe, ...patch }));
  }
  assert.throws(() => assertEmulatorOnly(safe, { testOnly: true }));
});
test('Fixtures reproducibles, referencias válidas y sin usuarios empresariales', () => {
  const date = new Date('2026-09-23T12:00:00Z');
  const f = buildFixtures(date); assert.deepEqual(f, buildFixtures(date));
  for (const plan of f.plans) assert.match(plan.color, /^#[0-9A-F]{6}$/i);
  for (const docs of Object.values(f)) assert.equal(new Set(docs.map(d => d.id)).size, docs.length);
  const userIds = new Set(f.users.map(u => u.id)), questions = new Set(f.questions.map(q => q.id));
  for (const c of f.corrections) { assert.ok(userIds.has(c.userId)); assert.ok(questions.has(c.questionId)); }
  for (const u of f.users) assert.ok(u.email.endsWith('@example.test'));
  const active = f.users.filter(u => date - new Date(u.lastActivity) < 30 * 86400000);
  assert.equal(active.length, 4);
  assert.equal(active.filter(u => u.subscription?.status === 'active').length, 2);
  assert.equal(f.metrics[0].converted.rate, 50);
  assert.equal(f.metrics[0].source, 'fixture_snapshot_not_live');
});
test('Reparto contiene exactamente 27 métodos/rutas únicos y responsables', () => {
  const endpoints = JSON.parse(readFileSync(new URL('../../../docs/endpoints.json', import.meta.url), 'utf8'));
  assert.equal(endpoints.length, 27);
  assert.equal(new Set(endpoints.map(e => `${e.method} ${e.path}`)).size, 27);
  const counts = Object.fromEntries(['A', 'B', 'C'].map(o => [o, endpoints.filter(e => e.owner === o).length]));
  assert.deepEqual(counts, { A: 10, B: 10, C: 7 });
  for (const e of endpoints) { assert.ok(e.accept); assert.ok(e.points > 0); assert.ok(e.sprint >= 1 && e.sprint <= 5); }
});
