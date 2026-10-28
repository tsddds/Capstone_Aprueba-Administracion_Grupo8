import assert from 'node:assert/strict';
import { assertEmulatorOnly, DEMO_PASSWORD } from '../../dev/safety.mjs';
assertEmulatorOnly(process.env, { testOnly: true });
const base = process.env.TEST_BASE_URL;
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base || '')) throw new Error('Tests únicamente contra backend local creado por el runner.');
export async function request(method, path, { token, body } = {}) {
  const response = await fetch(`${base}${path}`, { method, signal: AbortSignal.timeout(10000), headers: {
    ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}),
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const text = await response.text();
  return { status: response.status, headers: response.headers, json: text ? JSON.parse(text) : null };
}
export async function login(role = 'admin') {
  const r = await request('POST', '/api/v1/admin/auth/login', { body: { email: `${role}@example.test`, password: DEMO_PASSWORD } });
  assert.equal(r.status, 200, `login ${role}`);
  assert.equal(typeof r.json.data.accessToken, 'string');
  return r.json.data.accessToken;
}
