import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAllSponsors } from '../src/api/sponsors.js';

test('La pantalla conserva todos los sponsors al atravesar varias páginas', async () => {
  const calls = [];
  const result = await loadAllSponsors(async path => {
    calls.push(path);
    if (calls.length === 1) return { data: Array.from({ length: 100 }, (_, id) => ({ id })), meta: { pagination: { nextCursor: 'cursor-next' } } };
    return { data: [{ id: 100 }, { id: 101 }], meta: { pagination: { nextCursor: null } } };
  });
  assert.equal(result.length, 102);
  assert.deepEqual(result.map(row => row.id), Array.from({ length: 102 }, (_, id) => id));
  assert.deepEqual(calls, ['/sponsors?limit=100', '/sponsors?limit=100&cursor=cursor-next']);
});

test('Una página vacía produce listado vacío sin consultas adicionales', async () => {
  let calls = 0;
  assert.deepEqual(await loadAllSponsors(async () => {
    calls++;
    return { data: [], meta: { pagination: { nextCursor: null } } };
  }), []);
  assert.equal(calls, 1);
});

test('Un fallo en otra página no publica totales parciales', async () => {
  let calls = 0;
  await assert.rejects(loadAllSponsors(async () => {
    if (++calls === 1) return { data: [{ id: 1 }], meta: { pagination: { nextCursor: 'next' } } };
    throw new Error('Servidor no disponible');
  }), /Servidor no disponible/);
});

test('Un cursor repetido no provoca un bucle infinito', async () => {
  await assert.rejects(loadAllSponsors(async () => ({
    data: [{ id: 1 }], meta: { pagination: { nextCursor: 'repeated' } },
  })), /No se pudo completar/);
});
