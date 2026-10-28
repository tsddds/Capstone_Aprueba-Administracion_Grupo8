import { Router } from 'express';
import { ok } from '../lib/envelope.js';
import { requireRole } from '../middleware/auth.js';
import { COL,listAll } from '../data/repo.js';
import { adminRoute,identifier,pick } from '../lib/admin-validation.js';
import { services,containers,restart } from '../data/admin-ops.js';
const r=Router();
r.get('/platforms',requireRole('ops'),adminRoute(async(_req,res)=>
  ok(res,(await listAll(COL.platforms)).map(p=>pick(p,['platform','version','available','downloads','updatedAt','source'])))));
r.get('/services',requireRole('ops'),adminRoute(async(_req,res)=>ok(res,await services())));
r.get('/containers',requireRole('ops'),adminRoute(async(_req,res)=>ok(res,await containers())));
r.post('/containers/:name/restart',requireRole('ops'),adminRoute(async(req,res)=>
  ok(res,await restart(identifier(req.params.name,'name'),req.user),202)));
export default r;
