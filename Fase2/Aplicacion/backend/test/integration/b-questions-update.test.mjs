import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { request, login } from './helper.mjs';
import { assertEmulatorOnly, DEMO_JWT } from '../../dev/safety.mjs';
import { db } from '../../src/data/repo.js';

assertEmulatorOnly(process.env, { testOnly: true });
const path = '/api/v1/admin/questions';
const collection = db.collection('questions');
const explanation = {
  title: '  Título conservado  ', subject: 'Matemática M1',
  steps: [{ label: 'Paso 1', body: 'Desarrollo de prueba' }],
  verification: 'Comprobar la igualdad', keyConcept: 'Conservar todos los campos',
};
const initial = {
  testId: 'm1', axis: 'Álgebra', difficulty: 'd1', statement: 'Pregunta ficticia E21',
  options: ['1', '2', '3', '4', '5'], correctAnswer: 'E', explanation,
  requiredSkill: 'Resolver ecuaciones', status: 'draft', sourceRef: 'origen-ficticio-preservado',
};
const snapshot = async () => (await collection.get()).docs
  .map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.id.localeCompare(b.id));
async function withQuestion(fn, data = initial) {
  const ref = collection.doc('qst_e21_update');
  await ref.create(data);
  try { await fn(ref); }
  finally { await ref.delete(); }
}

test('E21: actualiza parcialmente y conserva explanation omitida y datos de origen', async () => {
  const token = await login();
  await withQuestion(async ref => {
    const patch = { statement: 'Enunciado corregido', status: 'published' };
    const result = await request('PUT', `${path}/${ref.id}`, { token, body: patch });
    assert.equal(result.status, 200);
    assert.equal(result.json.error, null);
    assert.equal(typeof result.json.meta.requestId, 'string');
    assert.ok(Number.isFinite(Date.parse(result.json.meta.timestamp)));
    assert.deepEqual(result.json.data, { ...initial, ...patch, id: ref.id });
    assert.deepEqual((await ref.get()).data(), { ...initial, ...patch });
    const listed = await request('GET', path, { token });
    assert.deepEqual(listed.json.data.find(q => q.id === ref.id), result.json.data);
  });
});

test('E21: valida la coherencia con opciones y respuesta ya guardadas', async () => {
  const token = await login();
  await withQuestion(async ref => {
    const invalid = await request('PUT', `${path}/${ref.id}`, { token, body: { options: ['A', 'B'] } });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.json.error.code, 'INVALID_CORRECT_ANSWER');
    assert.deepEqual((await ref.get()).data(), initial);
    const answer = await request('PUT', `${path}/${ref.id}`, { token, body: { correctAnswer: 'B' } });
    assert.equal(answer.status, 200);
    assert.deepEqual(answer.json.data.options, initial.options);
    const options = await request('PUT', `${path}/${ref.id}`, { token, body: { options: ['A', 'B'] } });
    assert.equal(options.status, 200);
    assert.deepEqual((await ref.get()).data(), { ...initial, options: ['A', 'B'], correctAnswer: 'B' });
  });
});

test('E21: edita los cinco campos estructurados y conserva compatibilidad con texto', async () => {
  const token = await login();
  await withQuestion(async ref => {
    const updated = {
      title: 'Nuevo título', subject: 'Nueva materia',
      steps: [{ label: 'Primer paso', body: 'Nuevo desarrollo' }, { label: 'Segundo paso', body: 'Resultado' }],
      verification: 'Nueva verificación', keyConcept: 'Nuevo concepto clave',
    };
    for (const value of [updated, 'Explicación de texto compatible', updated]) {
      const result = await request('PUT', `${path}/${ref.id}`, { token, body: { explanation: value } });
      assert.equal(result.status, 200);
      assert.deepEqual(result.json.data.explanation, value);
      assert.deepEqual((await ref.get()).data(), { ...initial, explanation: value });
    }
  });
});

test('E21: admite los estados, niveles y pruebas del contrato', async () => {
  const token = await login();
  await withQuestion(async ref => {
    for (const status of ['published', 'flagged', 'retired', 'draft']) {
      const result = await request('PUT', `${path}/${ref.id}`, { token, body: { status } });
      assert.equal(result.status, 200);
      assert.equal(result.json.data.status, status);
    }
    for (const testId of ['lectora', 'm1', 'm2', 'cien', 'hist']) {
      assert.equal((await request('PUT', `${path}/${ref.id}`, { token, body: { testId } })).status, 200);
    }
    for (const difficulty of ['d1', 'd2', 'd3', 'd4']) {
      assert.equal((await request('PUT', `${path}/${ref.id}`, { token, body: { difficulty } })).status, 200);
    }
  });
});

test('E21: cambios concurrentes no dejan una respuesta fuera de las opciones', async () => {
  const token = await login();
  await withQuestion(async ref => {
    const results = await Promise.all([
      request('PUT', `${path}/${ref.id}`, { token, body: { options: ['A', 'B'] } }),
      request('PUT', `${path}/${ref.id}`, { token, body: { correctAnswer: 'E' } }),
    ]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 400]);
    const invalid = results.find(r => r.status === 400);
    assert.equal(invalid.json.error.code, 'INVALID_CORRECT_ANSWER');
    const stored = (await ref.get()).data();
    assert.ok('ABCDE'.slice(0, stored.options.length).includes(stored.correctAnswer));
    assert.deepEqual(stored.explanation, explanation);
  }, { ...initial, correctAnswer: 'B' });
});

