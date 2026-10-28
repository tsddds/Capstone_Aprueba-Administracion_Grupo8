import http from 'node:http';
// Recurso dedicado de desarrollo. No representa pagos ni otros servicios empresariales.
const startedAt=new Date().toISOString();
http.createServer((req,res)=>{
  const healthy=req.url==='/health';
  res.writeHead(healthy?200:404,{'Content-Type':'application/json'});
  res.end(JSON.stringify(healthy?{status:'ok',service:'aprueba-ops-lab',startedAt}:{error:'not_found'}));
}).listen(8090,'0.0.0.0');
