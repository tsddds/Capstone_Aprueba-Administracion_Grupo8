import { test } from 'node:test';
import assert from 'node:assert/strict';
import { metricsJob } from '../../src/services/metrics/job.js';

const key = 'solo-prueba-unitaria-' + 'x'.repeat(40);
async function invoke({ method = 'GET', authorization, secret = key, throws = false } = {}) {
  let calls = 0, caught;
  const result = { headers: {} };
  const res = { set(k, v) { result.headers[k] = v; return this; }, status(code) { result.status = code; return this; }, json(body) { result.body = body; return this; } };
  await metricsJob({ secret: () => secret, refresh: async () => {
    calls++; if (throws) throw new Error('fallo de persistencia');
    return { generatedAt: '2026-10-27T12:00:00.000Z', ranges: ['7d', '30d', '90d', '365d'] };
  } })({ method, get: () => authorization }, res, error => { caught = error; });
  return { ...result, calls, caught };
}
test('metrics job solo admite GET y no ejecuta trabajo con otros métodos', async () => {
  const r = await invoke({ method: 'POST', authorization: `Bearer ${key}` });
  assert.equal(r.status, 405); assert.equal(r.headers.Allow, 'GET'); assert.equal(r.calls, 0);
});
test('metrics job sin secreto seguro queda cerrado y no expone el secreto', async () => {
  for (const secret of [undefined, '', 'corto']) {
    const r = await invoke({ secret: secret ?? '' });
    assert.equal(r.status, 503); assert.equal(r.calls, 0);
  }
});
test('metrics job rechaza autorización ausente, distinta y mal formada sin recalcular', async () => {
  for (const authorization of [undefined, '', 'Bearer incorrecto', `bearer ${key}`, `Bearer ${key}x`, 'Basic test']) {
    const r = await invoke({ authorization });
    assert.equal(r.status, 401); assert.equal(r.calls, 0);
    assert.ok(!JSON.stringify(r.body).includes(key));
  }
});
test('metrics job autorizado actualiza una vez y devuelve metadatos sin datos personales', async () => {
  const r = await invoke({ authorization: `Bearer ${key}` });
  assert.equal(r.status, 200); assert.equal(r.calls, 1); assert.equal(r.body.error, null);
  assert.equal(r.headers['Cache-Control'], 'no-store');
  assert.deepEqual(r.body.data, { updated: true, generatedAt: '2026-10-27T12:00:00.000Z', ranges: ['7d', '30d', '90d', '365d'] });
});
test('metrics job no declara éxito cuando falla la persistencia', async () => {
  const r = await invoke({ authorization: `Bearer ${key}`, throws: true });
  assert.equal(r.calls, 1); assert.equal(r.status, undefined); assert.match(r.caught.message, /persistencia/);
});
