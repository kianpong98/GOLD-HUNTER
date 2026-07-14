const STATIC_URL='/assets/data/spdr-gld-holdings.json?v=stable-data-1';
const KV_KEY='spdr-gld-holdings-v1';
const ENGINE_VERSION='stable-data-1';
const headers={'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=300, s-maxage=900','access-control-allow-origin':'*'};
const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers});
function valid(d){return Array.isArray(d?.records)&&d.records.some(r=>Number.isFinite(Number(r.holdings))&&r.date)}
function latestDate(d){const rows=Array.isArray(d?.records)?d.records:[];return rows.reduce((m,r)=>String(r?.date||'')>m?String(r.date):m,'')}
function updatedMs(d){const values=[d?.updatedAt,d?.sourceUpdatedAt,latestDate(d)].map(v=>Date.parse(v||0)).filter(Number.isFinite);return values.length?Math.max(...values):0}
export async function onRequestGet({request,env}){
  const checkedAt=new Date().toISOString();
  let staticData=null,kvData=null,staticError='',kvError='';
  try{const u=new URL(STATIC_URL,new URL(request.url).origin);const r=await fetch(u.toString(),{headers:{accept:'application/json'},cf:{cacheTtl:300,cacheEverything:true}});if(!r.ok)throw new Error(`static HTTP ${r.status}`);const d=await r.json();if(valid(d))staticData=d;else throw new Error('static payload invalid');}catch(e){staticError=String(e?.message||e)}
  if(env.GH_MARKET_DATA){try{const d=await env.GH_MARKET_DATA.get(KV_KEY,{type:'json'});if(valid(d))kvData=d;}catch(e){kvError=String(e?.message||e)}}
  const candidates=[['static',staticData],['kv-cache',kvData]].filter(([,d])=>d).sort((a,b)=>updatedMs(b[1])-updatedMs(a[1]));
  const [sourceMode,chosen]=candidates[0]||[];
  if(!chosen)return json({engineVersion:ENGINE_VERSION,records:[],source:'SPDR Gold Shares',sourceUrl:'https://www.spdrgoldshares.com/usa/gld/',updatedAt:null,lastCheckedAt:checkedAt,status:'offline',sourceStatus:'offline',kvWrite:false,error:[staticError,kvError].filter(Boolean).join(' | '),message:'ETF data is waiting for the official daily sync.'},200);
  const officialDate=latestDate(chosen);
  return json({...chosen,engineVersion:ENGINE_VERSION,status:sourceMode==='static'?'live':'cached',sourceStatus:sourceMode==='static'?'live':'cached',sourceMode,officialDate,lastCheckedAt:checkedAt,lastSuccessfulUpdateAt:chosen.updatedAt||chosen.sourceUpdatedAt||officialDate||null,kvWrite:false,writePolicy:'read-only API; GitHub workflow updates static snapshot only',errors:[staticError,kvError].filter(Boolean)});
}
