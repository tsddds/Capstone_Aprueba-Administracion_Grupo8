import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { request, login } from './helper.mjs';
import { assertEmulatorOnly, DEMO_JWT } from '../../dev/safety.mjs';
import { db } from '../../src/data/repo.js';

assertEmulatorOnly(process.env, { testOnly: true });
const path = '/api/v1/admin/corrections';
const explanation = { title: ' Título original ', subject: 'M1', steps: [{ label: 'Paso 1', body: 'Sumar' }], verification: 'Comprobar', keyConcept: 'Adición' };
const initialQuestion = {
  testId: 'm1', axis: 'Números', difficulty: 'd1', statement: '¿Cuánto es 3 + 4?',
  options: ['4', '5', '6', '7', '8'], correctAnswer: 'C', explanation,
  requiredSkill: 'Sumar', status: 'flagged', sourceRef: 'origen-preservado',
};
const initialUser = { name: 'Alumno ficticio E18', badges: 37, medals: { bronze: 10, silver: 5, gold: 2 }, email: 'e18@example.test', subscription: { plan: 'uni' } };
async function fixture(fn, user = initialUser) {
  const u = db.collection('users').doc('usr_e18');
  const q = db.collection('questions').doc('qst_e18');
  const c = db.collection('corrections').doc('cor_e18');
  const initial = { userId: u.id, questionId: q.id, state: 'pending', reason: 'wrong_answer', comment: 'Ejemplo E18', createdAt: '2026-01-01T00:00:00.000Z' };
  const n = u.collection('notifications').doc(c.id);
  const m = u.collection('medalMovements').doc(c.id);
  await Promise.all([u.create(user), q.create(initialQuestion), c.create(initial)]);
  const snapshot = async () => Promise.all([u, q, c, n, m].map(async ref => (await ref.get()).data() ?? null));
  try { await fn({ u, q, c, n, m, initial, snapshot }); }
  finally { await Promise.all([db.recursiveDelete(u), q.delete(), c.delete(), db.collection('corrections').doc('cor_e18_second').delete()]); }
}
const resolve = (id, token, body = { resolution: 'confirmed' }) => request('PATCH', `${path}/${id}`, { token, body });

for (const role of ['admin', 'support']) {
  test(`E18: ${role} confirma y acredita exactamente 250 bronce con aviso y movimiento únicos`, async () => {
    const token = await login(role);
    await fixture(async ({ u, q, c, n, m, initial }) => {
      const result = await resolve(c.id, token, { resolution: 'confirmed', questionPatch: { correctAnswer: 'D' } });
      assert.equal(result.status, 200);
      assert.equal(result.json.error, null);
      assert.deepEqual(result.json.data, { id: c.id, state: 'confirmed', rewardGranted: { userId: u.id, tier: 'bronze', amount: 250 } });
      assert.equal(typeof result.json.meta.requestId, 'string');
      assert.deepEqual((await u.get()).data(), { ...initialUser, medals: { ...initialUser.medals, bronze: 260 } });
      assert.deepEqual((await q.get()).data(), { ...initialQuestion, correctAnswer: 'D' });
      const stored = (await c.get()).data();
      assert.deepEqual(stored, { ...initial, state: 'confirmed', resolvedBy: `adm_demo_${role}`, resolvedAt: stored.resolvedAt, rewardGranted: result.json.data.rewardGranted });
      assert.ok(Number.isFinite(Date.parse(stored.resolvedAt)));
      assert.deepEqual((await n.get()).data(), { type: 'correction_resolved', correctionId: c.id, state: 'confirmed', message: 'Tu recorrección fue confirmada. Recibiste 250 medallas de bronce.', createdAt: stored.resolvedAt, read: false });
      assert.deepEqual((await m.get()).data(), { correctionId: c.id, tier: 'bronze', amount: 250, createdAt: stored.resolvedAt, actorId: stored.resolvedBy });
    });
  });
}

test('E18: rechazar no cambia medallas ni pregunta y también guarda aviso', async () => {
  const token = await login('support');
  await fixture(async ({ u, q, c, n, m }) => {
    const result = await resolve(c.id, token, { resolution: 'rejected' });
    assert.equal(result.status, 200); assert.equal(result.json.data.rewardGranted, null);
    assert.deepEqual((await u.get()).data(), initialUser);
    assert.deepEqual((await q.get()).data(), initialQuestion);
    assert.equal((await c.get()).data().state, 'rejected');
    assert.equal((await n.get()).data().state, 'rejected');
    assert.equal((await m.get()).exists, false);
  });
});

test('E18: confirmación sin parche conserva la pregunta completa', async () => {
  const token = await login();
  await fixture(async ({ c, q }) => {
    assert.equal((await resolve(c.id, token)).status, 200);
    assert.deepEqual((await q.get()).data(), initialQuestion);
  });
});

