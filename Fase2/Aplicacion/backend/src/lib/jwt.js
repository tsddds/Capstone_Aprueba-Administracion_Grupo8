import jwt from 'jsonwebtoken';
const SECRET = process.env.JWT_SECRET;
if (typeof SECRET !== 'string' || Buffer.byteLength(SECRET) < 32) throw new Error('JWT_SECRET debe configurarse con al menos 32 bytes; no existe secreto por defecto');
export const ACCESS_TTL = 900;
export const REFRESH_TTL = 2592000;
export function signAccess(user) {
  return jwt.sign({ sub: user.id, name: user.name, role: user.role, plan: user.plan || 'free', typ: 'access' }, SECRET, { algorithm: 'HS256', expiresIn: ACCESS_TTL });
}
export function signRefresh(user) {
  return jwt.sign({ sub: user.id, role: user.role, plan: user.plan || 'free', typ: 'refresh' }, SECRET, { algorithm: 'HS256', expiresIn: REFRESH_TTL });
}
export function verify(token) { return jwt.verify(token, SECRET, { algorithms: ['HS256'] }); }
