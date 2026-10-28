import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { request, login } from './helper.mjs';
import { assertEmulatorOnly, DEMO_JWT } from '../../dev/safety.mjs';
import { db } from '../../src/data/repo.js';

assertEmulatorOnly(process.env, { testOnly: true });
const path = '/api/v1/admin/questions/import';
const explanation = {
  title: 'Explicación ficticia', subject: 'Matemática',
  steps: [{ label: 'Paso 1', body: 'Desarrollo' }, { label: 'Paso 2', body: 'Resultado' }],
  verification: 'Comprobar', keyConcept: 'Conservar la estructura',
};
const valid = {
  pregunta: 'E22 pregunta ficticia', alternativas: ['No', 'Sí'], respuesta_correcta: 'B',
  explicacion_respuesta: explanation, habilidad_requerida: 'Razonar', eje: 'Álgebra', dificultad: 'd2',
};
const rows = async (name = 'questions') => (await db.collection(name).get()).docs
  .map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.id.localeCompare(b.id));
async function isolated(fn) {
  const originals = new Map();
  for (const name of ['questions', 'questionImportKeys']) {
    originals.set(name, new Map((await db.collection(name).get()).docs.map(doc => [doc.id, doc.data()])));
  }
  try { await fn(); }
  finally {
    const batch = db.batch();
    for (const [name, before] of originals) {
      const collection = db.collection(name);
      for (const doc of (await collection.get()).docs) if (!before.has(doc.id)) batch.delete(doc.ref);
      for (const [id, data] of before) batch.set(collection.doc(id), data);
    }
    await batch.commit();
  }
}
function summary(result, count) {
  assert.equal(result.status, 201);
  assert.equal(result.json.error, null);
  const data = result.json.data;
  assert.equal(data.imported + data.skipped + data.errors.length, count);
  assert.equal(data.duplicates.length, data.skipped);
  return data;
}

test('E22: lote mixto conserva explanation, importa válidas y reporta duplicados y errores por índice', async () => {
  const token = await login();
  await isolated(async () => {
    const before = await rows();
    const items = [valid, { ...valid }, { ...valid, pregunta: 'Texto compatible', explicacion_respuesta: 'Texto antiguo compatible' },
      { ...valid, pregunta: 'Respuesta inválida', respuesta_correcta: 'E' },
      { ...valid, pregunta: 'Explicación incompleta', explicacion_respuesta: { keyConcept: 'Incompleta' } }];
    const result = await request('POST', path, { token, body: { testId: 'm1', items } });
    const data = summary(result, items.length);
    assert.equal(data.imported, 2); assert.equal(data.skipped, 1);
    assert.deepEqual(data.errors.map(e => [e.index, e.code]), [[3, 'INVALID_CORRECT_ANSWER'], [4, 'VALIDATION_ERROR']]);
    assert.equal(data.errors[0].field, 'respuesta_correcta');
    assert.match(data.errors[1].field, /^explicacion_respuesta/);
    assert.equal(data.duplicates[0].index, 1);
    const created = (await rows()).filter(q => !before.some(b => b.id === q.id));
    assert.equal(created.length, 2);
    const structured = created.find(q => q.statement === valid.pregunta);
    assert.deepEqual(structured, {
      id: structured.id, testId: 'm1', axis: 'Álgebra', difficulty: 'd2', statement: valid.pregunta,
      options: ['No', 'Sí'], correctAnswer: 'B', explanation, requiredSkill: 'Razonar', status: 'draft',
    });
    assert.equal(created.find(q => q.statement === 'Texto compatible').explanation, 'Texto antiguo compatible');
    assert.equal(typeof result.json.meta.requestId, 'string');
  });
});

test('E22: omite preguntas existentes con espacios normalizados sin sobrescribir sus datos', async () => {
  const token = await login();
  await isolated(async () => {
    const before = await rows();
    const item = { ...valid, pregunta: '  ¿Cuánto   vale x si 2x = 10?  ' };
    const data = summary(await request('POST', path, { token, body: { testId: 'm1', items: [item] } }), 1);
    assert.equal(data.imported, 0); assert.equal(data.skipped, 1);
    assert.deepEqual(data.duplicates, [{ index: 0, questionId: 'qst_demo_01' }]);
    assert.deepEqual(await rows(), before);
  });
});

