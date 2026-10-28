import { createHash } from 'node:crypto';
import { AdminError, bodyObject, enumeration, invalid } from './admin-validation.js';
import { QUESTION_TESTS, validateQuestion } from './question-validation.js';

// Identidad de importación: prueba + enunciado con espacios normalizados.
// No se ignoran mayúsculas: pueden ser relevantes en fórmulas. Nunca sobrescribe.
export function questionImportKey(question) {
  const statement = question.statement.normalize('NFC').trim().replace(/\s+/gu, ' ');
  return createHash('sha256').update(JSON.stringify([question.testId, statement])).digest('hex');
}

const sourceFields = {
  statement: 'pregunta', options: 'alternativas', correctAnswer: 'respuesta_correcta',
  explanation: 'explicacion_respuesta', requiredSkill: 'habilidad_requerida', axis: 'eje', difficulty: 'dificultad',
};
const formatError = () => { throw new AdminError(400, 'IMPORT_FORMAT_ERROR', 'Se requiere un lote de entre 1 y 100 preguntas de origen', 'items'); };

function normalizeItem(item, testId) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new AdminError(400, 'IMPORT_FORMAT_ERROR', 'La fila debe ser un objeto de pregunta', null);
  }
  bodyObject(item, [...Object.values(sourceFields), 'axis', 'difficulty']);
  for (const [canonical, alias] of [['eje', 'axis'], ['dificultad', 'difficulty']]) {
    if (canonical in item && alias in item && item[canonical] !== item[alias]) invalid(canonical, 'Los campos equivalentes no coinciden');
  }
  return validateQuestion({
    testId, statement: item.pregunta, options: item.alternativas, correctAnswer: item.respuesta_correcta,
    explanation: item.explicacion_respuesta, requiredSkill: item.habilidad_requerida,
    axis: item.eje ?? item.axis, difficulty: item.dificultad ?? item.difficulty,
  }, { allowMissingClassification: true });
}

// Cada fila es independiente; la escritura y su clave se confirman juntas.
export async function importQuestionBatch(body, { readExisting, write }) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) formatError();
  const input = bodyObject(body, ['testId', 'items']);
  enumeration(input.testId, 'testId', QUESTION_TESTS);
  if (!Array.isArray(input.items) || !input.items.length || input.items.length > 100) formatError();
  const existing = new Map();
  for (const row of await readExisting()) {
    if (typeof row.statement === 'string' && typeof row.testId === 'string') existing.set(questionImportKey(row), row.id);
  }
  const result = { imported: 0, skipped: 0, errors: [], duplicates: [] };
  for (const [index, item] of input.items.entries()) {
    let question;
    try { question = normalizeItem(item, input.testId); }
    catch (error) {
      if (!(error instanceof AdminError)) throw error;
      const parts = error.field?.split('.') ?? [];
      if (parts.length) parts[0] = sourceFields[parts[0]] ?? parts[0];
      result.errors.push({ index, code: error.code, field: parts.join('.') || null, message: error.message });
      continue;
    }
    const key = questionImportKey(question);
    try {
      const saved = await write(question, existing.get(key));
      existing.set(key, saved.id);
      if (saved.imported) result.imported++;
      else {
        result.skipped++;
        result.duplicates.push({ index, questionId: saved.id });
      }
    } catch {
      // No filtrar mensajes del proveedor ni contabilizar como importada una fila fallida.
      result.errors.push({ index, code: 'IMPORT_WRITE_ERROR', field: null, message: 'No se pudo guardar esta pregunta; puede reintentar el lote.' });
    }
  }
  return result;
}
