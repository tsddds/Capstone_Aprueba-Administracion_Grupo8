import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFixtures } from '../../dev/fixtures.mjs';
import { calculateMetrics, metricsRange } from '../../src/services/metrics/calculate.js';
import { validatePlan } from '../../src/services/plans/validation.js';
import { activeSubscription } from '../../src/services/plans/subscriptions.js';
import { stripeTestClient } from '../../src/services/billing/stripe-test.js';
const at=Date.parse('2026-10-16T12:00:00Z');
test('C métricas reproducen oráculo MAU=4, conversión=50%, MRR=8000 sin snapshots',()=>{
  const input=buildFixtures(new Date(at));input.metrics=[];
  const result=calculateMetrics(input,{at});
  assert.equal(result.overview.mau.value,4);assert.equal(result.commercial.dau,1);
  assert.equal(result.commercial.converted,2);assert.equal(result.commercial.convRate,50);assert.equal(result.commercial.mrr,8000);
  assert.equal(result.overview.downloads.total,100);assert.equal(result.overview.downloads.month,20);
  assert.equal(result.commercial.collectedRevenue,8000);assert.equal(result.overview.systemHealth.status,'unknown');
  assert.equal(result.overview.mau.deltaPct,null);assert.equal(result.overview.badgesIssued,0);
});
test('C actividad usa usuarios únicos, frontera abierta de 30 días y excluye fechas futuras',()=>{
  const day=86400000;
  const users=[{id:'a',lastActivity:new Date(at-30*day).toISOString(),state:'active'},{id:'b',lastActivity:new Date(at-day).toISOString(),state:'suspended'},{id:'c',lastActivity:new Date(at+1).toISOString()}];
  const activityEvents=[{id:'e1',userId:'b',occurredAt:new Date(at-1000).toISOString()},{id:'e2',userId:'b',occurredAt:new Date(at-2000).toISOString()}];
  const r=calculateMetrics({users,activityEvents},{at}).commercial;
  assert.equal(r.mau,1);assert.equal(r.dau,1);assert.equal(r.activeInRange,1);
});
test('C deduplica eventos, distingue emisión de saldo y pagos de MRR',()=>{
  const data=buildFixtures(new Date(at));
  data.downloadEvents=[{id:'one',eventId:'same',occurredAt:new Date(at).toISOString(),count:10},{id:'two',eventId:'same',occurredAt:new Date(at).toISOString(),count:10}];
  data.badgeEvents=[{id:'reward',tier:'bronze',amount:250,createdAt:new Date(at).toISOString()}];
  data.payments.push({id:'refund',status:'refunded',amount:900,currency:'CLP',paidAt:new Date(at).toISOString()});
  const r=calculateMetrics(data,{at});
  assert.equal(r.overview.downloads.total,10);assert.equal(r.overview.badgesIssued,250);assert.equal(r.commercial.badgesByType[0].value,250);
  assert.equal(r.commercial.collectedRevenue,8000);
});
test('C datos vacíos, rangos y períodos vencidos no producen NaN o suscriptores falsos',()=>{
  const r=calculateMetrics({},{at});
  assert.equal(r.commercial.convRate,0);assert.equal(r.commercial.mrr,0);assert.equal(r.commercial.mau,0);
  assert.ok(!JSON.stringify(r).includes('NaN'));
  for(const range of ['bad','',[],null]) assert.throws(()=>metricsRange(range));
  assert.equal(activeSubscription({status:'active',currentPeriodEnd:new Date(at).toISOString()},at),false);
  assert.equal(activeSubscription({status:'canceled',currentPeriodEnd:new Date(at+1000).toISOString()},at),false);
});
test('C MRR anual usa importe de suscripción, no nuevo precio del catálogo',()=>{
  const r=calculateMetrics({plans:[{id:'all',price:9000}],subscriptions:[{id:'s',plan:'all',unitAmount:12000,currency:'CLP',billingCycle:'annual',status:'active',currentPeriodEnd:new Date(at+1000).toISOString()}]},{at});
  assert.equal(r.commercial.mrr,1000);
});
test('C límites cero se conservan; entrada inválida no se normaliza silenciosamente',()=>{
  assert.equal(validatePlan({name:'Gratis',price:0,limits:{tests:0}}).limits.tests,0);
  const previous={name:'Existente',price:0,limits:{qDay:10,groups:3,tests:0},badges:{login:1,purchase:3,correct:4}};
  const updated=validatePlan({limits:{qDay:20},badges:{login:2}},previous);
  assert.deepEqual(updated.limits,{qDay:20,groups:3,tests:0});assert.equal(updated.badges.purchase,3);
  for(const body of [{name:'x'}, {name:'x',price:'3'}, {name:'x',price:-1},{name:'x',price:1,limits:{qDay:-1}},{name:'x',price:1,features:['f1','f1']},{name:'x',price:1,badges:{login:1.5}}]) assert.throws(()=>validatePlan(body));
});
test('C Stripe rechaza claves live, reutiliza claves por operación y conserva unidades CLP',async()=>{
  assert.throws(()=>stripeTestClient({key:'sk_live_forbidden'}),e=>e.code==='STRIPE_NOT_CONFIGURED');
  const calls=[];
  const transport=async(url,opts)=>{
    calls.push({url,...opts});const fields=new URLSearchParams(opts.body);
    return {ok:true,json:async()=>url.endsWith('/products')?{id:'prod_test',livemode:false}:{id:'price_test',livemode:false,unit_amount:Number(fields.get('unit_amount')),currency:'clp',product:'prod_test',recurring:{interval:'month'}}};
  };
  const client=stripeTestClient({key:'sk_test_fake',transport});
  const args={planId:'uni',price:3000,operationId:'op1'};
  await client.syncPrice(args);await client.syncPrice(args);
  assert.equal(new URLSearchParams(calls[1].body).get('unit_amount'),'3000');
  assert.equal(calls[1].headers['Idempotency-Key'],calls[3].headers['Idempotency-Key']);
  const broken=stripeTestClient({key:'sk_test_fake',transport:async()=>{throw new Error('timeout');}});
  await assert.rejects(()=>broken.syncPrice(args),e=>e.status===503);
});