for (const resolution of ['confirmed', 'rejected']) {
  test(`E18: ${resolution} conserva la nota interna sin incluirla en el aviso del alumno`, async () => {
    const token = await login('support');
    await fixture(async ({ c, n, m, u }) => {
      const note = 'Revisión interna: evidencia contrastada por soporte.';
      const result = await resolve(c.id, token, { resolution, note: `  ${note}  ` });
      assert.equal(result.status, 200);
      assert.equal((await c.get()).data().note, note);
      assert.equal((await n.get()).data().note, undefined);
      assert.ok(!(await n.get()).data().message.includes(note));
      assert.equal(result.json.data.note, undefined);
      assert.equal((await m.get()).exists, resolution === 'confirmed');
      assert.equal((await u.get()).data().medals.bronze, resolution === 'confirmed' ? 260 : 10);
    });
  });
}

test('E18: nota inválida se rechaza antes de escribir y acepta el límite de 2000 caracteres', async () => {
  const token = await login();
  await fixture(async ({ c, snapshot }) => {
    const before = await snapshot();
    for (const note of [null, 1, true, [], {}, '', '   ', 'x'.repeat(2001)]) {
      const result = await resolve(c.id, token, { resolution: 'rejected', note });
      assert.equal(result.status, 400);
      assert.equal(result.json.error.field, 'note');
      assert.deepEqual(await snapshot(), before);
    }
    assert.equal((await resolve(c.id, token, { resolution: 'rejected', note: 'x'.repeat(2000) })).status, 200);
    assert.equal((await c.get()).data().note.length, 2000);
  });
});

test('E18: repetir o competir con notas diferentes no sobrescribe la nota ni duplica efectos', async () => {
  const token = await login();
  await fixture(async ({ c, u, snapshot }) => {
    const notes = ['Nota del primer revisor', 'Nota del segundo revisor'];
    const results = await Promise.all(notes.map(note => resolve(c.id, token, { resolution: 'confirmed', note })));
    assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
    assert.equal((await c.get()).data().note, notes[results.findIndex(r => r.status === 200)]);
    assert.equal((await u.get()).data().medals.bronze, 260);
    const before = await snapshot();
    assert.equal((await resolve(c.id, token, { resolution: 'rejected', note: 'No sobrescribir' })).status, 409);
    assert.deepEqual(await snapshot(), before);
  });
});

test('E18: una escritura fallida revierte también la nota interna', async () => {
  const token = await login();
  await fixture(async ({ c, n, snapshot }) => {
    await n.create({ message: 'Aviso previo de prueba', read: true });
    const before = await snapshot();
    const result = await resolve(c.id, token, { resolution: 'confirmed', note: 'No debe persistir' });
    assert.equal(result.status, 500);
    assert.deepEqual(await snapshot(), before);
  });
});

test('E18: explicación estructurada completa y texto siguen siendo compatibles', async () => {
  const token = await login();
  for (const value of [{ ...explanation, title: 'Título actualizado', steps: [{ label: 'Nuevo', body: 'Desarrollo' }] }, 'Explicación de texto']) {
    await fixture(async ({ c, q }) => {
      assert.equal((await resolve(c.id, token, { resolution: 'confirmed', questionPatch: { correctAnswer: 'D', explanation: value } })).status, 200);
      assert.deepEqual((await q.get()).data(), { ...initialQuestion, correctAnswer: 'D', explanation: value });
    });
  }
});

test('E18: repetición y cambio de resolución devuelven 409 sin nuevos efectos', async () => {
  const token = await login();
  for (const first of ['confirmed', 'rejected']) {
    await fixture(async ({ c, snapshot }) => {
      assert.equal((await resolve(c.id, token, { resolution: first })).status, 200);
      const before = await snapshot();
      for (const resolution of ['confirmed', 'rejected']) {
        const result = await resolve(c.id, token, { resolution });
        assert.equal(result.status, 409); assert.equal(result.json.error.code, 'CORRECTION_ALREADY_RESOLVED');
        assert.equal(result.json.data, null);
      }
      assert.deepEqual(await snapshot(), before);
    });
  }
});

