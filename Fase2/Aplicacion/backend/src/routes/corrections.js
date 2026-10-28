import { Router } from 'express';
import { ok } from '../lib/envelope.js';
import { requireRole } from '../middleware/auth.js';
import { COL, listAll } from '../data/repo.js';
import { adminRoute, bodyObject, enumeration, identifier, invalid, text } from '../lib/admin-validation.js';
import { paginate } from '../lib/admin-pagination.js';
import { correctionReferences, resolveCorrection } from '../data/corrections.js';
import { QUESTION_FIELDS } from '../lib/question-validation.js';

const r = Router();

r.get('/corrections', requireRole('support'), adminRoute(async (req, res) => {
  const query = req.query;
  for (const key of Object.keys(query)) if (!['state', 'limit', 'page', 'cursor', 'sort'].includes(key)) invalid(key);
  if (query.state !== undefined) enumeration(query.state, 'state', ['pending', 'confirmed', 'rejected']);
  const all = await listAll(COL.corrections);
  const rows = all.filter(row => query.state === undefined || row.state === query.state);
  const { items, pagination } = paginate(rows, query, {
    fields: ['id', 'createdAt', 'state', 'userId', 'questionId', 'reason'],
    defaultSort: 'createdAt', filterKeys: ['state'],
  });
  return ok(res, await correctionReferences(items), 200, {
    pagination, summary: { pending: all.filter(row => row.state === 'pending').length },
  });
}));

// PATCH /admin/corrections/:id — confirmar otorga 250 medallas de bronce al alumno
r.patch('/corrections/:id', requireRole('support'), adminRoute(async (req, res) => {
  const id = identifier(req.params.id);
  const body = bodyObject(req.body, ['resolution', 'questionPatch', 'note']);
  enumeration(body.resolution, 'resolution', ['confirmed', 'rejected']);
  if (body.note !== undefined) body.note = text(body.note, 'note', 2000);
  if (body.questionPatch !== undefined) {
    if (body.resolution !== 'confirmed') invalid('questionPatch', 'Solo se puede corregir una pregunta al confirmar');
    bodyObject(body.questionPatch, [...QUESTION_FIELDS, 'status']);
    if (!Object.keys(body.questionPatch).length) invalid('questionPatch');
  }
  return ok(res, await resolveCorrection(id, req.user.id, body));
}));

export default r;
