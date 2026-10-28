import { Router } from 'express';
import { ok } from '../lib/envelope.js';
import { adminRoute } from '../lib/admin-validation.js';
import { requireRole } from '../middleware/auth.js';
import { getMetrics } from '../services/metrics/store.js';

const r = Router();

// E02: el contrato original reserva el resumen ejecutivo a admin.
r.get('/metrics/overview', requireRole('admin'), adminRoute(async (req, res) => {
  return ok(res, await getMetrics('overview',req.query.range), 200, { range: req.query.range || '30d' });
}));

// GET /admin/metrics/commercial  (Bearer finance/admin)
r.get('/metrics/commercial', requireRole('finance'), adminRoute(async (req, res) => {
  return ok(res, await getMetrics('commercial',req.query.range), 200, { range: req.query.range || '30d' });
}));

export default r;