test('E18: dos confirmaciones simultáneas producen un éxito, un 409 y un único premio', async () => {
  const admin = await login(); const support = await login('support');
  await fixture(async ({ c, u }) => {
    const results = await Promise.all([resolve(c.id, admin), resolve(c.id, support)]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
    assert.equal(results.find(r => r.status === 409).json.error.code, 'CORRECTION_ALREADY_RESOLVED');
    assert.equal((await u.get()).data().medals.bronze, 260);
    assert.equal((await u.collection('notifications').get()).size, 1);
    assert.equal((await u.collection('medalMovements').get()).size, 1);
  });
});

test('E18: solicitudes distintas del mismo alumno acumulan 500 bronce sin perder saldo', async () => {
  const token = await login('support');
  await fixture(async ({ c, u, initial }) => {
    const second = db.collection('corrections').doc('cor_e18_second');
    await second.create(initial);
    const results = await Promise.all([resolve(c.id, token), resolve(second.id, token)]);
    assert.deepEqual(results.map(r => r.status), [200, 200]);
    assert.deepEqual((await u.get()).data(), { ...initialUser, medals: { ...initialUser.medals, bronze: 510 } });
    assert.equal((await u.collection('notifications').get()).size, 2);
    assert.equal((await u.collection('medalMovements').get()).size, 2);
  });
});

test('E18: errores de validación no dejan saldo, aviso, estado o pregunta parciales', async () => {
  const token = await login();
  await fixture(async ({ c, snapshot }) => {
    const before = await snapshot();
    const bodies = [null, [], {}, { resolution: 'other' }, { resolution: 'confirmed', userId: 'otro' },
      { resolution: 'rejected', questionPatch: { correctAnswer: 'D' } },
      ...[null, [], {}, { id: 'otro' }, { correctAnswer: 'F' }, { options: ['1', '2'] },
        { explanation: { keyConcept: 'Incompleta' } }, { statement: '' }, { status: 'unknown' },
      ].map(questionPatch => ({ resolution: 'confirmed', questionPatch })),
    ];
    for (const body of bodies) {
      const result = await resolve(c.id, token, body);
      assert.equal(result.status, 400, JSON.stringify(body));
      assert.ok(['VALIDATION_ERROR', 'INVALID_CORRECT_ANSWER'].includes(result.json.error.code));
      assert.equal(result.json.data, null);
    }
    assert.deepEqual(await snapshot(), before);
  });
});

test('E18: fallo al persistir aviso cancela también premio, movimiento, pregunta y resolución', async () => {
  const token = await login();
  await fixture(async ({ c, n, snapshot }) => {
    // Conflicto de create en la última escritura: comprueba rollback real del commit.
    await n.create({ message: 'Aviso previo de prueba', read: true });
    const before = await snapshot();
    const result = await resolve(c.id, token, { resolution: 'confirmed', questionPatch: { correctAnswer: 'D' } });
    assert.equal(result.status, 500); assert.equal(result.json.error.code, 'INTERNAL_ERROR');
    assert.deepEqual(await snapshot(), before);
  });
});

test('E18: referencias inexistentes o inválidas se rechazan sin resolver ni premiar', async () => {
  const token = await login();
  await fixture(async ({ c, snapshot, initial }) => {
    for (const links of [{ userId: 'usr_missing' }, { questionId: 'qst_missing' }, { userId: 'bad/id' }, { questionId: null }]) {
      await c.set({ ...initial, ...links });
      const before = await snapshot();
      const result = await resolve(c.id, token);
      assert.equal(result.status, Object.values(links)[0]?.includes?.('missing') ? 404 : 400);
      assert.deepEqual(await snapshot(), before);
    }
  });
  const missing = await resolve('cor_e18_missing', token);
  assert.equal(missing.status, 404); assert.equal(missing.json.error.code, 'NOT_FOUND');
  for (const id of ['bad.id', 'x'.repeat(129)]) assert.equal((await resolve(id, token)).status, 400);
});

test('E18: saldo ausente inicia en cero sin tomar badges como bronce; saldo inválido cancela', async () => {
  const token = await login();
  await fixture(async ({ c, u }) => {
    assert.equal((await resolve(c.id, token)).status, 200);
    assert.deepEqual((await u.get()).data(), { name: 'Legado', badges: 900, medals: { bronze: 250 } });
  }, { name: 'Legado', badges: 900 });
  for (const medals of [null, [], { bronze: null }, { bronze: -1 }, { bronze: '10' }, { bronze: 1.5 }, { bronze: Number.MAX_SAFE_INTEGER }]) {
    await fixture(async ({ c, snapshot }) => {
      const before = await snapshot();
      assert.equal((await resolve(c.id, token)).status, 400);
      assert.deepEqual(await snapshot(), before);
    }, { ...initialUser, medals });
  }
});

test('E18: permisos y tokens inválidos impiden toda escritura', async () => {
  const candidates = [];
  for (const role of ['finance', 'ops']) candidates.push([await login(role), 403, 'AUTH_FORBIDDEN']);
  candidates.push(
    [jwt.sign({ sub: 'usr_demo_01', role: 'student', typ: 'access' }, DEMO_JWT, { expiresIn: 60 }), 403, 'AUTH_FORBIDDEN'],
    [undefined, 401, 'AUTH_REQUIRED'], ['invalid', 401, 'AUTH_REQUIRED'],
    [jwt.sign({ sub: 'adm_demo_admin', role: 'admin', typ: 'access' }, DEMO_JWT, { expiresIn: -1 }), 401, 'AUTH_TOKEN_EXPIRED'],
    [jwt.sign({ sub: 'adm_demo_admin', role: 'admin', typ: 'refresh' }, DEMO_JWT, { expiresIn: 60 }), 401, 'AUTH_REQUIRED'],
  );
  await fixture(async ({ c, snapshot }) => {
    const before = await snapshot();
    for (const [token, status, code] of candidates) {
      const result = await resolve(c.id, token);
      assert.equal(result.status, status); assert.equal(result.json.error.code, code);
      assert.equal(result.json.data, null);
    }
    assert.deepEqual(await snapshot(), before);
  });
});
