import { Router } from 'express';
import { ok, fail } from '../lib/envelope.js';
import { requireRole } from '../middleware/auth.js';
import { COL, listAll, getDoc } from '../data/repo.js';
import { adminRoute, identifier, invalid, enumeration, email, bodyObject, text } from '../lib/admin-validation.js';
import { paginate } from '../lib/admin-pagination.js';
import { userSummary, userDetail, updateUser } from '../data/admin-support.js';
const r = Router();
r.get('/users', requireRole('support'), adminRoute(async (req,res) => {
  const query = req.query;
  if (query.q !== undefined && (typeof query.q !== 'string' || query.q.length > 200)) invalid('q');
  if (query.state !== undefined) enumeration(query.state, 'state', ['active','suspended','churned']);
  if (query.plan !== undefined) enumeration(query.plan, 'plan', ['free','uni','all']);
  let users = (await listAll(COL.users)).map(userSummary);
  if (query.q?.trim()) {
    const q = query.q.trim().toLowerCase();
    users = users.filter(u => [u.name,u.email].some(s => typeof s === 'string' && s.toLowerCase().includes(q)));
  }
  if (query.state) users = users.filter(u => u.state === query.state);
  if (query.plan) users = users.filter(u => u.plan === query.plan);
  const {items,pagination} = paginate(users, query, { fields:['name','email','createdAt','lastActivity','id'], defaultSort:'name', filterKeys:['q','state','plan'] });
  return ok(res, items, 200, {pagination});
}));
r.get('/users/:id', requireRole('support'), adminRoute(async (req,res) => {
  const user = await getDoc(COL.users, identifier(req.params.id));
  if (!user) return fail(res,404,'NOT_FOUND','Usuario no encontrado');
  return ok(res, await userDetail(user));
}));
r.patch('/users/:id', requireRole('support'), adminRoute(async (req,res) => {
  const id = identifier(req.params.id), input = bodyObject(req.body, ['state','email','plan','reason']), patch = {};
  if ('state' in input) patch.state = enumeration(input.state,'state',['active','suspended']);
  if ('email' in input) patch.email = email(input.email);
  if ('plan' in input) patch.plan = identifier(input.plan,'plan');
  if (!Object.keys(patch).length) invalid(null,'Debe indicar un cambio de estado, correo o plan');
  const reason = input.reason === undefined ? undefined : text(input.reason,'reason',2000);
  const user = await updateUser(id,patch,reason,req.user);
  return ok(res,userSummary(user));
}));
export default r;
