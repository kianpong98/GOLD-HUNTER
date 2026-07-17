const STATIC_URL = '/assets/data/rate-expectation.json';
const MANUAL_KEY = 'fed-rate-manual-override-v2';
const LEGACY_MANUAL_KEY = 'fed-rate-manual-override-v1';
const CRON_LIVE_KEY = 'fed-rate-live-v1';
const CRON_LIVE_MAX_AGE_MS = 30 * 60 * 1000; // must stay comfortably above the Worker's own heartbeat interval (15 min) so a normal quiet heartbeat is never mistaken for a stalled Worker.
const ENGINE_VERSION = 'fed-rate-full-admin-control-4.0';

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), { status, headers: {'content-type':'application/json; charset=utf-8','cache-control':'no-store, max-age=0',...extraHeaders} });
}
function authorized(request, env){const supplied=request.headers.get('x-admin-pin')||'';return Boolean(env.ADMIN_PIN&&supplied&&supplied===env.ADMIN_PIN);}
function clean(value){return String(value??'').trim();}
function parseRange(value){
  const nums=clean(value).replace(/[–—]/g,'-').match(/\d+(?:\.\d+)?/g)||[];
  if(nums.length<2)return null;
  let lower=Number(nums[0]),upper=Number(nums[1]);
  if(upper>20){lower/=100;upper/=100;}
  if(!Number.isFinite(lower)||!Number.isFinite(upper)||lower<0||upper>20||lower>=upper)return null;
  const lowerBps=Math.round(lower*100),upperBps=Math.round(upper*100);
  if(![25,50].includes(upperBps-lowerBps))return null;
  return {lower,upper,lowerBps,upperBps,display:`${lower.toFixed(2)}%–${upper.toFixed(2)}%`};
}
function midpoint(value){const r=parseRange(value);return r?(r.lower+r.upper)/2:null;}
function normalizeOutcome(row,currentTargetRange){
  const parsed=parseRange(row?.targetRange);const probability=Number(String(row?.probability??'').replace('%','').trim());
  if(!parsed||!Number.isFinite(probability)||probability<0||probability>100)return null;
  const targetMid=(parsed.lower+parsed.upper)/2,currentMid=midpoint(currentTargetRange),bps=Number.isFinite(currentMid)?Math.round((targetMid-currentMid)*100):0;
  const direction=bps<0?'cut':bps>0?'hike':'hold';
  return {targetRange:parsed.display,probability:Number(probability.toFixed(1)),move:bps===0?'No change':`${Math.abs(bps)} bps ${direction}`,direction};
}
function localDateTimeToIso(value){
  const v=clean(value);if(!/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(v))return '';
  return `${v.length===16?v+':00':v}+08:00`;
}
function validatePayload(input){
  const current=parseRange(input?.currentTargetRange);if(!current)throw new Error('Current target range is invalid. Example: 3.50%–3.75%.');
  const outcomes=(Array.isArray(input?.outcomes)?input.outcomes:[]).filter(row=>clean(row?.targetRange)||clean(row?.probability)).map(row=>normalizeOutcome(row,current.display)).filter(Boolean).sort((a,b)=>(parseRange(a.targetRange)?.lowerBps||0)-(parseRange(b.targetRange)?.lowerBps||0));
  if(outcomes.length<2)throw new Error('At least two valid target-rate outcomes are required.');
  const total=Number(outcomes.reduce((s,r)=>s+r.probability,0).toFixed(1));if(total<99.5||total>100.5)throw new Error(`Probabilities must total 100%. Current total: ${total}%.`);
  for(let i=1;i<outcomes.length;i++){const p=parseRange(outcomes[i-1].targetRange),c=parseRange(outcomes[i].targetRange);if(!p||!c||p.upperBps!==c.lowerBps)throw new Error('Target-rate ranges must be continuous.');}
  const meetingDateTime=localDateTimeToIso(input?.meetingDateTime);if(!meetingDateTime)throw new Error('FOMC meeting date and time are required.');
  const updatedAtManual=localDateTimeToIso(input?.displayUpdatedAt)||new Date().toISOString();
  return {
    manualEnabled: input?.manualEnabled!==false,
    meetingDate: meetingDateTime.slice(0,10), meetingDateTime,
    meetingLabel: clean(input?.meetingLabel)||'Next FOMC decision',
    meetingTimezone:'Asia/Kuala_Lumpur',meetingTimezoneLabel:'Malaysia Time (MYT)',
    currentTargetRange:current.display,outcomes,probabilityTotal:total,
    source:clean(input?.source)||'Admin controlled Fed rate probabilities',
    sourceUrl:clean(input?.sourceUrl)||'https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html',
    note:clean(input?.note),displayUpdatedAt:updatedAtManual,
  };
}
async function loadStatic(origin){const r=await fetch(new URL(`${STATIC_URL}?v=${Date.now()}`,origin),{headers:{accept:'application/json','cache-control':'no-cache'},cf:{cacheTtl:0,cacheEverything:false}});if(!r.ok)throw new Error(`Static Fed snapshot HTTP ${r.status}`);return r.json();}
async function loadManual(env){if(!env.GH_MARKET_DATA)return null;for(const key of [MANUAL_KEY,LEGACY_MANUAL_KEY]){try{const v=await env.GH_MARKET_DATA.get(key,{type:'json'});if(v)return v;}catch{}}return null;}
async function loadCronLive(env){
  if(!env.GH_MARKET_DATA)return null;
  try{
    const v=await env.GH_MARKET_DATA.get(CRON_LIVE_KEY,{type:'json'});
    if(!v||!Array.isArray(v.outcomes)||!v.outcomes.length)return null;
    const ageMs=Date.now()-Date.parse(v.updatedAt||0);
    if(!Number.isFinite(ageMs)||ageMs>CRON_LIVE_MAX_AGE_MS)return null; // stale: the Worker may not be deployed or stopped running
    return v;
  }catch{return null;}
}
function isOfficialLive(s){return Boolean(s&&Array.isArray(s.outcomes)&&s.officialFetchSucceeded===true&&s.sourceMode==='official-github-sync');}
function buildManualResult(manual,snapshot,checkedAt){return {...manual,updatedAt:manual.displayUpdatedAt||manual.updatedAt,lastCheckedAt:checkedAt,officialDataChangedAt:manual.displayUpdatedAt||manual.updatedAt,sourceMode:'manual-admin-primary',sourceStatus:'manual',live:true,exactOfficialValues:false,officialFetchSucceeded:false,cmeLastCheckedAt:snapshot?.lastCheckedAt||null,cmeLastError:snapshot?.lastOfficialFetchError||snapshot?.errors?.join?.(' | ')||'',cacheMode:'Admin manual control is primary. CME snapshot is retained only as a reference.',kvWrite:false,engineVersion:ENGINE_VERSION,manualOverrideAvailable:true};}
function buildCronLiveResult(cronLive,checkedAt){return {...cronLive,lastApiCheckedAt:checkedAt,lastCheckedAt:cronLive.updatedAt||checkedAt,sourceStatus:'live',live:true,exactOfficialValues:false,cacheMode:'Calculated automatically every ~5 minutes from public Fed Funds futures pricing (Cloudflare Cron Worker). Not CME\u2019s own data feed.',kvWrite:false,engineVersion:ENGINE_VERSION,manualOverrideAvailable:true};}
function buildOfficialResult(snapshot,checkedAt){return {...snapshot,lastApiCheckedAt:checkedAt,sourceStatus:'live',sourceMode:'official-github-sync',live:true,exactOfficialValues:true,cacheMode:'CME official snapshot is active because Admin manual priority is disabled.',kvWrite:false,engineVersion:ENGINE_VERSION,manualOverrideAvailable:true};}
function buildStaticFallback(snapshot,checkedAt){return {...snapshot,lastApiCheckedAt:checkedAt,sourceStatus:'verified-static-fallback',sourceMode:'verified-static-fallback',live:false,cacheMode:'No active Admin override and no live CME result. Using last verified snapshot.',kvWrite:false,engineVersion:ENGINE_VERSION,manualOverrideAvailable:true};}
export async function onRequestOptions(){return new Response(null,{status:204,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type,x-admin-pin'}});}
export async function onRequestGet({request,env}){
  const checkedAt=new Date().toISOString(),origin=new URL(request.url).origin;let snapshot=null,staticError='';try{snapshot=await loadStatic(origin);}catch(e){staticError=String(e?.message||e);}
  const manual=await loadManual(env);
  const cronLive=await loadCronLive(env);
  let result;
  if(manual?.manualEnabled!==false&&manual?.outcomes?.length)result=buildManualResult(manual,snapshot,checkedAt);
  else if(isOfficialLive(snapshot))result=buildOfficialResult(snapshot,checkedAt);
  else if(cronLive)result=buildCronLiveResult(cronLive,checkedAt);
  else if(snapshot?.outcomes?.length)result=buildStaticFallback(snapshot,checkedAt);
  else return json({error:'Fed rate expectation is unavailable.',detail:staticError,lastApiCheckedAt:checkedAt,live:false,kvWrite:false,engineVersion:ENGINE_VERSION},503);
  if(authorized(request,env))result.admin={manualOverride:manual||null,officialSnapshot:snapshot||null,cronLiveSnapshot:cronLive||null,effectiveSource:result.sourceMode};
  return json(result,200,{'x-gh-fed-source':result.sourceMode});
}
export async function onRequestPost({request,env}){
  if(!authorized(request,env))return json({error:'Incorrect PIN, or ADMIN_PIN is not configured.'},401);if(!env.GH_MARKET_DATA)return json({error:'GH_MARKET_DATA KV binding is not configured.'},500);
  let body;try{body=await request.json();}catch{return json({error:'Invalid JSON body.'},400);}
  let validated;try{validated=validatePayload(body);}catch(e){return json({error:String(e?.message||e)},400);}
  const now=new Date().toISOString(),payload={...validated,savedAt:now,updatedAt:validated.displayUpdatedAt||now,sourceMode:'manual-admin-primary',sourceStatus:'manual',live:true,exactOfficialValues:false,kvWrite:true,engineVersion:ENGINE_VERSION};
  const existing=await loadManual(env),comparable=v=>JSON.stringify({manualEnabled:v?.manualEnabled,meetingDateTime:v?.meetingDateTime,meetingLabel:v?.meetingLabel,currentTargetRange:v?.currentTargetRange,outcomes:v?.outcomes,source:v?.source,sourceUrl:v?.sourceUrl,note:v?.note,displayUpdatedAt:v?.displayUpdatedAt});
  if(existing&&comparable(existing)===comparable(payload))return json({ok:true,unchanged:true,version:ENGINE_VERSION,manualOverride:existing});
  try{await env.GH_MARKET_DATA.put(MANUAL_KEY,JSON.stringify(payload));const verify=await env.GH_MARKET_DATA.get(MANUAL_KEY,{type:'json'});if(!verify||comparable(verify)!==comparable(payload))throw new Error('KV readback verification failed.');return json({ok:true,unchanged:false,version:ENGINE_VERSION,manualOverride:verify});}catch(e){return json({error:'Manual Fed rate save failed.',detail:String(e?.message||e),version:ENGINE_VERSION},500);}
}
