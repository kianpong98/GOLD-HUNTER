const EVENTS_KEY = 'gold-market-events-v3';
const ADMIN_OVERRIDES_KEY='news-admin-overrides-v1';
const EVENTS_BACKUP_KEY = 'gold-market-events-v3-backup';
const BLS_CACHE_KEY = 'official-bls-cache-v1';

const SEED_EVENTS = [
  {id:'cpi-2026-07',releasePeriod:'2026-06',type:'cpi_yoy',name:'Consumer Price Index',nameZh:'消费者物价指数',datetime:'2026-07-14T20:30:00+08:00',forecast:'',previous:'',sourceName:'U.S. Bureau of Labor Statistics',sourceUrl:'https://www.bls.gov/schedule/news_release/cpi.htm',impact:5,whyZh:'衡量美国整体通胀，通常会明显影响美元与黄金。'},
  {id:'core-cpi-2026-07',releasePeriod:'2026-06',type:'core_cpi_yoy',name:'Core Consumer Price Index',nameZh:'核心消费者物价指数',datetime:'2026-07-14T20:30:00+08:00',forecast:'',previous:'',sourceName:'U.S. Bureau of Labor Statistics',sourceUrl:'https://www.bls.gov/schedule/news_release/cpi.htm',impact:5,whyZh:'剔除食品与能源，更能反映基础通胀趋势。'},
  {id:'ppi-2026-07',releasePeriod:'2026-06',type:'ppi_yoy',name:'Producer Price Index',nameZh:'生产者物价指数',datetime:'2026-07-15T20:30:00+08:00',forecast:'',previous:'',sourceName:'U.S. Bureau of Labor Statistics',sourceUrl:'https://www.bls.gov/schedule/news_release/ppi.htm',impact:4,whyZh:'反映生产端通胀压力，可影响市场对利率的预期。'},
  {id:'core-ppi-2026-07',releasePeriod:'2026-06',type:'core_ppi_yoy',name:'Core Producer Price Index',nameZh:'核心生产者物价指数',datetime:'2026-07-15T20:30:00+08:00',forecast:'',previous:'',sourceName:'U.S. Bureau of Labor Statistics',sourceUrl:'https://www.bls.gov/schedule/news_release/ppi.htm',impact:4,whyZh:'剔除波动较大的项目，用于观察持续性生产通胀。'},
  {id:'retail-sales-2026-07',releasePeriod:'2026-06',type:'retail_sales',name:'Retail Sales',nameZh:'零售销售',datetime:'2026-07-16T20:30:00+08:00',forecast:'',previous:'',sourceName:'U.S. Census Bureau',sourceUrl:'https://www.census.gov/retail/release_schedule.html',impact:4,whyZh:'反映消费强弱，可能改变经济与利率预期。'},
  {id:'jobless-claims-2026-07-16',releasePeriod:'2026-07-11',type:'jobless_claims',name:'Initial Jobless Claims',nameZh:'初请失业金人数',datetime:'2026-07-16T20:30:00+08:00',forecast:'',previous:'',sourceName:'U.S. Department of Labor',sourceUrl:'https://www.dol.gov/ui/data.pdf',impact:4,whyZh:'反映就业市场短期变化，可能影响美元与黄金。'},
  {id:'fomc-2026-07',releasePeriod:'2026-07-29',type:'fomc',name:'FOMC Interest Rate Decision',nameZh:'美联储利率决议',datetime:'2026-07-30T02:00:00+08:00',forecast:'',previous:'',sourceName:'Federal Reserve',sourceUrl:'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',impact:5,whyZh:'利率与政策措辞会直接改变美元、收益率和黄金定价。'},
  {id:'gdp-advance-2026-q2',releasePeriod:'2026-Q2',type:'gdp',name:'GDP — Advance Estimate',nameZh:'国内生产总值初值',datetime:'2026-07-30T20:30:00+08:00',forecast:'',previous:'',sourceName:'U.S. Bureau of Economic Analysis',sourceUrl:'https://www.bea.gov/news/schedule',impact:4,whyZh:'衡量美国经济增长，是影响利率预期的重要数据。'},
  {id:'pce-2026-07',releasePeriod:'2026-06',type:'pce',name:'PCE Price Index',nameZh:'PCE物价指数',datetime:'2026-07-30T20:30:00+08:00',forecast:'',previous:'',sourceName:'U.S. Bureau of Economic Analysis',sourceUrl:'https://www.bea.gov/data/personal-consumption-expenditures-price-index',impact:5,whyZh:'美联储重点关注的通胀指标之一。'},
  {id:'core-pce-2026-07',releasePeriod:'2026-06',type:'core_pce',name:'Core PCE Price Index',nameZh:'核心PCE物价指数',datetime:'2026-07-30T20:30:00+08:00',forecast:'',previous:'',sourceName:'U.S. Bureau of Economic Analysis',sourceUrl:'https://www.bea.gov/data/personal-consumption-expenditures-price-index',impact:5,whyZh:'剔除食品与能源，是美联储观察基础通胀的重要指标。'},
  {id:'nfp-2026-08',releasePeriod:'2026-07',type:'nfp',name:'Nonfarm Payrolls',nameZh:'非农就业人数',datetime:'2026-08-07T20:30:00+08:00',forecast:'',previous:'',sourceName:'U.S. Bureau of Labor Statistics',sourceUrl:'https://www.bls.gov/schedule/news_release/empsit.htm',impact:5,whyZh:'反映美国就业增长，公布时黄金通常波动较大。'},
  {id:'unemployment-2026-08',releasePeriod:'2026-07',type:'unemployment',name:'Unemployment Rate',nameZh:'失业率',datetime:'2026-08-07T20:30:00+08:00',forecast:'',previous:'',sourceName:'U.S. Bureau of Labor Statistics',sourceUrl:'https://www.bls.gov/schedule/news_release/empsit.htm',impact:5,whyZh:'反映劳动力市场强弱，并影响利率预期。'},
  {id:'avg-hourly-earnings-2026-08',releasePeriod:'2026-07',type:'avg_hourly_earnings',name:'Average Hourly Earnings',nameZh:'平均每小时工资',datetime:'2026-08-07T20:30:00+08:00',forecast:'',previous:'',sourceName:'U.S. Bureau of Labor Statistics',sourceUrl:'https://www.bls.gov/schedule/news_release/empsit.htm',impact:4,whyZh:'工资增长会影响通胀与利率预期，并可能带动黄金波动。'},
  {id:'fomc-minutes-2026-07-29',releasePeriod:'2026-07-29',type:'fomc_minutes',name:'FOMC Meeting Minutes',nameZh:'美联储会议纪要',datetime:'2026-08-20T02:00:00+08:00',forecast:'',previous:'',sourceName:'Federal Reserve',sourceUrl:'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',impact:4,whyZh:'披露政策讨论细节，可能改变市场对未来利率路径的判断。'}
];

// Verified official publication timestamps used to backfill older Last Release rows.
// BLS time is 08:30 ET; these values are stored directly in Malaysia Time (MYT).
// Keeping the publication date separate from the reference period prevents a data
// month such as 2026-06 from being displayed as though it were a release date.
const VERIFIED_RELEASE_DATETIMES = {
  cpi_yoy: {
    '2025-08':'2025-09-11T20:30:00+08:00',
    '2025-09':'2025-10-24T20:30:00+08:00',
    '2025-11':'2025-12-18T21:30:00+08:00',
    '2025-12':'2026-01-13T21:30:00+08:00',
    '2026-01':'2026-02-13T21:30:00+08:00',
    '2026-02':'2026-03-11T20:30:00+08:00',
    '2026-03':'2026-04-10T20:30:00+08:00',
    '2026-04':'2026-05-12T20:30:00+08:00',
    '2026-05':'2026-06-10T20:30:00+08:00',
    '2026-06':'2026-07-14T20:30:00+08:00'
  },
  core_cpi_yoy: {},
  ppi_yoy: {
    '2025-08':'2025-09-10T20:30:00+08:00',
    '2025-09':'2025-11-25T21:30:00+08:00',
    // October 2025 had no separate PPI release; October data were published
    // together with November data on 14 Jan 2026.
    '2025-10':'2026-01-14T21:30:00+08:00',
    '2025-11':'2026-01-14T21:30:00+08:00',
    '2025-12':'2026-01-30T21:30:00+08:00',
    '2026-01':'2026-02-27T21:30:00+08:00',
    '2026-02':'2026-03-18T20:30:00+08:00',
    '2026-03':'2026-04-14T20:30:00+08:00',
    '2026-04':'2026-05-13T20:30:00+08:00',
    '2026-05':'2026-06-11T20:30:00+08:00',
    '2026-06':'2026-07-15T20:30:00+08:00'
  },
  core_ppi_yoy: {},
  nfp: {
    '2025-08':'2025-09-05T20:30:00+08:00',
    '2025-09':'2025-11-20T21:30:00+08:00',
    '2025-11':'2025-12-16T21:30:00+08:00',
    '2025-12':'2026-01-09T21:30:00+08:00',
    '2026-01':'2026-02-11T21:30:00+08:00',
    '2026-02':'2026-03-06T21:30:00+08:00',
    '2026-03':'2026-04-03T20:30:00+08:00',
    '2026-04':'2026-05-08T20:30:00+08:00',
    '2026-05':'2026-06-05T20:30:00+08:00',
    '2026-06':'2026-07-02T20:30:00+08:00'
  },
  unemployment: {},
  avg_hourly_earnings: {}
};
VERIFIED_RELEASE_DATETIMES.core_cpi_yoy = VERIFIED_RELEASE_DATETIMES.cpi_yoy;
VERIFIED_RELEASE_DATETIMES.core_ppi_yoy = VERIFIED_RELEASE_DATETIMES.ppi_yoy;
VERIFIED_RELEASE_DATETIMES.unemployment = VERIFIED_RELEASE_DATETIMES.nfp;
VERIFIED_RELEASE_DATETIMES.avg_hourly_earnings = VERIFIED_RELEASE_DATETIMES.nfp;

