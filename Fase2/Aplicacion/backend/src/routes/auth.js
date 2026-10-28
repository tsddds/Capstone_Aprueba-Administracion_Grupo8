import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { ok, fail } from '../lib/envelope.js';
import { signAccess, signRefresh, verify, ACCESS_TTL, REFRESH_TTL } from '../lib/jwt.js';
import { COL, listAll, getDoc, db } from '../data/repo.js';
import { adminRoute, bodyObject, email, invalid } from '../lib/admin-validation.js';
import { verifyTotp } from '../lib/totp.js';
const r = Router();
export const administrative = user => user && ['admin', 'support', 'finance', 'ops'].includes(user.role)
  && !['suspended', 'churned', 'disabled'].includes(user.state) && user.disabled !== true;
const publicUser = u => ({ id: u.id, name: u.name, role: u.role, email: u.email, plan: u.plan || 'free' });
function issue(res, user) {
  const pub = publicUser(user), refreshToken = signRefresh(pub);
  res.cookie('aprueba_admin_refresh', refreshToken, { httpOnly: true, secure: true, sameSite: 'strict',
    path: '/api/v1/admin/auth', maxAge: REFRESH_TTL * 1000 });
  res.set('Cache-Control', 'no-store');
  return ok(res, { user: pub, accessToken: signAccess(pub), refreshToken, expiresIn: ACCESS_TTL });
}
r.post('/auth/login', adminRoute(async (req, res) => {
  const input = bodyObject(req.body, ['email', 'password', 'otp']);
  const address = email(input.email);
  if (typeof input.password !== 'string' || !input.password.length || Buffer.byteLength(input.password) > 72) invalid('password');
  if (input.otp !== undefined && input.otp !== '' && (typeof input.otp !== 'string' || !/^\d{6}$/.test(input.otp))) invalid('otp');
  const users = await listAll(COL.adminUsers);
  const matches = users.filter(u => typeof u.email === 'string' && u.email.trim().toLowerCase() === address);
  const user = matches.length === 1 ? matches[0] : null;
  const passwordMatches = user && typeof user.passwordHash === 'string' && await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordMatches || !administrative(user)) return fail(res, 401, 'AUTH_INVALID_CREDENTIALS', 'Credenciales incorrectas');
  if (user.mfaEnabled) {
    let step;
    try { step = verifyTotp(user.mfaSecret, input.otp, Date.now(), user.mfaLastCounter ?? -1); }
    catch { return fail(res, 503, 'SERVICE_UNAVAILABLE', 'Segundo factor no configurado correctamente'); }
    if (step === null) return fail(res, 401, 'MFA_REQUIRED', 'Se requiere código de segundo factor válido');
    const accepted = await db.runTransaction(async tx => {
      const ref = db.collection(COL.adminUsers).doc(user.id), snap = await tx.get(ref), current = snap.data();
      if (!administrative(current) || current.mfaSecret !== user.mfaSecret || step <= (current.mfaLastCounter ?? -1)) return false;
      tx.update(ref, { mfaLastCounter: step }); return true;
    });
    if (!accepted) return fail(res, 401, 'MFA_REQUIRED', 'El código ya fue utilizado; espere un código nuevo');
  }
  return issue(res, user);
}));
// Ruta heredada auxiliar, no agrega un endpoint al contrato de 27.
r.post('/auth/refresh', adminRoute(async (req, res) => {
  const input = bodyObject(req.body, ['refreshToken']);
  if (typeof input.refreshToken !== 'string') invalid('refreshToken');
  let payload;
  try { payload = verify(input.refreshToken); } catch { return fail(res, 401, 'AUTH_REQUIRED', 'Refresh token inválido'); }
  if (payload.typ !== 'refresh' || typeof payload.sub !== 'string' || !/^[\w-]{1,128}$/.test(payload.sub)) return fail(res, 401, 'AUTH_REQUIRED', 'Tipo de token inválido');
  const user = await getDoc(COL.adminUsers, payload.sub);
  if (!administrative(user)) return fail(res, 401, 'AUTH_REQUIRED', 'Cuenta no disponible');
  return issue(res, user);
}));
export default r;
