import { spawn } from 'node:child_process';
import { mkdir, writeFile, access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
const option = name => { const i=args.indexOf(name); return i < 0 ? undefined : args[i+1]; };
const output = path.resolve(root, option('--output') || `.local/verification-${new Date().toISOString().replace(/[:.]/g,'-')}`);
if (!output.startsWith(root) || output === root) throw new Error('La evidencia debe guardarse dentro del proyecto.');
try { await access(output); throw new Error('El directorio de evidencia ya existe; usar otro nombre para conservar resultados anteriores.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await mkdir(output, {recursive:true});
const base = ['compose','-f','compose.yaml','-f','compose.ops.yaml','--profile','test','--profile','ui'];
const modes = ['a-sprint1','a-sprint2','a-ops','b-sponsors','b-sponsors-create','b-sponsors-update','b-sponsors-delete','b-questions-list','b-questions-create','b-questions-update','b-questions-import','b-corrections-list','b-corrections-resolve','c-catalog','c-billing','c-metrics','smoke','contract'];
const jobs = modes.map(mode => ({label:mode,command:[...base,'run','--rm','test','node','dev/run-tests.mjs',mode]}));
jobs.push({label:'backend-unit',command:[...base,'run','--rm','test','npm','test']});
jobs.push({label:'frontend-unit',command:[...base,'run','--rm','--no-deps','-v',`${path.join(root,'frontend/test').replace(/\\/g,'/') }:/app/test:ro`,'frontend','node','--test','test/*.test.mjs']});
jobs.push({label:'firestore-config',command:[...base,'run','--rm','--no-deps','-v',`${path.join(root,'infra/firestore').replace(/\\/g,'/')}:/checks:ro`,'frontend','node','--test','/checks/config.test.mjs']});
jobs.push({label:'frontend-build',command:[...base,'run','--rm','--no-deps','frontend','npm','run','build']});
const records=[];
const digest = p => readFile(path.join(root,p)).then(bytes=>createHash('sha256').update(bytes).digest('hex'));
const sourceFiles=['backend/src/routes/corrections.js','backend/src/data/corrections.js','backend/src/data/admin-support.js','backend/src/services/metrics/job.js','backend/src/index.js','frontend/src/pages/Users.jsx','frontend/src/pages/Overview.jsx','frontend/src/i18n.js'];
const sourceHashes=Object.fromEntries(await Promise.all(sourceFiles.map(async p=>[p,await digest(p)])));
await writeFile(path.join(output,'fuente.json'),JSON.stringify({at:new Date().toISOString(),sourceHashes,externalStripe:false,emulator:'demo-aprueba-tests',note:'Árbol local con cambios sin publicar; los SHA identifican las fuentes probadas.'},null,2));
for(const job of jobs){
 const startedAt=new Date().toISOString(); let log='';
 const exitCode=await new Promise((resolve,reject)=>{
  const child=spawn('docker',job.command,{cwd:root,stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',d=>{log+=d.toString();});child.stderr.on('data',d=>{log+=d.toString();});
  child.on('error',reject);child.on('exit',code=>resolve(code??1));
 });
 await writeFile(path.join(output,job.label+'.txt'),log);
 const count=name=>Number(log.match(new RegExp(`^# ${name} (\\d+)`,'m'))?.[1]||0);
 records.push({...job,command:['docker',...job.command],startedAt,endedAt:new Date().toISOString(),exitCode,tests:count('tests'),pass:count('pass'),fail:count('fail'),skipped:count('skipped')});
 await writeFile(path.join(output,'resultados.json'),JSON.stringify(records,null,2));
 console.log(JSON.stringify({suite:job.label,exitCode,pass:count('pass'),fail:count('fail')}));
 // No reintentos automáticos: un fallo conserva su registro y detiene la entrega.
 if(exitCode!==0){process.exitCode=exitCode;break;}
}
const completed=records.length===jobs.length&&records.every(r=>r.exitCode===0);
const summary={completed,suites:records.length,expectedSuites:jobs.length,tests:records.reduce((s,r)=>s+r.tests,0),passed:records.reduce((s,r)=>s+r.pass,0),failed:records.reduce((s,r)=>s+r.fail,0),skipped:records.reduce((s,r)=>s+r.skipped,0),externalStripe:'PENDIENTE_CUENTA',humanAcceptance:'PENDIENTE'};
await writeFile(path.join(output,'resumen.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
