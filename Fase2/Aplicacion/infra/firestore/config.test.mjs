import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = f => JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8'));
test('Visor de desarrollo habilitado y sin colisión con Express o Vite', () => {
  const { emulators: e } = read('firebase.json');
  assert.equal(e.ui.enabled, true);
  assert.equal(e.ui.port, 4001);
  const ports = [e.firestore.port, e.firestore.websocketPort, e.ui.port, e.hub.port, e.logging.port];
  assert.equal(new Set(ports).size, ports.length);
  for (const p of ports) assert(![4000, 5173].includes(p));
});
test('Emulador de tests no ofrece visor que se confunda con datos de trabajo', () => {
  const { emulators: e } = read('firebase.test.json');
  assert.equal(e.ui.enabled, false);
  assert.equal(e.firestore.port, 8080);
});
