import { test } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../../src/data/repo.js';
import { updatePlan } from '../../src/services/plans/catalog.js';
import { stripeTestClient } from '../../src/services/billing/stripe-test.js';
import { AdminError } from '../../src/lib/admin-validation.js';
import { request,login } from './helper.mjs';
const actor={id:'adm_demo_admin',role:'admin'};
test('E26 HTTP sincroniza contra proveedor SIMULADO y registra IDs privados',async()=>{
  const token=await login();
  const r=await request('PUT','/api/v1/admin/plans/pl_demo_empty',{token,body:{price:1250}});
  assert.equal(r.status,200);assert.equal(r.json.data.price,1250);assert.equal(r.json.data.billing,undefined);
  const p=(await db.collection('plans').doc('pl_demo_empty').get()).data();
  assert.equal(p.billing.mode,'test');assert.match(p.billing.priceId,/^price_/);
  const audits=await db.collection('adminAudit').where('entityId','==','pl_demo_empty').get();assert.equal(audits.size,1);
});
test('E26 timeout conserva precio y la misma operación se reintenta sin duplicar objetos',async()=>{
  const ref=db.collection('plans').doc('uni'),before=(await ref.get()).data(),keys=[];
  const failFactory=()=>({syncPrice:async args=>{keys.push(args.operationId);throw new AdminError(503,'STRIPE_UNAVAILABLE','timeout');}});
  await assert.rejects(()=>updatePlan('uni',{price:3500},actor,{billingFactory:failFactory}),e=>e.status===503);
  assert.equal((await ref.get()).data().price,before.price);
  const pending=(await db.collection('planPriceOperations').doc('uni').get()).data();assert.equal(pending.status,'pending');
  await assert.rejects(()=>updatePlan('uni',{price:3600},actor,{billingFactory:failFactory}),e=>e.status===409);
  const success=()=>({syncPrice:async args=>{keys.push(args.operationId);return {productId:'prod_retry',priceId:'price_retry',mode:'test',currency:'CLP',interval:'month'};}});
  const r=await updatePlan('uni',{price:3500},actor,{billingFactory:success});
  assert.equal(r.price,3500);assert.equal(keys[0],keys[1]);
  assert.equal((await db.collection('planPriceOperations').doc('uni').get()).data().status,'completed');
});
test('E26 reintentos concurrentes del mismo precio generan una sola auditoría',async()=>{
  const seen=new Set();
  const factory=()=>({syncPrice:async args=>{seen.add(args.operationId);return {productId:'prod_c',priceId:'price_c',mode:'test',currency:'CLP',interval:'month'};}});
  const results=await Promise.all([1,2].map(()=>updatePlan('all',{price:5500},actor,{billingFactory:factory})));
  assert.ok(results.every(r=>r.price===5500));assert.equal(seen.size,1);
  const audits=await db.collection('adminAudit').where('entityId','==','all').get();assert.equal(audits.size,1);
});
test('E26 sin Stripe no modifica precio; respuesta live o proveedor inválido nunca confirma',async()=>{
  const missing=()=>stripeTestClient({key:undefined});
  const prior=process.env.STRIPE_TEST_SECRET_KEY;delete process.env.STRIPE_TEST_SECRET_KEY;
  try {await assert.rejects(()=>updatePlan('pl_demo_empty',{price:1500},actor,{billingFactory:missing}),e=>e.code==='STRIPE_NOT_CONFIGURED');}
  finally {process.env.STRIPE_TEST_SECRET_KEY=prior;}
  assert.equal((await db.collection('plans').doc('pl_demo_empty').get()).data().price,1250);
  const factory=()=>stripeTestClient({key:'sk_test_fake',transport:async()=>({ok:true,json:async()=>({id:'prod_bad',livemode:true})})});
  await assert.rejects(()=>updatePlan('pl_demo_empty',{price:1500},actor,{billingFactory:factory}),e=>e.status===503);
  assert.equal((await db.collection('plans').doc('pl_demo_empty').get()).data().price,1250);
});
test('E26 operación incierta bloquea baja y exige conciliación tras ventana de idempotencia',async()=>{
  const token=await login();
  assert.equal((await request('DELETE','/api/v1/admin/plans/pl_demo_empty',{token})).status,409);
  await db.collection('planPriceOperations').doc('pl_demo_empty').update({createdAt:new Date(Date.now()-24*3600000).toISOString()});
  await assert.rejects(()=>updatePlan('pl_demo_empty',{price:1500},actor),e=>e.code==='STRIPE_RECONCILIATION_REQUIRED');
});
