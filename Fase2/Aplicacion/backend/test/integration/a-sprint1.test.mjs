import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { request, login } from './helper.mjs';
import { DEMO_PASSWORD, DEMO_JWT } from '../../dev/safety.mjs';
import { db } from '../../src/data/repo.js';
import { totp } from '../../src/lib/totp.js';
const base='/api/v1/admin';
test('E01 login returns public identity, claims, TTL and secure HttpOnly cookie',async()=>{
  for(const role of ['admin','support','finance','ops']){
    const r=await request('POST',base+'/auth/login',{body:{email:role.toUpperCase()+'@EXAMPLE.TEST',password:DEMO_PASSWORD,otp:''}});
    assert.equal(r.status,200); assert.equal(r.json.data.expiresIn,900);
    const a=jwt.verify(r.json.data.accessToken,DEMO_JWT), f=jwt.verify(r.json.data.refreshToken,DEMO_JWT);
    assert.equal(a.exp-a.iat,900); assert.equal(f.exp-f.iat,2592000);
    for(const p of [a,f]){assert.equal(p.role,role);assert.equal(p.plan,'free');assert.ok(p.sub);}
    assert.match(r.headers.get('set-cookie'),/HttpOnly/);assert.match(r.headers.get('set-cookie'),/Secure/);
    assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.json.data.user.passwordHash,undefined);
  }
});
test('E01 invalid shapes, unknown fields and wrong credentials have contract errors',async()=>{
  for(const body of [{},[],{email:[],password:'x'},{email:'a@b.test',password:5},{email:'a@b.test',password:'x',role:'admin'}]){
    const r=await request('POST',base+'/auth/login',{body});assert.equal(r.status,400);assert.equal(r.json.error.code,'VALIDATION_ERROR');assert.ok(Array.isArray(r.json.error.details));
  }
  for(const body of [{email:'admin@example.test',password:'wrong'},{email:'missing@example.test',password:'wrong'}]){
    const r=await request('POST',base+'/auth/login',{body});assert.equal(r.status,401);assert.equal(r.json.error.code,'AUTH_INVALID_CREDENTIALS');
  }
});
test('E01 MFA validates TOTP and disallows replay; fixed demo OTP is removed',async()=>{
  const ref=db.collection('adminUsers').doc('adm_demo_admin'), secret='GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  await ref.update({mfaEnabled:true,mfaSecret:secret,mfaLastCounter:-1});
  const attempt=otp=>request('POST',base+'/auth/login',{body:{email:'admin@example.test',password:DEMO_PASSWORD,...(otp?{otp}:{})}});
  try{
    assert.equal((await attempt()).json.error.code,'MFA_REQUIRED');
    const code=totp(secret,Math.floor(Date.now()/30000));
    assert.equal((await attempt(code)).status,200);
    assert.equal((await attempt(code)).json.error.code,'MFA_REQUIRED');
  }finally{await ref.update({mfaEnabled:false});}
});
test('E01 disabled accounts and stale permissions cannot login or reuse access',async()=>{
  const token=await login('support'),ref=db.collection('adminUsers').doc('adm_demo_support');
  try{
    await ref.update({state:'suspended'});
    assert.equal((await request('GET',base+'/users',{token})).status,401);
    assert.equal((await request('POST',base+'/auth/login',{body:{email:'support@example.test',password:DEMO_PASSWORD}})).status,401);
    await ref.update({state:'active',role:'ops'});
    assert.equal((await request('GET',base+'/users',{token})).status,403);
  }finally{await ref.update({state:'active',role:'support'});}
});
test('Authentication rejects expired, refresh, tampered and student tokens',async()=>{
  const make=(payload,opts={})=>jwt.sign({sub:'adm_demo_admin',role:'admin',typ:'access',...payload},DEMO_JWT,opts);
  for(const [token,code] of [[make({}, {expiresIn:-1}),'AUTH_TOKEN_EXPIRED'],[make({typ:'refresh'}),'AUTH_REQUIRED'],[make({role:'student'}),'AUTH_FORBIDDEN'],['bad','AUTH_REQUIRED']]){
    assert.equal((await request('GET',base+'/users',{token})).json.error.code,code);
  }
  const invalidSubject=make({typ:'refresh',sub:'bad/path'});
  assert.equal((await request('POST',base+'/auth/refresh',{body:{refreshToken:invalidSubject}})).status,401);
});
test('E12/E13 permission matrix and missing-user errors',async()=>{
  for(const role of ['admin','support','finance','ops']){
    const token=await login(role),expected=['admin','support'].includes(role)?200:403;
    for(const path of ['/users','/users/usr_demo_01']) assert.equal((await request('GET',base+path,{token})).status,expected);
  }
  assert.equal((await request('GET',base+'/users/missing',{token:await login()})).status,404);
});
test('E12 query filters, empty results, page, sort and cursor coverage',async()=>{
  const token=await login('support'),get=q=>request('GET',base+'/users'+q,{token});
  const all=await get('?limit=100');assert.equal(all.json.meta.pagination.total,7);
  const ids=[];let cursor;
  do{const r=await get('?limit=2'+(cursor?'&cursor='+cursor:''));ids.push(...r.json.data.map(x=>x.id));cursor=r.json.meta.pagination.nextCursor;}while(cursor);
  assert.equal(new Set(ids).size,7);
  assert.deepEqual((await get('?page=2&limit=2')).json.data.map(x=>x.id),ids.slice(2,4));
  assert.equal((await get('?q=USR_DEMO_02&plan=uni&state=active')).json.data.length,1);
  assert.equal((await get('?q=not-found')).json.data.length,0);
  assert.equal((await get('?q=')).status,200);
  const desc=(await get('?sort=-name')).json.data;assert.ok(desc[0].name>=desc.at(-1).name);
  for(const q of ['?limit=0','?limit=-1','?limit=101','?limit=2.5','?cursor=bad','?page=0','?sort=passwordHash','?state=bad','?plan=bad','?q[]=x'])
    assert.equal((await get(q)).status,400,q);
});
test('E12/E13 projections remove top-level and nested secrets and read current subscription',async()=>{
  const token=await login(),ref=db.collection('users').doc('usr_demo_02');
  await ref.update({passwordHash:'SENSITIVE',mfaSecret:'SENSITIVE',devices:[{id:'dev_1',platform:'android',pushToken:'SENSITIVE'}],medals:{bronze:10,token:'SENSITIVE'},recentActivity:[{type:'login',secret:'SENSITIVE'}]});
  await db.collection('subscriptions').doc('sub_demo_uni').update({status:'past_due',stripeSubscriptionId:'SENSITIVE'});
  for(const path of ['/users','/users/usr_demo_02']){
    const r=await request('GET',base+path,{token});assert.equal(r.status,200);assert.ok(!JSON.stringify(r.json.data).includes('SENSITIVE'));
  }
  const detail=(await request('GET',base+'/users/usr_demo_02',{token})).json.data;
  assert.equal(detail.subscription.status,'past_due');assert.equal(detail.devices[0].id,'dev_1');assert.equal(detail.medals.bronze,10);
});
