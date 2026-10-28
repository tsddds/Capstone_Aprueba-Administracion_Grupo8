import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuestionImport } from '../src/api/question-import.js';

test('Importación acepta array y sobre testId/items sin modificar explicación estructurada', () => {
  const items = [{ pregunta: 'Ejemplo', explicacion_respuesta: {
    title: 'Título', subject: 'Materia', steps: [{ label: 'Paso', body: 'Texto' }], verification: 'Verificar', keyConcept: 'Clave',
  } }];
  assert.deepEqual(parseQuestionImport(JSON.stringify(items), 'm1'), { testId: 'm1', items });
  assert.deepEqual(parseQuestionImport(JSON.stringify({ testId: 'm2', items })), { testId: 'm2', items });
});

test('Importación no reemplaza silenciosamente una prueba distinta a la del archivo', () => {
  assert.throws(() => parseQuestionImport('{"testId":"m2","items":[{}]}', 'm1'), /q_import_test_conflict/);
});

test('Importación detecta JSON inválido, prueba ausente y límites del lote', () => {
  for (const text of ['[', 'null', '3', '{"items":{}}', '{"items":[{}],"extra":true}']) {
    assert.throws(() => parseQuestionImport(text, 'm1'), /q_import_invalid/);
  }
  assert.throws(() => parseQuestionImport('[{}]'), /q_import_test_required/);
  assert.throws(() => parseQuestionImport('[]', 'm1'), /q_import_limit/);
  assert.throws(() => parseQuestionImport(JSON.stringify(Array.from({ length: 101 }, () => ({}))), 'm1'), /q_import_limit/);
});


test('Importación conserva el código b1 de Biología de las preguntas originales', () => {
  assert.deepEqual(parseQuestionImport(JSON.stringify({ testId: 'b1', items: [{ pregunta: 'Biología' }] })), { testId: 'b1', items: [{ pregunta: 'Biología' }] });
});
