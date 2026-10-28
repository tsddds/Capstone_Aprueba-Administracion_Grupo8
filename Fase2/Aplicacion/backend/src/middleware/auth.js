import { verify } from '../lib/jwt.js';
import { fail } from '../lib/envelope.js';
import { COL, getDoc } from '../data/repo.js';
const roles = ['admin', 'support', 'finance', 'ops'];
export async function authRequired(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return fail(res, 401, 'AUTH_REQUIRED', 'Falta el token de acceso');
  let payload;
  try { payload = verify(token); }
  catch (e) { return fail(res, 401, e.name === 'TokenExpiredError' ? 'AUTH_TOKEN_EXPIRED' : 'AUTH_REQUIRED', 'Token inválido o expirado'); }
  if (payload.typ !== 'access' || typeof payload.sub !== 'string' || !/^[\w-]{1,128}$/.test(payload.sub)) return fail(res, 401, 'AUTH_REQUIRED', 'Token de acceso inválido');
  if (!roles.includes(payload.role)) return fail(res, 403, 'AUTH_FORBIDDEN', 'Rol no autorizado');
  try {
    const user = await getDoc(COL.adminUsers, payload.sub);
    if (!user || user.disabled === true || ['suspended', 'churned', 'disabled'].includes(user.state)) return fail(res, 401, 'AUTH_REQUIRED', 'Cuenta no disponible');
    if (user.role !== payload.role) return fail(res, 403, 'AUTH_FORBIDDEN', 'Los permisos cambiaron; inicie sesión nuevamente');
    req.user = { id: payload.sub, name: user.name, role: user.role }; next();
  } catch (e) { next(e); }
}
export function requireRole(...allowed) {
  return (req, res, next) => {
    if (!req.user) return fail(res, 401, 'AUTH_REQUIRED', 'No autenticado');
    if (req.user.role === 'admin' || allowed.includes(req.user.role)) return next();
    return fail(res, 403, 'AUTH_FORBIDDEN', 'El rol no autoriza esta acción');
  };
}
