import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
const token=process.env.OPS_BRIDGE_TOKEN;
if (!token || token.length<32) throw new Error('OPS_BRIDGE_TOKEN required');
const target='aprueba-ops-lab';
function docker(method,path) {
  return new Promise((resolve,reject)=>{
    const req=http.request({socketPath:'/var/run/docker.sock',path:'/v1.45'+path,method},res=>{
      let body='';res.setEncoding('utf8');res.on('data',chunk=>{body+=chunk;if(body.length>2000000)req.destroy(new Error('limit'));});
      res.on('end',()=>{
        if(res.statusCode<200||res.statusCode>=300) return reject(Object.assign(new Error('Docker unavailable'),{status:res.statusCode===404?404:503}));
        try{resolve(body?JSON.parse(body):null);}catch{reject(new Error('Invalid Docker response'));}
      });
    });
    req.setTimeout(8000,()=>req.destroy(new Error('Docker timeout')));req.on('error',reject);req.end();
  });
}
async function inspect() {
  const d=await docker('GET','/containers/'+target+'/json');
  if(d.Config?.Labels?.['aprueba.ops.allowed']!=='local-test-only'||d.Name!=='/'+target)
    throw Object.assign(new Error('Unapproved target'),{status:404});
  return d;
}
let restarting=false;
const server=http.createServer(async(req,res)=>{
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
  if(req.method==='GET'&&req.url==='/health')return send(200,{status:'ok'});
  const provided=Buffer.from(req.headers.authorization||''),expected=Buffer.from('Bearer '+token);
  if(provided.length!==expected.length||!timingSafeEqual(provided,expected))return send(401,{error:'unauthorized'});
  // No passthrough paths, exec, create, delete, logs or arbitrary container names.
  if(!((req.method==='GET'&&req.url==='/containers')||(req.method==='POST'&&req.url==='/containers/'+target+'/restart')))return send(404,{error:'not_found'});
  try{
    const d=await inspect();
    if(req.method==='POST'){
      if(restarting)return send(409,{error:'restart_in_progress'});
      restarting=true;
      try{await docker('POST','/containers/'+d.Id+'/restart?t=2');}
      finally{restarting=false;}
      return send(202,{name:target,action:'restart',status:'scheduled',previousStartedAt:d.State.StartedAt});
    }
    const stats=d.State.Running?await docker('GET','/containers/'+d.Id+'/stats?stream=false'):null;
    const cpuDelta=(stats?.cpu_stats?.cpu_usage?.total_usage||0)-(stats?.precpu_stats?.cpu_usage?.total_usage||0);
    const sysDelta=(stats?.cpu_stats?.system_cpu_usage||0)-(stats?.precpu_stats?.system_cpu_usage||0);
    const mem=stats?.memory_stats;
    const used=mem?Math.max(0,mem.usage-(mem.stats?.inactive_file||mem.stats?.total_inactive_file||0)):0;
    return send(200,[{name:target,state:d.State.Running?'ok':'down',
      cpu:stats&&sysDelta>0?Math.round(Math.max(0,cpuDelta/sysDelta*100)*100)/100:d.State.Running?null:0,
      mem:mem?.limit?Math.round(used/mem.limit*10000)/100:d.State.Running?null:0,
      region:'local-docker',startedAt:d.State.StartedAt,observedAt:new Date().toISOString(),source:'docker-engine'}]);
  }catch(e){return send(e.status||503,{error:'orchestrator_unavailable'});}
});
server.requestTimeout=10000;server.headersTimeout=10000;server.listen(8089,'0.0.0.0');