function verifiedReleaseDateTime(type,period){
  const canonical=canonicalType({type});
  const key=String(period||'').trim();
  const exact=VERIFIED_RELEASE_DATETIMES[canonical]?.[key];
  if(exact)return exact;
  // Initial claims are normally released on the Thursday following the
  // reported week-ending Saturday. This deterministic fallback is used only
  // when a stored row does not already contain an authoritative timestamp.
  if(canonical==='jobless_claims'&&/^\d{4}-\d{2}-\d{2}$/.test(key)){
    const d=new Date(`${key}T00:00:00Z`);
    if(Number.isFinite(d.getTime())){
      d.setUTCDate(d.getUTCDate()+5);
      return `${d.toISOString().slice(0,10)}T20:30:00+08:00`;
    }
  }
  if(canonical==='fomc'&&/^\d{4}-\d{2}-\d{2}$/.test(key)){
    const d=new Date(`${key}T00:00:00Z`);
    if(Number.isFinite(d.getTime())){
      d.setUTCDate(d.getUTCDate()+1);
      return `${d.toISOString().slice(0,10)}T02:00:00+08:00`;
    }
  }
  return '';
}

const AUTO_TYPES = new Set(['cpi_yoy','core_cpi_yoy','ppi_yoy','core_ppi_yoy','nfp','unemployment','avg_hourly_earnings','retail_sales','jobless_claims','gdp','pce','core_pce','fomc']);
const JOBLESS_HEALTH_STATE_KEY='jobless-health-source-v1';
const EVENT_ONLY_TYPES = new Set(['fomc_minutes','fed_speech']);

const VERIFIED_FALLBACK_METRICS = {
  jobless_claims:{actual:'215K',previous:'217K',period:'2026-07-04',observationDate:'2026-07-04',source:'U.S. Department of Labor verified fallback',history:[
    {period:'2026-07-04',actual:'215K',previous:'217K'},{period:'2026-06-27',actual:'217K',previous:'216K'},{period:'2026-06-20',actual:'216K',previous:'227K'},{period:'2026-06-13',actual:'227K',previous:'230K'},{period:'2026-06-06',actual:'229K',previous:'225K'},{period:'2026-05-30',actual:'225K',previous:'212K'},{period:'2026-05-23',actual:'215K',previous:'210K'},{period:'2026-05-16',actual:'209K',previous:'212K'},{period:'2026-05-09',actual:'211K',previous:'199K'},{period:'2026-05-02',actual:'200K',previous:'190K'}]},
  fomc:{actual:'3.5–3.75%',previous:'3.5–3.75%',period:'2026-06-18',observationDate:'2026-06-18',source:'Federal Reserve verified fallback',history:VERIFIED_FOMC_HISTORY},
  gdp:{actual:'2.1%',previous:'0.5%',period:'2026-Q1',observationDate:'2026-04-01',source:'U.S. Bureau of Economic Analysis verified fallback',history:[
    {period:'2026-Q1',actual:'2.1%',previous:'0.5%'},{period:'2025-Q4',actual:'0.5%',previous:'4.4%'},{period:'2025-Q3',actual:'4.4%',previous:''}]}
};


const VERIFIED_FOMC_HISTORY = [
  {period:'2026-06-18',actual:'3.5–3.75%',previous:'3.5–3.75%'},
  {period:'2026-04-30',actual:'3.5–3.75%',previous:'3.5–3.75%'},
  {period:'2026-03-19',actual:'3.5–3.75%',previous:'3.5–3.75%'},
  {period:'2026-01-29',actual:'3.5–3.75%',previous:'3.5–3.75%'},
  {period:'2025-12-11',actual:'3.5–3.75%',previous:'3.75–4%'},
  {period:'2025-10-30',actual:'3.75–4%',previous:'4–4.25%'},
  {period:'2025-09-18',actual:'4–4.25%',previous:'4.25–4.5%'},
  {period:'2025-07-31',actual:'4.25–4.5%',previous:'4.25–4.5%'},
  {period:'2025-06-19',actual:'4.25–4.5%',previous:'4.25–4.5%'},
  {period:'2025-05-08',actual:'4.25–4.5%',previous:'4.25–4.5%'}
];
const VERIFIED_FOMC_PERIODS = new Set(VERIFIED_FOMC_HISTORY.map(row=>row.period));
function sanitizeFomcHistory(list){
  const byPeriod=new Map();
  for(const row of [...(Array.isArray(list)?list:[]),...VERIFIED_FOMC_HISTORY]){
    const period=String(row?.period||'').slice(0,10);
    if(!VERIFIED_FOMC_PERIODS.has(period)||!row?.actual)continue;
    const canonical=VERIFIED_FOMC_HISTORY.find(item=>item.period===period)||{};
    const old=byPeriod.get(period)||{};
    byPeriod.set(period,{...old,...row,period,actual:canonical.actual||row.actual,previous:canonical.previous||row.previous||''});
  }
  return [...byPeriod.values()].sort((a,b)=>b.period.localeCompare(a.period)).slice(0,10);
}

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
const FED_FOMC_CACHE_KEY='official-fed-fomc-cache-v1';
const OFFICIAL_HISTORY_SNAPSHOT_KEY='official-history-snapshot-v1';
const FRED_CONFIG={
  // FRED fallback coverage for every numeric news type. BLS remains primary where available.
  cpi_yoy:{series:'CPIAUCSL',mode:'yoy',suffix:'%',decimals:1},
  core_cpi_yoy:{series:'CPILFESL',mode:'yoy',suffix:'%',decimals:1},
  ppi_yoy:{series:'WPSFD4',mode:'yoy',suffix:'%',decimals:1},
  core_ppi_yoy:{series:'WPSFD49116',mode:'yoy',suffix:'%',decimals:1},
  nfp:{series:'PAYEMS',mode:'change',suffix:'K',decimals:0},
  unemployment:{series:'UNRATE',mode:'level',suffix:'%',decimals:1},
  avg_hourly_earnings:{series:'CES0500000003',mode:'mom',suffix:'%',decimals:1},
  retail_sales:{series:'RSAFS',mode:'mom',suffix:'%',decimals:1},
  jobless_claims:{series:'ICSA',mode:'level',suffix:'K',decimals:0,scale:0.001},
  gdp:{series:'A191RL1Q225SBEA',mode:'level',suffix:'%',decimals:1,period:'quarter'},
  pce:{series:'PCEPI',mode:'yoy',suffix:'%',decimals:1},
  core_pce:{series:'PCEPILFE',mode:'yoy',suffix:'%',decimals:1},
  fomc:{series:'DFEDTARU',lowerSeries:'DFEDTARL',mode:'range',suffix:'%',decimals:2}
};
function csvRows(text){
  const lines=String(text||'').trim().split(/\r?\n/);if(lines.length<2)return[];
  return lines.slice(1).map(line=>{const i=line.indexOf(',');if(i<0)return null;const date=line.slice(0,i).trim();const raw=line.slice(i+1).trim();const value=Number(raw);return date&&Number.isFinite(value)?{date,value}:null}).filter(Boolean).sort((a,b)=>b.date.localeCompare(a.date));
}
async function fetchWithRetry(url,options={},attempts=3){
  let lastError;
  for(let attempt=1;attempt<=attempts;attempt++){
    try{
      const response=await fetch(url,options);
      if(response.ok||response.status<500)return response;
      lastError=new Error(`HTTP ${response.status}`);
    }catch(error){lastError=error;}
    if(attempt<attempts)await new Promise(resolve=>setTimeout(resolve,attempt*350));
  }
  throw lastError||new Error('Request failed');
}
async function fetchFredCsv(series){
  // Try both official FRED CSV routes. Cloudflare can occasionally receive a
  // transient 520 from one edge route while the alternate official route works.
  const urls=[
    `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(series)}`,
    `https://fred.stlouisfed.org/graph/fredgraph.csv?cosd=1900-01-01&id=${encodeURIComponent(series)}&v=${Date.now()}`
  ];
  let lastError=null;
  for(const url of urls){
    try{
      const r=await fetchWithRetry(url,{headers:{accept:url.includes('file_type=json')?'application/json':'text/csv','user-agent':'GoldHunter/1.0'}},5);
      if(!r.ok)throw new Error(`FRED ${series} ${r.status}`);
      const rows=csvRows(await r.text());
      if(rows.length)return rows;
      throw new Error(`FRED ${series} empty`);
    }catch(error){lastError=error;}
  }
  throw lastError||new Error(`FRED ${series} unavailable`);
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
  if(cfg.mode==='change')calc=i=>r[i+1]?r[i].value-r[i+1].value:null;
  if(cfg.mode==='mom')calc=i=>r[i+1]&&r[i+1].value!==0?((r[i].value/r[i+1].value)-1)*100:null;
  if(cfg.mode==='yoy')calc=i=>{const target=new Date(r[i].date+'T00:00:00Z');target.setUTCFullYear(target.getUTCFullYear()-1);const key=target.toISOString().slice(0,7);const base=r.find(x=>x.date.slice(0,7)===key);return base&&base.value!==0?((r[i].value/base.value)-1)*100:null};
  const a=calc?.(0),pr=calc?.(1);
  const history=[];for(let i=0;i<r.length&&history.length<10;i++){const v=calc?.(i);if(v===null||v===undefined)continue;const pv=calc?.(i+1);history.push({period:r[i].date,actual:fredFmt(v,cfg),previous:fredFmt(pv,cfg)})}
  const period=cfg.period==='quarter'?`${r[0].date.slice(0,4)}-Q${Math.floor((Number(r[0].date.slice(5,7))-1)/3)+1}`:(cfg.mode==='level'?r[0].date:fredPeriod(r[0].date));
  return {actual:fredFmt(a,cfg),previous:fredFmt(pr,cfg),period,observationDate:r[0].date,history};
}
async function fetchFred(env,forceRefresh=false){
  let stale=null;
  if(env.GH_MARKET_DATA){stale=await env.GH_MARKET_DATA.get(FRED_CACHE_KEY,{type:'json'});if(!forceRefresh&&stale&&Date.now()-stale.savedAt<15*60*1000)return stale;}
  try{
  const metrics={},histories={},errors={};
  await Promise.all(Object.entries(FRED_CONFIG).map(async([type,cfg])=>{
    try{const [rows,lower]=await Promise.all([fetchFredCsv(cfg.series),cfg.lowerSeries?fetchFredCsv(cfg.lowerSeries):Promise.resolve(null)]);const m=fredMetric(rows,cfg,lower);metrics[type]=m;histories[type]=m?.history||[];}catch(e){errors[type]=e.message;}
  }));
  // Never let a partial refresh erase a previously working metric.
  const mergedMetrics={...(stale?.metrics||{})};
  const mergedHistories={...(stale?.histories||{})};
  for(const [type,metric] of Object.entries(metrics)){if(metric?.actual)mergedMetrics[type]=metric;}
  for(const [type,rows] of Object.entries(histories)){if(Array.isArray(rows)&&rows.length){const byPeriod=new Map();for(const row of [...rows,...(mergedHistories[type]||[])]){if(row?.period&&row?.actual&&!byPeriod.has(String(row.period)))byPeriod.set(String(row.period),row);}mergedHistories[type]=[...byPeriod.values()].sort((a,b)=>String(b.period).localeCompare(String(a.period))).slice(0,10);}}
  const result={savedAt:Date.now(),metrics:mergedMetrics,histories:mergedHistories,errors,source:'FRED / official source series',partial:Boolean(Object.keys(errors).length)};
  if(env.GH_MARKET_DATA){const saved=await putJsonIfChanged(env.GH_MARKET_DATA,FRED_CACHE_KEY,result,{expirationTtl:2592000},stale);if(!saved.written&&saved.current)return {...saved.current,liveCheckAt:Date.now()};}
  return result;
  }catch(error){if(stale)return {...stale,stale:true,refreshError:error.message};throw error;}
}