test('E22: reintentar el lote no duplica ni sobrescribe explicaciones existentes', async () => {
  const token = await login();
  await isolated(async () => {
    const body = { testId: 'm1', items: [valid] };
    assert.equal(summary(await request('POST', path, { token, body }), 1).imported, 1);
    const before = await rows();
    const second = summary(await request('POST', path, { token, body: {
      ...body, items: [{ ...valid, explicacion_respuesta: 'No debe reemplazar el objeto' }],
    } }), 1);
    assert.equal(second.imported, 0); assert.equal(second.skipped, 1);
    assert.deepEqual(await rows(), before);
  });
});

test('E22: importaciones simultáneas de una fila crean una sola pregunta', async () => {
  const token = await login();
  await isolated(async () => {
    const body = { testId: 'm1', items: [valid] };
    const results = await Promise.all([request('POST', path, { token, body }), request('POST', path, { token, body })]);
    const summaries = results.map(r => summary(r, 1));
    assert.equal(summaries.reduce((sum, s) => sum + s.imported, 0), 1);
    assert.equal(summaries.reduce((sum, s) => sum + s.skipped, 0), 1);
    assert.equal((await rows()).filter(q => q.statement === valid.pregunta).length, 1);
  });
});

test('E22: la clave de importación no bloquea el enunciado anterior después de editar la pregunta', async () => {
  const token = await login();
  await isolated(async () => {
    const body = { testId: 'm1', items: [valid] };
    assert.equal(summary(await request('POST', path, { token, body }), 1).imported, 1);
    const created = (await rows()).find(q => q.statement === valid.pregunta);
    assert.equal((await request('PUT', `/api/v1/admin/questions/${created.id}`, {
      token, body: { statement: 'Enunciado editado posteriormente' },
    })).status, 200);
    assert.equal(summary(await request('POST', path, { token, body }), 1).imported, 1);
    const after = await rows();
    assert.equal(after.find(q => q.id === created.id).statement, 'Enunciado editado posteriormente');
    assert.equal(after.filter(q => q.statement === valid.pregunta).length, 1);
  });
});

test('E22: el mismo enunciado en pruebas distintas se importa y admite alias heredados sin conflicto', async () => {
  const token = await login();
  await isolated(async () => {
    const alias = { ...valid, axis: valid.eje, difficulty: valid.dificultad };
    delete alias.eje; delete alias.dificultad;
    for (const testId of ['m1', 'm2']) {
      assert.equal(summary(await request('POST', path, { token, body: { testId, items: [alias] } }), 1).imported, 1);
    }
    assert.equal((await rows()).filter(q => q.statement === valid.pregunta).length, 2);
  });
});

test('E22: filas incompletas, tipos inválidos y campos conflictivos se reportan sin persistir', async () => {
  const token = await login();
  await isolated(async () => {
    const before = await rows();
    const missing = Object.keys(valid).filter(key => !['eje', 'dificultad'].includes(key)).map(key => { const item = { ...valid }; delete item[key]; return item; });
    const items = [null, [], 'texto', 3, {}, ...missing,
      ...['', null, [], 3].map(pregunta => ({ ...valid, pregunta })),
      { ...valid, alternativas: ['Única'] }, { ...valid, respuesta_correcta: 'E' },
      { ...valid, explicacion_respuesta: {} }, { ...valid, explicacion_respuesta: { ...explanation, keyConcept: '' } },
      { ...valid, dificultad: 'd5' }, { ...valid, eje: 42 },
      { ...valid, axis: 'Otro eje' }, { ...valid, difficulty: 'd4' },
      { ...valid, status: 'draft' }, { ...valid, testId: 'm2' }];
    const data = summary(await request('POST', path, { token, body: { testId: 'm1', items } }), items.length);
    assert.equal(data.imported, 0); assert.equal(data.skipped, 0);
    assert.deepEqual(data.errors.map(e => e.index), items.map((_, i) => i));
    for (const error of data.errors) assert.ok(error.code && typeof error.message === 'string');
    assert.deepEqual(await rows(), before);
  });
});

