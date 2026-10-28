import { db, COL } from './repo.js';
import { AdminError, pick } from '../lib/admin-validation.js';
import { createHash } from 'node:crypto';
const summaryFields = ['id','name','email','country','plan','state','lastActivity','badges','createdAt'];
const subscriptionFields = ['id','plan','status','billingCycle','currentPeriodEnd','cancelAtPeriodEnd'];
const snapshot = s => ({ ...s.data(), id: s.id });
export const userSummary = u => pick(u, summaryFields);
export async function userDetail(user) {
  const subs = await db.collection('subscriptions').where('userId','==',user.id).get();
  const candidates = subs.docs.map(snapshot).sort((a,b) => (b.status === 'active') - (a.status === 'active') || String(b.currentPeriodEnd || '').localeCompare(String(a.currentPeriodEnd || '')));
  return { ...userSummary(user), ...pick(user, ['school','region','age','locale','streak','groups']),
    subscription: candidates[0] ? pick(candidates[0], subscriptionFields) : user.subscription ? pick(user.subscription, subscriptionFields) : null,
    medals: pick(user.medals || {}, ['bronze','silver','gold','diamond','platinum']),
    devices: (Array.isArray(user.devices) ? user.devices : []).map(d => pick(d, ['id','platform','lastSeenAt','createdAt'])),
    recentActivity: (Array.isArray(user.recentActivity) ? user.recentActivity : []).map(a => pick(a, ['type','occurredAt','description'])),
  };
}
export async function updateUser(id, patch, reason, actor) {
  const ref = db.collection(COL.users).doc(id), audit = db.collection('adminAudit').doc();
  const normalized = value => String(value || '').trim().toLowerCase();
  const claimRef = value => db.collection('adminEmailClaims').doc(createHash('sha256').update(value).digest('hex'));
  // Buscar usuarios legados sin bloquear toda la colección en la transacción.
  // Los cambios concurrentes nuevos se coordinan mediante la reserva por correo.
  const candidates = patch.email === undefined ? [] : (await db.collection(COL.users).get()).docs
    .filter(doc => doc.id !== id && normalized(doc.data().email) === patch.email).map(doc => doc.ref);
  return db.runTransaction(async tx => {
    const current = await tx.get(ref);
    if (!current.exists) throw new AdminError(404, 'NOT_FOUND', 'Usuario no encontrado');
    let target, previous, previousClaim;
    if (patch.email !== undefined) {
      target = claimRef(patch.email);
      const claim = await tx.get(target);
      if (claim.exists && claim.data().userId !== id)
        throw new AdminError(409, 'EMAIL_ALREADY_EXISTS', 'El nuevo correo ya está en uso', 'email');
      if (candidates.length) {
        const users = await tx.getAll(...candidates);
        if (users.some(doc => doc.exists && normalized(doc.data().email) === patch.email))
          throw new AdminError(409, 'EMAIL_ALREADY_EXISTS', 'El nuevo correo ya está en uso', 'email');
      }
      const oldEmail = normalized(current.data().email);
      if (oldEmail && oldEmail !== patch.email) {
        previous = claimRef(oldEmail); previousClaim = await tx.get(previous);
      }
    }
    if (patch.plan !== undefined) {
      const plan = await tx.get(db.collection(COL.plans).doc(patch.plan));
      if (!plan.exists) throw new AdminError(400, 'VALIDATION_ERROR', 'Plan inexistente', 'plan');
    }
    const at = new Date().toISOString(), before = current.data();
    const changes = Object.entries(patch).filter(([k,v]) => before[k] !== v).map(([field,after]) => ({field,before:before[field] ?? null,after}));
    if (changes.length) {
      tx.update(ref, { ...patch, updatedAt:at, auditedAt:at, auditedBy:actor.id, lastActionReason:reason ?? null });
      tx.create(audit, { entity:'user', entityId:id, actorId:actor.id, actorRole:actor.role, reason:reason ?? null, createdAt:at, changes });
    }
    if (target) {
      tx.set(target, { userId: id, email: patch.email });
      if (previousClaim?.exists && previousClaim.data().userId === id) tx.delete(previous);
    }
    return { ...before, ...patch, id };
  });
}
export async function updateTicket(id, patch, reply, actor) {
  const ref = db.collection(COL.tickets).doc(id);
  const audit = db.collection('adminAudit').doc(), replyRef = ref.collection('replies').doc();
  return db.runTransaction(async tx => {
    const current = await tx.get(ref);
    if (!current.exists) throw new AdminError(404, 'NOT_FOUND', 'Ticket no encontrado');
    if (patch.assigneeId !== undefined) {
      const assignee = await tx.get(db.collection(COL.adminUsers).doc(patch.assigneeId));
      const a = assignee.data();
      if (!a || !['admin','support'].includes(a.role) || a.disabled === true || ['suspended','disabled','churned'].includes(a.state))
        throw new AdminError(400, 'VALIDATION_ERROR', 'Agente de soporte no disponible', 'assigneeId');
    }
    const at = new Date().toISOString(), before = current.data();
    const changes = Object.entries(patch).filter(([k,v]) => before[k] !== v).map(([field,after]) => ({field,before:before[field] ?? null,after}));
    const saved = { ...patch, updatedAt:at };
    if (reply !== undefined) {
      saved.lastReply = reply;
      tx.create(replyRef, { body:reply, actorId:actor.id, createdAt:at });
    }
    if (changes.length || reply !== undefined) {
      tx.update(ref, saved);
      tx.create(audit, { entity:'ticket', entityId:id, actorId:actor.id, actorRole:actor.role, createdAt:at, changes, replyId:reply === undefined ? null : replyRef.id });
    }
    return { ...before, ...saved, id };
  });
}
export function ticketView(t, user) {
  const elapsed = Date.now() - Date.parse(t.createdAt);
  const minutes = Number.isFinite(elapsed) ? Math.floor(Math.max(0,elapsed)/60000) : null;
  const age = minutes === null ? null : minutes < 60 ? minutes + ' min' : minutes < 1440 ? Math.floor(minutes/60) + ' h' : Math.floor(minutes/1440) + ' d';
  return { ...pick(t, ['id','subject','userId','priority','state','assigneeId','createdAt','updatedAt','lastReply']),
    user:user?.name ?? t.user ?? null, age };
}