function stripHtml(text){return String(text||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&ndash;|&#8211;/gi,'–').replace(/&mdash;|&#8212;/gi,'—').replace(/\s+/g,' ').trim();}
function absoluteFedUrl(href){const h=String(href||'').trim();if(!h)return'';if(/^https?:\/\//i.test(h))return h;if(h.startsWith('/'))return `https://www.federalreserve.gov${h}`;return `https://www.federalreserve.gov/${h.replace(/^\.\//,'')}`;}
function rangeText(low,high){const f=v=>Number(v).toFixed(2).replace(/\.00$/,'').replace(/(\.\d)0$/,'$1');return `${f(low)}–${f(high)}%`;}
async function fetchFederalReserveFomc(env,forceRefresh=false){
  let stale=null;
  if(env.GH_MARKET_DATA){stale=await env.GH_MARKET_DATA.get(FED_FOMC_CACHE_KEY,{type:'json'});if(!forceRefresh&&stale&&Date.now()-stale.savedAt<10*60*1000)return stale;}
  try{
    const calendarResponse=await fetchWithRetry('https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',{headers:{accept:'text/html','user-agent':'GoldHunter/1.0'}},3);
    if(!calendarResponse.ok)throw new Error(`Federal Reserve calendar ${calendarResponse.status}`);
    const calendarHtml=await calendarResponse.text();
    const links=[];
    const re=/href=["']([^"']*?\/newsevents\/pressreleases\/monetary\d{8}a\.htm)["']/gi;
    let match;
    while((match=re.exec(calendarHtml))){const url=absoluteFedUrl(match[1]);if(url&&!links.includes(url))links.push(url);}
    links.sort().reverse();
    const rows=[];
    for(const url of links.slice(0,18)){
      const dateMatch=url.match(/monetary(\d{4})(\d{2})(\d{2})a\.htm/i);if(!dateMatch)continue;
      try{
        const response=await fetchWithRetry(url,{headers:{accept:'text/html','user-agent':'GoldHunter/1.0'}},2);if(!response.ok)continue;
        const text=stripHtml(await response.text());
        const rate=text.match(/target range for the federal funds rate (?:at|to)\s*(\d+(?:\.\d+)?)\s*(?:to|–|-)\s*(\d+(?:\.\d+)?)\s*percent/i);
        if(!rate)continue;
        const period=`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
        rows.push({period,observationDate:period,actual:rangeText(Number(rate[1]),Number(rate[2])),previous:''});
        if(rows.length>=11)break;
      }catch{}
    }
    rows.sort((a,b)=>b.period.localeCompare(a.period));
    if(!rows.length)throw new Error('No Federal Reserve FOMC statement target ranges found');
    rows.forEach((row,i)=>{row.previous=rows[i+1]?.actual||''});
    const history=rows.slice(0,10);
    const metric={actual:history[0].actual,previous:history[0].previous,period:history[0].period,observationDate:history[0].period,history,source:'Federal Reserve FOMC statement'};
    const result={savedAt:Date.now(),metrics:{fomc:metric},histories:{fomc:history},source:'Federal Reserve official statements'};
    if(env.GH_MARKET_DATA){const saved=await putJsonIfChanged(env.GH_MARKET_DATA,FED_FOMC_CACHE_KEY,result,{expirationTtl:2592000},stale);if(!saved.written&&saved.current)return {...saved.current,liveCheckAt:Date.now()};}
    return result;
  }catch(error){if(stale)return {...stale,stale:true,refreshError:error.message};throw error;}
}
function fomcReleaseDate(event){
  try{return new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(event.datetime));}catch{return String(event.releasePeriod||'').slice(0,10);}
}

async function fetchStaticOfficial(request){
  try{
    const url=new URL('/data/official-data.json',new URL(request.url).origin);
    url.searchParams.set('v',String(Date.now()).slice(0,-5));
    const response=await fetch(url.toString(),{headers:{accept:'application/json','cache-control':'no-cache'},cache:'no-store',cf:{cacheTtl:0,cacheEverything:false}});
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
    url.searchParams.set('v',String(Date.now()));
    const response=await fetch(url.toString(),{headers:{accept:'application/json','cache-control':'no-cache'},cache:'no-store',cf:{cacheTtl:0,cacheEverything:false}});
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
function stableValue(value){
  if(Array.isArray(value))return value.map(stableValue);
  if(value&&typeof value==='object'){
    const out={};
    for(const key of Object.keys(value).sort()){
      if(['savedAt','updatedAt','timestamp','refreshError','stale','liveCheckAt'].includes(key))continue;
      out[key]=stableValue(value[key]);
    }
    return out;
  }
  return value;
}
function stableJson(value){return JSON.stringify(stableValue(value));}
function sameMeaningfulData(a,b){
  try{return stableJson(a)===stableJson(b)}catch{return false}
}
async function putJsonIfChanged(namespace,key,next,options,previous=null){
  if(!namespace)return {written:false,reason:'unbound'};
  let current=previous;
  if(current===null){try{current=await namespace.get(key,{type:'json'})}catch{current=null}}
  if(current&&sameMeaningfulData(current,next))return {written:false,reason:'unchanged',current};
  await namespace.put(key,JSON.stringify(next),options);
  return {written:true,reason:'changed',current:next};
}
function authorized(request,env){const supplied=request.headers.get('x-admin-pin')||'';return Boolean(env.ADMIN_PIN&&supplied&&supplied===env.ADMIN_PIN);}
const TYPE_ALIASES={
  cpi:'cpi_yoy',consumer_price_index:'cpi_yoy',headline_cpi:'cpi_yoy',
  core_cpi:'core_cpi_yoy',core_consumer_price_index:'core_cpi_yoy',
  ppi:'ppi_yoy',producer_price_index:'ppi_yoy',headline_ppi:'ppi_yoy',
  core_ppi:'core_ppi_yoy',core_producer_price_index:'core_ppi_yoy',
  nonfarm_payrolls:'nfp',non_farm_payrolls:'nfp',payrolls:'nfp',
  unemployment_rate:'unemployment',average_hourly_earnings:'avg_hourly_earnings',
  retail_sales_mom:'retail_sales',initial_jobless_claims:'jobless_claims',
  gross_domestic_product:'gdp',pce_price_index:'pce',core_pce_price_index:'core_pce',
  fed_rate_decision:'fomc',fomc_rate_decision:'fomc',interest_rate_decision:'fomc',
  fomc_meeting_minutes:'fomc_minutes'
};
function canonicalType(e){
  const raw=String(e?.type||'').trim().toLowerCase().replace(/[\s-]+/g,'_');
  return TYPE_ALIASES[raw]||raw;
}
function normalizedReleaseDate(value){
  const ms=Date.parse(String(value||''));
  if(Number.isFinite(ms))return new Date(ms).toISOString().slice(0,10);
  return String(value||'').trim().slice(0,10);
}
function canonicalEventId(e){
  const type=canonicalType(e);
  const period=String(e?.releasePeriod||'').trim();
  const date=normalizedReleaseDate(e?.datetime);
  const minute=(()=>{const ms=Date.parse(String(e?.datetime||''));return Number.isFinite(ms)?new Date(ms).toISOString().slice(0,16):String(e?.datetime||'').trim().slice(0,16)})();
  // One numeric macro release is identified by metric + official release period.
  // This remains stable even if a schedule source changes the release date/time.
  if(AUTO_TYPES.has(type)||type==='fomc_minutes')return `${type}_${(period||date).replace(/[^0-9A-Za-z]+/g,'_').replace(/^_|_$/g,'')}`;
  // Multiple Fed speeches may happen on the same day, so keep minute + title.
  const title=String(e?.name||'event').trim().toLowerCase().replace(/[^0-9a-z]+/g,'_').replace(/^_|_$/g,'');
  return `${type}_${minute.replace(/[^0-9A-Za-z]+/g,'_')}_${title}`;
}
function eventKey(e){return canonicalEventId(e);}
function historyKey(row){return `${String(row?.period||'').trim()}|${String(row?.dateTime||row?.datetime||'').trim().slice(0,16)}`;}
function mergeHistoryRows(...lists){
  const byKey=new Map();
  for(const list of lists){
    for(const row of Array.isArray(list)?list:[]){
      if(!row||!row.period)continue;
      const key=historyKey(row);
      const old=byKey.get(key)||{};
      byKey.set(key,{...row,actual:row.actual||old.actual||'',forecast:row.forecast||old.forecast||'',previous:row.previous||old.previous||'',archivedAt:row.archivedAt||old.archivedAt||''});
    }
  }
  return [...byKey.values()].sort((a,b)=>String(b.period).localeCompare(String(a.period))).slice(0,100);
}
function mergeEventState(scheduleRow,...stateRows){
  const rows=stateRows.filter(Boolean);
  const history=mergeHistoryRows(...rows.map(r=>r.releaseHistory));
  const releaseForecasts=Object.assign({},...rows.slice().reverse().map(r=>r.releaseForecasts||{}));
  const pick=(field)=>rows.find(r=>r?.[field])?.[field];
  return {
    ...scheduleRow,
    id:eventKey(scheduleRow),
    type:canonicalType(scheduleRow),
    forecast:pick('forecast')||scheduleRow.forecast||'',
    previous:pick('previous')||scheduleRow.previous||'',
    actual:pick('actual')||scheduleRow.actual||'',
    lastRelease:pick('lastRelease')||scheduleRow.lastRelease||null,
    releaseHistory:history,
    releaseForecasts,
    archivedPeriod:pick('archivedPeriod')||scheduleRow.archivedPeriod||'',
    archivedAt:pick('archivedAt')||scheduleRow.archivedAt||''
  };
}
function applyAuthoritativeSchedule(generated,stored){
  const official=dedupeEvents(generated);
  // Schedule is never sourced from KV. If the static schedule request is unavailable,
  // use the bundled verified schedule rather than reviving stale KV dates.
  const schedule=official.length?official:dedupeEvents(SEED_EVENTS);
  const storedRows=dedupeEvents(stored);
  const byKey=new Map();
  const byType=new Map();
  for(const row of storedRows){
    const key=eventKey(row);
    if(!byKey.has(key))byKey.set(key,[]);
    byKey.get(key).push(row);
    const type=canonicalType(row);
    if(!byType.has(type))byType.set(type,[]);
    byType.get(type).push(row);
  }
  const usedState=new Set();
  const result=schedule.map(row=>{
    const exact=byKey.get(eventKey(row))||[];
    let stateRows=exact;
    // If an official date/period was corrected, migrate only user-managed state
    // from the same metric. Never migrate an old Actual into a different release.
    if(!stateRows.length){
      const candidates=(byType.get(canonicalType(row))||[]).filter(x=>!usedState.has(eventKey(x)));
      candidates.sort((a,b)=>{
        const score=x=>Number(Boolean(x.forecast))*8+Number(Boolean(x.lastRelease))*5+Number(Boolean(x.releaseHistory?.length))*4+Number(Boolean(Object.keys(x.releaseForecasts||{}).length))*4+Number(Boolean(x.previous));
        return score(b)-score(a);
      });
      if(candidates.length)stateRows=[candidates[0]];
    }
    for(const x of stateRows)usedState.add(eventKey(x));
    const merged=mergeEventState(row,...stateRows);
    if(!exact.length){
      merged.actual='';
      merged.archivedPeriod='';
      merged.archivedAt='';
    }
    return merged;
  });
  // Only unscheduled speech-type rows may exist outside the authoritative schedule.
  for(const row of storedRows){
    const type=canonicalType(row);
    if(type==='fed_speech')result.push(row);
  }
  return dedupeEvents(result);
}
function dedupeEvents(input){
  const out=new Map();
  for(const raw of Array.isArray(input)?input:[]){
    const e={...raw,type:canonicalType(raw)};
    const key=eventKey(e);if(!key)continue;
    e.id=key;
    const old=out.get(key);
    if(!old){out.set(key,e);continue;}
    // Keep the most complete schedule row while preserving all user-managed fields.
    const preferred=(String(e.datetime||'').length>=String(old.datetime||'').length)?e:old;
    const other=preferred===e?old:e;
    out.set(key,{...other,...preferred,id:key,type:canonicalType(preferred),forecast:old.forecast||e.forecast||'',previous:old.previous||e.previous||'',actual:old.actual||e.actual||'',lastRelease:old.lastRelease||e.lastRelease||null,releaseHistory:mergeHistoryRows(old.releaseHistory,e.releaseHistory),releaseForecasts:{...(e.releaseForecasts||{}),...(old.releaseForecasts||{})},archivedPeriod:old.archivedPeriod||e.archivedPeriod||'',archivedAt:old.archivedAt||e.archivedAt||''});
  }
  return [...out.values()].sort((a,b)=>new Date(a.datetime)-new Date(b.datetime));
}
function sanitizeEvents(input){
  if(!Array.isArray(input)) return [];
  return dedupeEvents(input.slice(0,150).map((e,i)=>({
    id:clean(e?.id,80)||`event-${Date.now()}-${i}`,
    type:canonicalType({type:clean(e?.type,60)}), releasePeriod:clean(e?.releasePeriod,10), name:clean(e?.name,120), nameZh:clean(e?.nameZh,120),
    datetime:clean(e?.datetime,50), forecast:clean(e?.forecast,80), previous:clean(e?.previous,80), actual:clean(e?.actual,80),
    lastRelease:(e?.lastRelease&&typeof e.lastRelease==='object')?{period:clean(e.lastRelease.period,20),dateTime:clean(e.lastRelease.dateTime,50),actual:clean(e.lastRelease.actual,80),forecast:clean(e.lastRelease.forecast,80),previous:clean(e.lastRelease.previous,80)}:null,
    releaseHistory:Array.isArray(e?.releaseHistory)?e.releaseHistory.slice(0,100).map(r=>({period:clean(r?.period,20),dateTime:clean(r?.dateTime,50),actual:clean(r?.actual,80),forecast:clean(r?.forecast,80),previous:clean(r?.previous,80),archivedAt:clean(r?.archivedAt,50)})).filter(r=>r.period&&r.actual):[],
    releaseForecasts:(e?.releaseForecasts&&typeof e.releaseForecasts==='object')?Object.fromEntries(Object.entries(e.releaseForecasts).slice(0,20).map(([k,v])=>[clean(k,20),clean(v,80)]).filter(([k])=>k)): {},
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
  // generated-events.json is the authoritative whitelist for scheduled macro rows.
  // Stored KV rows may enrich matching schedule rows, but may not create extra
  // numeric/FOMC dates. This prevents stale false events from reappearing.
  return applyAuthoritativeSchedule(generated.length?generated:SEED_EVENTS,stored);
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
async function fetchBls(env,forceRefresh=false){
  let stale=null;
  if(env.GH_MARKET_DATA){stale=await env.GH_MARKET_DATA.get(BLS_CACHE_KEY,{type:'json'});if(!forceRefresh&&stale&&Date.now()-stale.savedAt<30*60*1000)return stale;}
  try{
  const year=new Date().getUTCFullYear();
  const ids=Object.values(SERIES).map(x=>x.id);
  const r=await fetchWithRetry('https://api.bls.gov/publicAPI/v2/timeseries/data/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({seriesid:ids,startyear:String(year-2),endyear:String(year)})},3);
  if(!r.ok)throw new Error(`BLS ${r.status}`);
  const payload=await r.json();
  const byId=new Map((payload?.Results?.series||[]).map(s=>[s.seriesID,s]));
  const metrics={}; const histories={}; for(const [key,cfg] of Object.entries(SERIES)){ metrics[key]=computeMetric(byId.get(cfg.id),cfg); histories[key]=computeHistory(byId.get(cfg.id),cfg,10); }
  // Preserve each previous successful metric if BLS omits one series temporarily.
  const mergedMetrics={...(stale?.metrics||{})};
  const mergedHistories={...(stale?.histories||{})};
  for(const [type,metric] of Object.entries(metrics)){if(metric?.actual)mergedMetrics[type]=metric;}
  for(const [type,rows] of Object.entries(histories)){if(Array.isArray(rows)&&rows.length){const byPeriod=new Map();for(const row of [...rows,...(mergedHistories[type]||[])]){if(row?.period&&row?.actual&&!byPeriod.has(String(row.period)))byPeriod.set(String(row.period),row);}mergedHistories[type]=[...byPeriod.values()].sort((a,b)=>String(b.period).localeCompare(String(a.period))).slice(0,10);}}
  const result={savedAt:Date.now(),metrics:mergedMetrics,histories:mergedHistories,source:'BLS Public Data API'};
  if(env.GH_MARKET_DATA){const saved=await putJsonIfChanged(env.GH_MARKET_DATA,BLS_CACHE_KEY,result,{expirationTtl:2592000},stale);if(!saved.written&&saved.current)return {...saved.current,liveCheckAt:Date.now()};}
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

function mergeOfficialHistories(...sources){
  const keys=new Set(sources.flatMap(src=>Object.keys(src||{})));
  const out={};
  for(const key of keys){
    const rows=[]; const seen=new Set();
    for(const src of sources){
      for(const row of (src?.[key]||[])){
        if(!row||!row.period||!row.actual)continue;
        const k=String(row.period); if(seen.has(k))continue;
        seen.add(k); rows.push({...row});
      }
    }
    rows.sort((a,b)=>String(b.period).localeCompare(String(a.period)));
    out[key]=key==='fomc'?sanitizeFomcHistory(rows):rows.slice(0,10);
  }
  return out;
}

function cleanOfficialHistorySnapshot(source){
  const out={};
  for(const [type,list] of Object.entries(source||{})){
    const rows=[];const seen=new Set();
    for(const row of Array.isArray(list)?list:[]){
      const period=clean(row?.period,20),actual=clean(row?.actual,80);
      if(!period||!actual||seen.has(period))continue;
      seen.add(period);
      rows.push({period,actual,previous:clean(row?.previous,80),observationDate:clean(row?.observationDate,20)});
      if(rows.length===10)break;
    }
    if(rows.length){const canonical=canonicalType({type});out[canonical]=canonical==='fomc'?sanitizeFomcHistory(rows):rows;}
  }
  return out;
}


function nextMalaysiaDayStart(datetime){
  const day=String(datetime||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return NaN;
  const d=new Date(`${day}T00:00:00+08:00`);
  d.setUTCDate(d.getUTCDate()+1);
  return d.getTime();
}

function normalizeReleasePeriod(type,value){
  const raw=String(value||'').trim();
  if(!raw)return '';
  if(type==='gdp'){
    const match=raw.match(/^(\d{4})[- ]?Q([1-4])$/i);
    return match?`${match[1]}-Q${match[2]}`:raw.toUpperCase();
  }
  if(type==='jobless_claims'||type==='fomc'||type==='fomc_minutes'){
    const ms=Date.parse(raw);
    return Number.isFinite(ms)?new Date(ms).toISOString().slice(0,10):raw.slice(0,10);
  }
  const month=raw.match(/^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?$/);
  if(month)return `${month[1]}-${String(month[2]).padStart(2,'0')}`;
  return raw;
}
function releasePeriodsMatch(type,officialPeriod,eventPeriod,event){
  const canonical=canonicalType({type});
  const a=normalizeReleasePeriod(canonical,officialPeriod);
  const b=normalizeReleasePeriod(canonical,eventPeriod);
  if(a&&b&&a===b)return true;
  if(canonical==='fomc')return a===normalizeReleasePeriod(canonical,fomcReleaseDate(event));
  return false;
}
function isMalaysiaReleaseDay(datetime,now=Date.now()){
  const releaseMs=Date.parse(String(datetime||''));
  if(!Number.isFinite(releaseMs))return false;
  const fmt=ms=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
  return fmt(releaseMs)===fmt(now);
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

async function probeOfficialSource(name,url,options={}){
  const started=Date.now();
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),Number(options.timeoutMs||12000));
  try{
    const response=await fetch(url,{method:options.method||'GET',headers:{accept:options.accept||'*/*','user-agent':'GoldHunter-Health/1.0',...(options.headers||{})},body:options.body,signal:controller.signal,redirect:'follow',cf:{cacheTtl:0,cacheEverything:false}});
    const ok=response.ok;
    return {name,status:ok?'live':'offline',httpStatus:response.status,lastChecked:new Date().toISOString(),lastSuccess:ok?new Date().toISOString():null,latencyMs:Date.now()-started,error:ok?'':`HTTP ${response.status}`};
  }catch(error){
    return {name,status:'offline',httpStatus:0,lastChecked:new Date().toISOString(),lastSuccess:null,latencyMs:Date.now()-started,error:error?.name==='AbortError'?'Timeout':(error?.message||String(error))};
  }finally{clearTimeout(timeout);}
}
async function probeJoblessClaimsSource(env){
  const now=Date.now();
  let state={consecutiveDolFailures:0,preferFredUntil:0,lastDolProbeAt:0,lastSuccess:null};
  if(env.GH_MARKET_DATA){
    try{state={...state,...((await env.GH_MARKET_DATA.get(JOBLESS_HEALTH_STATE_KEY,{type:'json'}))||{})};}catch{/* health state is optional */}
  }
  const shouldPreferFred=Number(state.preferFredUntil||0)>now;
  const dolDue=!shouldPreferFred||(now-Number(state.lastDolProbeAt||0)>=60*60*1000);
  let dol=null,fred=null;

  // When DOL has been blocked repeatedly, use FRED ICSA first and only retest DOL hourly.
  if(shouldPreferFred){
    fred=await probeOfficialSource('joblessFred','https://fred.stlouisfed.org/graph/fredgraph.csv?id=ICSA',{accept:'text/csv'});
    if(dolDue)dol=await probeOfficialSource('dol','https://www.dol.gov/ui/data.pdf',{accept:'application/pdf'});
  }else{
    dol=await probeOfficialSource('dol','https://www.dol.gov/ui/data.pdf',{accept:'application/pdf'});
    // DOL failure falls back to FRED immediately in the same Worker invocation.
    if(dol.status!=='live')fred=await probeOfficialSource('joblessFred','https://fred.stlouisfed.org/graph/fredgraph.csv?id=ICSA',{accept:'text/csv'});
  }

  if(dol?.status==='live'){
    state={...state,consecutiveDolFailures:0,preferFredUntil:0,lastDolProbeAt:now,lastSuccess:dol.lastSuccess};
  }else if(dol){
    const failures=Number(state.consecutiveDolFailures||0)+1;
    state={...state,consecutiveDolFailures:failures,lastDolProbeAt:now,preferFredUntil:failures>=3?now+60*60*1000:Number(state.preferFredUntil||0)};
  }
  if(fred?.status==='live')state.lastSuccess=fred.lastSuccess;
  if(env.GH_MARKET_DATA){
    try{await env.GH_MARKET_DATA.put(JOBLESS_HEALTH_STATE_KEY,JSON.stringify(state));}catch{/* health persistence must not fail the response */}
  }

  const active=(dol?.status==='live')?dol:(fred?.status==='live'?fred:null);
  return {
    name:'joblessClaims',
    status:active?'live':'offline',
    provider:active===dol?'U.S. Department of Labor':'FRED ICSA official fallback',
    sourceMode:active===dol?'primary':'fallback',
    lastChecked:(dol?.lastChecked||fred?.lastChecked||new Date().toISOString()),
    lastSuccess:active?.lastSuccess||state.lastSuccess||null,
    httpStatus:active?.httpStatus??dol?.httpStatus??fred?.httpStatus??0,
    latencyMs:active?.latencyMs??dol?.latencyMs??fred?.latencyMs??null,
    error:active?'':[dol?.error&&`DOL: ${dol.error}`,fred?.error&&`FRED ICSA: ${fred.error}`].filter(Boolean).join(' | '),
    consecutiveDolFailures:Number(state.consecutiveDolFailures||0),
    preferFredUntil:Number(state.preferFredUntil||0)||0,
    dol,
    fred
  };
}
async function probeOfficialSources(env){
  const year=new Date().getUTCFullYear();
  const blsBody=JSON.stringify({seriesid:['CUUR0000SA0'],startyear:String(year-1),endyear:String(year)});
  const checks=await Promise.all([
    probeOfficialSource('bls','https://api.bls.gov/publicAPI/v2/timeseries/data/',{method:'POST',accept:'application/json',headers:{'content-type':'application/json'},body:blsBody}),
    probeOfficialSource('fred','https://fred.stlouisfed.org/graph/fredgraph.csv?id=UNRATE',{accept:'text/csv'}),
    probeOfficialSource('census','https://www.census.gov/retail/index.html',{accept:'text/html'}),
    probeOfficialSource('bea','https://www.bea.gov/news/schedule',{accept:'text/html'}),
    probeOfficialSource('federalReserve','https://www.federalreserve.gov/',{accept:'text/html',timeoutMs:10000})
  ]);
  const out=Object.fromEntries(checks.map(x=>[x.name,x]));
  // Initial Jobless Claims Actual is driven by the automatic GitHub Actual Engine.
  // Do not probe DOL/FRED from Cloudflare because those routes repeatedly return 403/520.
  // The final status is derived from the verified GitHub snapshot below.
  out.joblessClaims=null;
  out.dol={name:'dol',status:'offline',httpStatus:0,lastChecked:null,lastSuccess:null,latencyMs:null,error:'Live probe disabled; GitHub Actual Engine is authoritative'};
  const now=new Date().toISOString();
  out.staticCache={name:'staticCache',status:'live',httpStatus:200,lastChecked:now,lastSuccess:now,latencyMs:0,error:'',mode:'GitHub Actions verified snapshot'};
  out.cloudflareKv={name:'cloudflareKv',status:env.GH_MARKET_DATA?'live':'offline',httpStatus:env.GH_MARKET_DATA?200:0,lastChecked:now,lastSuccess:env.GH_MARKET_DATA?now:null,latencyMs:0,error:env.GH_MARKET_DATA?'':'GH_MARKET_DATA binding missing'};
  return out;
}

export async function onRequestOptions(){return new Response(null,{status:204,headers});}
export async function onRequestGet({request,env}){
  const wantsAdmin=request.headers.has('x-admin-pin');
  if(wantsAdmin&&!authorized(request,env))return json({error:'Incorrect PIN, or ADMIN_PIN is not configured.'},401,{'cache-control':'no-store'});
  const requestUrl=new URL(request.url);
  // Only an authenticated watcher/admin request may bypass the normal connector cache.
  // This prevents public visitors from repeatedly hammering official upstream sources.
  const forceRefresh=Boolean(wantsAdmin&&requestUrl.searchParams.get('force')==='1');
  const stored=(await readStored(env,request)).filter(e=>!REMOVED_TYPES.has(String(e.type||''))&&!/ISM/i.test(String(e.name||'')));
  let adminOverrides={};
  if(env.GH_MARKET_DATA){
    try{
      const payload=await env.GH_MARKET_DATA.get(ADMIN_OVERRIDES_KEY,{type:'json'})||{};
      adminOverrides=(payload&&typeof payload.overrides==='object')?payload.overrides:{};
    }catch{adminOverrides={};}
  }
  let historySnapshot={};
  if(env.GH_MARKET_DATA){
    try{
      const snapshot=await env.GH_MARKET_DATA.get(OFFICIAL_HISTORY_SNAPSHOT_KEY,{type:'json'})||{};
      historySnapshot=cleanOfficialHistorySnapshot(snapshot.histories||snapshot);
    }catch{historySnapshot={};}
  }
  const staticOfficial=await fetchStaticOfficial(request);
  // Public/admin reads always use the GitHub-generated official snapshot for data.
  // Admin force refresh performs only one lightweight probe per provider. It never
  // downloads every series, so a single Worker invocation stays well below the
  // Cloudflare subrequest limit. Actual data refresh remains handled by GitHub Actions.
  let bls={metrics:{},histories:{},savedAt:null},fred={metrics:{},histories:{},savedAt:null},fedFomc={metrics:{},histories:{},savedAt:null};
  const liveProbes=forceRefresh?await probeOfficialSources(env):null;
  const runtimeMetrics={...(fred.metrics||{}),...(bls.metrics||{}),...(fedFomc.metrics||{})};
  const runtimeHistories={...(fred.histories||{}),...(bls.histories||{}),...(fedFomc.histories||{})};
  const official={
    metrics:mergeOfficialMetrics(mergeOfficialMetrics(VERIFIED_FALLBACK_METRICS,runtimeMetrics),staticOfficial.metrics||{}),
    histories:mergeOfficialHistories(fedFomc.histories||{},bls.histories||{},fred.histories||{},staticOfficial.histories||{},historySnapshot,Object.fromEntries(Object.entries(VERIFIED_FALLBACK_METRICS).map(([k,v])=>[k,v.history||[]]))),
    savedAt:Math.max(bls.savedAt||0,fred.savedAt||0,fedFomc.savedAt||0,staticOfficial.savedAt||0),
    error:[bls.error,fred.error,fedFomc.error,...Object.values(staticOfficial.errors||{})].filter(Boolean).join(' | '),
    staticSource:staticOfficial.source
  };
  // Preserve the latest ten official releases independently from connector caches.
  // This prevents Last Releases from disappearing when BLS/FRED/BEA is temporarily
  // unavailable, a cache expires, or a deployment starts with an empty KV cache.
  if(env.GH_MARKET_DATA&&forceRefresh){
    try{
      const histories=cleanOfficialHistorySnapshot(official.histories);
      if(Object.keys(histories).length){
        await putJsonIfChanged(env.GH_MARKET_DATA,OFFICIAL_HISTORY_SNAPSHOT_KEY,{schemaVersion:1,histories,updatedAt:new Date().toISOString()});
      }
    }catch{/* History persistence must never break the public calendar response. */}
  }
  const now=Date.now();
  let historyChanged=false;
  const persistable=stored.map(e=>({...e}));
  const prepared=dedupeEvents(persistable.filter(e=>Number(e.impact)>=4&&!REMOVED_TYPES.has(e.type))).map(e=>{
    const keys=[`${canonicalType(e)}|${String(e.releasePeriod||'')}`,String(e.id||'')].filter(Boolean);
    let override=null;
    for(const key of keys){if(Object.prototype.hasOwnProperty.call(adminOverrides,key)){override=adminOverrides[key];break;}}
    if(override&&typeof override==='object'){
      if(Object.prototype.hasOwnProperty.call(override,'forecast'))e.forecast=String(override.forecast??'');
      if(override.datetime)e.datetime=String(override.datetime);
      if(override.releaseForecasts&&typeof override.releaseForecasts==='object')e.releaseForecasts={...(e.releaseForecasts||{}),...override.releaseForecasts};
    }
    return e;
  });
  const events=prepared.map(e=>{
    const m=official.metrics?.[e.type];
    const releaseAt=new Date(e.datetime).getTime();
    const released=Number.isFinite(releaseAt)&&now>=releaseAt;
    const exactCurrentRelease=Boolean(released&&e.releasePeriod&&m&&m.actual&&releasePeriodsMatch(e.type,m.period,e.releasePeriod,e));
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
    if(!previous&&!eventOnly){
      const anyMetric=Object.entries(official.metrics||{}).find(([type,x])=>x&&x.actual&&releasePeriodsMatch(type,x.period,e.releasePeriod,e))?.[1];
      previous=anyMetric?.previous||'';
    }

    // As soon as an official release is verified, save the complete row into Last Release.
    // This records the real scheduled publication timestamp and preserves the exact
    // Actual / Forecast / Previous values shown on release day. It does not clear the
    // live forecast or remove the released news from today's homepage.
    if(!eventOnly&&exactCurrentRelease){
      const releasedRow={
        period:e.releasePeriod||'',
        dateTime:e.datetime||'',
        releaseDateTime:e.datetime||'',
        actual:actual||'',
        forecast:e.forecast||'',
        previous:previous||''
      };
      const previousRow=e.lastRelease||{};
      const releaseChanged=
        String(previousRow.period||'')!==String(releasedRow.period)||
        String(previousRow.dateTime||previousRow.releaseDateTime||'')!==String(releasedRow.dateTime)||
        String(previousRow.actual||'')!==String(releasedRow.actual)||
        String(previousRow.forecast||'')!==String(releasedRow.forecast)||
        String(previousRow.previous||'')!==String(releasedRow.previous);
      if(releaseChanged){
        e.lastRelease={...previousRow,...releasedRow};
        const existing=Array.isArray(e.releaseHistory)?e.releaseHistory:[];
        const byPeriod=new Map(existing.map(row=>[String(row?.period||''),row]));
        byPeriod.set(String(releasedRow.period),{...(byPeriod.get(String(releasedRow.period))||{}),...releasedRow});
        e.releaseHistory=[...byPeriod.values()]
          .filter(row=>row?.period&&row?.actual)
          .sort((a,b)=>{
            const ad=Date.parse(String(a.dateTime||a.releaseDateTime||''));
            const bd=Date.parse(String(b.dateTime||b.releaseDateTime||''));
            if(Number.isFinite(ad)&&Number.isFinite(bd))return bd-ad;
            return String(b.period||'').localeCompare(String(a.period||''));
          })
          .slice(0,100);
        historyChanged=true;
      }
    }

    // At Malaysia midnight on the day after release, mark the event as archived.
    // Forecast is intentionally preserved; it is part of the released record and must
    // never disappear merely because the lifecycle advanced to the next day.
    const archiveAt=nextMalaysiaDayStart(e.datetime);
    if(!eventOnly&&exactCurrentRelease&&Number.isFinite(archiveAt)&&now>=archiveAt&&e.archivedPeriod!==e.releasePeriod){
      const archivedAt=new Date().toISOString();
      e.archivedPeriod=e.releasePeriod||'';
      e.archivedAt=archivedAt;
      if(e.lastRelease)e.lastRelease={...e.lastRelease,archivedAt};
      if(Array.isArray(e.releaseHistory)){
        e.releaseHistory=e.releaseHistory.map(row=>String(row?.period||'')===String(e.releasePeriod||'')?{...row,archivedAt}:row);
      }
      historyChanged=true;
    }

    // Repair stale lifecycle state left by an older deployment. A current release must
    // remain live for the full Malaysia release day once its official Actual is verified.
    // This applies uniformly to every numeric news type and never touches Forecast/history.
    if(exactCurrentRelease&&isMalaysiaReleaseDay(e.datetime,now)&&String(e.archivedPeriod||'')===String(e.releasePeriod||'')){
      e.archivedPeriod='';
      e.archivedAt='';
      historyChanged=true;
    }

    // Once archived, the released row lives in Last Release rather than the live values.
    const archivedThisPeriod=e.archivedPeriod&&e.archivedPeriod===e.releasePeriod;
    if(archivedThisPeriod){actual='';previous=e.lastRelease?.actual||previous;}
    if(!previous) previous=eventOnly?'Not applicable':'—';

    const history=[];
    const forecastMap=e.releaseForecasts||{};
    const seenHistory=new Set();
    // Release-history dates must represent the real publication timestamp, not the data month.
    // Dates are sourced only from authoritative schedule rows or archived releases. We never
    // convert a period such as 2026-06 into a fake calendar date.
    const releaseDateByPeriod=new Map();
    if(e.releasePeriod&&e.datetime)releaseDateByPeriod.set(String(e.releasePeriod),String(e.datetime));
    for(const row of Array.isArray(e.releaseHistory)?e.releaseHistory:[]){
      if(row?.period&&(row.dateTime||row.releaseDateTime))releaseDateByPeriod.set(String(row.period),String(row.dateTime||row.releaseDateTime));
    }
    if(e.lastRelease?.period&&(e.lastRelease.dateTime||e.lastRelease.releaseDateTime))releaseDateByPeriod.set(String(e.lastRelease.period),String(e.lastRelease.dateTime||e.lastRelease.releaseDateTime));
    const addHistory=(row,lastRelease=false)=>{
      if(!row?.period||!row?.actual||seenHistory.has(String(row.period)))return;
      seenHistory.add(String(row.period));
      const dateTime=String(row.dateTime||row.releaseDateTime||releaseDateByPeriod.get(String(row.period))||verifiedReleaseDateTime(e.type,row.period)||'');
      history.push({...row,dateTime,forecast:forecastMap[row.period]||row.forecast||'',lastRelease});
    };
    const eventHistory=e.type==='fomc'?sanitizeFomcHistory(e.releaseHistory||[]):(e.releaseHistory||[]);
    for(const row of eventHistory)addHistory(row,Boolean(e.lastRelease?.period===row.period));
    if(e.lastRelease?.actual&&(e.type!=='fomc'||VERIFIED_FOMC_PERIODS.has(String(e.lastRelease.period||'').slice(0,10))))addHistory(e.lastRelease,true);
    for(const row of (e.type==='fomc'?sanitizeFomcHistory(rawHistory):rawHistory))addHistory(row,false);
    if(e.type==='fomc')for(const row of VERIFIED_FOMC_HISTORY)addHistory(row,false);
    history.sort((a,b)=>{
      const ad=Date.parse(String(a.dateTime||'')),bd=Date.parse(String(b.dateTime||''));
      if(Number.isFinite(ad)&&Number.isFinite(bd))return bd-ad;
      if(Number.isFinite(ad))return -1;
      if(Number.isFinite(bd))return 1;
      return String(b.period).localeCompare(String(a.period));
    });
    history.splice(10);
    const previousStatus=previous&&!/unavailable|Syncing|Manual|pending/i.test(previous)?'ready':(AUTO_TYPES.has(e.type)?'awaiting_official':'manual_required');
    const status=!released?'Scheduled':archivedThisPeriod?'Archived to Last Release':'Released';
    const result=eventOnly?{comparison:'',comparisonZh:'',difference:'',goldImpact:'',goldImpactZh:'',surpriseStrength:'',surpriseStrengthZh:''}:classifyResult(e.type,actual,e.forecast);
    return {...e,actual,previous,history,officialPeriod:m?.period||'',officialAuto:Boolean(m),released,previousStatus,eventOnly,status,...result};
  });
  if(historyChanged&&env.GH_MARKET_DATA){
    await putJsonIfChanged(env.GH_MARKET_DATA,EVENTS_KEY,sanitizeEvents(persistable),undefined);
  }
  const staticIso=staticOfficial.savedAt?new Date(staticOfficial.savedAt).toISOString():null;
  const staticAgeMinutes=staticOfficial.savedAt?Math.round((Date.now()-staticOfficial.savedAt)/60000):null;
  const staticHealthy=Boolean(Object.keys(staticOfficial.metrics||{}).length)&&staticAgeMinutes!==null&&staticAgeMinutes<=45;
  const staticAvailable=Boolean(Object.keys(staticOfficial.metrics||{}).length);
  const responseNow=new Date().toISOString();
  const fallbackSource=(key,types)=>({
    status:types.some(type=>Boolean(official.metrics?.[type]?.actual))?(staticHealthy?'live':'cached'):'offline',
    lastSuccess:staticIso,lastChecked:staticIso,lastDataChanged:staticIso,httpStatus:null,latencyMs:null,error:''
  });
  const probeOr=(key,fallback)=>{
    const probe=liveProbes?.[key];
    if(!probe)return fallback;
    return {...fallback,...probe,lastDataChanged:staticIso};
  };
  const connectorSources={
    staticCache:probeOr('staticCache',{status:staticHealthy?'live':staticAvailable?'cached':'offline',lastSuccess:staticIso,lastChecked:staticIso,lastDataChanged:staticIso,ageMinutes:staticAgeMinutes,mode:'GitHub Actions verified snapshot'}),
    bls:probeOr('bls',fallbackSource('bls',['cpi_yoy','core_cpi_yoy','ppi_yoy','core_ppi_yoy','nfp','unemployment','avg_hourly_earnings'])),
    fred:probeOr('fred',fallbackSource('fred',['retail_sales','jobless_claims','gdp','pce','core_pce'])),
    dol:probeOr('dol',fallbackSource('dol',['jobless_claims'])),
    joblessClaims:{
      ...fallbackSource('joblessClaims',['jobless_claims']),
      status:official.metrics?.jobless_claims?.actual&&staticIso?'live':'offline',
      provider:'GitHub official snapshot (FRED ICSA / DOL verified)',
      sourceMode:'github-snapshot',
      lastSuccess:staticIso,
      lastChecked:staticIso,
      lastDataChanged:staticIso,
      httpStatus:null,
      latencyMs:null,
      error:''
    },
    census:probeOr('census',fallbackSource('census',['retail_sales'])),
    bea:probeOr('bea',fallbackSource('bea',['gdp','pce','core_pce'])),
    federalReserve:probeOr('federalReserve',fallbackSource('federalReserve',['fomc'])),
    cloudflareKv:probeOr('cloudflareKv',{status:env.GH_MARKET_DATA?'live':'offline',lastSuccess:env.GH_MARKET_DATA?responseNow:null,lastChecked:responseNow,lastDataChanged:null,httpStatus:env.GH_MARKET_DATA?200:0,latencyMs:0,error:env.GH_MARKET_DATA?'':'GH_MARKET_DATA binding missing'})
  };
  const degraded=Object.entries(connectorSources).filter(([key,v])=>!['staticCache','cloudflareKv','dol'].includes(key)&&v.status!=='live').map(([key])=>key);
  const connectorMessage=degraded.length?`${degraded.join(', ')} temporarily unavailable; cached official data is being used where available.`:'';
  const blsTypes=new Set(['cpi_yoy','core_cpi_yoy','ppi_yoy','core_ppi_yoy','nfp','unemployment','avg_hourly_earnings']);
  const connectionFor=(event)=>{
    const type=event.type;
    let provider='FRED official fallback',primary=connectorSources.fred,fallback=null;
    if(blsTypes.has(type)){provider='BLS Public Data API';primary=connectorSources.bls;}
    else if(type==='jobless_claims'){primary=connectorSources.joblessClaims;provider=primary?.provider||'GitHub official snapshot';fallback=null;}
    else if(type==='retail_sales'){provider='U.S. Census Bureau';primary=connectorSources.census;fallback=connectorSources.fred;}
    else if(['gdp','pce','core_pce'].includes(type)){provider='U.S. Bureau of Economic Analysis';primary=connectorSources.bea;fallback=connectorSources.fred;}
    else if(type==='fomc'){provider='Federal Reserve';primary=connectorSources.federalReserve;}
    const hasCurrentMetric=Boolean(official.metrics?.[type]?.actual);
    const primaryLive=primary?.status==='live';
    const fallbackLive=fallback?.status==='live';
    const snapshotAvailable=Boolean(hasCurrentMetric&&staticIso);
    const status=primaryLive?'live':fallbackLive||snapshotAvailable?'cached':'offline';
    const error=primaryLive?'':(primary?.error||'');
    const lastSuccess=primary?.lastSuccess||fallback?.lastSuccess||(snapshotAvailable?staticIso:null);
    const githubSnapshotPrimary=type==='jobless_claims'&&primary?.sourceMode==='github-snapshot'&&primaryLive;
    const accessSource=githubSnapshotPrimary?'GitHub official snapshot':primaryLive?'Live official':fallbackLive?'Live official fallback':snapshotAvailable?'GitHub official snapshot':'';
    const recovery=githubSnapshotPrimary?'Connected via automatic GitHub Actual Engine':status==='live'?'Connected':status==='cached'?(fallbackLive?'Primary unavailable; live official fallback connected':snapshotAvailable?'GitHub verified snapshot active; live source retrying':'Automatic retry and cached fallback active'):'Official source and fallback unavailable';
    return {id:event.id,type,name:event.name,nameZh:event.nameZh,provider,status,lastChecked:primary?.lastChecked||responseNow,lastSuccess,lastDataChanged:staticIso,httpStatus:primary?.httpStatus??null,latencyMs:primary?.latencyMs??null,error,recovery,accessSource};
  };
  const connectionHealth=events.filter(e=>AUTO_TYPES.has(e.type)).map(connectionFor);
  return json({engineVersion:'stable-data-phase1.4-source-health',events,connectionHealth,healthMode:forceRefresh?'source-runtime-poll':'cached-status',updatedAt:responseNow,lastCheckedAt:responseNow,lastDataChangeAt:official.savedAt?new Date(official.savedAt).toISOString():null,officialUpdatedAt:official.savedAt?new Date(official.savedAt).toISOString():null,kvConfigured:Boolean(env.GH_MARKET_DATA),kvWriteProtection:{enabled:true,mode:'change-only',dailyCountTracked:false},officialError:connectorMessage,connectorSources,officialSources:{staticCache:Boolean(Object.keys(staticOfficial.metrics||{}).length),bls:connectorSources.bls.status!=='offline',fred:connectorSources.fred.status!=='offline',dol:connectorSources.dol.status!=='offline',bea:connectorSources.bea.status!=='offline',federalReserve:connectorSources.federalReserve.status!=='offline',census:connectorSources.census.status!=='offline',fredErrors:{},staticErrors:staticOfficial.errors||{}}},200,{'cache-control':'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0','cdn-cache-control':'no-store','cloudflare-cdn-cache-control':'no-store'});
}
export async function onRequestPost({request,env}){
  const debug={
    engineVersion:'stable-data-phase1.4-admin-health-final',
    step:'start',
    timestamp:new Date().toISOString(),
    kvBound:Boolean(env&&env.GH_MARKET_DATA)
  };
  try{
    debug.step='authorize';
    if(!authorized(request,env))return json({error:'Incorrect PIN, or ADMIN_PIN is not configured.',debug},401,{'cache-control':'no-store'});

    debug.step='check-kv-binding';
    if(!env.GH_MARKET_DATA)return json({error:'GH_MARKET_DATA KV binding is not configured in Cloudflare.',debug},503,{'cache-control':'no-store'});

    debug.step='parse-request-json';
    let body;
    try{
      body=await request.json();
    }catch(error){
      debug.exception={name:error?.name||'Error',message:error?.message||String(error)};
      return json({error:'Invalid request JSON.',debug},400,{'cache-control':'no-store'});
    }

    debug.step='validate-events';
    const rows=Array.isArray(body?.events)?body.events:[];
    debug.receivedEventCount=rows.length;
    if(!rows.length)return json({error:'No events supplied.',debug},400,{'cache-control':'no-store'});

    debug.step='build-overrides';
    const overrides={};
    for(const raw of rows.slice(0,500)){
      const type=canonicalType(raw);
      const period=clean(raw?.releasePeriod,30);
      const id=clean(raw?.id,160);
      const value={
        forecast:clean(raw?.forecast,80),
        datetime:clean(raw?.datetime,50),
        releaseForecasts:{},
        updatedAt:new Date().toISOString()
      };
      if(raw?.releaseForecasts&&typeof raw.releaseForecasts==='object'){
        for(const [k,v] of Object.entries(raw.releaseForecasts).slice(0,100)){
          const periodKey=clean(k,30);
          if(periodKey)value.releaseForecasts[periodKey]=clean(v,80);
        }
      }
      const keys=[type&&period?`${type}|${period}`:'',id].filter(Boolean);
      for(const key of keys)overrides[key]=value;
    }

    const updatedAt=new Date().toISOString();
    const payload={version:'stable-data-phase1.2-fomc-history-fixed',updatedAt,overrides};
    const serialized=JSON.stringify(payload);
    debug.overrideCount=Object.keys(overrides).length;
    debug.payloadBytes=new TextEncoder().encode(serialized).length;
    debug.kvKey=ADMIN_OVERRIDES_KEY;

    debug.step='kv-read-existing';
    let existing=null;
    try{existing=await env.GH_MARKET_DATA.get(ADMIN_OVERRIDES_KEY,{type:'json'});}catch{}
    if(existing&&sameMeaningfulData(existing,payload)){
      debug.step='complete-no-change';
      debug.writeSkipped=true;
      return json({ok:true,unchanged:true,version:'stable-data-phase1.2-fomc-history-fixed',count:Object.keys(overrides).length,updatedAt:existing.updatedAt||updatedAt,overrides:existing.overrides||{},debug},200,{'cache-control':'no-store'});
    }

    debug.step='kv-put';
    await env.GH_MARKET_DATA.put(ADMIN_OVERRIDES_KEY,serialized);

    debug.step='kv-readback';
    const verify=await env.GH_MARKET_DATA.get(ADMIN_OVERRIDES_KEY,{type:'json'});
    debug.readbackPresent=Boolean(verify);
    debug.readbackVersion=verify?.version||null;

    debug.step='verify-readback';
    if(!verify||verify.version!=='stable-data-phase1.2-fomc-history-fixed'){
      return json({error:'KV write verification failed.',debug},500,{'cache-control':'no-store'});
    }

    debug.step='complete';
    return json({ok:true,version:'stable-data-phase1.2-fomc-history-fixed',count:Object.keys(overrides).length,updatedAt,overrides:verify.overrides||{},debug},200,{'cache-control':'no-store'});
  }catch(error){
    debug.failedAt=debug.step;
    debug.exception={
      name:error?.name||'Error',
      message:error?.message||String(error),
      stack:String(error?.stack||'').split('\\n').slice(0,8).join('\\n')
    };
    console.error('Gold Hunter forecast save failed',debug);
    return json({error:'Forecast save failed inside Cloudflare Function.',debug},500,{'cache-control':'no-store'});
  }
}
