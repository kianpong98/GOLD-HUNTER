const EVENTS_KEY = 'gold-market-events-v3';
const BLS_CACHE_KEY = 'official-bls-cache-v1';

const SEED_EVENTS = [
  {id:'cpi-2026-07',releasePeriod:'2026-06',type:'cpi_yoy',name:'Consumer Price Index',nameZh:'消费者物价指数',datetime:'2026-07-14T20:30:00+08:00',forecast:'',sourceName:'U.S. Bureau of Labor Statistics',sourceUrl:'https://www.bls.gov/schedule/news_release/cpi.htm',impact:5,whyZh:'衡量美国整体通胀，通常会明显影响美元与黄金。'},
  {id:'core-cpi-2026-07',releasePeriod:'2026-06',type:'core_cpi_yoy',name:'Core Consumer Price Index',nameZh:'核心消费者物价指数',datetime:'2026-07-14T20:30:00+08:00',forecast:'',sourceName:'U.S. Bureau of Labor Statistics',sourceUrl:'https://www.bls.gov/schedule/news_release/cpi.htm',impact:5,whyZh:'剔除食品与能源，更能反映基础通胀趋势。'},
  {id:'ppi-2026-07',releasePeriod:'2026-06',type:'ppi_yoy',name:'Producer Price Index',nameZh:'生产者物价指数',datetime:'2026-07-15T20:30:00+08:00',forecast:'',sourceName:'U.S. Bureau of Labor Statistics',sourceUrl:'https://www.bls.gov/schedule/news_release/ppi.htm',impact:4,whyZh:'反映生产端通胀压力，可影响市场对利率的预期。'},
  {id:'core-ppi-2026-07',releasePeriod:'2026-06',type:'core_ppi_yoy',name:'Core Producer Price Index',nameZh:'核心生产者物价指数',datetime:'2026-07-15T20:30:00+08:00',forecast:'',sourceName:'U.S. Bureau of Labor Statistics',sourceUrl:'https://www.bls.gov/schedule/news_release/ppi.htm',impact:4,whyZh:'剔除波动较大的项目，用于观察持续性生产通胀。'},
  {id:'beige-book-2026-07',type:'beige_book',name:'Federal Reserve Beige Book',nameZh:'美联储褐皮书',datetime:'2026-07-16T02:00:00+08:00',forecast:'',sourceName:'Federal Reserve',sourceUrl:'https://www.federalreserve.gov/newsevents/2026-july.htm',impact:3,whyZh:'总结各地区经济状况，可影响市场对经济与利率前景的判断。'},
  {id:'retail-sales-2026-07',releasePeriod:'2026-06',type:'retail_sales',name:'Retail Sales',nameZh:'零售销售',datetime:'2026-07-16T20:30:00+08:00',forecast:'',sourceName:'U.S. Census Bureau',sourceUrl:'https://www.census.gov/retail/release_schedule.html',impact:3,whyZh:'反映消费强弱，可能改变经济与利率预期。'},
  {id:'import-export-prices-2026-07',releasePeriod:'2026-06',type:'import_export_prices',name:'Import and Export Price Indexes',nameZh:'进出口物价指数',datetime:'2026-07-17T20:30:00+08:00',forecast:'',sourceName:'U.S. Bureau of Labor Statistics',sourceUrl:'https://www.bls.gov/schedule/',impact:3,whyZh:'反映跨境商品价格压力，可补充观察美国通胀趋势。'},
  {id:'housing-starts-2026-07',releasePeriod:'2026-06',type:'housing_starts',name:'Housing Starts and Building Permits',nameZh:'新屋开工与营建许可',datetime:'2026-07-17T20:30:00+08:00',forecast:'',sourceName:'U.S. Census Bureau',sourceUrl:'https://www.census.gov/economic-indicators/calendar-listview.html',impact:3,whyZh:'反映房地产与经济活动，可影响美元和收益率预期。'},
  {id:'durable-goods-2026-07',releasePeriod:'2026-06',type:'durable_goods',name:'Durable Goods Orders',nameZh:'耐用品订单',datetime:'2026-07-27T20:30:00+08:00',forecast:'',sourceName:'U.S. Census Bureau',sourceUrl:'https://www.census.gov/manufacturing/m3/release_schedule.html',impact:3,whyZh:'反映企业投资与制造需求，可影响经济增长预期。'},
  {id:'advance-trade-2026-07',releasePeriod:'2026-06',type:'advance_trade',name:'Advance Goods Trade Balance',nameZh:'商品贸易帐初值',datetime:'2026-07-28T20:30:00+08:00',forecast:'',sourceName:'U.S. Census Bureau',sourceUrl:'https://www.census.gov/economic-indicators/calendar-listview.html',impact:3,whyZh:'反映贸易状况，可能影响美元与增长预期。'},
  {id:'gdp-advance-2026-q2',releasePeriod:'2026-Q2',type:'gdp',name:'GDP — Advance Estimate',nameZh:'国内生产总值初值',datetime:'2026-07-30T20:30:00+08:00',forecast:'',sourceName:'U.S. Bureau of Economic Analysis',sourceUrl:'https://www.bea.gov/news/schedule',impact:4,whyZh:'衡量美国经济增长，是影响利率预期的重要数据。'},
  {id:'fomc-2026-07',type:'fomc',name:'FOMC Interest Rate Decision',nameZh:'美联储利率决议',datetime:'2026-07-30T02:00:00+08:00',forecast:'',sourceName:'Federal Reserve',sourceUrl:'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',impact:5,whyZh:'利率与政策措辞会直接改变美元、收益率和黄金定价。'},
  {id:'pce-2026-07',type:'pce',name:'PCE Price Index',nameZh:'PCE物价指数',datetime:'2026-07-30T20:30:00+08:00',forecast:'',sourceName:'U.S. Bureau of Economic Analysis',sourceUrl:'https://www.bea.gov/data/personal-consumption-expenditures-price-index',impact:5,whyZh:'美联储重点关注的通胀指标之一。'},
  {id:'core-pce-2026-07',type:'core_pce',name:'Core PCE Price Index',nameZh:'核心PCE物价指数',datetime:'2026-07-30T20:30:00+08:00',forecast:'',sourceName:'U.S. Bureau of Economic Analysis',sourceUrl:'https://www.bea.gov/data/personal-consumption-expenditures-price-index',impact:5,whyZh:'剔除食品与能源，是美联储观察基础通胀的重要指标。'},
  {id:'nfp-2026-08',releasePeriod:'2026-07',type:'nfp',name:'Nonfarm Payrolls',nameZh:'非农就业人数',datetime:'2026-08-07T20:30:00+08:00',forecast:'',sourceName:'U.S. Bureau of Labor Statistics',sourceUrl:'https://www.bls.gov/schedule/news_release/empsit.htm',impact:5,whyZh:'反映美国就业增长，公布时黄金通常波动较大。'},
  {id:'unemployment-2026-08',releasePeriod:'2026-07',type:'unemployment',name:'Unemployment Rate',nameZh:'失业率',datetime:'2026-08-07T20:30:00+08:00',forecast:'',sourceName:'U.S. Bureau of Labor Statistics',sourceUrl:'https://www.bls.gov/schedule/news_release/empsit.htm',impact:5,whyZh:'反映劳动力市场强弱，并影响利率预期。'},
  {id:'avg-hourly-earnings-2026-08',releasePeriod:'2026-07',type:'avg_hourly_earnings',name:'Average Hourly Earnings',nameZh:'平均每小时工资',datetime:'2026-08-07T20:30:00+08:00',forecast:'',sourceName:'U.S. Bureau of Labor Statistics',sourceUrl:'https://www.bls.gov/schedule/news_release/empsit.htm',impact:3,whyZh:'工资增长会影响通胀与利率预期，并可能带动黄金波动。'}
];

