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
  title: 'Resolver una ecuación', subject: 'Matemática M1',
  steps: [{ label: 'Despejar', body: 'Restar cinco y dividir por tres.' }, { label: 'Resultado', body: 'x = 5' }],
  verification: '3 × 5 + 5 = 20', keyConcept: 'Mantener la igualdad al operar en ambos lados.',
};
const valid = {
  testId: 'm1', axis: 'Álgebra', difficulty: 'd1', statement: 'Si 3x + 5 = 20, ¿cuál es x?',
  options: ['3', '5', '6', '7', '10'], correctAnswer: 'B', explanation, requiredSkill: 'Resolver ecuaciones',
};
const snapshot = async () => (await collection.get()).docs
  .map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.id.localeCompare(b.id));
async function createAndCheck(token, body) {
  const result = await request('POST', path, { token, body });
  assert.equal(result.status, 201);
  const id = result.json.data.id;
  try {
    assert.deepEqual(result.json.data, { id, status: 'draft' });
    assert.equal(result.json.error, null);
    assert.equal(typeof result.json.meta.requestId, 'string');
    assert.ok(Number.isFinite(Date.parse(result.json.meta.timestamp)));
    assert.deepEqual((await collection.doc(id).get()).data(), { ...body, status: 'draft' });
    const listed = await request('GET', path, { token });
    assert.deepEqual(listed.json.data.find(q => q.id === id), { id, ...body, status: 'draft' });
  } finally { await collection.doc(id).delete(); }
}

test('E20: crea draft con los cinco campos de explanation y conserva todos sus pasos', async () => {
  const token = await login();
  const before = await snapshot();
  await createAndCheck(token, valid);
  assert.deepEqual(await snapshot(), before);
});

test('E20: mantiene explicación de texto y acepta dos alternativas o cinco con respuesta E', async () => {
  const token = await login();
  await createAndCheck(token, { ...valid, options: ['No', 'Sí'], correctAnswer: 'B', explanation: 'Explicación antigua compatible.' });
  await createAndCheck(token, { ...valid, correctAnswer: 'E' });
});

test('E20: acepta las cinco pruebas y las cuatro dificultades del contrato', async () => {
  const token = await login();
  for (const testId of ['lectora', 'm1', 'm2', 'cien', 'hist']) await createAndCheck(token, { ...valid, testId });
  for (const difficulty of ['d1', 'd2', 'd3', 'd4']) await createAndCheck(token, { ...valid, difficulty });
});

for (const role of ['finance', 'support', 'ops']) {
  test(`E20: ${role} recibe 403 sin crear preguntas`, async () => {
    const token = await login(role);
    const before = await snapshot();
    const result = await request('POST', path, { token, body: valid });
    assert.equal(result.status, 403);
    assert.equal(result.json.error.code, 'AUTH_FORBIDDEN');
    assert.equal(result.json.data, null);
    assert.deepEqual(await snapshot(), before);
  });
}

test('E20: student recibe 403 y falta de token 401 sin escribir datos', async () => {
  const before = await snapshot();
  const token = jwt.sign({ sub: 'usr_demo_01', role: 'student', typ: 'access' }, DEMO_JWT, { expiresIn: 60 });
  for (const [candidate, status, code] of [[token, 403, 'AUTH_FORBIDDEN'], [undefined, 401, 'AUTH_REQUIRED']]) {
    const result = await request('POST', path, { token: candidate, body: valid });
    assert.equal(result.status, status);
    assert.equal(result.json.error.code, code);
    assert.equal(result.json.data, null);
  }
  assert.deepEqual(await snapshot(), before);
});

