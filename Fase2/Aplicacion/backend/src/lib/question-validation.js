import { AdminError, bodyObject, enumeration, invalid, text } from './admin-validation.js';

// b1 es el código de Biología utilizado por las preguntas originales.
export const QUESTION_TESTS = ['lectora', 'm1', 'm2', 'cien', 'hist', 'b1'];
export const QUESTION_DIFFICULTIES = ['d1', 'd2', 'd3', 'd4'];
export const QUESTION_STATUSES = ['draft', 'published', 'flagged', 'retired'];
export const QUESTION_FIELDS = ['testId', 'axis', 'difficulty', 'statement', 'options', 'correctAnswer', 'explanation', 'requiredSkill'];

export function validateExplanation(value) {
  if (typeof value === 'string') return text(value, 'explanation', 20000);
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('explanation');
  const fields = ['title', 'subject', 'steps', 'verification', 'keyConcept'];
  for (const key of Object.keys(value)) if (!fields.includes(key)) invalid(`explanation.${key}`);
  const result = {
    title: text(value.title, 'explanation.title'),
    subject: text(value.subject, 'explanation.subject'),
    verification: text(value.verification, 'explanation.verification', 20000),
    keyConcept: text(value.keyConcept, 'explanation.keyConcept', 2000),
  };
  if (!Array.isArray(value.steps) || !value.steps.length || value.steps.length > 100) invalid('explanation.steps');
  result.steps = value.steps.map((step, index) => {
    const field = `explanation.steps.${index}`;
    if (!step || typeof step !== 'object' || Array.isArray(step)) invalid(field);
    for (const key of Object.keys(step)) if (!['label', 'body'].includes(key)) invalid(`${field}.${key}`);
    return { label: text(step.label, `${field}.label`), body: text(step.body, `${field}.body`, 20000) };
  });
  return result;
}

// Una clasificación pendiente se conserva como null; los valores inválidos se rechazan.
const missingClassification = value => value == null || (typeof value === 'string' && !value.trim());

// Esquema completo compartible con la edición/importación, sin escribir datos.
export function validateQuestion(value, { allowMissingClassification = false } = {}) {
  const input = bodyObject(value, QUESTION_FIELDS);
  const result = {
    testId: enumeration(input.testId, 'testId', QUESTION_TESTS),
    axis: allowMissingClassification && missingClassification(input.axis) ? null : text(input.axis, 'axis'),
    difficulty: allowMissingClassification && missingClassification(input.difficulty) ? null : enumeration(input.difficulty, 'difficulty', QUESTION_DIFFICULTIES),
    statement: text(input.statement, 'statement', 20000),
  };
  if (!Array.isArray(input.options) || input.options.length < 2 || input.options.length > 5) invalid('options');
  result.options = input.options.map((option, index) => text(option, `options.${index}`, 5000));
  if (typeof input.correctAnswer !== 'string' || !'ABCDE'.slice(0, result.options.length).includes(input.correctAnswer) || input.correctAnswer.length !== 1) {
    throw new AdminError(400, 'INVALID_CORRECT_ANSWER', 'La alternativa correcta no existe en las opciones', 'correctAnswer');
  }
  result.correctAnswer = input.correctAnswer;
  result.explanation = validateExplanation(input.explanation);
  result.requiredSkill = text(input.requiredSkill, 'requiredSkill', 2000);
  return result;
}
