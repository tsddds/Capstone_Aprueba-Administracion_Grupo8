import { Router } from 'express';
import { ok, created, noContent, fail } from '../lib/envelope.js';
import { wrap } from '../middleware/error.js';
import { requireRole } from '../middleware/auth.js';
import { adminRoute, bodyObject, text, enumeration, invalid, identifier } from '../lib/admin-validation.js';
import { COL, listAll, addDoc } from '../data/repo.js';
import { updateSponsor, deactivateSponsor } from '../data/sponsors.js';

const r = Router();
const TIERS = ['Bronze', 'Silver', 'Gold'];

r.get('/sponsors', requireRole('admin'), wrap(async (req, res) => {
  const { limit = '20', page, cursor, sort = 'name' } = req.query;
  const invalid = () => fail(res, 400, 'VALIDATION_ERROR', 'Paginación u orden inválidos');
  const positiveInteger = value => typeof value === 'string' && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value));
  if (!positiveInteger(limit) || Number(limit) > 100) return invalid();
  if (page !== undefined && (!positiveInteger(page) || cursor !== undefined)) return invalid();
  if (typeof sort !== 'string') return invalid();
  const descending = sort.startsWith('-');
  const field = descending ? sort.slice(1) : sort;
  const fields = ['id', 'name', 'tier', 'monthlyFee', 'benefitsOffered', 'benefitsRedeemed', 'status'];
  if (!fields.includes(field)) return invalid();
  const size = Number(limit);
  let offset = (Number(page ?? 1) - 1) * size;
  if (!Number.isSafeInteger(offset)) return invalid();
  if (cursor !== undefined) {
    if (typeof cursor !== 'string' || !/^[A-Za-z0-9_-]+$/.test(cursor) || cursor.length > 512) return invalid();
    try {
      const decoded = Buffer.from(cursor, 'base64url');
      if (decoded.toString('base64url') !== cursor) return invalid();
      const position = JSON.parse(decoded.toString('utf8'));
      if (position?.version !== 1 || position.sort !== sort || !Number.isSafeInteger(position.offset) || position.offset < 0) return invalid();
      offset = position.offset;
    } catch { return invalid(); }
  }
  const rows = (await listAll(COL.sponsors)).filter(sponsor => !sponsor.deletedAt);
  rows.sort((a, b) => {
    const left = a[field], right = b[field];
    const order = left === right ? 0 : left == null ? -1 : right == null ? 1 : left < right ? -1 : 1;
    const tie = a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    return (descending ? -1 : 1) * (order || tie);
  });
  const result = rows.slice(offset, offset + size);
  const nextOffset = offset + result.length;
  const nextCursor = nextOffset < rows.length
    ? Buffer.from(JSON.stringify({ version: 1, offset: nextOffset, sort })).toString('base64url') : null;
  return ok(res, result, 200, { pagination: { limit: size, total: rows.length, nextCursor } });
}));

r.post('/sponsors', requireRole('admin'), adminRoute(async (req, res) => {
  const input = bodyObject(req.body, ['name', 'tier', 'monthlyFee', 'benefits']);
  const name = text(input.name, 'name');
  const tier = enumeration(input.tier, 'tier', TIERS);
  const monthlyFee = input.monthlyFee;
  if (typeof monthlyFee !== 'number' || !Number.isFinite(monthlyFee) || monthlyFee < 0) invalid('monthlyFee');
  const source = input.benefits === undefined ? [] : input.benefits;
  if (!Array.isArray(source)) invalid('benefits');
  const benefits = source.map((value, i) => {
    const field = `benefits.${i}`;
    if (!value || Array.isArray(value) || typeof value !== 'object') invalid(field);
    for (const key of Object.keys(value)) {
      if (!['name', 'description', 'costPlatinum', 'stock'].includes(key)) invalid(`${field}.${key}`);
    }
    const benefit = { name: text(value.name, `${field}.name`) };
    if (value.description !== undefined) {
      if (typeof value.description !== 'string' || value.description.length > 2000) invalid(`${field}.description`);
      benefit.description = value.description.trim();
    }
    for (const key of ['costPlatinum', 'stock']) {
      if (!Number.isSafeInteger(value[key]) || value[key] < 0) invalid(`${field}.${key}`);
      benefit[key] = value[key];
    }
    return benefit;
  });
  const doc = await addDoc(COL.sponsors, {
    name, tier, monthlyFee,
    benefitsOffered: benefits.length, benefitsRedeemed: 0, status: 'ok', benefits,
  });
  return created(res, doc);
}));

r.patch('/sponsors/:id', requireRole('admin'), adminRoute(async (req, res) => {
  const id = identifier(req.params.id);
  const allowed = ['name', 'tier', 'monthlyFee', 'status', 'benefitsOffered'];
  const input = bodyObject(req.body, allowed);
  if (!Object.keys(input).length) invalid(null, 'Debe indicar al menos un campo para actualizar');
  const patch = {};
  if ('name' in input) patch.name = text(input.name, 'name');
  if ('tier' in input) patch.tier = enumeration(input.tier, 'tier', TIERS);
  if ('status' in input) patch.status = enumeration(input.status, 'status', ['ok', 'deg', 'down']);
  if ('monthlyFee' in input) {
    if (typeof input.monthlyFee !== 'number' || !Number.isFinite(input.monthlyFee) || input.monthlyFee < 0) invalid('monthlyFee');
    patch.monthlyFee = input.monthlyFee;
  }
  if ('benefitsOffered' in input) {
    if (!Number.isSafeInteger(input.benefitsOffered) || input.benefitsOffered < 0) invalid('benefitsOffered');
    patch.benefitsOffered = input.benefitsOffered;
  }
  const doc = await updateSponsor(id, patch);
  if (!doc) return fail(res, 404, 'NOT_FOUND', 'Sponsor no encontrado');
  return ok(res, doc);
}));

r.delete('/sponsors/:id', requireRole('admin'), adminRoute(async (req, res) => {
  const removed = await deactivateSponsor(identifier(req.params.id));
  if (!removed) return fail(res, 404, 'NOT_FOUND', 'Sponsor no encontrado');
  return noContent(res);
}));

export default r;
