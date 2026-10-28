import { fail } from './envelope.js';
export class AdminError extends Error {
  constructor(status, code, message, field = null) { super(message); Object.assign(this, { status, code, field }); }
}
export function invalid(field, message = 'Valor no válido') { throw new AdminError(400, 'VALIDATION_ERROR', message, field); }
export function bodyObject(body, fields) {
  if (!body || Array.isArray(body) || typeof body !== 'object') invalid(null, 'Se requiere un objeto JSON');
  for (const k of Object.keys(body)) if (!fields.includes(k)) invalid(k, 'Campo no permitido');
  return body;
}
export const idValid = id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(id);
export function identifier(id, field = 'id') { if (!idValid(id)) invalid(field); return id; }
export function text(value, field, max = 200) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) invalid(field);
  return value.trim();
}
export function email(value) {
  const result = text(value, 'email', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) invalid('email', 'Correo no válido');
  return result;
}
export function enumeration(value, field, options) {
  if (!options.includes(value)) invalid(field);
  return value;
}
export function adminRoute(fn) {
  return async (req, res, next) => {
    try { await fn(req, res); }
    catch (e) {
      if (e instanceof AdminError) return fail(res, e.status, e.code, e.message, e.field ? [{ field: e.field, message: e.message }] : [], e.field);
      next(e);
    }
  };
}
export function pick(source, fields) {
  return Object.fromEntries(fields.filter(k => source?.[k] !== undefined).map(k => [k, source[k]]));
}
