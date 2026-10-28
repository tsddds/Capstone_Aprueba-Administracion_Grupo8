import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { request,login } from './helper.mjs';
import { db } from '../../src/data/repo.js';
import { refreshMetrics,metricsConfig,startMetricsScheduler } from '../../src/services/metrics/store.js';
const base='/api/v1/admin/metrics';
test('E02/E03 matriz de permisos exacta',async()=>{
  for(const role of ['admin','finance','support','ops']) {
    const token=await login(role);
    assert.equal((await request('GET',base+'/overview',{token})).status,role==='admin'?200:403);
    assert.equal((await request('GET',base+'/commercial',{token})).status,['admin','finance'].includes(role)?200:403);
  }
  assert.equal((await request('GET',base+'/commercial')).status,401);
});
test('E02/E03 recalculan registros, coinciden entre paneles y descartan seed',async()=>{
  const token=await login();
  const a=await request('GET',base+'/overview',{token}),b=await request('GET',base+'/commercial',{token});
  assert.equal(a.json.data.source,'calculated_from_records');assert.equal(a.json.data.mau.value,4);
  assert.equal(b.json.data.mau,4);assert.equal(b.json.data.convRate,50);assert.equal(b.json.data.mrr,8000);
  assert.equal(a.json.data.generatedAt,b.json.data.generatedAt);
  assert.deepEqual(a.json.data.downloadsByMonth,b.json.data.downloadsByMonth);
  assert.equal(a.json.data.systemHealth.status,'unknown');
});
test('E02/E03 filtros válidos y malformados',async()=>{
  const token=await login('finance');
  for(const range of ['7d','30d','90d','365d']) assert.equal((await request('GET',base+'/commercial?range='+range,{token})).json.data.range,range);
  for(const query of ['range=bad','range=','range[]=30d','range=7d&range=30d']) assert.equal((await request('GET',base+'/commercial?'+query,{token})).status,400,query);
});
test('E03 frecuencia configurable renueva cambios reales y no cuenta una suscripción vencida',async()=>{
  const token=await login('finance');
  await db.collection('appConfig').doc('metrics').update({metricsRefreshSeconds:1,dashboardPollSeconds:2});
  await db.collection('users').doc('usr_demo_07').update({lastActivity:new Date().toISOString()});
  await db.collection('subscriptions').doc('sub_demo_uni').update({currentPeriodEnd:new Date(Date.now()-1).toISOString()});
  await delay(1100);
  const r=await request('GET',base+'/commercial',{token});assert.equal(r.status,200);
  assert.equal(r.json.data.mau,5);assert.equal(r.json.data.converted,1);assert.equal(r.json.data.convRate,20);assert.equal(r.json.data.mrr,5000);assert.equal(r.json.data.dashboardPollSeconds,2);
});
test('E03 movimientos de medallas y observaciones reales se agregan sin usar balances',async()=>{
  await db.collection('users').doc('usr_demo_01').collection('medalMovements').doc('c-reward').set({correctionId:'c-reward',tier:'bronze',amount:250,createdAt:new Date().toISOString()});
  await db.collection('serviceObservations').doc('c-probe').set({lastSuccess:false,lastLatencyMs:10,observedAt:new Date().toISOString()});
  const r=(await refreshMetrics(await metricsConfig()))['30d'];
  assert.equal(r.overview.badgesIssued,250);assert.equal(r.commercial.badgesByType[0].value,250);
  assert.equal(r.overview.systemHealth.status,'down');assert.equal(r.overview.systemHealth.servicesDown,1);
});
test('E03 planificador renueva instantáneas sin una consulta HTTP',async()=>{
  const stop=startMetricsScheduler({enabled:true});
  try {
    await delay(300);
    const before=(await db.collection('metrics').doc('commercial').get()).data().generatedAt;
    await db.collection('users').doc('usr_demo_05').update({lastActivity:new Date().toISOString()});
    await delay(1400);
    const after=(await db.collection('metrics').doc('commercial').get()).data();
    assert.notEqual(after.generatedAt,before);assert.equal(after.mau,6);
  } finally {stop();}
});
test('E03 configuración inválida falla explícitamente',async()=>{
  const token=await login();
  await db.collection('appConfig').doc('metrics').update({metricsRefreshSeconds:0});
  const r=await request('GET',base+'/overview',{token});assert.equal(r.status,503);assert.equal(r.json.error.code,'METRICS_CONFIG_INVALID');
});

test('disparador de métricas exige secreto de infraestructura, no un JWT administrativo',async()=>{
  const url='/internal/metrics/refresh', token=await login();
  assert.equal((await request('GET',url)).status,401);
  assert.equal((await request('GET',url,{token})).status,401);
  const invalid=await request('POST',url,{token:process.env.CRON_SECRET});
  assert.equal(invalid.status,405);assert.equal(invalid.headers.get('allow'),'GET');
});
test('disparador de métricas no oculta configuración inválida ni guarda un falso éxito',async()=>{
  const result=await request('GET','/internal/metrics/refresh',{token:process.env.CRON_SECRET});
  assert.equal(result.status,503);assert.equal(result.json.error.code,'METRICS_CONFIG_INVALID');
});
test('disparador autorizado actualiza las cuatro ventanas persistidas sin una consulta del panel',async()=>{
  await db.collection('appConfig').doc('metrics').update({metricsRefreshSeconds:300});
  const result=await request('GET','/internal/metrics/refresh',{token:process.env.CRON_SECRET});
  assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'no-store');
  assert.deepEqual(result.json.data.ranges,['7d','30d','90d','365d']);
  for(const range of result.json.data.ranges) {
    const stored=(await db.collection('metrics').doc('overview-'+range).get()).data();
    assert.equal(stored.generatedAt,result.json.data.generatedAt);assert.equal(stored.source,'calculated_from_records');
  }
  assert.ok(!JSON.stringify(result.json).includes(process.env.CRON_SECRET));
});
