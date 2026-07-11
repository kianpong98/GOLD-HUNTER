const EVENTS_KEY = 'gold-market-events-v3';
const BLS_CACHE_KEY = 'official-bls-cache-v1';

const SEED_EVENTS = [
  {id:'cpi-2026-07',releasePeriod:'2026-06',type:'cpi_yoy',name:'Consumer Price Index',nameZh:'消费者物价指数',datetime:'2026-07-14T20:30:00+08:00',forecast:'',previous:'',sourceName:'U.S. Bureau of Labor Statistics',sourceUrl:'https://www.bls.gov/schedule/news_release/cpi.htm',impact:5,whyZh:'衡量美国整体通胀，通常会明显影响美元与黄金。'},
  {id:'core-cpi-2026-07',releasePeriod:'2026-06',type:'core_cpi_yoy',name:'Core Consumer Price Index',nameZh:'核心消费者物价指数',datetime:'2026-07-14T20:30:00+08:00',forecast:'',previous:'',sourceName:'U.S. Bureau of Labor Statistics',sourceUrl:'https://www.bls.gov/schedule/news_release/cpi.htm',impact:5,whyZh:'剔除食品与能源，更能反映基础通胀趋势。'},
  {id:'ppi-2026-07',releasePeriod:'2026-06',type:'ppi_yoy',name:'Producer Price Index',nameZh:'生产者物价指数',datetime:'2026-07-15T20:30:00+08:00',forecast:'',previous:'',sourceName:'U.S. Bureau of Labor Statistics',sourceUrl:'https://www.bls.gov/schedule/news_release/ppi.htm',impact:4,whyZh:'反映生产端通胀压力，可影响市场对利率的预期。'},
  {id:'core-ppi-2026-07',releasePeriod:'2026-06',type:'core_ppi_yoy',name:'Core Producer Price Index',nameZh:'核心生产者物价指数',datetime:'2026-07-15T20:30:00+08:00',forecast:'',previous:'',sourceName:'U.S. Bureau of Labor Statistics',sourceUrl:'https://www.bls.gov/schedule/news_release/ppi.htm',impact:4,whyZh:'剔除波动较大的项目，用于观察持续性生产通胀。'},
  {id:'retail-sales-2026-07',releasePeriod:'2026-06',type:'retail_sales',name:'Retail Sales',nameZh:'零售销售',datetime:'2026-07-16T20:30:00+08:00',forecast:'',previous:'',sourceName:'U.S. Census Bureau',sourceUrl:'https://www.census.gov/retail/release_schedule.html',impact:4,whyZh:'反映消费强弱，可能改变经济与利率预期。'},
  {id:'jobless-claims-2026-07-16',releasePeriod:'2026-07-11',type:'jobless_claims',name:'Initial Jobless Claims',nameZh:'初请失业金人数',datetime:'2026-07-16T20:30:00+08:00',forecast:'',previous:'',sourceName:'U.S. Department of Labor',sourceUrl:'https://www.dol.gov/ui/data.pdf',impact:4,whyZh:'反映就业市场短期变化，可能影响美元与黄金。'},
  {id:'fomc-2026-07',releasePeriod:'2026-07-30',type:'fomc',name:'FOMC Interest Rate Decision',nameZh:'美联储利率决议',datetime:'2026-07-30T02:00:00+08:00',forecast:'',previous:'',sourceName:'Federal Reserve',sourceUrl:'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',impact:5,whyZh:'利率与政策措辞会直接改变美元、收益率和黄金定价。'},
  {id:'gdp-advance-2026-q2',releasePeriod:'2026-Q2',type:'gdp',name:'GDP — Advance Estimate',nameZh:'国内生产总值初值',datetime:'2026-07-30T20:30:00+08:00',forecast:'',previous:'',sourceName:'U.S. Bureau of Economic Analysis',sourceUrl:'https://www.bea.gov/news/schedule',impact:4,whyZh:'衡量美国经济增长，是影响利率预期的重要数据。'},
  {id:'pce-2026-07',releasePeriod:'2026-06',type:'pce',name:'PCE Price Index',nameZh:'PCE物价指数',datetime:'2026-07-30T20:30:00+08:00',forecast:'',previous:'',sourceName:'U.S. Bureau of Economic Analysis',sourceUrl:'https://www.bea.gov/data/personal-consumption-expenditures-price-index',impact:5,whyZh:'美联储重点关注的通胀指标之一。'},
  {id:'core-pce-2026-07',releasePeriod:'2026-06',type:'core_pce',name:'Core PCE Price Index',nameZh:'核心PCE物价指数',datetime:'2026-07-30T20:30:00+08:00',forecast:'',previous:'',sourceName:'U.S. Bureau of Economic Analysis',sourceUrl:'https://www.bea.gov/data/personal-consumption-expenditures-price-index',impact:5,whyZh:'剔除食品与能源，是美联储观察基础通胀的重要指标。'},
  {id:'nfp-2026-08',releasePeriod:'2026-07',type:'nfp',name:'Nonfarm Payrolls',nameZh:'非农就业人数',datetime:'2026-08-07T20:30:00+08:00',forecast:'',previous:'',sourceName:'U.S. Bureau of Labor Statistics',sourceUrl:'https://www.bls.gov/schedule/news_release/empsit.htm',impact:5,whyZh:'反映美国就业增长，公布时黄金通常波动较大。'},
  {id:'unemployment-2026-08',releasePeriod:'2026-07',type:'unemployment',name:'Unemployment Rate',nameZh:'失业率',datetime:'2026-08-07T20:30:00+08:00',forecast:'',previous:'',sourceName:'U.S. Bureau of Labor Statistics',sourceUrl:'https://www.bls.gov/schedule/news_release/empsit.htm',impact:5,whyZh:'反映劳动力市场强弱，并影响利率预期。'},
  {id:'avg-hourly-earnings-2026-08',releasePeriod:'2026-07',type:'avg_hourly_earnings',name:'Average Hourly Earnings',nameZh:'平均每小时工资',datetime:'2026-08-07T20:30:00+08:00',forecast:'',previous:'',sourceName:'U.S. Bureau of Labor Statistics',sourceUrl:'https://www.bls.gov/schedule/news_release/empsit.htm',impact:4,whyZh:'工资增长会影响通胀与利率预期，并可能带动黄金波动。'},
  {id:'fomc-minutes-2026-08',type:'fomc_minutes',name:'FOMC Meeting Minutes',nameZh:'美联储会议纪要',datetime:'2026-08-20T02:00:00+08:00',forecast:'',previous:'',sourceName:'Federal Reserve',sourceUrl:'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',impact:4,whyZh:'披露政策讨论细节，可能改变市场对未来利率路径的判断。'}
];

