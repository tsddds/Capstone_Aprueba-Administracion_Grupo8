import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request, login } from './helper.mjs';
import { db } from '../../src/data/repo.js';
const base='/api/v1/admin';
test('E23-E27 matriz de permisos y ausencia de token',async()=>{
  for(const role of ['admin','finance','support','ops']) {
    const token=await login(role), expected=role==='admin'?200:403;
    for(const path of ['/features','/plans']) assert.equal((await request('GET',base+path,{token})).status,expected);
    if(role!=='admin') for(const [method,path,body] of [['POST','/plans',{name:'x',price:1}],['PUT','/plans/uni',{name:'x'}],['DELETE','/plans/uni']])
      assert.equal((await request(method,base+path,{token,body})).status,403);
  }
  assert.equal((await request('GET',base+'/features')).status,401);
});
test('E25 rechaza formas, precio, límites, funcionalidades y campos desconocidos sin persistencia',async()=>{
  const token=await login(), before=(await db.collection('plans').get()).size;
  for(const body of [{},[],{name:'x'},{name:'x',price:-1},{name:'x',price:'5'},{name:'x',price:1.1},{name:'x',price:1,features:['missing']},{name:'x',price:1,limits:{qDay:-1}},{name:'x',price:1,limits:null},{name:'x',price:1,badges:{login:true}},{name:'x',price:1,billing:{secret:'x'}}]) {
    const r=await request('POST',base+'/plans',{token,body});assert.equal(r.status,400,JSON.stringify(body));assert.equal(r.json.error.code,'VALIDATION_ERROR');
  }
  assert.equal((await db.collection('plans').get()).size,before);
});
test('E25/E26 crea plan gratuito, conserva cero ilimitado y campos internos al editar',async()=>{
  const token=await login();
  const made=await request('POST',base+'/plans',{token,body:{name:'Plan C',price:0,features:['f1'],limits:{qDay:0,tests:0}}});
  assert.equal(made.status,201);assert.equal(made.json.data.limits.tests,0);
  const id=made.json.data.id;
  await db.collection('plans').doc(id).update({privateProviderToken:'DO_NOT_EXPOSE'});
  const saved=await request('PUT',base+'/plans/'+id,{token,body:{name:'Editado',limits:{qDay:20,groups:0,tests:0}}});
  assert.equal(saved.status,200);assert.equal(saved.json.data.features[0],'f1');
  assert.equal((await db.collection('plans').doc(id).get()).data().privateProviderToken,'DO_NOT_EXPOSE');
  const rows=await request('GET',base+'/plans',{token});assert.ok(!JSON.stringify(rows.json).includes('DO_NOT_EXPOSE'));
  const audits=await db.collection('adminAudit').where('entityId','==',id).get();assert.equal(audits.size,2);
  assert.equal((await request('DELETE',base+'/plans/'+id,{token})).status,204);
});
test('E26 valida resultado completo y no persiste un patch inválido',async()=>{
  const token=await login(), ref=db.collection('plans').doc('uni'), before=(await ref.get()).data();
  for(const body of [{price:-1},{price:null},{features:['missing']},{limits:{groups:'2'}},{color:'red'},{}]) assert.equal((await request('PUT',base+'/plans/uni',{token,body})).status,400);
  assert.deepEqual((await ref.get()).data(),before);
  assert.equal((await request('PUT',base+'/plans/missing',{token,body:{name:'x'}})).status,404);
});
test('E27 suscripción real bloquea incluso con cuenta suspendida o plan administrativo distinto',async()=>{
  const token=await login();
  await db.collection('users').doc('usr_demo_02').update({state:'suspended',plan:'free'});
  const r=await request('DELETE',base+'/plans/uni',{token});assert.equal(r.status,409);assert.equal(r.json.error.code,'PLAN_HAS_SUBSCRIBERS');
  assert.ok((await db.collection('plans').doc('uni').get()).exists);
});
test('E27 canceladas y vencidas no bloquean; 204 sin cuerpo y 404 posterior',async()=>{
  const token=await login();
  await db.collection('users').doc('usr_demo_01').update({plan:'pl_demo_empty',state:'active'});
  await db.collection('subscriptions').doc('c-expired').set({plan:'pl_demo_empty',userId:'usr_demo_01',status:'active',currentPeriodEnd:new Date(Date.now()-1).toISOString()});
  await db.collection('subscriptions').doc('c-canceled').set({plan:'pl_demo_empty',userId:'usr_demo_01',status:'canceled',currentPeriodEnd:new Date(Date.now()+86400000).toISOString()});
  const r=await request('DELETE',base+'/plans/pl_demo_empty',{token});assert.equal(r.status,204);assert.equal(r.json,null);
  assert.equal((await request('DELETE',base+'/plans/pl_demo_empty',{token})).status,404);
});
test('E27 una suscripción activa sin vencimiento bloquea hasta verificar sus datos',async()=>{
  const token=await login();
  const made=await request('POST',base+'/plans',{token,body:{name:'C sin vencimiento',price:0}}),id=made.json.data.id;
  await db.collection('subscriptions').doc('c-no-end').set({plan:id,userId:'usr_demo_01',status:'active'});
  const r=await request('DELETE',base+'/plans/'+id,{token});assert.equal(r.status,409);assert.equal(r.json.error.code,'PLAN_HAS_SUBSCRIBERS');
});
