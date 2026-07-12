const STATIC_URL='/assets/data/central-bank-gold-reserves.json?v=1';
const KV_KEY='central-bank-gold-reserves-v1';
const headers={'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=900, s-maxage=3600','access-control-allow-origin':'*'};
const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers});
function valid(d){return Array.isArray(d?.records)&&d.records.some(r=>r.country&&Number.isFinite(Number(r.holdingsTonnes)))}
export async function onRequestGet({request,env}){
  let staticData=null,kvData=null;
  try{const u=new URL(STATIC_URL,new URL(request.url).origin);const r=await fetch(u.toString(),{headers:{accept:'application/json'}});if(r.ok){const d=await r.json();if(valid(d))staticData=d;}}catch{}
  if(env.GH_MARKET_DATA){try{const d=await env.GH_MARKET_DATA.get(KV_KEY,{type:'json'});if(valid(d))kvData=d;}catch{}}
  const candidates=[staticData,kvData].filter(Boolean).sort((a,b)=>Date.parse(b.updatedAt||0)-Date.parse(a.updatedAt||0));
  const chosen=candidates[0];
  if(!chosen)return json({records:[],source:'World Gold Council / IMF IFS',sourceUrl:'https://www.gold.org/goldhub/data/gold-reserves-by-country',updatedAt:null,status:'awaiting_sync',message:'Central-bank gold reserves are waiting for the first official monthly sync.'});
  if(env.GH_MARKET_DATA&&staticData&&(!kvData||Date.parse(staticData.updatedAt||0)>Date.parse(kvData.updatedAt||0))){try{await env.GH_MARKET_DATA.put(KV_KEY,JSON.stringify(staticData),{expirationTtl:7776000});}catch{}}
  return json({...chosen,status:'ready'});
}
