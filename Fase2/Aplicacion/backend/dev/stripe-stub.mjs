// Proveedor SIMULADO de integración: no acredita aceptación en Stripe sandbox.
import { createServer } from 'node:http';
import { assertEmulatorOnly } from './safety.mjs';
export async function startStripeStub() {
  assertEmulatorOnly(process.env,{testOnly:true});
  const seen = new Map();
  let sequence = 0;
  const server = createServer(async (req,res) => {
    const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
    if (req.method!=='POST' || !['/v1/products','/v1/prices'].includes(req.url) || req.headers.authorization !== 'Bearer sk_test_local_stub_only') return send(403,{error:'test-only'});
    let body='';
    for await (const chunk of req) {body+=chunk;if(body.length>10000)return send(413,{});}
    const key=req.headers['idempotency-key'], signature=req.url+'\n'+body;
    if (!key) return send(400,{});
    if (seen.has(key)) return seen.get(key).signature===signature?send(200,seen.get(key).result):send(409,{});
    const fields=new URLSearchParams(body);
    const result = req.url==='/v1/products' ? {id:'prod_stub_'+ ++sequence,livemode:false} :
      {id:'price_stub_'+ ++sequence,livemode:false,product:fields.get('product'),currency:fields.get('currency'),unit_amount:Number(fields.get('unit_amount')),recurring:{interval:fields.get('recurring[interval]')}};
    seen.set(key,{signature,result});return send(200,result);
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  return {origin:'http://127.0.0.1:'+server.address().port,close:()=>new Promise(resolve=>server.close(resolve))};
}
