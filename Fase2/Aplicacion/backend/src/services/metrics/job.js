import { createHash, timingSafeEqual } from 'node:crypto';
import { ok, fail } from '../../lib/envelope.js';
import { AdminError } from '../../lib/admin-validation.js';

// Disparador de infraestructura, separado de los 27 endpoints administrativos.
// La autenticación de usuarios/JWT no concede permiso para ejecutar este trabajo.
export function metricsJob({ refresh, secret = () => process.env.CRON_SECRET }) {
  return async (req, res, next) => {
    if (req.method !== 'GET') {
      res.set('Allow', 'GET');
      return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Método no permitido');
    }
    const expected = secret();
    if (typeof expected !== 'string' || expected.length < 32)
      return fail(res, 503, 'METRICS_JOB_NOT_CONFIGURED', 'El disparador de métricas no está configurado');
    const authorization = req.get('authorization');
    const digest = value => createHash('sha256').update(value).digest();
    if (typeof authorization !== 'string' || !timingSafeEqual(digest(authorization), digest(`Bearer ${expected}`)))
      return fail(res, 401, 'AUTH_REQUIRED', 'Autorización de infraestructura requerida');
    res.set('Cache-Control', 'no-store');
    try {
      const result = await refresh();
      return ok(res, { updated: true, generatedAt: result.generatedAt, ranges: result.ranges });
    } catch (error) {
      if (error instanceof AdminError) return fail(res, error.status, error.code, error.message);
      next(error);
    }
  };
}