for (const role of ['finance', 'support', 'ops']) {
  test(`E21: ${role} recibe 403 sin modificar preguntas`, async () => {
    const token = await login(role);
    const before = await snapshot();
    const result = await request('PUT', `${path}/qst_demo_01`, { token, body: { status: 'published' } });
    assert.equal(result.status, 403);
    assert.equal(result.json.error.code, 'AUTH_FORBIDDEN');
    assert.equal(result.json.data, null);
    assert.deepEqual(await snapshot(), before);
  });
}

test('E21: student recibe 403 y sin token recibe 401 sin alterar datos', async () => {
  const before = await snapshot();
  const token = jwt.sign({ sub: 'usr_demo_01', role: 'student', typ: 'access' }, DEMO_JWT, { expiresIn: 60 });
  for (const [candidate, status, code] of [[token, 403, 'AUTH_FORBIDDEN'], [undefined, 401, 'AUTH_REQUIRED']]) {
    const result = await request('PUT', `${path}/qst_demo_01`, { token: candidate, body: { status: 'draft' } });
    assert.equal(result.status, status);
    assert.equal(result.json.error.code, code);
    assert.equal(result.json.data, null);
  }
  assert.deepEqual(await snapshot(), before);
});

test('E21: rechaza vacíos, valores inválidos, campos ajenos y explanation incompleta sin cambios parciales', async () => {
  const token = await login();
  await withQuestion(async ref => {
    const before = await snapshot();
    const bodies = [null, [], 'texto', {},
      ...['testId', 'axis', 'difficulty', 'statement', 'requiredSkill'].flatMap(key => (['axis', 'difficulty'].includes(key) ? [false, 1, [], {}] : ['', null, false, 1, [], {}]).map(value => ({ [key]: value }))),
      { testId: 'otro' }, { difficulty: 'd5' },
      ...['archived', '', null, [], 3].map(status => ({ status })),
      ...[null, [], ['solo'], ['1', '2', '3', '4', '5', '6'], ['a', '']].map(options => ({ options })),
      ...['F', '', null, 'AB'].map(correctAnswer => ({ correctAnswer })),
      ...['', null, [], {}, { keyConcept: 'No puede borrar el resto' }, { ...explanation, steps: [] },
        { ...explanation, steps: [{ label: 'Paso' }] }, { ...explanation, keyConcept: '' },
      ].map(value => ({ explanation: value })),
      { id: 'otro' }, { sourceRef: 'otro origen' },
      { statement: 'No debe guardarse', status: 'inválido' },
    ];
    for (const body of bodies) {
      const result = await request('PUT', `${path}/${ref.id}`, { token, body });
      assert.equal(result.status, 400, JSON.stringify(body));
      assert.ok(['VALIDATION_ERROR', 'INVALID_CORRECT_ANSWER'].includes(result.json.error.code));
      assert.equal(result.json.data, null);
    }
    assert.deepEqual(await snapshot(), before);
  });
});

test('E21: inexistente devuelve 404 e identificadores inválidos 400 sin crear preguntas', async () => {
  const token = await login();
  const before = await snapshot();
  const missing = await request('PUT', `${path}/qst_e21_missing`, { token, body: { status: 'draft' } });
  assert.equal(missing.status, 404);
  assert.equal(missing.json.error.code, 'NOT_FOUND');
  assert.equal(missing.json.data, null);
  for (const id of ['invalid.id', 'x'.repeat(129), '%20']) {
    const result = await request('PUT', `${path}/${id}`, { token, body: { status: 'draft' } });
    assert.equal(result.status, 400);
    assert.equal(result.json.error.code, 'VALIDATION_ERROR');
    assert.equal(result.json.error.field, 'id');
  }
  assert.deepEqual(await snapshot(), before);
});

test('E21: no publica datos heredados incoherentes aunque el cambio recibido sea válido', async () => {
  const token = await login();
  const legacy = { ...initial, options: ['A', 'B'], correctAnswer: 'E' };
  await withQuestion(async ref => {
    const result = await request('PUT', `${path}/${ref.id}`, { token, body: { status: 'published' } });
    assert.equal(result.status, 400);
    assert.equal(result.json.error.code, 'INVALID_CORRECT_ANSWER');
    assert.deepEqual((await ref.get()).data(), legacy);
  }, legacy);
});


test('E21: permite revisar la pregunta original de Biología b1 sin cambiar su prueba', async () => {
  const token = await login();
  const legacy = { ...initial, testId: 'b1', axis: 'Célula', statement: '¿Cuál es la unidad básica de la vida?', options: ['Átomo', 'Célula', 'Tejido', 'Órgano', 'Molécula'], correctAnswer: 'B', explanation: 'La célula es la unidad estructural y funcional.', status: 'published' };
  await withQuestion(async ref => {
    const patch = { ...legacy, explanation: 'La célula constituye la unidad básica de la vida.' };
    delete patch.sourceRef;
    const result = await request('PUT', path + '/' + ref.id, { token, body: patch });
    assert.equal(result.status, 200);
    assert.deepEqual((await ref.get()).data(), { ...legacy, ...patch });
    const filtered = await request('GET', path + '?testId=b1', { token });
    assert.equal(filtered.status, 200);
    assert.ok(filtered.json.data.some(q => q.id === ref.id));
    assert.ok(filtered.json.meta.filters.testIds.includes('b1'));
  }, legacy);
});
