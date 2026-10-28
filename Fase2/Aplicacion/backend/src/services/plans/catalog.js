import { createHash } from 'node:crypto';
import { db, COL } from '../../data/repo.js';
import { AdminError, pick } from '../../lib/admin-validation.js';
import { validatePlan, planFields } from './validation.js';
import { subscriptionBlocksDeletion } from './subscriptions.js';
import { stripeTestClient } from '../billing/stripe-test.js';
const missing = () => new AdminError(404,'NOT_FOUND','Plan no encontrado');
const busy = () => new AdminError(409,'PLAN_UPDATE_IN_PROGRESS','Hay una sincronización pendiente; reintente la misma solicitud');
export const publicPlan = p => pick(p, ['id', ...planFields, 'createdAt','updatedAt']);
async function checkFeatures(tx, plan) {
  for (const id of plan.features) {
    if (!(await tx.get(db.collection(COL.features).doc(id))).exists) throw new AdminError(400,'VALIDATION_ERROR','Funcionalidad inexistente','features');
  }
}
function auditData(id, actor, action, at) { return {entity:'plan',entityId:id,actorId:actor.id,actorRole:actor.role,action,createdAt:at}; }
export async function createPlan(body, actor) {
  const plan = validatePlan(body), ref = db.collection(COL.plans).doc(), audit = db.collection('adminAudit').doc();
  const at = new Date().toISOString();
  await db.runTransaction(async tx => {
    await checkFeatures(tx, plan);
    tx.create(ref, {...plan,createdAt:at,updatedAt:at,revision:0});
    tx.create(audit, {...auditData(ref.id,actor,'create',at), after:plan});
  });
  return {...plan,id:ref.id,createdAt:at,updatedAt:at};
}
export async function updatePlan(id, body, actor, { billingFactory = stripeTestClient } = {}) {
  const ref = db.collection(COL.plans).doc(id), opRef = db.collection('planPriceOperations').doc(id);
  const audit = db.collection('adminAudit').doc();
  const prepared = await db.runTransaction(async tx => {
    const current = await tx.get(ref), op = await tx.get(opRef);
    if (!current.exists) throw missing();
    const before = current.data(), plan = validatePlan(body, before);
    await checkFeatures(tx, plan);
    const fingerprint = createHash('sha256').update(JSON.stringify(plan)).digest('hex');
    const pending = op.data()?.status === 'pending' ? op.data() : null;
    if (pending && pending.fingerprint !== fingerprint) throw busy();
    if (pending) {
      // Stripe garantiza retención de claves al menos 24h; fuera de esa ventana se requiere conciliación.
      if (Date.now()-Date.parse(pending.createdAt) > 23*3600000) throw new AdminError(409,'STRIPE_RECONCILIATION_REQUIRED','Revisar la operación pendiente en Stripe antes de volver a sincronizar');
      return {plan, before, operation:pending};
    }
    const at = new Date().toISOString(), revision = (before.revision || 0)+1;
    if (planFields.every(field => JSON.stringify(plan[field]) === JSON.stringify(before[field])))
      return {done:true,plan:{...before,id}};
    if (plan.price === before.price) {
      tx.update(ref, {...plan,revision,updatedAt:at});
      tx.create(audit, {...auditData(id,actor,'update',at),before:publicPlan({...before,id}),after:plan});
      return {done:true,plan:{...plan,id,createdAt:before.createdAt,updatedAt:at}};
    }
    billingFactory();
    const operation = {status:'pending',fingerprint,operationId:'aprueba-'+id+'-'+revision,baseRevision:before.revision||0,createdAt:at,actorId:actor.id};
    tx.set(opRef,operation);
    return {plan,before,operation};
  });
  if (prepared.done) return publicPlan(prepared.plan);
  const productId = prepared.before.billing?.mode === 'test' ? prepared.before.billing.productId : undefined;
  const billing = await billingFactory().syncPrice({planId:id,price:prepared.plan.price,operationId:prepared.operation.operationId,productId});
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref), opSnap = await tx.get(opRef), before = snap.data(), op = opSnap.data();
    if (op?.status === 'completed' && op.operationId === prepared.operation.operationId) return publicPlan({...before,id});
    if (!snap.exists || op?.status !== 'pending' || op.operationId !== prepared.operation.operationId || (before.revision||0) !== op.baseRevision) throw busy();
    const at = new Date().toISOString();
    tx.update(ref,{...prepared.plan,billing,revision:op.baseRevision+1,updatedAt:at});
    tx.update(opRef,{status:'completed',completedAt:at,priceId:billing.priceId});
    tx.create(audit,{...auditData(id,actor,'update-price',at),requestedBy:op.actorId,before:publicPlan({...before,id}),after:prepared.plan,operationId:op.operationId,stripePriceId:billing.priceId});
    return publicPlan({...before,...prepared.plan,id,updatedAt:at});
  });
}
export async function removePlan(id, actor) {
  const ref = db.collection(COL.plans).doc(id), opRef = db.collection('planPriceOperations').doc(id), audit = db.collection('adminAudit').doc();
  await db.runTransaction(async tx => {
    const plan = await tx.get(ref), op = await tx.get(opRef);
    if (!plan.exists) throw missing();
    if (op.data()?.status === 'pending') throw busy();
    const subs = await tx.get(db.collection('subscriptions').where('plan','==',id));
    if (subs.docs.some(s => subscriptionBlocksDeletion(s.data()))) throw new AdminError(409,'PLAN_HAS_SUBSCRIBERS','El plan tiene suscripciones activas o pendientes de verificar');
    tx.delete(ref);
    tx.create(audit,{...auditData(id,actor,'delete',new Date().toISOString()),before:publicPlan({...plan.data(),id})});
  });
}
