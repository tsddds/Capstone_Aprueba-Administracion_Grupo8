import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { assertEmulatorOnly, DEMO_JWT } from './safety.mjs';
import { seed } from './seed.mjs';
import { startStripeStub } from './stripe-stub.mjs';
import { randomBytes } from 'node:crypto';

const target = assertEmulatorOnly(process.env, { testOnly: true });
const mode = process.argv[2];
if (!['smoke', 'contract', 'a-sprint1', 'a-sprint2', 'a-ops', 'b-sponsors', 'b-sponsors-create', 'b-sponsors-update', 'b-sponsors-delete', 'b-questions-list', 'b-questions-create', 'b-questions-update', 'b-questions-import', 'b-corrections-list', 'b-corrections-resolve', 'c-catalog', 'c-billing', 'c-metrics'].includes(mode)) throw new Error('Modo de pruebas no permitido.');
// Nunca ejecuta pruebas con escritura contra la aplicación publicada ni base de compañeros.
const serverPort = await new Promise((resolve, reject) => {
  const s = createServer(); s.on('error', reject);
  s.listen(0, '127.0.0.1', () => { const port = s.address().port; s.close(() => resolve(port)); });
});
// Restablecer SOLO demo-aprueba-tests: nunca la base persistente demo-aprueba-equipo.
const reset = await fetch(`http://${target.host}/emulator/v1/projects/${target.project}/databases/(default)/documents`, {
  method: 'DELETE', signal: AbortSignal.timeout(20000),
});
if (!reset.ok) throw new Error(`No se pudo preparar la base aislada de tests: HTTP ${reset.status}`);
await seed(target);
const stripeStub = await startStripeStub();
const env = { ...process.env, HOST: '127.0.0.1', PORT: String(serverPort), JWT_SECRET: DEMO_JWT,
  TEST_BASE_URL: `http://127.0.0.1:${serverPort}`, NODE_ENV: 'test', CRON_SECRET:randomBytes(32).toString('hex'), STRIPE_TEST_API_ORIGIN:stripeStub.origin, STRIPE_TEST_SECRET_KEY:'sk_test_local_stub_only' };
const server = spawn(process.execPath, ['dev/start.mjs'], { env, stdio: ['ignore', 'ignore', 'inherit'] });
let serverError;
server.on('error', error => { serverError = error; });
let tests;
const stop = () => { if (tests?.exitCode === null) tests.kill(); if (server.exitCode === null) server.kill(); };
process.on('SIGINT', () => { stop(); process.exit(130); });
process.on('SIGTERM', () => { stop(); process.exit(143); });
try {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    if (serverError || server.exitCode !== null) throw serverError || new Error('El backend terminó antes de estar disponible.');
    try { const r = await fetch(`${env.TEST_BASE_URL}/health`, { signal: AbortSignal.timeout(500) }); if (r.ok) { ready = true; break; } } catch {}
    await delay(250);
  }
  if (!ready) throw new Error('El backend no respondió dentro del tiempo previsto.');
  tests = spawn(process.execPath, ['--test', '--test-concurrency=1', `test/integration/${mode}.test.mjs`], { env, stdio: 'inherit' });
  process.exitCode = await new Promise((resolve, reject) => { tests.on('exit', code => resolve(code ?? 1)); tests.on('error', reject); });
} finally { stop(); await stripeStub.close(); }
