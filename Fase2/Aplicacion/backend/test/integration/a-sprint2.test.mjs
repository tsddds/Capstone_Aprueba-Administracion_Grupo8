import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request,login } from './helper.mjs';
import { db } from '../../src/data/repo.js';
const base='/api/v1/admin';
test('E14 validates patches and missing IDs without mutation',async()=>{
  const token=await login('support');
  for(const body of [{},{state:'churned'},{email:'bad'},{plan:'not-found'},{role:'admin'},{reason:'only reason'},{state:'active',reason:3}]){
    const r=await request('PATCH',base+'/users/usr_demo_01',{token,body});assert.equal(r.status,400,JSON.stringify(body));assert.equal(r.json.error.code,'VALIDATION_ERROR');
  }
  assert.equal((await request('PATCH',base+'/users/missing',{token,body:{state:'active'}})).status,404);
});
test('E14 normalized email uniqueness also handles concurrent requests',async()=>{
  const token=await login('support');
  const duplicate=await request('PATCH',base+'/users/usr_demo_01',{token,body:{email:'USR_DEMO_02@EXAMPLE.TEST'}});
  assert.equal(duplicate.status,409);assert.equal(duplicate.json.error.code,'EMAIL_ALREADY_EXISTS');
  for(let round=0;round<5;round++){
    const address='unique-'+round+'@example.test';
    const attempts=await Promise.all(['usr_demo_01','usr_demo_06'].map(id=>request('PATCH',base+'/users/'+id,{token,body:{email:address}})));
    assert.deepEqual(attempts.map(r=>r.status).sort(),[200,409],'concurrent round '+round);
    assert.equal((await db.collection('users').where('email','==',address).get()).size,1);
  }
});
test('E14 reserva por correo libera el anterior, conserva normalización y no duplica auditorías al repetir',async()=>{
  const token=await login('support');
  const a=db.collection('users').doc('usr_email_claim_a'), b=db.collection('users').doc('usr_email_claim_b');
  await Promise.all([a.create({name:'Prueba correo A',email:'old-claim@example.test',state:'active'}),b.create({name:'Prueba correo B',email:'other-claim@example.test',state:'active'})]);
  const change=(id,email)=>request('PATCH',base+'/users/'+id,{token,body:{email}});
  try {
    assert.equal((await change(a.id,' MIDDLE-CLAIM@EXAMPLE.TEST ')).status,200);
    assert.equal((await change(a.id,'last-claim@example.test')).status,200);
    assert.equal((await change(b.id,'middle-claim@example.test')).status,200);
    const before=await db.collection('adminAudit').where('entityId','==',a.id).get();
    assert.equal((await change(a.id,'LAST-CLAIM@EXAMPLE.TEST')).status,200);
    assert.equal((await db.collection('adminAudit').where('entityId','==',a.id).get()).size,before.size);
    const claims=await db.collection('adminEmailClaims').where('userId','==',a.id).get();
    assert.equal(claims.size,1);assert.equal(claims.docs[0].data().email,'last-claim@example.test');
    assert.equal((await change(b.id,'last-claim@example.test')).status,409);
  } finally {
    for(const ref of [a,b]) {
      const claims=await db.collection('adminEmailClaims').where('userId','==',ref.id).get();
      await Promise.all(claims.docs.map(d=>d.ref.delete()));await ref.delete();
    }
  }
});
test('E14 detecta duplicados legados sin índice y valida otra vez el propietario dentro de la transacción',async()=>{
  const token=await login('support'), ref=db.collection('users').doc('usr_email_legacy');
  await ref.create({name:'Prueba legado',email:' LEGACY-CLAIM@EXAMPLE.TEST ',state:'active'});
  try {
    const result=await request('PATCH',base+'/users/usr_demo_01',{token,body:{email:'legacy-claim@example.test'}});
    assert.equal(result.status,409);assert.equal(result.json.error.code,'EMAIL_ALREADY_EXISTS');
  } finally {await ref.delete();}
});
test('E14 persists changes and append-only audits without changing medals or subscriptions',async()=>{
  const token=await login('support'),ref=db.collection('users').doc('usr_demo_03');
  const before=(await ref.get()).data();
  for(const body of [{state:'suspended',reason:'Prueba local'},{state:'active',plan:'uni',reason:'Ajuste manual'}])
    assert.equal((await request('PATCH',base+'/users/usr_demo_03',{token,body})).status,200);
  const after=(await ref.get()).data();
  assert.equal(after.plan,'uni');assert.deepEqual(after.medals,before.medals);assert.deepEqual(after.subscription,before.subscription);
  const audit=await db.collection('adminAudit').where('entityId','==','usr_demo_03').get();
  assert.equal(audit.size,2);assert.ok(audit.docs.every(d=>d.data().actorId==='adm_demo_support'&&d.data().createdAt&&d.data().reason));
});
test('E15 filters, computes age, enriches user and paginates',async()=>{
  const token=await login('support');
  const r=await request('GET',base+'/tickets?state=open&priority=high',{token});
  assert.equal(r.status,200);assert.equal(r.json.data.length,1);assert.equal(r.json.data[0].age,'1 d');assert.ok(r.json.data[0].user);
  assert.equal((await request('GET',base+'/tickets?limit=1',{token})).json.data.length,1);
  for(const q of ['state=bad','priority=urgent','limit=0'])assert.equal((await request('GET',base+'/tickets?'+q,{token})).status,400);
});
test('E16 validates states, priority, assignee and reply; missing ticket is 404',async()=>{
  const token=await login('support');
  for(const body of [{},{state:'resolved'},{priority:'urgent'},{assigneeId:'missing'},{assigneeId:'adm_demo_ops'},{reply:''},{reply:[]},{unknown:true}]){
    const r=await request('PATCH',base+'/tickets/tkt_demo_01',{token,body});assert.equal(r.status,400,JSON.stringify(body));
  }
  assert.equal((await request('PATCH',base+'/tickets/missing',{token,body:{state:'closed'}})).status,404);
});
test('E16 retains concurrent replies and audits rather than overwriting history',async()=>{
  const token=await login('support');
  const rs=await Promise.all(['Primera respuesta','Segunda respuesta'].map(reply=>request('PATCH',base+'/tickets/tkt_demo_01',{token,body:{state:'progress',assigneeId:'adm_demo_support',reply}})));
  assert.ok(rs.every(r=>r.status===200));
  const replies=await db.collection('tickets').doc('tkt_demo_01').collection('replies').get();
  assert.equal(replies.size,2);assert.deepEqual(replies.docs.map(d=>d.data().body).sort(),['Primera respuesta','Segunda respuesta']);
  const audit=await db.collection('adminAudit').where('entityId','==','tkt_demo_01').get();assert.equal(audit.size,2);
  const rows=(await request('GET',base+'/tickets?state=progress',{token})).json.data;
  assert.ok(rows.some(t=>t.id==='tkt_demo_01'&&t.assigneeId==='adm_demo_support'));
});
test('E14–E16 deny finance and ops, accept admin/support',async()=>{
  for(const role of ['finance','ops']){
    const token=await login(role);
    for(const [method,path,body] of [['PATCH','/users/usr_demo_01',{state:'active'}],['GET','/tickets'],['PATCH','/tickets/tkt_demo_01',{state:'closed'}]])
      assert.equal((await request(method,base+path,{token,body})).status,403);
  }
});
