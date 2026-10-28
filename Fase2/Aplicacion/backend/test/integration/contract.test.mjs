// Intencionalmente ROJO donde el código base no cumple; nunca marcar estos casos como skip.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request, login } from './helper.mjs';
import { randomUUID } from 'node:crypto';

test('E02: support NO puede consultar overview (contrato original)', async () => {
  const token = await login('support');
  const r = await request('GET', '/api/v1/admin/metrics/overview', { token }); assert.equal(r.status, 403);
});
test('E04: finance NO puede listar sponsors (contrato original)', async () => {
  const token = await login('finance');
  const r = await request('GET', '/api/v1/admin/sponsors', { token }); assert.equal(r.status, 403);
});
test('E05: rechaza sponsor sin tier y sin monthlyFee', async () => {
  const token = await login();
  const r = await request('POST', '/api/v1/admin/sponsors', { token, body: { name: `Inválido ${randomUUID()}` } });
  if (r.status === 201) await request('DELETE', `/api/v1/admin/sponsors/${r.json.data.id}`, { token });
  assert.equal(r.status, 400); assert.equal(r.json.error.code, 'VALIDATION_ERROR');
});
test('E20: rechaza alternativa correcta fuera de opciones', async () => {
  const token = await login();
  const r = await request('POST', '/api/v1/admin/questions', { token, body: { testId: 'm1', axis: 'Álgebra', difficulty: 'd1', statement: 'Ejemplo inválido', options: ['1', '2'], correctAnswer: 'E', explanation: 'Prueba', requiredSkill: 'Prueba' } });
  assert.equal(r.status, 400); assert.equal(r.json.error.code, 'INVALID_CORRECT_ANSWER');
});
test('E18: resolver una recorrección ya resuelta devuelve 409', async () => {
  const token = await login('support');
  const r = await request('PATCH', '/api/v1/admin/corrections/cor_demo_02', { token, body: { resolution: 'confirmed' } });
  assert.equal(r.status, 409); assert.equal(r.json.error.code, 'CORRECTION_ALREADY_RESOLVED');
});
test('E14: cambiar correo al de otro alumno devuelve 409', async () => {
  const token = await login('support');
  const r = await request('PATCH', '/api/v1/admin/users/usr_demo_01', { token, body: { email: 'usr_demo_02@example.test', reason: 'Prueba duplicado' } });
  if (r.status === 200) await request('PATCH', '/api/v1/admin/users/usr_demo_01', { token, body: { email: 'usr_demo_01@example.test' } });
  assert.equal(r.status, 409); assert.equal(r.json.error.code, 'EMAIL_ALREADY_EXISTS');
});
test('E27: código contractual cuando un plan tiene suscriptores', async () => {
  const token = await login();
  const r = await request('DELETE', '/api/v1/admin/plans/uni', { token });
  assert.equal(r.status, 409); assert.equal(r.json.error.code, 'PLAN_HAS_SUBSCRIBERS');
});
test('E25: rechaza precio negativo', async () => {
  const token = await login();
  const r = await request('POST', '/api/v1/admin/plans', { token, body: { name: 'Plan inválido ficticio', price: -1 } });
  if (r.status === 201) await request('DELETE', `/api/v1/admin/plans/${r.json.data.id}`, { token });
  assert.equal(r.status, 400); assert.equal(r.json.error.code, 'VALIDATION_ERROR');
});