const SERIES = {
  cpi_yoy: {id:'CUUR0000SA0', mode:'yoy', suffix:'%'},
  core_cpi_yoy: {id:'CUUR0000SA0L1E', mode:'yoy', suffix:'%'},
  ppi_yoy: {id:'WPUFD4', mode:'yoy', suffix:'%'},
  core_ppi_yoy: {id:'WPUFD49116', mode:'yoy', suffix:'%'},
  nfp: {id:'CES0000000001', mode:'change', suffix:'K'},
  unemployment: {id:'LNS14000000', mode:'level', suffix:'%'}
};

const headers={
  'content-type':'application/json; charset=utf-8',
  'access-control-allow-origin':'*',
  'access-control-allow-headers':'content-type,x-admin-pin',
  'access-control-allow-methods':'GET,POST,OPTIONS'
};
const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{...headers,...extra}});
const clean=(v,max=500)=>typeof v==='string'?v.trim().slice(0,max):'';
function authorized(request,env){const supplied=request.headers.get('x-admin-pin')||'';return Boolean(env.ADMIN_PIN&&supplied&&supplied===env.ADMIN_PIN);}
function sanitizeEvents(input){
  if(!Array.isArray(input)) return [];
  return input.slice(0,100).map((e,i)=>({
    id:clean(e?.id,80)||`event-${Date.now()}-${i}`,
    type:clean(e?.type,60), releasePeriod:clean(e?.releasePeriod,10), name:clean(e?.name,120), nameZh:clean(e?.nameZh,120),
    datetime:clean(e?.datetime,50), forecast:clean(e?.forecast,80),
    sourceName:clean(e?.sourceName,160), sourceUrl:/^https:\/\//i.test(clean(e?.sourceUrl,500))?clean(e?.sourceUrl,500):'',
    impact:Math.min(5,Math.max(3,Number(e?.impact)||3)), whyZh:clean(e?.whyZh,180)
  })).filter(e=>e.name&&e.datetime&&e.impact>=3);
}
async function readStored(env){
  if(!env.GH_MARKET_DATA) return SEED_EVENTS;
  const stored=await env.GH_MARKET_DATA.get(EVENTS_KEY,{type:'json'});
  return Array.isArray(stored)&&stored.length?stored:SEED_EVENTS;
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
async function fetchBls(env){
  if(env.GH_MARKET_DATA){const cached=await env.GH_MARKET_DATA.get(BLS_CACHE_KEY,{type:'json'});if(cached&&Date.now()-cached.savedAt<30*60*1000)return cached;}
  const year=new Date().getUTCFullYear();
  const ids=Object.values(SERIES).map(x=>x.id);
  const r=await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({seriesid:ids,startyear:String(year-2),endyear:String(year)})});
  if(!r.ok)throw new Error(`BLS ${r.status}`);
  const payload=await r.json();
  const byId=new Map((payload?.Results?.series||[]).map(s=>[s.seriesID,s]));
  const metrics={}; for(const [key,cfg] of Object.entries(SERIES)) metrics[key]=computeMetric(byId.get(cfg.id),cfg);
  const result={savedAt:Date.now(),metrics,source:'BLS Public Data API'};
  if(env.GH_MARKET_DATA)await env.GH_MARKET_DATA.put(BLS_CACHE_KEY,JSON.stringify(result),{expirationTtl:3600});
  return result;
}
export async function onRequestOptions(){return new Response(null,{status:204,headers});}
export async function onRequestGet({request,env}){
  const wantsAdmin=request.headers.has('x-admin-pin');
  if(wantsAdmin&&!authorized(request,env))return json({error:'Incorrect PIN, or ADMIN_PIN is not configured.'},401,{'cache-control':'no-store'});
  const stored=await readStored(env); let official={metrics:{},savedAt:null};
  try{official=await fetchBls(env);}catch(e){official.error=e.message;}
  const now=Date.now();
  const events=stored.filter(e=>Number(e.impact)>=3).map(e=>{
    const m=official.metrics?.[e.type];
    const releaseAt=new Date(e.datetime).getTime();
    const released=Number.isFinite(releaseAt)&&now>=releaseAt;
    let actual='';
    let previous='';
    if(m){
      if(released && e.releasePeriod && m.period===e.releasePeriod){
        actual=m.actual||'';
        previous=m.previous||'';
      }else{
        // Before the release (or while the official source has not published the new period),
        // the latest official reading is the Previous value and Actual stays blank.
        previous=m.actual||m.previous||'';
      }
    }
    return {...e,actual,previous,officialPeriod:m?.period||'',officialAuto:Boolean(m),released};
  });
  return json({events,updatedAt:new Date().toISOString(),officialUpdatedAt:official.savedAt?new Date(official.savedAt).toISOString():null,kvConfigured:Boolean(env.GH_MARKET_DATA),officialError:official.error||null},200,{'cache-control':wantsAdmin?'no-store':'public, max-age=60, s-maxage=300'});
}
export async function onRequestPost({request,env}){
  if(!authorized(request,env))return json({error:'Incorrect PIN, or ADMIN_PIN is not configured.'},401,{'cache-control':'no-store'});
  if(!env.GH_MARKET_DATA)return json({error:'GH_MARKET_DATA KV binding is not configured in Cloudflare.'},503,{'cache-control':'no-store'});
  let body;try{body=await request.json();}catch{return json({error:'Invalid request.'},400);}
  const events=sanitizeEvents(body?.events); if(!events.length)return json({error:'No valid 3-star, 4-star or 5-star events.'},400);
  events.sort((a,b)=>new Date(a.datetime)-new Date(b.datetime)); await env.GH_MARKET_DATA.put(EVENTS_KEY,JSON.stringify(events));
  return json({ok:true,count:events.length,events,updatedAt:new Date().toISOString()},200,{'cache-control':'no-store'});
}