const AUTO_TYPES = new Set(['cpi_yoy','core_cpi_yoy','ppi_yoy','core_ppi_yoy','nfp','unemployment','avg_hourly_earnings','retail_sales','jobless_claims','gdp','pce','core_pce','fomc']);
const EVENT_ONLY_TYPES = new Set(['fomc_minutes','fed_speech']);
const REMOVED_TYPES = new Set(['ism_manufacturing','ism_services']);

const SERIES = {
  cpi_yoy: {id:'CUUR0000SA0', mode:'yoy', suffix:'%'},
  core_cpi_yoy: {id:'CUUR0000SA0L1E', mode:'yoy', suffix:'%'},
  ppi_yoy: {id:'WPUFD4', mode:'yoy', suffix:'%'},
  core_ppi_yoy: {id:'WPUFD49116', mode:'yoy', suffix:'%'},
  nfp: {id:'CES0000000001', mode:'change', suffix:'K'},
  unemployment: {id:'LNS14000000', mode:'level', suffix:'%'},
  avg_hourly_earnings: {id:'CES0500000003', mode:'mom', suffix:'%'}
};



const FRED_CACHE_KEY='official-fred-cache-v2';
const FRED_CONFIG={
  avg_hourly_earnings:{series:'CES0500000003',mode:'mom',suffix:'%',decimals:1},
  retail_sales:{series:'RSAFS',mode:'mom',suffix:'%',decimals:1},
  jobless_claims:{series:'ICSA',mode:'level',suffix:'K',decimals:0,scale:0.001},
  gdp:{series:'A191RL1Q225SBEA',mode:'level',suffix:'%',decimals:1},
  pce:{series:'PCEPI',mode:'yoy',suffix:'%',decimals:1},
  core_pce:{series:'PCEPILFE',mode:'yoy',suffix:'%',decimals:1},
  fomc:{series:'DFEDTARU',lowerSeries:'DFEDTARL',mode:'range',suffix:'%',decimals:2}
};
function csvRows(text){
  const lines=String(text||'').trim().split(/\r?\n/);if(lines.length<2)return[];
  return lines.slice(1).map(line=>{const i=line.indexOf(',');if(i<0)return null;const date=line.slice(0,i).trim();const raw=line.slice(i+1).trim();const value=Number(raw);return date&&Number.isFinite(value)?{date,value}:null}).filter(Boolean).sort((a,b)=>b.date.localeCompare(a.date));
}
async function fetchFredCsv(series){
  const r=await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(series)}`,{headers:{accept:'text/csv','user-agent':'GoldHunter/1.0'}});
  if(!r.ok)throw new Error(`FRED ${series} ${r.status}`);
  const rows=csvRows(await r.text());if(!rows.length)throw new Error(`FRED ${series} empty`);return rows;
}
function fredPeriod(date){return String(date||'').slice(0,7)}
function fredFmt(v,cfg){if(!Number.isFinite(v))return'';const scaled=v*(cfg.scale||1);return `${scaled.toFixed(cfg.decimals??1).replace(/\.0+$/,'')}${cfg.suffix||''}`}
function fredMetric(rows,cfg,lowerRows){
  if(!rows?.length)return null;
  if(cfg.mode==='range'){
    const upper=rows[0],lower=lowerRows?.[0];if(!lower)return null;
    const prevUpper=rows.find((x,i)=>i>0&&x.value!==upper.value)||rows[1];
    const prevLower=lowerRows.find((x,i)=>i>0&&x.value!==lower.value)||lowerRows[1];
    const range=(l,u)=>`${Number(l).toFixed(2).replace(/\.00$/,'')}–${Number(u).toFixed(2).replace(/\.00$/,'')}%`;
    return {actual:range(lower.value,upper.value),previous:prevLower&&prevUpper?range(prevLower.value,prevUpper.value):range(lower.value,upper.value),period:upper.date,history:rows.slice(0,10).map((u,i)=>({period:u.date,actual:range(lowerRows?.[i]?.value??lower.value,u.value),previous:i+1<rows.length?range(lowerRows?.[i+1]?.value??lower.value,rows[i+1].value):''}))};
  }
  const r=rows;
  let calc;
  if(cfg.mode==='level')calc=i=>r[i]?r[i].value:null;
  if(cfg.mode==='mom')calc=i=>r[i+1]&&r[i+1].value!==0?((r[i].value/r[i+1].value)-1)*100:null;
  if(cfg.mode==='yoy')calc=i=>{const target=new Date(r[i].date+'T00:00:00Z');target.setUTCFullYear(target.getUTCFullYear()-1);const key=target.toISOString().slice(0,7);const base=r.find(x=>x.date.slice(0,7)===key);return base&&base.value!==0?((r[i].value/base.value)-1)*100:null};
  const a=calc?.(0),pr=calc?.(1);
  const history=[];for(let i=0;i<r.length&&history.length<10;i++){const v=calc?.(i);if(v===null||v===undefined)continue;const pv=calc?.(i+1);history.push({period:r[i].date,actual:fredFmt(v,cfg),previous:fredFmt(pv,cfg)})}
  return {actual:fredFmt(a,cfg),previous:fredFmt(pr,cfg),period:cfg.mode==='level'?r[0].date:fredPeriod(r[0].date),history};
}
async function fetchFred(env){
  let stale=null;
  if(env.GH_MARKET_DATA){stale=await env.GH_MARKET_DATA.get(FRED_CACHE_KEY,{type:'json'});if(stale&&Date.now()-stale.savedAt<15*60*1000)return stale;}
  try{
  const metrics={},histories={},errors={};
  await Promise.all(Object.entries(FRED_CONFIG).map(async([type,cfg])=>{
    try{const [rows,lower]=await Promise.all([fetchFredCsv(cfg.series),cfg.lowerSeries?fetchFredCsv(cfg.lowerSeries):Promise.resolve(null)]);const m=fredMetric(rows,cfg,lower);metrics[type]=m;histories[type]=m?.history||[];}catch(e){errors[type]=e.message;}
  }));
  const result={savedAt:Date.now(),metrics,histories,errors,source:'FRED / official source series'};
  if(env.GH_MARKET_DATA)await env.GH_MARKET_DATA.put(FRED_CACHE_KEY,JSON.stringify(result),{expirationTtl:604800});
  return result;
  }catch(error){if(stale)return {...stale,stale:true,refreshError:error.message};throw error;}
}


async function fetchStaticOfficial(request){
  try{
    const url=new URL('/data/official-data.json',new URL(request.url).origin);
    url.searchParams.set('v',String(Date.now()).slice(0,-5));
    const response=await fetch(url.toString(),{headers:{accept:'application/json'},cf:{cacheTtl:60,cacheEverything:true}});
    if(!response.ok)throw new Error(`Static official data ${response.status}`);
    const data=await response.json();
    return {
      metrics:data?.metrics||{},
      histories:Object.fromEntries(Object.entries(data?.metrics||{}).map(([key,value])=>[key,Array.isArray(value?.history)?value.history:[]])),
      savedAt:data?.updatedAt?new Date(data.updatedAt).getTime():0,
      errors:data?.errors||{},
      source:'GitHub Actions official-data cache'
    };
  }catch(error){
    return {metrics:{},histories:{},savedAt:0,errors:{static:error.message},source:'static cache unavailable'};
  }
}

async function fetchStaticEvents(request){
  try{
    const url=new URL('/data/generated-events.json',new URL(request.url).origin);
    url.searchParams.set('v',String(Date.now()).slice(0,-5));
    const response=await fetch(url.toString(),{headers:{accept:'application/json'},cf:{cacheTtl:60,cacheEverything:true}});
    if(!response.ok)throw new Error(`Static schedule ${response.status}`);
    const data=await response.json();
    return Array.isArray(data)?data:[];
  }catch{return[];}
}

const headers={
  'content-type':'application/json; charset=utf-8',
  'access-control-allow-origin':'*',
  'access-control-allow-headers':'content-type,x-admin-pin',
  'access-control-allow-methods':'GET,POST,OPTIONS'
};
const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{...headers,...extra}});
const clean=(v,max=500)=>typeof v==='string'?v.trim().slice(0,max):'';
function authorized(request,env){const supplied=request.headers.get('x-admin-pin')||'';return Boolean(env.ADMIN_PIN&&supplied&&supplied===env.ADMIN_PIN);}
function eventKey(e){
  const type=String(e?.type||'').trim().toLowerCase();
  const period=String(e?.releasePeriod||'').trim();
  const minute=String(e?.datetime||'').trim().slice(0,16);
  return period?`${type}|${period}`:`${type}|${minute}`;
}
function dedupeEvents(input){
  const out=new Map();
  for(const e of Array.isArray(input)?input:[]){
    const key=eventKey(e);if(!key||key==='|')continue;
    const old=out.get(key);
    if(!old){out.set(key,e);continue;}
    // Keep one row only and preserve user-managed lifecycle fields.
    out.set(key,{...old,forecast:old.forecast||e.forecast||'',previous:old.previous||e.previous||'',actual:old.actual||e.actual||'',lastRelease:old.lastRelease||e.lastRelease||null,archivedPeriod:old.archivedPeriod||e.archivedPeriod||'',archivedAt:old.archivedAt||e.archivedAt||''});
  }
  return [...out.values()].sort((a,b)=>new Date(a.datetime)-new Date(b.datetime));
}
function sanitizeEvents(input){
  if(!Array.isArray(input)) return [];
  return dedupeEvents(input.slice(0,150).map((e,i)=>({
    id:clean(e?.id,80)||`event-${Date.now()}-${i}`,
    type:clean(e?.type,60), releasePeriod:clean(e?.releasePeriod,10), name:clean(e?.name,120), nameZh:clean(e?.nameZh,120),
    datetime:clean(e?.datetime,50), forecast:clean(e?.forecast,80), previous:clean(e?.previous,80), actual:clean(e?.actual,80),
    lastRelease:(e?.lastRelease&&typeof e.lastRelease==='object')?{period:clean(e.lastRelease.period,20),dateTime:clean(e.lastRelease.dateTime,50),actual:clean(e.lastRelease.actual,80),forecast:clean(e.lastRelease.forecast,80),previous:clean(e.lastRelease.previous,80)}:null,
    archivedPeriod:clean(e?.archivedPeriod,20), archivedAt:clean(e?.archivedAt,50),
    sourceName:clean(e?.sourceName,160), sourceUrl:/^https:\/\//i.test(clean(e?.sourceUrl,500))?clean(e?.sourceUrl,500):'',
    impact:Math.min(5,Math.max(4,Number(e?.impact)||4)), whyZh:clean(e?.whyZh,180)
  })).filter(e=>e.name&&e.datetime&&e.impact>=4&&!REMOVED_TYPES.has(e.type)));
}
async function readStored(env,request){
  const generated=await fetchStaticEvents(request);
  let stored=[];
  if(env.GH_MARKET_DATA){
    const value=await env.GH_MARKET_DATA.get(EVENTS_KEY,{type:'json'});
    if(Array.isArray(value))stored=value;
  }
  const base=dedupeEvents(generated.length?generated:(stored.length?stored:SEED_EVENTS));
  if(!generated.length||!stored.length)return base;
  const byId=new Map(stored.map(e=>[String(e.id||''),e]));
  const byTypePeriod=new Map(stored.map(e=>[`${e.type||''}|${e.releasePeriod||''}`,e]));
  const merged=base.map(e=>{
    const old=byId.get(String(e.id||''))||byTypePeriod.get(`${e.type||''}|${e.releasePeriod||''}`);
    return old?{...e,forecast:old.forecast||e.forecast||'',previous:old.previous||e.previous||'',actual:old.actual||e.actual||'',lastRelease:old.lastRelease||e.lastRelease||null,archivedPeriod:old.archivedPeriod||e.archivedPeriod||'',archivedAt:old.archivedAt||e.archivedAt||''}:e;
  });
  // Preserve manually maintained official Fed speech events not yet present in the generated schedule.
  for(const e of stored){if(e.type==='fed_speech'&&!merged.some(x=>x.id===e.id))merged.push(e);}
  return dedupeEvents(merged);
}
function monthKey(row){return `${row.year}-${String(Number(row.period?.replace('M',''))).padStart(2,'0')}`;}
function newestRows(series){return (series?.data||[]).filter(r=>/^M\d\d$/.test(r.period)).sort((a,b)=>monthKey(b).localeCompare(monthKey(a)));}
function num(v){const n=Number(v);return Number.isFinite(n)?n:null;}
function format(v,suffix,dec=1){if(v===null||!Number.isFinite(v))return '';return `${v.toFixed(dec).replace(/\.0$/,'')}${suffix}`;}
function computeMetric(series,config){
  const rows=newestRows(series); if(rows.length<2)return null;
  if(config.mode==='level') return {actual:format(num(rows[0].value),config.suffix),previous:format(num(rows[1].value),config.suffix),period:monthKey(rows[0])};
  if(config.mode==='change'){
    if(rows.length<3)return null; const a=num(rows[0].value),b=num(rows[1].value),c=num(rows[2].value);
    return {actual:format(a-b,config.suffix,0),previous:format(b-c,config.suffix,0),period:monthKey(rows[0])};
  }
  if(config.mode==='mom'){
    if(rows.length<3)return null; const a=num(rows[0].value),b=num(rows[1].value),c=num(rows[2].value);
    if(!b||!c)return null;
    return {actual:format((a/b-1)*100,config.suffix,1),previous:format((b/c-1)*100,config.suffix,1),period:monthKey(rows[0])};
  }
  if(config.mode==='yoy'){
    const map=new Map(rows.map(r=>[monthKey(r),num(r.value)]));
    const latest=rows[0], prev=rows[1];
    const ly=`${Number(latest.year)-1}-${String(Number(latest.period.replace('M',''))).padStart(2,'0')}`;
    const py=`${Number(prev.year)-1}-${String(Number(prev.period.replace('M',''))).padStart(2,'0')}`;
    const av=num(latest.value),al=map.get(ly),pv=num(prev.value),pl=map.get(py);
    if([av,al,pv,pl].some(v=>v===null||v===undefined))return null;
    return {actual:format((av/al-1)*100,config.suffix),previous:format((pv/pl-1)*100,config.suffix),period:monthKey(latest)};
  }
  return null;
}

function computeHistory(series,config,limit=10){
  const rows=newestRows(series); const out=[];
  if(!rows.length)return out;
  if(config.mode==='level'){
    for(let i=0;i<Math.min(limit,rows.length-1);i++){
      out.push({period:monthKey(rows[i]),actual:format(num(rows[i].value),config.suffix),previous:format(num(rows[i+1].value),config.suffix)});
    }
    return out;
  }
  if(config.mode==='change'){
    for(let i=0;i<Math.min(limit,rows.length-2);i++){
      const a=num(rows[i].value),b=num(rows[i+1].value),c=num(rows[i+2].value);
      if([a,b,c].some(v=>v===null))continue;
      out.push({period:monthKey(rows[i]),actual:format(a-b,config.suffix,0),previous:format(b-c,config.suffix,0)});
    }
    return out;
  }
  if(config.mode==='mom'){
    for(let i=0;i<Math.min(limit,rows.length-2);i++){
      const a=num(rows[i].value),b=num(rows[i+1].value),c=num(rows[i+2].value);
      if([a,b,c].some(v=>v===null)||!b||!c)continue;
      out.push({period:monthKey(rows[i]),actual:format((a/b-1)*100,config.suffix,1),previous:format((b/c-1)*100,config.suffix,1)});
    }
    return out;
  }
  if(config.mode==='yoy'){
    const map=new Map(rows.map(r=>[monthKey(r),num(r.value)]));
    for(let i=0;i<rows.length&&out.length<limit;i++){
      const r=rows[i],period=monthKey(r),ly=`${Number(r.year)-1}-${String(Number(r.period.replace('M',''))).padStart(2,'0')}`;
      const v=num(r.value),base=map.get(ly);
      if(v===null||base===null||base===undefined)continue;
      let previous='';
      if(i+1<rows.length){
        const pr=rows[i+1],pp=monthKey(pr),ply=`${Number(pr.year)-1}-${String(Number(pr.period.replace('M',''))).padStart(2,'0')}`;
        const pv=num(pr.value),pb=map.get(ply);
        if(pv!==null&&pb!==null&&pb!==undefined)previous=format((pv/pb-1)*100,config.suffix);
      }
      out.push({period,actual:format((v/base-1)*100,config.suffix),previous});
    }
    return out;
  }
  return out;
}
async function fetchBls(env){
  let stale=null;
  if(env.GH_MARKET_DATA){stale=await env.GH_MARKET_DATA.get(BLS_CACHE_KEY,{type:'json'});if(stale&&Date.now()-stale.savedAt<30*60*1000)return stale;}
  try{
  const year=new Date().getUTCFullYear();
  const ids=Object.values(SERIES).map(x=>x.id);
  const r=await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({seriesid:ids,startyear:String(year-2),endyear:String(year)})});
  if(!r.ok)throw new Error(`BLS ${r.status}`);
  const payload=await r.json();
  const byId=new Map((payload?.Results?.series||[]).map(s=>[s.seriesID,s]));
  const metrics={}; const histories={}; for(const [key,cfg] of Object.entries(SERIES)){ metrics[key]=computeMetric(byId.get(cfg.id),cfg); histories[key]=computeHistory(byId.get(cfg.id),cfg,10); }
  const result={savedAt:Date.now(),metrics,histories,source:'BLS Public Data API'};
  if(env.GH_MARKET_DATA)await env.GH_MARKET_DATA.put(BLS_CACHE_KEY,JSON.stringify(result),{expirationTtl:604800});
  return result;
  }catch(error){if(stale)return {...stale,stale:true,refreshError:error.message};throw error;}
}

function parseComparable(value){
  const matches=String(value||'').replace(/,/g,'').match(/-?\d+(?:\.\d+)?/g);
  if(!matches?.length)return null;
  const nums=matches.map(Number).filter(Number.isFinite);
  if(!nums.length)return null;
  // Interest-rate forecasts/actuals may be ranges such as 5.25–5.50%.
  return nums.length>=2?(nums[0]+nums[1])/2:nums[0];
}
function metricFreshness(metric){
  const raw=metric?.observationDate||metric?.period||'';
  if(/^\d{4}-Q[1-4]$/.test(raw))return Number(raw.slice(0,4))*10+Number(raw.slice(-1))*3;
  const parsed=Date.parse(String(raw).length===7?`${raw}-01`:raw);
  return Number.isFinite(parsed)?parsed:0;
}
function chooseMetric(runtimeMetric,staticMetric){
  if(!runtimeMetric)return staticMetric;
  if(!staticMetric)return runtimeMetric;
  return metricFreshness(runtimeMetric)>=metricFreshness(staticMetric)?runtimeMetric:staticMetric;
}
function mergeOfficialMetrics(runtimeMetrics,staticMetrics){
  const keys=new Set([...Object.keys(runtimeMetrics||{}),...Object.keys(staticMetrics||{})]);
  return Object.fromEntries([...keys].map(key=>[key,chooseMetric(runtimeMetrics?.[key],staticMetrics?.[key])]));
}


function nextMalaysiaDayStart(datetime){
  const day=String(datetime||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return NaN;
  const d=new Date(`${day}T00:00:00+08:00`);
  d.setUTCDate(d.getUTCDate()+1);
  return d.getTime();
}

function classifyResult(type,actual,forecast){
  const a=parseComparable(actual),f=parseComparable(forecast);
  if(a===null||f===null)return {comparison:'',comparisonZh:'',difference:'',goldImpact:'',goldImpactZh:''};
  const tolerance=Math.max(0.0001,Math.abs(f)*0.0001);
  const delta=a-f;
  const comparison=Math.abs(delta)<=tolerance?'In Line':delta>0?'Above Forecast':'Below Forecast';
  const comparisonZh=comparison==='In Line'?'符合预期':comparison==='Above Forecast'?'高于预期':'低于预期';
  const bullishWhenHigher=new Set(['unemployment','jobless_claims']);
  const bearishWhenHigher=new Set(['cpi_yoy','core_cpi_yoy','ppi_yoy','core_ppi_yoy','nfp','avg_hourly_earnings','retail_sales','gdp','pce','core_pce','fomc']);
  let goldImpact='',goldImpactZh='';
  if(comparison==='In Line'){goldImpact='Typically Neutral for Gold';goldImpactZh='通常对黄金影响中性';}
  else if(bullishWhenHigher.has(type)){
    const bullish=delta>0;goldImpact=bullish?'Typically Supportive for Gold':'Typically Negative for Gold';goldImpactZh=bullish?'通常利好黄金':'通常利空黄金';
  }else if(bearishWhenHigher.has(type)){
    const bullish=delta<0;goldImpact=bullish?'Typically Supportive for Gold':'Typically Negative for Gold';goldImpactZh=bullish?'通常利好黄金':'通常利空黄金';
  }
  const suffix=String(actual||'').includes('%')?'%':String(actual||'').toUpperCase().includes('K')?'K':'';
  const difference=`${delta>0?'+':''}${delta.toFixed(Math.abs(delta)<1?2:1).replace(/\.0$/,'')}${suffix}`;
  const surprisePct=Math.abs(f)>0?Math.abs(delta/f)*100:null;
  const surpriseStrength=surprisePct===null?'':surprisePct>=20?'High surprise':surprisePct>=7.5?'Moderate surprise':'Small surprise';
  const surpriseStrengthZh=surpriseStrength==='High surprise'?'明显偏离预期':surpriseStrength==='Moderate surprise'?'中度偏离预期':surpriseStrength==='Small surprise'?'轻微偏离预期':'';
  return {comparison,comparisonZh,difference,goldImpact,goldImpactZh,surpriseStrength,surpriseStrengthZh};
}
export async function onRequestOptions(){return new Response(null,{status:204,headers});}
export async function onRequestGet({request,env}){
  const wantsAdmin=request.headers.has('x-admin-pin');
  if(wantsAdmin&&!authorized(request,env))return json({error:'Incorrect PIN, or ADMIN_PIN is not configured.'},401,{'cache-control':'no-store'});
  const stored=(await readStored(env,request)).filter(e=>!REMOVED_TYPES.has(String(e.type||''))&&!/ISM/i.test(String(e.name||'')));
  const staticOfficial=await fetchStaticOfficial(request);
  let bls={metrics:{},histories:{},savedAt:null},fred={metrics:{},histories:{},savedAt:null};
  try{bls=await fetchBls(env);}catch(e){bls.error=e.message;}
  try{fred=await fetchFred(env);}catch(e){fred.error=e.message;}
  const runtimeMetrics={...(bls.metrics||{}),...(fred.metrics||{})};
  const runtimeHistories={...(bls.histories||{}),...(fred.histories||{})};
  const official={
    metrics:mergeOfficialMetrics(runtimeMetrics,staticOfficial.metrics||{}),
    histories:{...(staticOfficial.histories||{}),...runtimeHistories},
    savedAt:Math.max(bls.savedAt||0,fred.savedAt||0,staticOfficial.savedAt||0),
    error:[bls.error,fred.error,...Object.values(staticOfficial.errors||{})].filter(Boolean).join(' | '),
    staticSource:staticOfficial.source
  };
  const now=Date.now();
  let archiveChanged=false;
  const persistable=stored.map(e=>({...e}));
  const events=dedupeEvents(persistable.filter(e=>Number(e.impact)>=4&&!REMOVED_TYPES.has(e.type))).map(e=>{
    const m=official.metrics?.[e.type];
    const releaseAt=new Date(e.datetime).getTime();
    const released=Number.isFinite(releaseAt)&&now>=releaseAt;
    const exactCurrentRelease=Boolean(released&&e.releasePeriod&&m&&m.period===e.releasePeriod&&m.actual);
    const eventOnly=EVENT_ONLY_TYPES.has(e.type);
    const rawHistory=(official.histories?.[e.type]||[]).slice(0,10);

    // Before release, the newest published official Actual is the automatic Previous.
    // On release day, only a metric whose period exactly matches releasePeriod may become Actual.
    // An older official observation is never copied into the current Actual field.
    let actual=exactCurrentRelease?(m.actual||''):'';
    let previous='';
    if(eventOnly) previous='Not applicable';
    else if(exactCurrentRelease) previous=m.previous||rawHistory.find(r=>r&&r.period!==e.releasePeriod&&r.actual)?.actual||e.lastRelease?.actual||e.previous||'';
    else previous=(m?.actual||rawHistory.find(r=>r&&r.actual)?.actual||e.lastRelease?.actual||e.previous||'');

    // At Malaysia midnight on the day after release, archive the complete released row once.
    // Forecast is then cleared, so Admin only needs to enter the next release forecast.
    const archiveAt=nextMalaysiaDayStart(e.datetime);
    if(!eventOnly&&exactCurrentRelease&&Number.isFinite(archiveAt)&&now>=archiveAt&&e.archivedPeriod!==e.releasePeriod){
      e.lastRelease={period:e.releasePeriod||'',dateTime:e.datetime||'',actual,forecast:e.forecast||'',previous:previous||''};
      e.archivedPeriod=e.releasePeriod||'';
      e.archivedAt=new Date().toISOString();
      e.forecast='';
      archiveChanged=true;
    }

    // Once archived, the released row lives in Last Release rather than the live values.
    const archivedThisPeriod=e.archivedPeriod&&e.archivedPeriod===e.releasePeriod;
    if(archivedThisPeriod){actual='';previous=e.lastRelease?.actual||previous;}
    if(!previous) previous=eventOnly?'Not applicable':'—';

    const history=[];
    if(e.lastRelease?.actual)history.push({...e.lastRelease,lastRelease:true});
    for(const row of rawHistory){
      if(history.length>=10)break;
      if(e.lastRelease?.period&&row.period===e.lastRelease.period)continue;
      history.push({...row,forecast:''});
    }
    const previousStatus=previous&&!/unavailable|Syncing|Manual|pending/i.test(previous)?'ready':(AUTO_TYPES.has(e.type)?'awaiting_official':'manual_required');
    const status=!released?'Scheduled':archivedThisPeriod?'Archived to Last Release':'Released';
    const result=eventOnly?{comparison:'',comparisonZh:'',difference:'',goldImpact:'',goldImpactZh:'',surpriseStrength:'',surpriseStrengthZh:''}:classifyResult(e.type,actual,e.forecast);
    return {...e,actual,previous,history,officialPeriod:m?.period||'',officialAuto:Boolean(m),released,previousStatus,eventOnly,status,...result};
  });
  if(archiveChanged&&env.GH_MARKET_DATA){
    await env.GH_MARKET_DATA.put(EVENTS_KEY,JSON.stringify(sanitizeEvents(persistable)));
  }
  return json({events,updatedAt:new Date().toISOString(),officialUpdatedAt:official.savedAt?new Date(official.savedAt).toISOString():null,kvConfigured:Boolean(env.GH_MARKET_DATA),officialError:official.error||null,officialSources:{staticCache:Boolean(Object.keys(staticOfficial.metrics||{}).length),bls:!bls.error,fred:!fred.error,fredErrors:fred.errors||{},staticErrors:staticOfficial.errors||{}}},200,{'cache-control':wantsAdmin?'no-store':'public, max-age=60, s-maxage=300'});
}
export async function onRequestPost({request,env}){
  if(!authorized(request,env))return json({error:'Incorrect PIN, or ADMIN_PIN is not configured.'},401,{'cache-control':'no-store'});
  if(!env.GH_MARKET_DATA)return json({error:'GH_MARKET_DATA KV binding is not configured in Cloudflare.'},503,{'cache-control':'no-store'});
  let body;try{body=await request.json();}catch{return json({error:'Invalid request.'},400);}
  const events=sanitizeEvents(body?.events); if(!events.length)return json({error:'No valid 4-star or 5-star events.'},400);
  events.sort((a,b)=>new Date(a.datetime)-new Date(b.datetime));
  await env.GH_MARKET_DATA.put(EVENTS_KEY,JSON.stringify(events));
  return json({ok:true,count:events.length,events,updatedAt:new Date().toISOString()},200,{'cache-control':'no-store'});
}
