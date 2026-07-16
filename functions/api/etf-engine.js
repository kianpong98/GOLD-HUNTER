const STATIC_URL='/assets/data/spdr-gld-holdings.json?v=etf-stable-2';
const KV_KEY='spdr-gld-holdings-v1';
const ENGINE_VERSION='etf-stable-2';
const headers={
  'content-type':'application/json; charset=utf-8',
  'cache-control':'public, max-age=120, s-maxage=300, stale-while-revalidate=1800',
  'access-control-allow-origin':'*'
};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
function valid(data){
  return Array.isArray(data?.records)
    && data.records.length>=2
    && data.records.every(row=>/^\d{4}-\d{2}-\d{2}$/.test(String(row?.date||''))&&Number.isFinite(Number(row?.holdings))&&Number(row.holdings)>100&&Number(row.holdings)<5000);
}
function latestDate(data){
  return (Array.isArray(data?.records)?data.records:[]).reduce((max,row)=>String(row?.date||'')>max?String(row.date):max,'');
}
function freshnessMs(data){
  const values=[data?.updatedAt,data?.sourceUpdatedAt,latestDate(data)].map(value=>Date.parse(value||0)).filter(Number.isFinite);
  return values.length?Math.max(...values):0;
}
export async function onRequestGet({request,env}){
  const lastCheckedAt=new Date().toISOString();
  let staticData=null,kvData=null,staticError='',kvError='';
  try{
    const url=new URL(STATIC_URL,new URL(request.url).origin);
    url.searchParams.set('_',String(Math.floor(Date.now()/300000)));
    const response=await fetch(url.toString(),{headers:{accept:'application/json'},cf:{cacheTtl:300,cacheEverything:true}});
    if(!response.ok)throw new Error(`static HTTP ${response.status}`);
    const data=await response.json();
    if(!valid(data))throw new Error('static ETF payload invalid or empty');
    staticData=data;
  }catch(error){staticError=String(error?.message||error)}
  if(env.GH_MARKET_DATA){
    try{
      const data=await env.GH_MARKET_DATA.get(KV_KEY,{type:'json'});
      if(valid(data))kvData=data;
    }catch(error){kvError=String(error?.message||error)}
  }
  const candidates=[['official-static',staticData],['legacy-kv-cache',kvData]]
    .filter(([,data])=>data)
    .sort((a,b)=>freshnessMs(b[1])-freshnessMs(a[1]));
  const [sourceMode,chosen]=candidates[0]||[];
  if(!chosen){
    return json({engineVersion:ENGINE_VERSION,records:[],source:'SPDR Gold Shares',sourceUrl:'https://www.spdrgoldshares.com/usa/gld/',updatedAt:null,officialDate:null,lastCheckedAt,status:'offline',sourceStatus:'offline',kvWrite:false,error:[staticError,kvError].filter(Boolean).join(' | '),message:'ETF data is waiting for the official archive sync.'});
  }
  const officialDate=latestDate(chosen);
  const records=[...chosen.records].sort((a,b)=>String(a.date).localeCompare(String(b.date))).slice(-30);
  const latest=records.at(-1),previous=records.at(-2);
  const dailyChange=previous?Number((Number(latest.holdings)-Number(previous.holdings)).toFixed(3)):Number(chosen.dailyChange||0);
  return json({
    ...chosen,
    records,
    engineVersion:ENGINE_VERSION,
    status:sourceMode==='official-static'?'live':'cached',
    sourceStatus:sourceMode==='official-static'?'live':'cached',
    sourceMode,
    officialDate,
    latestHoldings:Number(latest.holdings),
    dailyChange,
    lastCheckedAt,
    lastSuccessfulUpdateAt:chosen.lastSuccessfulConnectionAt||chosen.checkedAt||chosen.updatedAt||chosen.sourceUpdatedAt||officialDate||null,
    lastSuccessfulConnectionAt:chosen.lastSuccessfulConnectionAt||chosen.checkedAt||chosen.updatedAt||null,
    dataUpdatedAt:chosen.dataUpdatedAt||chosen.updatedAt||null,
    kvWrite:false,
    writePolicy:'read-only API; scheduled GitHub workflow commits only changed official records',
    errors:[staticError,kvError].filter(Boolean)
  });
}