test('E22: valida el sobre, prueba obligatoria y límites antes de escribir', async () => {
  const token = await login();
  const before = await rows();
  const keysBefore = await rows('questionImportKeys');
  for (const body of [null, [], 'texto', {}, { items: [valid] },
    ...['', null, 'otra', ['m1']].map(testId => ({ testId, items: [valid] })),
    { testId: 'm1' }, { testId: 'm1', items: null }, { testId: 'm1', items: {} },
    { testId: 'm1', items: [] }, { testId: 'm1', items: Array.from({ length: 101 }, () => valid) },
    { testId: 'm1', items: [valid], extra: true },
  ]) {
    const result = await request('POST', path, { token, body });
    assert.equal(result.status, 400);
    assert.ok(['IMPORT_FORMAT_ERROR', 'VALIDATION_ERROR'].includes(result.json.error.code));
    assert.equal(result.json.data, null);
  }
  assert.deepEqual(await rows(), before);
  assert.deepEqual(await rows('questionImportKeys'), keysBefore);
});

for (const role of ['finance', 'support', 'ops']) {
  test(`E22: ${role} recibe 403 sin importar ni crear claves`, async () => {
    const token = await login(role);
    const before = await rows();
    const keysBefore = await rows('questionImportKeys');
    const result = await request('POST', path, { token, body: { testId: 'm1', items: [valid] } });
    assert.equal(result.status, 403);
    assert.equal(result.json.error.code, 'AUTH_FORBIDDEN');
    assert.equal(result.json.data, null);
    assert.deepEqual(await rows(), before);
    assert.deepEqual(await rows('questionImportKeys'), keysBefore);
  });
}

test('E22: student recibe 403 y falta de token 401', async () => {
  const token = jwt.sign({ sub: 'usr_demo_01', role: 'student', typ: 'access' }, DEMO_JWT, { expiresIn: 60 });
  for (const [candidate, status, code] of [[token, 403, 'AUTH_FORBIDDEN'], [undefined, 401, 'AUTH_REQUIRED']]) {
    const result = await request('POST', path, { token: candidate, body: { testId: 'm1', items: [valid] } });
    assert.equal(result.status, status);
    assert.equal(result.json.error.code, code);
    assert.equal(result.json.data, null);
  }
});

test('E22: acepta 100 filas con conteo exacto de duplicados internos', async () => {
  const token = await login();
  await isolated(async () => {
    const items = Array.from({ length: 100 }, () => valid);
    const data = summary(await request('POST', path, { token, body: { testId: 'hist', items } }), 100);
    assert.equal(data.imported, 1); assert.equal(data.skipped, 99);
    assert.equal(data.errors.length, 0);
  });
});


test('E22: importa incompletas como borrador, permite completarlas por separado y valida al publicar', async () => {
  const token = await login();
  await isolated(async () => {
    const item = { ...valid, pregunta: 'E22 clasificación pendiente' };
    delete item.eje; delete item.dificultad;
    assert.equal(summary(await request('POST', path, { token, body: { testId: 'm1', items: [item] } }), 1).imported, 1);
    const created = (await rows()).find(q => q.statement === item.pregunta);
    assert.equal(created.status, 'draft'); assert.equal(created.axis, null); assert.equal(created.difficulty, null);
    const url = '/api/v1/admin/questions/' + created.id;
    const update = body => request('PUT', url, { token, body });
    assert.equal((await update({ status: 'published' })).status, 400);
    assert.equal((await update({ axis: 'Álgebra' })).status, 200);
    assert.equal((await update({ status: 'published' })).status, 400);
    let stored = (await rows()).find(q => q.id === created.id);
    assert.equal(stored.status, 'draft'); assert.equal(stored.difficulty, null);
    assert.deepEqual(stored.explanation, explanation);
    assert.equal((await update({ difficulty: 'd2', status: 'published' })).status, 200);
    assert.equal((await update({ axis: null })).status, 400);
    stored = (await rows()).find(q => q.id === created.id);
    assert.equal(stored.status, 'published'); assert.equal(stored.axis, 'Álgebra');
    assert.equal((await update({ status: 'draft', axis: null, difficulty: null })).status, 200);
  });
});
