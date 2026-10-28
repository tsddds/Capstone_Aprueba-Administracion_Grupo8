import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { request, login } from './helper.mjs';
import { db } from '../../src/data/repo.js';
import { services,containers,restart } from '../../src/data/admin-ops.js';
const base='/api/v1/admin',target='aprueba-ops-lab';
test('E08 persisted fictitious platforms follow contract and permission matrix',async()=>{
  for(const role of ['admin','ops','support','finance']){
    const r=await request('GET',base+'/platforms',{token:await login(role)});
    assert.equal(r.status,['admin','ops'].includes(role)?200:403);
    if(r.status===200){assert.equal(r.json.data.length,3);assert.equal(typeof r.json.data[0].available,'boolean');assert.equal(r.json.data[0].source,'fixture');}
  }
});
test('E09 real local HTTP probe, measured latency and persistent sample counts',async()=>{
  const token=await login('ops');
  const a=await request('GET',base+'/services',{token}),b=await request('GET',base+'/services',{token});
  assert.equal(a.status,200);assert.equal(b.status,200);
  const first=a.json.data[0],next=b.json.data[0];
  assert.equal(first.source,'http-probe');assert.ok(['ok','deg'].includes(first.state));
  assert.match(first.latency,/^\d+ ms$/);assert.equal(next.sampleCount,first.sampleCount+1);
  assert.equal(next.uptime,'100.00%');
  assert.equal((await db.collection('serviceObservations').doc('lab').get()).data().total,next.sampleCount);
});
test('E09 non-2xx, redirect and timeout are not reported healthy; no config returns 503',async()=>{
  const old=process.env.OPS_SERVICES_JSON;
  const server=http.createServer((req,res)=>{
    if(req.url==='/slow')return;
    res.writeHead(req.url==='/redirect'?302:500,{Location:'/fail'});res.end();
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{
    process.env.OPS_SERVICES_JSON=JSON.stringify(['fail','redirect','slow'].map(key=>({key,name:key,url:'http://127.0.0.1:'+server.address().port+'/'+key})));
    const rows=await services();assert.ok(rows.every(r=>r.state==='down'&&r.latency===null&&r.uptime==='0.00%'));
    process.env.OPS_SERVICES_JSON=JSON.stringify([{key:'fail',name:'Changed target',url:'http://127.0.0.1:'+server.address().port+'/redirect'}]);
    assert.equal((await services())[0].sampleCount,1,'A changed target starts a new observation series');
    process.env.OPS_SERVICES_JSON='[]';
    await assert.rejects(services(),e=>e.status===503);
    process.env.OPS_SERVICES_JSON='bad';
    await assert.rejects(services(),e=>e.status===503);
    process.env.OPS_SERVICES_JSON='[null]';
    await assert.rejects(services(),e=>e.status===503);
  }finally{process.env.OPS_SERVICES_JSON=old;server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('E10 real Docker metrics expose only the authorized target',async()=>{
  const r=await request('GET',base+'/containers',{token:await login('ops')});
  assert.equal(r.status,200);assert.deepEqual(r.json.data.map(x=>x.name),[target]);
  const c=r.json.data[0];assert.equal(c.source,'docker-engine');assert.equal(c.state,'ok');
  assert.ok(typeof c.cpu==='number'&&c.cpu>=0);assert.ok(typeof c.mem==='number'&&c.mem>=0);assert.ok(c.startedAt);
});
test('E09–E11 reject support/finance and arbitrary restart targets',async()=>{
  for(const role of ['support','finance']){
    const token=await login(role);
    for(const [method,path] of [['GET','/services'],['GET','/containers'],['POST','/containers/'+target+'/restart']])
      assert.equal((await request(method,base+path,{token})).status,403);
  }
  assert.equal((await request('POST',base+'/containers/backend/restart',{token:await login('ops')})).status,404);
});
test('E11 restart accepted, StartedAt really changes and audit is retained',async()=>{
  const token=await login('ops');
  const before=(await request('GET',base+'/containers',{token})).json.data[0].startedAt;
  const result=await request('POST',base+'/containers/'+target+'/restart',{token});
  assert.equal(result.status,202);assert.equal(result.json.data.status,'scheduled');
  let changed=false;
  for(let i=0;i<8;i++){
    const rows=await request('GET',base+'/containers',{token});
    if(rows.status===200&&rows.json.data[0].startedAt!==before&&rows.json.data[0].state==='ok'){changed=true;break;}
    await delay(300);
  }
  assert.ok(changed,'Docker StartedAt must change, not merely a Firestore field');
  const audit=(await db.collection('adminAudit').doc(result.json.data.operationId).get()).data();
  assert.equal(audit.status,'verified');assert.equal(audit.actorId,'adm_demo_ops');assert.equal(audit.entityId,target);assert.ok(audit.verifiedAt);
});
test('E10/E11 orchestrator failure returns 503 with unknown outcome audit, not false success',async()=>{
  const old=process.env.OPS_BRIDGE_URL;
  try{
    process.env.OPS_BRIDGE_URL='http://127.0.0.1:1';
    await assert.rejects(containers(),e=>e.status===503&&e.code==='ORCHESTRATOR_UNAVAILABLE');
    await assert.rejects(restart(target,{id:'adm_demo_ops',role:'ops'}),e=>e.status===503);
    const audits=await db.collection('adminAudit').where('entity','==','container').get();
    assert.ok(audits.docs.some(d=>d.data().status==='unknown'));
  }finally{process.env.OPS_BRIDGE_URL=old;}
});
test('Docker bridge requires token and exposes no arbitrary Docker API or other containers',async()=>{
  const url=process.env.OPS_BRIDGE_URL,headers={Authorization:'Bearer '+process.env.OPS_BRIDGE_TOKEN};
  assert.equal((await fetch(url+'/containers')).status,401);
  for(const path of ['/containers/backend/restart','/containers/json','/exec','/images','/containers/'+target+'/exec'])
    assert.equal((await fetch(url+path,{method:'POST',headers})).status,404,path);
});
