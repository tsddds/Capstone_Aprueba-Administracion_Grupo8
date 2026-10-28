import { Router } from 'express';
import { ok } from '../lib/envelope.js';
import { requireRole } from '../middleware/auth.js';
import { COL, listAll, getDoc } from '../data/repo.js';
import { adminRoute, identifier, invalid, enumeration, bodyObject, text } from '../lib/admin-validation.js';
import { paginate } from '../lib/admin-pagination.js';
import { ticketView, updateTicket } from '../data/admin-support.js';
const r=Router();
r.get('/tickets', requireRole('support'), adminRoute(async (req,res) => {
  if (req.query.state !== undefined) enumeration(req.query.state,'state',['open','progress','closed']);
  if (req.query.priority !== undefined) enumeration(req.query.priority,'priority',['high','med','low']);
  let rows = await listAll(COL.tickets);
  if (req.query.state) rows = rows.filter(t => t.state === req.query.state);
  if (req.query.priority) rows = rows.filter(t => t.priority === req.query.priority);
  const {items,pagination} = paginate(rows,req.query,{ fields:['id','createdAt','priority','state'], defaultSort:'-createdAt', filterKeys:['state','priority'] });
  const users = new Map(await Promise.all([...new Set(items.map(t=>t.userId).filter(Boolean))].map(async id=>[id,await getDoc(COL.users,id)])));
  return ok(res,items.map(t=>ticketView(t,users.get(t.userId))),200,{pagination});
}));
r.patch('/tickets/:id', requireRole('support'), adminRoute(async (req,res) => {
  const id=identifier(req.params.id), input=bodyObject(req.body,['state','priority','assigneeId','reply']),patch={};
  if ('state' in input) patch.state=enumeration(input.state,'state',['open','progress','closed']);
  if ('priority' in input) patch.priority=enumeration(input.priority,'priority',['high','med','low']);
  if ('assigneeId' in input) patch.assigneeId=identifier(input.assigneeId,'assigneeId');
  const reply=input.reply===undefined?undefined:text(input.reply,'reply',10000);
  if (!Object.keys(patch).length && reply===undefined) invalid(null,'Debe indicar un cambio o respuesta');
  return ok(res,ticketView(await updateTicket(id,patch,reply,req.user)));
}));
export default r;
