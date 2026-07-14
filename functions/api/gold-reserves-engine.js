const STATIC_URL='/assets/data/central-bank-gold-reserves.json?v=gold-reserves-stable-1';
const KV_KEY='central-bank-gold-reserves-v1';
const ENGINE_VERSION='gold-reserves-stable-1';
const headers={'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=900, s-maxage=3600, stale-while-revalidate=86400','access-control-allow-origin':'*'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
function valid(data){return Array.isArray(data?.records)&&data.records.length>=5&&data.records.every(row=>row?.country&&Number.isFinite(Number(row?.holdingsTonnes))&&Number(row.holdingsTonnes)>0&&Number(row.holdingsTonnes)<20000)}
function freshness(data){return Math.max(...[data?.updatedAt,data?.checkedAt].map(v=>Date.parse(v||0)).filter(Number.isFinite),0)}
export async function onRequestGet({request,env}){
  const lastCheckedAt=new Date().toISOString();
  let staticData=null,legacyKv=null,staticError='',kvError='';
  try{
    const url=new URL(STATIC_URL,new URL(request.url).origin);
    url.searchParams.set('_',String(Math.floor(Date.now()/3600000)));
    const response=await fetch(url.toString(),{headers:{accept:'application/json'},cf:{cacheTtl:3600,cacheEverything:true}});
    if(!response.ok)throw new Error(`static HTTP ${response.status}`);
    const data=await response.json();
    if(!valid(data))throw new Error('static central-bank payload invalid');
    staticData=data;
  }catch(error){staticError=String(error?.message||error)}
  if(env.GH_MARKET_DATA){
    try{const data=await env.GH_MARKET_DATA.get(KV_KEY,{type:'json'});if(valid(data))legacyKv=data;}catch(error){kvError=String(error?.message||error)}
  }
  const candidates=[['official-static',staticData],['legacy-kv-cache',legacyKv]].filter(([,data])=>data).sort((a,b)=>freshness(b[1])-freshness(a[1]));
  const [sourceMode,chosen]=candidates[0]||[];
  if(!chosen)return json({engineVersion:ENGINE_VERSION,records:[],source:'World Gold Council / IMF IFS',sourceUrl:'https://www.gold.org/goldhub/data/gold-reserves-by-country',updatedAt:null,lastCheckedAt,status:'offline',sourceStatus:'offline',kvWrite:false,error:[staticError,kvError].filter(Boolean).join(' | '),message:'Central-bank gold reserves are waiting for a verified scheduled sync.'},503);
  return json({...chosen,engineVersion:ENGINE_VERSION,status:sourceMode==='official-static'?'live':'cached',sourceStatus:sourceMode==='official-static'?'live':'cached',sourceMode,lastCheckedAt,lastSuccessfulUpdateAt:chosen.updatedAt||chosen.checkedAt||null,kvWrite:false,writePolicy:'read-only API; scheduled GitHub workflow commits only validated source changes',errors:[staticError,kvError].filter(Boolean)});
}