test('E20: todos los campos son obligatorios y no se aceptan tipos o enums inválidos', async () => {
  const token = await login();
  const before = await snapshot();
  const missing = Object.keys(valid).map(key => {
    const body = { ...valid }; delete body[key]; return body;
  });
  const bodies = [null, [], 'texto', {}, ...missing,
    ...['', 'otro', null, ['m1'], 1].map(testId => ({ ...valid, testId })),
    ...['', 'd5', null, ['d1']].map(difficulty => ({ ...valid, difficulty })),
    ...['axis', 'statement', 'requiredSkill'].flatMap(key => ['', '   ', null, 1, false, [], {}].map(value => ({ ...valid, [key]: value }))),
    { ...valid, axis: 'a'.repeat(201) }, { ...valid, statement: 'a'.repeat(20001) },
    { ...valid, requiredSkill: 'a'.repeat(2001) },
    { ...valid, status: 'published' }, { ...valid, status: 'draft' }, { ...valid, id: 'qst_demo_01' },
  ];
  for (const body of bodies) {
    const result = await request('POST', path, { token, body });
    assert.equal(result.status, 400, JSON.stringify(body));
    assert.ok(['VALIDATION_ERROR', 'INVALID_CORRECT_ANSWER'].includes(result.json.error.code));
    assert.equal(result.json.data, null);
    assert.ok(Array.isArray(result.json.error.details));
  }
  assert.deepEqual(await snapshot(), before);
});

test('E20: alternativas inválidas o respuesta inexistente no crean preguntas ni cambian la letra', async () => {
  const token = await login();
  const before = await snapshot();
  for (const options of [null, 'texto', {}, [], ['única'], ['1', '2', '3', '4', '5', '6'], ['A', ''], ['A', null], ['A', {}], ['A', 'x'.repeat(5001)]]) {
    const result = await request('POST', path, { token, body: { ...valid, options } });
    assert.equal(result.status, 400);
    assert.equal(result.json.error.code, 'VALIDATION_ERROR');
  }
  for (const correctAnswer of ['C', 'E', 'F', 'a', '', 'AB', null, 1, ['A']]) {
    const result = await request('POST', path, { token, body: { ...valid, options: ['A', 'B'], correctAnswer } });
    assert.equal(result.status, 400);
    assert.equal(result.json.error.code, 'INVALID_CORRECT_ANSWER');
    assert.equal(result.json.error.field, 'correctAnswer');
    assert.equal(result.json.data, null);
  }
  assert.deepEqual(await snapshot(), before);
});

test('E20: valida explanation completo y rechaza objetos malformados sin guardar parcialmente', async () => {
  const token = await login();
  const before = await snapshot();
  const missing = Object.keys(explanation).map(key => {
    const value = { ...explanation }; delete value[key]; return value;
  });
  const values = ['', '   ', null, 1, false, [], {}, ...missing,
    ...['title', 'subject', 'verification', 'keyConcept'].flatMap(key => ['', null, [], {}].map(value => ({ ...explanation, [key]: value }))),
    { ...explanation, title: 'x'.repeat(201) }, { ...explanation, subject: 'x'.repeat(201) },
    { ...explanation, keyConcept: 'x'.repeat(2001) }, { ...explanation, verification: 'x'.repeat(20001) },
    { ...explanation, extra: 'dato ajeno' },
    ...[[], null, {}, ['texto'], [null], [{}], [{ label: 'Paso' }], [{ body: 'Texto' }],
      [{ label: '', body: 'Texto' }], [{ label: 'Paso', body: 1 }],
      [{ label: 'Paso', body: 'Texto', extra: true }],
      Array.from({ length: 101 }, () => ({ label: 'Paso', body: 'Texto' })),
    ].map(steps => ({ ...explanation, steps })),
  ];
  for (const value of values) {
    const result = await request('POST', path, { token, body: { ...valid, explanation: value } });
    assert.equal(result.status, 400);
    assert.equal(result.json.error.code, 'VALIDATION_ERROR');
    assert.match(result.json.error.field, /^explanation/);
    assert.equal(result.json.data, null);
  }
  assert.deepEqual(await snapshot(), before);
});
