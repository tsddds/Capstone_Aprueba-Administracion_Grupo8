import { db } from './repo.js';
import { AdminError } from '../lib/admin-validation.js';
import { createHash } from 'node:crypto';
const unavailable=()=>new AdminError(503,'ORCHESTRATOR_UNAVAILABLE','El orquestador no respondió');
export function allowedContainers() {
  return (process.env.OPS_CONTAINER_ALLOWLIST||'').split(',').map(x=>x.trim()).filter(Boolean);
}
export async function bridge(path,method='GET') {
  const url=process.env.OPS_BRIDGE_URL, token=process.env.OPS_BRIDGE_TOKEN;
  if(!url||!token)throw unavailable();
  try{
    const base=new URL(url);
    if(!['http:','https:'].includes(base.protocol)||base.username||base.password||base.search||base.hash)throw unavailable();
    const r=await fetch(new URL(path,base),{method,redirect:'error',signal:AbortSignal.timeout(10000),headers:{Authorization:'Bearer '+token}});
    if(r.status===404)throw new AdminError(404,'NOT_FOUND','Contenedor no encontrado');
    if(r.status===409)throw new AdminError(409,'CONFLICT','Reinicio en curso');
    if(!r.ok)throw unavailable();
    return await r.json();
  }catch(e){if(e instanceof AdminError)throw e;throw unavailable();}
}
export async function containers() {
  const rows=await bridge('/containers'), allowed=allowedContainers();
  if(!Array.isArray(rows))throw unavailable();
  const observations = rows.filter(r=>allowed.includes(r.name)).map(r=>{
    if(!['ok','deg','down'].includes(r.state)||![r.cpu,r.mem].every(v=>v===null||(typeof v==='number'&&Number.isFinite(v)&&v>=0)))throw unavailable();
    return {name:r.name,state:r.state,cpu:r.cpu,mem:r.mem,region:r.region,startedAt:r.startedAt,observedAt:r.observedAt,source:r.source};
  });
  // La consulta posterior comprueba el resultado de los reinicios aceptados.
  const pending=await db.collection('adminAudit').where('status','==','scheduled').get();
  for(const doc of pending.docs){
    const op=doc.data(), observed=observations.find(r=>r.name===op.entityId);
    if(op.entity==='container'&&op.previousStartedAt&&observed?.state==='ok'&&observed.startedAt!==op.previousStartedAt&&Date.parse(observed.startedAt)>=Date.parse(op.createdAt))
      await doc.ref.update({status:'verified',verifiedAt:new Date().toISOString(),startedAt:observed.startedAt});
  }
  return observations;
}
export async function restart(name,actor) {
  if(!allowedContainers().includes(name))throw new AdminError(404,'NOT_FOUND','Contenedor no autorizado o inexistente');
  const audit=db.collection('adminAudit').doc();
  await audit.create({entity:'container',entityId:name,actorId:actor.id,actorRole:actor.role,action:'restart',status:'requested',createdAt:new Date().toISOString()});
  let result;
  try{
    result=await bridge('/containers/'+encodeURIComponent(name)+'/restart','POST');
    if(result?.name!==name||result?.status!=='scheduled')throw unavailable();
  }catch(e){
    // Un timeout no prueba que el reinicio no ocurrió.
    await audit.update({status:e.status===503?'unknown':'rejected',updatedAt:new Date().toISOString()});
    throw e;
  }
  await audit.update({status:'scheduled',previousStartedAt:result.previousStartedAt||null,updatedAt:new Date().toISOString()});
  return {name,action:'restart',status:'scheduled',operationId:audit.id};
}
export async function services() {
  let configs;
  try{configs=JSON.parse(process.env.OPS_SERVICES_JSON||'[]');}
  catch{throw new AdminError(503,'SERVICE_UNAVAILABLE','Configuración de monitorización inválida');}
  if(!Array.isArray(configs)||!configs.length||configs.length>20)throw new AdminError(503,'SERVICE_UNAVAILABLE','No hay servicios autorizados configurados');
  const keys=new Set();
  for(const c of configs){
    let u;try{u=new URL(c.url);}catch{}
    if(!c||typeof c.key!=='string'||!/^[-\w]{1,64}$/.test(c.key)||keys.has(c.key)||typeof c.name!=='string'||!u||!['http:','https:'].includes(u.protocol)||u.username||u.password)
      throw new AdminError(503,'SERVICE_UNAVAILABLE','Configuración de monitorización inválida');
    keys.add(c.key);
  }
  return Promise.all(configs.map(async c=>{
    const start=performance.now();let success=false,latency=null;
    try{
      const response=await fetch(c.url,{redirect:'error',signal:AbortSignal.timeout(2000)});
      latency=Math.round(performance.now()-start);success=response.ok;
      await response.body?.cancel();
    }catch{}
    const ref=db.collection('serviceObservations').doc(c.key);
    const sourceFingerprint=createHash('sha256').update(c.url).digest('hex');
    const observedAt=new Date().toISOString();
    const counts=await db.runTransaction(async tx=>{
      const snap=await tx.get(ref), stored=snap.data();
      // Un cambio de destino inicia una serie nueva; no mezcla disponibilidad de dos servicios.
      const previous=stored?.sourceFingerprint===sourceFingerprint?stored:null;
      const total=(previous?.total||0)+1, healthy=(previous?.healthy||0)+(success?1:0);
      const data={total,healthy,firstObservedAt:previous?.firstObservedAt||observedAt,observedAt,lastLatencyMs:latency,lastSuccess:success,sourceFingerprint};
      tx.set(ref,data);return data;
    });
    return {key:c.key,name:c.name,state:!success?'down':latency>500?'deg':'ok',
      uptime:(counts.healthy/counts.total*100).toFixed(2)+'%',latency:success?latency+' ms':null,
      observedAt,firstObservedAt:counts.firstObservedAt,sampleCount:counts.total,source:'http-probe',uptimeBasis:'successful-samples-since-first-observation'};
  }));
}
