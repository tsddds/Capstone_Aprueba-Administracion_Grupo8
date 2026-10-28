import { Router } from 'express';
import { ok, created, fail } from '../lib/envelope.js';
import { requireRole } from '../middleware/auth.js';
import { COL, listAll, addDoc } from '../data/repo.js';
import { adminRoute, text, enumeration, invalid, bodyObject, identifier } from '../lib/admin-validation.js';
import { updateQuestion } from '../data/questions.js';
import { importQuestions } from '../data/question-import.js';
import { paginate } from '../lib/admin-pagination.js';
import { validateQuestion, QUESTION_FIELDS, QUESTION_TESTS, QUESTION_DIFFICULTIES, QUESTION_STATUSES } from '../lib/question-validation.js';

const r = Router();

r.get('/questions', requireRole('admin'), adminRoute(async (req, res) => {
  const filterKeys = ['testId', 'axis', 'difficulty', 'status'];
  const query = { ...req.query };
  const tests = QUESTION_TESTS;
  for (const key of Object.keys(query)) {
    if (![...filterKeys, 'limit', 'page', 'cursor', 'sort'].includes(key)) invalid(key);
  }
  if (query.testId !== undefined) enumeration(query.testId, 'testId', tests);
  if (query.axis !== undefined) query.axis = text(query.axis, 'axis');
  if (query.difficulty !== undefined) enumeration(query.difficulty, 'difficulty', QUESTION_DIFFICULTIES);
  if (query.status !== undefined) enumeration(query.status, 'status', QUESTION_STATUSES);
  const all = await listAll(COL.questions);
  const rows = all.filter(question => filterKeys.every(key => query[key] === undefined || question[key] === query[key]));
  const summary = {
    published: rows.filter(q => q.status === 'published').length,
    draft: rows.filter(q => q.status === 'draft').length,
    tests: new Set(rows.map(q => q.testId).filter(Boolean)).size,
  };
  const { items, pagination } = paginate(rows, query, {
    fields: ['id', 'testId', 'axis', 'difficulty', 'status', 'statement'], filterKeys,
  });
  return ok(res, items, 200, {
    pagination, summary,
    filters: { testIds: tests, axes: [...new Set(all.map(q => q.axis).filter(value => typeof value === 'string' && value.trim()))].sort() },
  });
}));

r.post('/questions', requireRole('admin'), adminRoute(async (req, res) => {
  const question = validateQuestion(req.body);
  const doc = await addDoc(COL.questions, { ...question, status: 'draft' });
  return created(res, { id: doc.id, status: doc.status });
}));

r.put('/questions/:id', requireRole('admin'), adminRoute(async (req, res) => {
  const id = identifier(req.params.id);
  const patch = bodyObject(req.body, [...QUESTION_FIELDS, 'status']);
  if (!Object.keys(patch).length) invalid(null, 'Debe indicar al menos un campo para actualizar');
  const doc = await updateQuestion(id, patch);
  if (!doc) return fail(res, 404, 'NOT_FOUND', 'Pregunta no encontrada');
  return ok(res, doc);
}));

// POST /admin/questions/import — formato de origen (archivos JSON por materia)
r.post('/questions/import', requireRole('admin'), adminRoute(async (req, res) => {
  return created(res, await importQuestions(req.body));
}));

export default r;
