import { db } from '../../data/repo.js';
import { AdminError } from '../../lib/admin-validation.js';
import { calculateMetrics, metricsRange, RANGES } from './calculate.js';
let running;
export async function metricsConfig() {
  const raw = (await db.collection('appConfig').doc('metrics').get()).data() || {};
  const config = {metricsRefreshSeconds:300,dashboardPollSeconds:60,timeZone:'America/Santiago',currency:'CLP',...raw};
  for (const key of ['metricsRefreshSeconds','dashboardPollSeconds'])
    if (!Number.isSafeInteger(config[key]) || config[key]<1 || config[key]>86400) throw new AdminError(503,'METRICS_CONFIG_INVALID','Frecuencia de métricas inválida');
  try { new Intl.DateTimeFormat('en',{timeZone:config.timeZone}).format(); }
  catch { throw new AdminError(503,'METRICS_CONFIG_INVALID','Zona horaria de métricas inválida'); }
  if (config.currency !== 'CLP') throw new AdminError(503,'METRICS_CONFIG_INVALID','Este catálogo usa precios en CLP');
  return config;
}
async function records(tx, name) {
  return (await tx.get(db.collection(name))).docs.map(s=>({...s.data(),id:s.id}));
}
export async function refreshMetrics(config, at = Date.now()) {
  if (running) return running;
  running = db.runTransaction(async tx => {
    const input = {};
    // Una instantánea transaccional mantiene coherentes fuentes y ambos paneles.
    for (const name of ['users','plans','subscriptions','payments','downloadEvents','activityEvents','badgeEvents','sponsors']) input[name] = await records(tx,name);
    input.observations = await records(tx,'serviceObservations');
    const movements = await tx.get(db.collectionGroup('medalMovements'));
    input.badgeEvents.push(...movements.docs.map(s=>({...s.data(),id:s.ref.path,eventId:s.data().correctionId || s.ref.path})));
    const results = {};
    for (const range of RANGES) {
      const result = calculateMetrics(input,{at,range,timeZone:config.timeZone,currency:config.currency});
      for (const kind of ['overview','commercial']) {
        result[kind].dashboardPollSeconds = config.dashboardPollSeconds;
        tx.set(db.collection('metrics').doc(kind+'-'+range), result[kind]);
      }
      results[range] = result;
    }
    tx.set(db.collection('metrics').doc('overview'),results['30d'].overview);
    tx.set(db.collection('metrics').doc('commercial'),results['30d'].commercial);
    return results;
  }).finally(()=>{running=undefined;});
  return running;
}
export async function getMetrics(kind, range) {
  range = metricsRange(range);
  const config = await metricsConfig();
  const doc = (await db.collection('metrics').doc(kind+'-'+range).get()).data();
  const age = Date.now()-Date.parse(doc?.generatedAt);
  if (doc?.source === 'calculated_from_records' && age>=0 && age<config.metricsRefreshSeconds*1000 && doc.timeZone===config.timeZone && doc.currency===config.currency)
    return {...doc,dashboardPollSeconds:config.dashboardPollSeconds};
  return (await refreshMetrics(config))[range][kind];
}
export function startMetricsScheduler({ enabled = process.env.NODE_ENV !== 'test' } = {}) {
  if (!enabled) return;
  let stopped = false, timer;
  const tick = async () => {
    let delay = 300000;
    try { const config = await metricsConfig(); delay=config.metricsRefreshSeconds*1000; await refreshMetrics(config); }
    catch { console.error('[metrics] No se pudo actualizar la instantánea'); }
    finally { if (!stopped) { timer=setTimeout(tick,delay); timer.unref(); } }
  };
  timer=setTimeout(tick,0); timer.unref();
  return () => {stopped=true;clearTimeout(timer);};
}
