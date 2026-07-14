const STATIC_URL='/assets/data/central-bank-gold-reserves.json?v=stable-data-1';
const KV_KEY='central-bank-gold-reserves-v1';
const ENGINE_VERSION='stable-data-1';
const headers={'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=900, s-maxage=3600','access-control-allow-origin':'*'};
const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers});
function valid(d){return Array.isArray(d?.records)&&d.records.length>=5&&d.records.every(r=>r.country&&Number.isFinite(Number(r.holdingsTonnes))&&Number(r.holdingsTonnes)>0)}
function updatedMs(d){return Math.max(0,...[d?.updatedAt,d?.sourceUpdatedAt,d?.dataDate,d?.asOf].map(v=>Date.parse(v||0)).filter(Number.isFinite))}
export async function onRequestGet({request,env}){
  const checkedAt=new Date().toISOString();
  let staticData=null,kvData=null,staticError='',kvError='';
  try{const u=new URL(STATIC_URL,new URL(request.url).origin);const r=await fetch(u.toString(),{headers:{accept:'application/json'},cf:{cacheTtl:900,cacheEverything:true}});if(!r.ok)throw new Error(`static HTTP ${r.status}`);const d=await r.json();if(valid(d))staticData=d;else throw new Error('static payload invalid');}catch(e){staticError=String(e?.message||e)}
  if(env.GH_MARKET_DATA){try{const d=await env.GH_MARKET_DATA.get(KV_KEY,{type:'json'});if(valid(d))kvData=d;}catch(e){kvError=String(e?.message||e)}}
  const candidates=[['static',staticData],['kv-cache',kvData]].filter(([,d])=>d).sort((a,b)=>updatedMs(b[1])-updatedMs(a[1]));
  const [sourceMode,chosen]=candidates[0]||[];
  if(!chosen)return json({engineVersion:ENGINE_VERSION,records:[],source:'World Gold Council / IMF IFS',sourceUrl:'https://www.gold.org/goldhub/data/gold-reserves-by-country',updatedAt:null,lastCheckedAt:checkedAt,status:'offline',sourceStatus:'offline',kvWrite:false,error:[staticError,kvError].filter(Boolean).join(' | '),message:'Central-bank gold reserves are waiting for the first verified sync.'});
  return json({...chosen,engineVersion:ENGINE_VERSION,status:sourceMode==='static'?'live':'cached',sourceStatus:sourceMode==='static'?'live':'cached',sourceMode,lastCheckedAt:checkedAt,lastSuccessfulUpdateAt:chosen.updatedAt||chosen.sourceUpdatedAt||chosen.dataDate||chosen.asOf||null,kvWrite:false,writePolicy:'read-only API; scheduled workflow updates verified static snapshot',errors:[staticError,kvError].filter(Boolean)});
}
