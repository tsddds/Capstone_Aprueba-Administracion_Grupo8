import { fail } from '../lib/envelope.js';

export function notFound(req, res) {
  return fail(res, 404, 'NOT_FOUND', `Ruta no encontrada: ${req.method} ${req.path}`);
}
export function errorHandler(err, req, res, _next) {
  // Nunca registrar cuerpos, contraseñas ni mensajes de proveedores con credenciales.
  if (err.type === 'entity.parse.failed') return fail(res, 400, 'VALIDATION_ERROR', 'JSON inválido');
  if (err.type === 'entity.too.large') return fail(res, 413, 'VALIDATION_ERROR', 'Solicitud demasiado grande');
  console.error('[error]', err.name || 'Error');
  return fail(res, 500, 'INTERNAL_ERROR', 'Error interno del servidor');
}
// Helper para envolver handlers async y propagar errores.
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
