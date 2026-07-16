const STATIC_URL='/assets/data/central-bank-gold-reserves.json?v=gold-reserves-stable-1.1';
const ENGINE_VERSION='gold-reserves-stable-1.1';
const headers={'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=900, s-maxage=3600, stale-while-revalidate=86400','access-control-allow-origin':'*'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
function valid(data){return Array.isArray(data?.records)&&data.records.length>=5&&data.records.every(row=>row?.country&&Number.isFinite(Number(row?.holdingsTonnes))&&Number(row.holdingsTonnes)>0&&Number(row.holdingsTonnes)<20000)}
export async function onRequestGet({request}){
  const lastCheckedAt=new Date().toISOString();
  try{
    const url=new URL(STATIC_URL,new URL(request.url).origin);
    url.searchParams.set('_',String(Math.floor(Date.now()/3600000)));
    const response=await fetch(url.toString(),{headers:{accept:'application/json'},cf:{cacheTtl:3600,cacheEverything:true}});
    if(!response.ok)throw new Error(`static HTTP ${response.status}`);
    const data=await response.json();
    if(!valid(data))throw new Error('static central-bank payload invalid');
    const checked=Date.parse(data.checkedAt||data.updatedAt||0);
    const ageMinutes=Number.isFinite(checked)?Math.round((Date.now()-checked)/60000):null;
    const githubSynced=data.sourceMode==='official-github-sync'||data.sourceMode==='official-github-partial-sync';
    const sourceStatus=!githubSynced?'cached':ageMinutes!==null&&ageMinutes<=60*24*10?'live':'cached';
    return json({...data,engineVersion:ENGINE_VERSION,status:sourceStatus,sourceStatus,sourceMode:data.sourceMode||'verified-static-snapshot',githubSynced,lastCheckedAt,lastSuccessfulUpdateAt:data.lastSuccessfulConnectionAt||data.checkedAt||data.updatedAt||null,lastSuccessfulConnectionAt:data.lastSuccessfulConnectionAt||data.checkedAt||data.updatedAt||null,dataUpdatedAt:data.dataUpdatedAt||data.updatedAt||null,sourceAgeMinutes:ageMinutes,kvWrite:false,writePolicy:'read-only API; GitHub Actions commits only validated source changes; legacy KV is ignored',errors:Array.isArray(data?.refresh?.errors)?data.refresh.errors:[]});
  }catch(error){
    return json({engineVersion:ENGINE_VERSION,records:[],source:'World Gold Council / IMF IFS',sourceUrl:'https://www.gold.org/goldhub/data/gold-reserves-by-country',updatedAt:null,lastCheckedAt,status:'offline',sourceStatus:'offline',sourceMode:'official-static-unavailable',githubSynced:false,kvWrite:false,error:String(error?.message||error),message:'Central-bank gold reserves are waiting for a verified GitHub snapshot.'},503);
  }
}
