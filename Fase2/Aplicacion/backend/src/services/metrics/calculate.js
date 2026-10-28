import { invalid } from '../../lib/admin-validation.js';
import { activeSubscription } from '../plans/subscriptions.js';
export const RANGES = ['7d','30d','90d','365d'];
const DAY = 86400000;
const positive = n => typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : 0;
const round = n => Math.round((n+Number.EPSILON)*100)/100;
export function metricsRange(value = '30d') {
  if (!RANGES.includes(value)) invalid('range', 'Rango permitido: 7d, 30d, 90d o 365d');
  return value;
}
const unique = rows => [...new Map(rows.map(r=>[r.eventId || r.id,r])).values()];
function monthKey(at, zone) {
  const parts = new Intl.DateTimeFormat('en', {timeZone:zone,year:'numeric',month:'2-digit'}).formatToParts(new Date(at));
  return parts.find(p=>p.type==='year').value+'-'+parts.find(p=>p.type==='month').value;
}
export function calculateMetrics(data, { at = Date.now(), range = '30d', timeZone = 'America/Santiago', currency = 'CLP' } = {}) {
  metricsRange(range);
  const {users=[],plans=[],subscriptions=[],payments=[],downloadEvents=[],activityEvents=[],badgeEvents=[],sponsors=[],observations=[]} = data;
  const start = at-parseInt(range)*DAY, within = (date,from=start) => Date.parse(date) > from && Date.parse(date) <= at;
  const userIds = new Set(users.map(u=>u.id));
  const activity = [...users.map(u=>({userId:u.id,occurredAt:u.lastActivity})),...activityEvents].filter(a=>userIds.has(a.userId));
  const active = from => new Set(activity.filter(a=>within(a.occurredAt,from)).map(a=>a.userId));
  const mau = active(at-30*DAY), dau = active(at-DAY), activeInRange = active(start);
  const planMap = new Map(plans.map(p=>[p.id,p]));
  const current = subscriptions.filter(s=>activeSubscription(s,at));
  const byPlan = new Map(), paidUsers = new Set();
  let missingSubscriptionPrices = 0;
  for (const s of current) {
    const price = s.unitAmount ?? planMap.get(s.plan)?.price;
    if (!Number.isFinite(price) || price < 0 || (s.currency && s.currency !== currency)) { missingSubscriptionPrices++; continue; }
    const count = s.intervalCount ?? 1;
    if (!Number.isSafeInteger(count) || count < 1 || !['monthly','annual','yearly'].includes(s.billingCycle || 'monthly')) { missingSubscriptionPrices++; continue; }
    const monthly = price / (['annual','yearly'].includes(s.billingCycle) ? 12*count : count);
    byPlan.set(s.plan,(byPlan.get(s.plan)||0)+monthly);
    if (monthly > 0 && userIds.has(s.userId)) paidUsers.add(s.userId);
  }
  const converted = [...mau].filter(id=>paidUsers.has(id)).length;
  const convRate = mau.size ? round(converted/mau.size*100) : 0;
  const revenueByPlan = [...byPlan].sort(([a],[b])=>a.localeCompare(b)).map(([plan,value])=>({plan,value:round(value)}));
  const mrr = round([...byPlan.values()].reduce((sum,v)=>sum+v,0));
  const downloads = unique(downloadEvents).filter(e=>within(e.occurredAt,-Infinity));
  const month = monthKey(at,timeZone), series = new Map();
  const first = monthKey(start,timeZone);
  for (let date = new Date(first+'-01T12:00:00Z'); date.toISOString().slice(0,7) <= month; date.setUTCMonth(date.getUTCMonth()+1)) series.set(date.toISOString().slice(0,7),0);
  let monthDownloads = 0, previousMonthDownloads = 0;
  const previousMonthDate = new Date(month+'-01T12:00:00Z'); previousMonthDate.setUTCMonth(previousMonthDate.getUTCMonth()-1);
  const previousMonth = previousMonthDate.toISOString().slice(0,7);
  for (const e of downloads) {
    const key = monthKey(Date.parse(e.occurredAt),timeZone), amount = positive(e.count);
    if (within(e.occurredAt) && series.has(key)) series.set(key,series.get(key)+amount);
    if (key === month) monthDownloads += amount;
    if (key === previousMonth) previousMonthDownloads += amount;
  }
  const downloadsByMonth = [...series].map(([month,value])=>({month,value}));
  const totalDownloads = downloads.reduce((n,e)=>n+positive(e.count),0);
  const paid = unique(payments).filter(p=>p.status==='paid' && p.currency===currency && within(p.paidAt));
  const collected = paid.reduce((n,p)=>n+positive(p.amount),0);
  const issued = unique(badgeEvents).filter(e=>within(e.createdAt) && positive(e.amount)>0 && ['bronze','silver','gold','diamond','platinum'].includes(e.tier));
  const badgeTypes = new Map();
  for (const e of issued) badgeTypes.set(e.tier,(badgeTypes.get(e.tier)||0)+e.amount);
  const fresh = observations.filter(o=>within(o.observedAt,at-5*60000));
  const servicesDown = fresh.filter(o=>o.lastSuccess===false).length;
  const systemHealth = {status:!fresh.length?'unknown':servicesDown?'down':fresh.some(o=>o.lastLatencyMs>500)?'degraded':'ok',servicesDown:fresh.length?servicesDown:null,observedServices:fresh.length};
  const metadata = {generatedAt:new Date(at).toISOString(),range,timeZone,currency,source:'calculated_from_records',
    quality:{activityHistory:activityEvents.length?'events-and-last-activity':'last-activity-only',
      historicalComparisons:'unavailable-without-complete-history',badgeHistory:'recorded-issuance-only',missingSubscriptionPrices},
    period:{from:new Date(start).toISOString(),to:new Date(at).toISOString()}};
  const common = {revenueByPlan,downloadsByMonth,collectedRevenue:round(collected),activeInRange:activeInRange.size,...metadata};
  return {
    overview:{...common,downloads:{total:totalDownloads,month:monthDownloads,deltaPct:previousMonthDownloads?round((monthDownloads-previousMonthDownloads)/previousMonthDownloads*100):null},
      mau:{value:mau.size,deltaPct:null},converted:{value:converted,rate:convRate},mrr:{value:mrr,deltaPct:null},
      badgesIssued:issued.reduce((n,e)=>n+e.amount,0),sponsorsActive:sponsors.filter(s=>s.status==='ok'&&!s.deletedAt).length,systemHealth},
    commercial:{...common,downloads:totalDownloads,downloadsMonth:monthDownloads,dau:dau.size,mau:mau.size,converted,convRate,mrr,
      benefitsRedeemed:sponsors.reduce((n,s)=>n+positive(s.benefitsRedeemed),0),
      funnel:[{label:'Descargas',value:totalDownloads},{label:'Registrados',value:users.length},{label:'Activos (MAU)',value:mau.size},{label:'Convertidos',value:converted}],
      badgesByType:[...badgeTypes].map(([tier,value])=>({tier,value}))}
  };
}
