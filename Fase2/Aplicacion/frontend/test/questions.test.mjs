import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAllQuestions } from '../src/api/questions.js';
import { questionOptions, editableOptions } from '../src/api/question-options.js';

test('El catálogo de recorrecciones encuentra preguntas posteriores a la primera página', async () => {
  const calls = [];
  const rows = await loadAllQuestions(async path => {
    calls.push(path);
    return calls.length === 1
      ? { data: Array.from({ length: 100 }, (_, i) => ({ id: `q${i}` })), meta: { pagination: { nextCursor: 'next' } } }
      : { data: [{ id: 'question-for-correction' }], meta: { pagination: { nextCursor: null } } };
  });
  assert.equal(rows.length, 101);
  assert.equal(rows.at(-1).id, 'question-for-correction');
  assert.deepEqual(calls, ['/questions?limit=100', '/questions?limit=100&cursor=next']);
});

test('Un fallo posterior no entrega un catálogo incompleto de preguntas', async () => {
  let calls = 0;
  await assert.rejects(loadAllQuestions(async () => {
    if (++calls === 1) return { data: [{ id: 'q1' }], meta: { pagination: { nextCursor: 'next' } } };
    throw new Error('Sin conexión');
  }), /Sin conexión/);
});

test('Un catálogo vacío termina y un cursor repetido se rechaza', async () => {
  assert.deepEqual(await loadAllQuestions(async () => ({ data: [], meta: { pagination: { nextCursor: null } } })), []);
  await assert.rejects(loadAllQuestions(async () => ({ data: [], meta: { pagination: { nextCursor: 'same' } } })), /No se pudo completar/);
});

test('Las alternativas finales vacías se omiten conservando la letra correcta', () => {
  assert.deepEqual(questionOptions([' 3 ', ' 5 ', '', '', ''], 'B'), ['3', '5']);
  assert.deepEqual(questionOptions(['1', '2', '3', '4', '5'], 'E'), ['1', '2', '3', '4', '5']);
});

test('Un hueco intermedio no desplaza las letras de las alternativas', () => {
  const options = ['Primera', '', 'Tercera', '', ''];
  assert.throws(() => questionOptions(options, 'C'), /q_err_options/);
  assert.deepEqual(options, ['Primera', '', 'Tercera', '', '']);
});

test('La respuesta fuera de opciones no se cambia silenciosamente a A', () => {
  for (const correct of ['E', 'F', '', 'AB']) {
    assert.throws(() => questionOptions(['Una', 'Dos', '', '', ''], correct), /q_err_correct/);
  }
});

test('La edición de dos alternativas permite añadir hasta E sin alterar las existentes', () => {
  const saved = ['Tres', 'Cuatro'];
  const form = editableOptions(saved);
  assert.deepEqual(form, ['Tres', 'Cuatro', '', '', '']);
  assert.deepEqual(questionOptions(form, 'B'), saved);
  form[2] = 'Cinco';
  assert.deepEqual(questionOptions(form, 'C'), ['Tres', 'Cuatro', 'Cinco']);
  assert.deepEqual(saved, ['Tres', 'Cuatro']);
});
